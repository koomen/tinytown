"""Stage 5 without the model: blueprint lint, geometry audit, render evidence, review records, repair policy.

    town lint <site> [IDS...] [--merged] [-q]      check drafts (or the blueprints in overrides.json)
    town review <site> IDS... [--stage detail] [--record]

Lint errors are things the renderer will get wrong or throw on: bad JSON,
unknown face names, fractions outside 0..1, ranges with a <= b reversed,
missing volumes, u/v not [lo, hi], invalid enum values, colours that are
neither `#rrggbb` nor a swatch in src/colors.js. Warnings are things that
usually mean a mistake: keys the schema does not know (typos), volumes
sticking well outside the footprint's bounding box, the union of volumes
covering little of the footprint (u and v swapped?), storeys above the eaves,
windows too wide for their face, a door landing on a ground-floor window,
very many windows (vertex budget). The schema is documented in
docs/BLUEPRINT_SCHEMA.md.

The geometry audit lists conservative candidate defects (openings crossing a
wall end, overlapping windows, coplanar walls) for visual triage.

A review is recorded per building in buildings/<id>/review.json (see
`write_review`); `state.building_status` derives `needs-repair`/`reviewed`
from its `draft_hash` and `passed` fields. Repairs are counted by which
buildings/<id>/repair-<n>.json files exist. The model-based visual review
itself lives in author.py; this module only judges files.

Standard library only. `render.renderer_signature` is imported lazily.
"""
import copy
import hashlib
import json
import math
from pathlib import Path
import re
import time

from .paths import ROOT, SitePaths, site_paths
from .site import FACE_NAMES, find_building, load_overrides, load_site, polygon_uv
from .state import atomic_json, building_frame, fingerprint, read_json

# --- blueprint lint -----------------------------------------------------------

FACES = FACE_NAMES
PROTRUDING = re.compile(r"porch|stoop|portico|canopy|step|vestibule|bay", re.I)  # volumes allowed outside the footprint

KEYS = {
    "top": {"wall", "wallMaterial", "trim", "roofColor", "volumes", "porches", "details", "notes", "id", "name", "_comment", "bridge", "pavilion", "fountain", "amphitheater", "athenaeumFront", "alumniHallBalcony", "lennaHall", "hultquistCenter"},
    "fountain": {"height", "basinHeight", "rimWidth", "pylonWidth", "stoneColor", "brickColor", "waterColor", "jets"},
    "amphitheater": {"axis", "stageEnd", "height", "roofRise", "backstageDepth", "bowlDepth", "audienceChamfer", "rearWingChamfer", "porchDepth", "rows", "monitor", "wallColor", "trimColor", "roofColor", "seatColor", "stringLightSpacing", "interiorLighting"},
    "pavilion": {"axis", "height", "pitch", "postWidth", "bents", "floorH", "floorColor", "furniture", "columns", "columnColor", "trimColor", "endPosts", "roofType", "seatingRows", "entranceEnd", "railing", "railingStyle", "entranceStairs", "wallH"},
    "pavilion.stairs": {"length", "width", "bottomY", "foundationDepth", "railing"},
    "bridge": {"type", "axis", "height", "arches", "pierWidth", "archRise", "deckThickness", "tracks", "railing", "girderHeight", "abutmentWidth", "wingWalls", "approaches", "approachLength", "approachWidth", "approachPlateau"},
    "volume": {"id", "u", "v", "polygon", "height", "bottom", "wall", "wallMaterial", "upperWall", "split", "trim", "roof", "cornice", "plinth",
               "beltCourses", "cupola", "towers", "chimneys", "faces", "_comment"},
    "roof": {"type", "ridge", "pitch", "maxH", "color", "overhang", "cross", "crossEnd", "crossSize", "crossColor",
             "gableColor", "lip", "flatTop", "h", "run", "inset", "capColor", "dormers", "kneeH", "kneeIn"},
    "dormers": {"faces", "count", "at", "w", "h", "type", "color", "trim", "roofColor", "y", "style", "depth"},
    "cornice": {"height", "overhang", "dentils", "color"},
    "plinth": {"height", "color"},
    "beltCourse": {"y", "height", "color"},
    "cupola": {"width", "color", "u", "v"},
    "tower": {"u", "v", "w", "height", "wall", "spire", "spireH", "cross", "crossColor", "windows", "windowType"},
    "chimney": {"u", "v"},
    "face": {"trim", "storeys", "doors", "storefronts", "awnings", "parapets", "signs", "pilasters", "buttresses",
             "porches", "bays", "moldings", "arcade", "_comment"},
    "arcade": {"at", "w", "h", "y", "depth", "trim", "surroundW", "backColor", "floorColor", "door", "approachDepth"},
    "bay": {"at", "w", "d", "y0", "y1", "h", "storeys", "count", "sides", "roof", "pitch", "color", "trim", "roofColor", "_comment"},
    "storey": {"y", "skip", "windows", "out", "_comment"},
    "windows": {"type", "w", "h", "count", "margin", "at", "center", "spread", "trim", "glass", "frameW", "hood",
                "shutters", "keystone", "mullions", "mullionColor", "sill", "planter", "transomY", "tracery", "traceryColor", "divisions", "interior"},
    "door": {"at", "type", "w", "h", "color", "surround", "surroundW", "steps", "fanlight", "lamp", "y", "groundEntrance", "panels", "lights", "_comment"},
    "storefront": {"range", "y", "h", "frame", "kick"},
    "awning": {"range", "y", "depth", "color", "stripes", "type", "rise", "trim", "posts", "brand"},
    "parapet": {"type", "at", "width", "height", "depth", "color", "trim", "cross", "crossSize", "crossColor",
                "text", "textStyle", "roundel", "outline", "trimWidth", "trimDepth"},
    "sign": {"text", "image", "brand", "style", "shape", "at", "y", "w", "h", "opts", "out", "_comment"},
    "pilasters": {"at", "w", "d", "height", "color", "cap", "capHeight", "capOverhang", "fitUnderEave"},
    "buttresses": {"at", "w", "d", "height", "color"},
    "porch": {"at", "range", "w", "d", "height", "pitch", "cross", "wall", "trim", "roofColor", "gableColor", "door",
              "style", "floorH", "floorThickness", "floorColor", "posts", "postColor", "roof", "railing", "railSides", "sideRailGaps", "railingGap", "steps", "stepsAt", "stepsW",
              "face", "u", "v", "wall_color", "_comment"},
    "detail": {"type", "text", "style", "u", "v", "w", "h", "rotation", "size", "height", "color", "y", "opts", "shape", "postHeight",
               "length", "dir", "landing", "railing", "railColor", "construction", "railSides", "foundationDepth"},
}
ENUMS = {
    "window.type": {"rect", "arch", "gothic", "round", "shop", "basement", "clock"},
    "door.type": {"rect", "arch", "gothic", "double", "garage"},
    "roof.type": {"none", "flat", "gable", "hip", "mansard", "gambrel", "barrel"},
    "wallMaterial": {"siding", "vertical-wood", "brick", "stone", "plaster"},
    "roof.ridge": {"u", "v"},
    "parapet.type": {"pediment", "mission", "arch", "stepped", "flat"},
    "sign.style": {"gold-on-black", "carved", "stone", "board", "red", "navy", "green", "bronze", "ghost"},
    "sign.shape": {"plaque", "arch", "rect", "cutout"},
    "detail.type": {"lawnsign", "cross", "bush", "flag", "ramp", "stair", "landing", "keyboard-tribute"},
    "detail.construction": {"solid", "open"},
    "porch.style": {"open", "carport"},
    "porch.roof": {"hip", "flat", "gable", "shed", "main", "none"},
    "bay.roof": {"hip", "flat", "none"},
    "awning.type": {"sloped", "barrel"},
    "dormers.style": {"gable", "shed"},
}

def swatches(root=ROOT):
    src = (Path(root) / "src" / "colors.js").read_text()
    return set(re.findall(r"\b([a-z]+):\s*(?:0x[0-9a-fA-F]{6}|null)", src))


SWATCHES = swatches()


class Lint:
    def __init__(self, label):
        self.label = label
        self.errors, self.warnings = [], []

    def err(self, where, msg):
        self.errors.append(f"{where}: {msg}")

    def warn(self, where, msg):
        self.warnings.append(f"{where}: {msg}")

    def keys(self, obj, kind, where):
        if not isinstance(obj, dict):
            self.err(where, f"expected an object for {kind}, got {type(obj).__name__}")
            return False
        for k in obj:
            if k not in KEYS[kind]:
                self.warn(where, f"unknown key `{k}` (schema {kind} has: {', '.join(sorted(KEYS[kind]))})")
        return True

    def color(self, v, where):
        if v is None or v is True or v is False:
            return
        if isinstance(v, (int, float)):
            return
        if isinstance(v, str):
            if re.fullmatch(r"#[0-9a-fA-F]{6}", v) or v in SWATCHES:
                return
            self.err(where, f"colour `{v}` is neither #rrggbb nor a swatch ({', '.join(sorted(SWATCHES))})")
        else:
            self.err(where, f"colour must be a string, got {type(v).__name__}")

    def frac(self, v, where, name="at"):
        if not isinstance(v, (int, float)):
            self.err(where, f"`{name}` must be a number 0..1, got {v!r}")
        elif not -0.03 <= v <= 1.03:
            self.err(where, f"`{name}` = {v} is outside 0..1 (fractions run left→right along the face)")

    def rng(self, v, where):
        if not (isinstance(v, list) and len(v) == 2 and all(isinstance(x, (int, float)) for x in v)):
            self.err(where, f"`range` must be [a, b], got {v!r}")
            return
        self.frac(v[0], where, "range[0]"); self.frac(v[1], where, "range[1]")
        if v[0] >= v[1]:
            self.err(where, f"`range` [{v[0]}, {v[1]}] must have a < b")

    def enum(self, v, key, where):
        if v is not None and v not in ENUMS[key]:
            self.err(where, f"`{key.split('.')[1]}` = {v!r} not one of {sorted(ENUMS[key])}")

    def num(self, v, where, name, lo=None, hi=None, allow_none=True):
        if v is None and allow_none:
            return
        if not isinstance(v, (int, float)):
            self.err(where, f"`{name}` must be a number, got {v!r}")
            return
        if lo is not None and v < lo:
            self.err(where, f"`{name}` = {v} is below {lo}")
        if hi is not None and v > hi:
            self.warn(where, f"`{name}` = {v} is above {hi} — check units (metres)")


def lint_face(L, spec, key, vol, where, L_face, H):
    if spec == "blank" or spec is None:
        return
    if not L.keys(spec, "face", where):
        return
    arcade = spec.get("arcade")
    if arcade is not None and L.keys(arcade, "arcade", where + ".arcade"):
        aw = where + ".arcade"
        if vol.get("polygon") or vol.get("upperWall") or key not in FACES:
            L.err(aw, "arcades require an explicit face on a rectangular unsplit volume")
        if sum(isinstance(s, dict) and bool(s.get("arcade")) for s in vol.get("faces", {}).values()) != 1:
            L.err(aw, "only one arcade face is supported per volume")
        vals = [arcade.get(k) for k in ("w", "h", "depth")]
        valid = all(type(v) in (int, float) and math.isfinite(v) and v > 0 for v in vals)
        if not valid:
            L.err(aw, "w, h and depth must be finite positive metres")
        y = arcade.get("y", 0)
        if type(y) not in (int, float) or not math.isfinite(y):
            L.err(aw, "y must be finite metres")
            valid = False
        positions = arcade.get("at")
        if not isinstance(positions, list) or not positions or not all(type(f) in (int, float) and math.isfinite(f) and 0 < f < 1 for f in positions):
            L.err(aw, "at must be a nonempty array of fractions strictly inside 0..1")
        elif valid:
            width, height, depth = vals
            if height < width / 2 or y <= vol.get("bottom", -1.2) or y + height >= H:
                L.err(aw, "the complete arch must fit inside the volume wall")
            if key in FACES and not vol.get("polygon"):
                span = vol["u"] if key[1] == "u" else vol["v"]
                if depth >= span[1] - span[0]:
                    L.err(aw, "depth must leave a solid back wall inside the volume")
            if any(min(f, 1 - f) * L_face <= width / 2 for f in positions):
                L.err(aw, "an arch extends beyond the face")
            if any((b - a) * L_face <= width for a, b in zip(sorted(positions), sorted(positions)[1:])):
                L.err(aw, "arcade openings overlap")
            if vol.get("plinth", {}).get("height", 0) > y or any(bc.get("y", 0) - bc.get("height", .22) / 2 < y + height and bc.get("y", 0) + bc.get("height", .22) / 2 > y for bc in vol.get("beltCourses", [])):
                L.err(aw, "plinth or belt course intersects an arcade opening")
        for color in ("trim", "backColor", "floorColor"):
            L.color(arcade.get(color), aw + "." + color)
        L.num(arcade.get("surroundW"), aw, "surroundW", .02, .5)
        L.num(arcade.get("approachDepth"), aw, "approachDepth", 0, 20)
        door = arcade.get("door")
        if door is not None and L.keys(door, "door", aw + ".door"):
            L.enum(door.get("type"), "door.type", aw + ".door")
            for color in ("color", "surround"):
                L.color(door.get(color), aw + ".door." + color)
            if valid and (door.get("w", 1.8 if door.get("type") == "double" else 1.2) >= vals[0] or door.get("h", 2.5) >= vals[1] - vals[0] / 2):
                L.err(aw, "recessed door must fit below the arch springline")
            if any(k in door for k in ("at", "y", "steps")):
                L.err(aw, "arcade positions and floor determine door placement; omit door at/y/steps")
    ground_windows = []
    for i, molding in enumerate(spec.get('moldings', [])):
        where_m = f'{where}.moldings[{i}]'
        L.rng(molding.get('range', [0,1]), where_m)
        L.num(molding.get('y'), where_m, 'y', 0, H+10, allow_none=False)
        L.color(molding.get('color'), where_m)
        profile = molding.get('profile')
        if not isinstance(profile, list) or not 1 <= len(profile) <= 12:
            L.err(where_m, 'molding profile needs 1..12 courses')
        else:
            for course in profile:
                if not isinstance(course, dict) or set(course) != {'height','depth'}:
                    L.err(where_m, 'each course needs height and depth')
                else:
                    L.num(course['height'], where_m, 'height', .01, 1, allow_none=False)
                    L.num(course['depth'], where_m, 'depth', .01, 1, allow_none=False)
    for i, st in enumerate(spec.get("storeys") or []):
        w = f"{where}.storeys[{i}]"
        if not L.keys(st, "storey", w):
            continue
        L.num(st.get("y"), w, "y", 0, 30, allow_none=False)
        win = st.get("windows")
        if win is None:
            L.warn(w, "storey without `windows`")
            continue
        if not L.keys(win, "windows", w + ".windows"):
            continue
        L.enum(win.get("type"), "window.type", w)
        if 'interior' in win and not isinstance(win['interior'], bool):
            L.err(w, 'window interior must be true or false')
        tracery = win.get('tracery')
        if tracery is not None and not isinstance(tracery, bool) and tracery not in ('rose', 'quatrefoil'):
            L.err(w, 'tracery must be true, false, rose, or quatrefoil')
        if isinstance(tracery, str):
            if tracery == 'rose' and (win.get('type') != 'round' or abs(win.get('w', 1.1) - win.get('h', win.get('w', 1.1))) > 0.001):
                L.err(w, 'rose tracery requires a round window with equal width and height')
            if tracery == 'quatrefoil' and (win.get('type') not in ('gothic', 'round') or win.get('h', 1.8) < win.get('w', 1.1)):
                L.err(w, 'quatrefoil tracery requires a round or gothic window at least as tall as it is wide')
        divisions = win.get('divisions')
        if divisions is not None:
            if not isinstance(divisions, dict) or set(divisions) - {'vertical','horizontal','width'}:
                L.err(w, 'divisions must contain vertical/horizontal fractions and optional width')
            else:
                for ax in ('vertical','horizontal'):
                    values = divisions.get(ax, [])
                    if not isinstance(values, list) or not all(type(x) in (int,float) and math.isfinite(x) and 0 < x < 1 for x in values) or values != sorted(set(values)) or len(values)>32:
                        L.err(w, f'{ax} divisions must be up to 32 sorted unique fractions strictly inside 0..1')
                L.num(divisions.get('width', .06), w, 'division width', .01, .2)
        for c in ("trim", "glass", "shutters", "mullionColor", "traceryColor"):
            L.color(win.get(c), f"{w}.windows.{c}")
        if isinstance(win.get("hood"), str):
            L.color(win["hood"], w + ".windows.hood")
        if isinstance(win.get("planter"), str):
            L.color(win["planter"], w + ".windows.planter")
        ww = win.get("w") or 1.1
        wh = win.get("h") or (0.7 if win.get("type") == "basement" else 2.4 if win.get("type") == "shop" else 1.8)
        fr = []
        if "at" in win:
            if not isinstance(win["at"], list):
                L.err(w, "`at` must be a list of fractions")
            else:
                for f in win["at"]:
                    L.frac(f, w + ".windows.at")
                fr = [f for f in win["at"] if isinstance(f, (int, float))]
        elif "spread" in win:
            n = win.get("count") or 3
            fr = [(win.get("center", 0.5)) + ((k - (n - 1) / 2) * win["spread"]) / L_face for k in range(n)]
            if fr and (min(fr) < -0.02 or max(fr) > 1.02):
                L.warn(w, f"clustered windows run off the face (fractions {min(fr):.2f}..{max(fr):.2f})")
        else:
            n = win.get("count") or max(1, int(L_face // 3))
            m = (win.get("margin", 0.9)) / L_face
            fr = [m + ((k + 0.5) / n) * (1 - 2 * m) for k in range(n)]
        if len(fr) * ww > L_face * 0.92:
            L.warn(w, f"{len(fr)} windows × {ww} m = {len(fr) * ww:.1f} m on a {L_face:.1f} m face — they will touch or overlap")
        roof = vol.get("roof") or {}
        top_ok = H + 0.3
        if roof.get("type") in ("gable", "gambrel") and key in FACES:
            W, D = vol["u"][1] - vol["u"][0], vol["v"][1] - vol["v"][0]
            ridge_u = (roof.get("ridge") or ("u" if W >= D else "v")) == "u"
            if key[1] == ("u" if ridge_u else "v"):  # a gable end: windows may rise into the gable
                top_ok = H + (roof.get("h") or min((D if ridge_u else W) * (roof.get("pitch") or (0.62 if roof.get("type") == "gambrel" else 0.55)), roof.get("maxH") or 9))
        elif roof.get("type") == "mansard":
            top_ok = H + (roof.get("h") or 2.6)
        if isinstance(st.get("y"), (int, float)) and st["y"] + wh > top_ok:
            L.warn(w, f"storey top {st['y'] + wh:.1f} m is above the eaves ({H} m) on a face that is not a gable end; it will poke out of the roof")
        for f in fr:
            if isinstance(st.get("y"), (int, float)) and st["y"] < 2.2:
                ground_windows.append((f, ww / L_face))
        for sk in st.get("skip") or []:
            if not (isinstance(sk, list) and len(sk) == 2):
                L.err(w, f"`skip` entries must be [a, b], got {sk!r}")
    for i, d in enumerate(spec.get("doors") or []):
        w = f"{where}.doors[{i}]"
        if not L.keys(d, "door", w):
            continue
        L.frac(d.get("at", 0.5), w)
        L.enum(d.get("type"), "door.type", w)
        L.color(d.get("color"), w + ".color"); L.color(d.get("surround"), w + ".surround")
        if "groundEntrance" in d and not isinstance(d["groundEntrance"], bool):
            L.err(w, "`groundEntrance` must be true or false")
        L.num(d.get("y"), w, "y", 0, H if d.get("groundEntrance") is True else 3)
        dw = (d.get("w") or (1.8 if d.get("type") == "double" else 2.6 if d.get("type") == "garage" else 1.2)) / L_face
        for f, ww in ground_windows:
            if abs(f - d.get("at", 0.5)) < (dw + ww) / 2 * 0.9:
                L.warn(w, f"door at {d.get('at', 0.5)} overlaps a ground-floor window at {f:.2f} (use `skip` on that storey)")
                break
    for i, s in enumerate(spec.get("storefronts") or []):
        w = f"{where}.storefronts[{i}]"
        if L.keys(s, "storefront", w):
            L.rng(s.get("range"), w); L.color(s.get("frame"), w + ".frame")
            if isinstance(s.get("kick"), str):
                L.color(s["kick"], w + ".kick")
    for i, s in enumerate(spec.get("awnings") or []):
        w = f"{where}.awnings[{i}]"
        if L.keys(s, "awning", w):
            L.rng(s.get("range"), w); L.color(s.get("color"), w + ".color"); L.color(s.get("stripes"), w + ".stripes")
            L.enum(s.get("type"), "awning.type", w); L.color(s.get("trim"), w + ".trim")
            if s.get("type") == "barrel":
                for key in ("rise", "depth"):
                    if key in s and (type(s[key]) not in (int, float) or not math.isfinite(s[key]) or s[key] <= 0):
                        L.err(w, f"barrel awning {key} must be a positive finite number")
                if "posts" in s and type(s["posts"]) is not bool:
                    L.err(w, "barrel awning posts must be boolean")
                if s.get("brand") not in (None, "athenaeum-hotel"):
                    L.err(w, "unknown barrel awning brand")
    for i, s in enumerate(spec.get("parapets") or []):
        w = f"{where}.parapets[{i}]"
        if L.keys(s, "parapet", w):
            L.enum(s.get("type"), "parapet.type", w); L.frac(s.get("at", 0.5), w)
            if 'outline' in s:
                pts = s['outline']
                if not isinstance(pts, list) or not 3 <= len(pts) <= 96:
                    L.err(w, 'custom outline needs 3..96 normalized CCW points')
                elif lint_polygon(L, [[p[0]*100,p[1]*100] for p in pts] if all(isinstance(p,list) and len(p)==2 and all(type(x) in (int,float) and math.isfinite(x) for x in p) for p in pts) else pts, w):
                    if any(not (-.5 <= x <= .5 and 0 <= y <= 1) for x,y in pts):
                        L.err(w, 'outline coordinates must have x in -0.5..0.5 and y in 0..1')
            L.num(s.get('trimWidth'), w, 'trimWidth', .01, .5)
            L.num(s.get('trimDepth'), w, 'trimDepth', .01, 1)
            L.color(s.get("color"), w + ".color"); L.color(s.get("trim"), w + ".trim")
            if s.get("width") not in (None, "full") and not isinstance(s.get("width"), (int, float)):
                L.err(w, "`width` must be metres or \"full\"")
    for i, s in enumerate(spec.get("signs") or []):
        w = f"{where}.signs[{i}]"
        if L.keys(s, "sign", w):
            if not s.get("text") and not s.get("image"):
                L.err(w, "sign without `text` or `image`")
            if s.get("shape") == "cutout" and not s.get("image"):
                L.err(w, "a cutout sign needs an `image` with a transparent background")
            L.enum(s.get("style"), "sign.style", w); L.enum(s.get("shape"), "sign.shape", w); L.frac(s.get("at", 0.5), w)
            L.num(s.get("y"), w, "y", 0, 30)
            if (s.get("w") or 4) > L_face * 1.05:
                L.warn(w, f"sign {s.get('w') or 4} m wide on a {L_face:.1f} m face")
    for k in ("pilasters", "buttresses"):
        if spec.get(k):
            w = f"{where}.{k}"
            if L.keys(spec[k], k, w):
                for f in spec[k].get("at") or []:
                    L.frac(f, w)
                L.color(spec[k].get("color"), w + ".color")
                if k == 'pilasters':
                    L.num(spec[k].get('capHeight'), w, 'capHeight', .02, 1)
                    L.num(spec[k].get('capOverhang'), w, 'capOverhang', 0, .5)
                    if 'fitUnderEave' in spec[k] and type(spec[k]['fitUnderEave']) is not bool:
                        L.err(w, 'fitUnderEave must be boolean')
    for i, by in enumerate(spec.get("bays") or []):
        w = f"{where}.bays[{i}]"
        if L.keys(by, "bay", w):
            L.frac(by.get("at", 0.5), w); L.enum(by.get("roof"), "bay.roof", w)
            L.num(by.get("w"), w, "w", 0.6, 8); L.num(by.get("d"), w, "d", 0.3, 3)
            for c in ("color", "trim", "roofColor"):
                L.color(by.get(c), f"{w}.{c}")
            y0, y1 = by.get("y0", 0), by.get("y1", (by.get("y0", 0) + by["h"]) if by.get("h") else H)
            if isinstance(y0, (int, float)) and isinstance(y1, (int, float)) and y1 <= y0:
                L.err(w, f"bay top {y1} must be above its bottom {y0}")
            for j, st in enumerate(by.get("storeys") or []):
                if L.keys(st, "storey", f"{w}.storeys[{j}]") and st.get("windows"):
                    L.keys(st["windows"], "windows", f"{w}.storeys[{j}].windows")
    for i, p in enumerate(spec.get("porches") or []):
        w = f"{where}.porches[{i}]"
        if L.keys(p, "porch", w):
            for k in ("face", "u", "v"):
                if k in p:
                    L.err(w, f"`{k}` belongs to a top-level `porches` entry (one that spans volumes), not a face porch")
            if "range" in p:
                L.rng(p["range"], w)
            else:
                L.frac(p.get("at", 0.5), w)
            L.enum(p.get("style"), "porch.style", w); L.enum(p.get("roof"), "porch.roof", w)
            lint_side_rail_gaps(L, p, w)
            if "railSides" in p and (not isinstance(p["railSides"], list) or any(s not in ("front", "left", "right") for s in p["railSides"])):
                L.err(w, "railSides must be an array of front/left/right (as viewed facing the wall)")
            if p.get("roof") == "shed": L.num(p.get("pitch", .25), w, "pitch", .05, 1)
            if p.get("roof") == "main":
                if vol.get("polygon") or (vol.get("roof") or {}).get("type") != "hip":
                    L.err(w, "a shared main roof requires a rectangular hip-roofed volume")
                if p.get("style") not in ("open", "carport") or p.get("range") != [0, 1]:
                    L.err(w, "a shared main roof requires a full-width open porch (range [0, 1])")
                if "height" in p:
                    L.warn(w, "shared-roof column height is set by the main cornice; omit height")
            if "floorThickness" in p:
                L.num(p["floorThickness"], w, "floorThickness", 0.05, 1, allow_none=False)
            for c in ("wall", "trim", "roofColor", "gableColor", "floorColor", "postColor"):
                L.color(p.get(c), f"{w}.{c}")
            if p.get("door"):
                L.keys(p["door"], "door", w + ".door")


def lint_side_rail_gaps(L, porch, where):
    if "sideRailGaps" not in porch:
        return
    gaps = porch["sideRailGaps"]
    if not isinstance(gaps, dict) or set(gaps) - {"left", "right"}:
        L.err(where, "sideRailGaps must map left/right to {at, w}")
        return
    for side, gap in gaps.items():
        w = f"{where}.sideRailGaps.{side}"
        if not isinstance(gap, dict) or set(gap) != {"at", "w"}:
            L.err(w, "expected {at, w}")
            continue
        L.frac(gap["at"], w)
        L.num(gap["w"], w, "w", .1, 10, allow_none=False)


def lint_polygon(L, pts, where):
    """A simple, CCW ring. Edge indices remain stable for facade references."""
    if not (isinstance(pts, list) and len(pts) >= 3 and all(
            isinstance(p, list) and len(p) == 2 and all(type(x) in (int, float) and math.isfinite(x) for x in p)
            for p in pts)):
        L.err(where, "`polygon` must contain at least three finite [u, v] points")
        return False
    n = len(pts)
    if any(math.dist(p, pts[(i + 1) % n]) < 0.1 for i, p in enumerate(pts)):
        L.err(where, "polygon edges must be at least 0.1 m long; do not repeat the first point")
        return False
    area2 = sum(p[0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * p[1] for i, p in enumerate(pts))
    if area2 <= 0.01:
        L.err(where, "polygon must have positive area and counter-clockwise winding in u/v")
        return False

    def cross(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    def intersect(a, b, c, d):
        if any(max(a[k], b[k]) < min(c[k], d[k]) or max(c[k], d[k]) < min(a[k], b[k]) for k in (0, 1)):
            return False
        return cross(a, b, c) * cross(a, b, d) <= 0 and cross(c, d, a) * cross(c, d, b) <= 0

    for i, a in enumerate(pts):
        for j in range(i + 1, n):
            if j == i + 1 or (i == 0 and j == n - 1):
                continue
            if intersect(a, pts[(i + 1) % n], pts[j], pts[(j + 1) % n]):
                L.err(where, f"polygon edges {i} and {j} intersect")
                return False
    return True


def lint_blueprint(bp, b, label):
    L = Lint(label)
    def finite(value, where):
        if isinstance(value, float) and not math.isfinite(value): L.err(where, 'non-finite number')
        elif isinstance(value, dict):
            for k,v in value.items(): finite(v, f'{where}.{k}')
        elif isinstance(value, list):
            for i,v in enumerate(value): finite(v, f'{where}[{i}]')
    finite(bp, 'top')
    if L.errors: return L
    if not isinstance(bp, dict):
        L.err("top", "blueprint must be a JSON object")
        return L
    L.keys(bp, "top", "top")
    if 'wallMaterial' in bp: L.enum(bp['wallMaterial'],'wallMaterial','top.wallMaterial')
    for c in ("wall", "trim", "roofColor"):
        L.color(bp.get(c), f"top.{c}")
    if 'amphitheater' in bp:
        spec = bp['amphitheater']
        if not L.keys(spec, 'amphitheater', 'amphitheater'): return L
        if any(bp.get(k) for k in ('volumes', 'porches', 'details', 'bridge', 'pavilion', 'fountain')):
            L.err('amphitheater', 'integrated auditoriums cannot contain other structures')
        if spec.get('axis', 'u') not in ('u', 'v'): L.err('amphitheater', 'axis must be u or v')
        if spec.get('stageEnd', 'negative') not in ('negative', 'positive'): L.err('amphitheater', 'stageEnd must be negative or positive')
        length = b['obb']['d' if spec.get('axis') == 'v' else 'w']
        for k, default, lo, hi in [('height',8,5,14), ('roofRise',5,1,9), ('backstageDepth',length*.22,3,length*.3), ('bowlDepth',5.2,2,8), ('audienceChamfer',min(12,min(b['obb']['w'],b['obb']['d'])*.2),3,min(b['obb']['w'],b['obb']['d'])*.35), ('porchDepth',3.4,1.5,6)]:
            value = spec.get(k, default)
            if type(value) not in (int,float) or not lo <= value <= hi: L.err('amphitheater', f'{k} must be between {lo} and {hi}')
        if type(spec.get('rows',12)) is not int or not 6 <= spec.get('rows',12) <= 20: L.err('amphitheater', 'rows must be an integer 6..20')
        if 'monitor' in spec and type(spec['monitor']) is not bool: L.err('amphitheater', 'monitor must be boolean')
        span = b['obb']['w' if spec.get('axis') == 'v' else 'd']
        backstage = spec.get('backstageDepth', length*.22)
        if type(backstage) in (int, float) and math.isfinite(backstage):
            maximum = min(span*.15, (length-backstage)*.15)
            chamfer = spec.get('rearWingChamfer', 0)
            if type(chamfer) not in (int, float) or not 0 <= chamfer <= maximum:
                L.err('amphitheater', f'rearWingChamfer must be between 0 and {maximum}')
        if 'stringLightSpacing' in spec and (type(spec['stringLightSpacing']) not in (int, float) or not .9 <= spec['stringLightSpacing'] <= 1.2):
            L.err('amphitheater', 'stringLightSpacing must be between 0.9 and 1.2 metres')
        if 'interiorLighting' in spec and type(spec['interiorLighting']) is not bool:
            L.err('amphitheater', 'interiorLighting must be boolean')
        for k in ('wallColor','trimColor','roofColor','seatColor'): L.color(spec.get(k), 'amphitheater.'+k)
        if min(b['obb']['w'], b['obb']['d']) < 20: L.err('amphitheater', 'auditorium footprint must be at least 20 metres across')
        return L
    if 'fountain' in bp:
        spec = bp['fountain']
        if not L.keys(spec, 'fountain', 'fountain'): return L
        if any(bp.get(k) for k in ('volumes', 'porches', 'details', 'bridge', 'pavilion')):
            L.err('fountain', 'a fountain cannot also contain buildings, bridges or pavilions')
        for k, default, lo, hi in [('height',4,2,8), ('basinHeight',.68,.25,1.2), ('rimWidth',.42,.2,.8), ('pylonWidth',1.65,.8,3)]:
            value = spec.get(k, default)
            if type(value) not in (int,float) or not lo <= value <= hi: L.err('fountain', f'{k} must be between {lo} and {hi}')
        for k in ('stoneColor','brickColor','waterColor'): L.color(spec.get(k), 'fountain.'+k)
        if 'jets' in spec and type(spec['jets']) is not bool: L.err('fountain', 'jets must be boolean')
        if L.errors: return L
        span = min(b['obb']['w'], b['obb']['d'])
        if span < 5 or spec.get('pylonWidth',1.65) + 2*spec.get('rimWidth',.42) + 1 >= span:
            L.err('fountain', 'basin must leave open water around the pylon')
        if spec.get('height',4) <= spec.get('basinHeight',.68) + 1:
            L.err('fountain', 'pylon must rise above the basin')
        return L
    if 'bridge' in bp:
        spec = bp['bridge']
        if not L.keys(spec, 'bridge', 'bridge'): return L
        if bp.get('volumes') or bp.get('porches') or bp.get('details') or bp.get('pavilion'):
            L.err('bridge', 'integrated bridges cannot also contain building volumes, porches, details or a pavilion')
        if spec.get('type') not in ('masonry-arch', 'steel-girder'): L.err('bridge', 'invalid bridge type')
        if spec.get('axis', 'u') not in ('u', 'v'): L.err('bridge', 'axis must be u or v')
        for k, default, lo, hi in [('height',6,1.5,30), ('deckThickness',.65,.15,3),
                                   ('pierWidth',1.5,.25,10), ('archRise',2,.3,20)]:
            value = spec.get(k, default)
            if type(value) not in (int,float) or not lo <= value <= hi:
                L.err('bridge', f'{k} must be between {lo} and {hi} metres')
        for k,lo,hi in [('girderHeight',.5,5),('abutmentWidth',1,30),('approachLength',10,150),('approachWidth',2,30),('approachPlateau',0,40)]:
            if k in spec and (type(spec[k]) not in (int,float) or not lo<=spec[k]<=hi): L.err('bridge',f'{k} must be between {lo} and {hi} metres')
        wings=spec.get('wingWalls')
        if wings is not None:
            if not isinstance(wings,dict): L.err('bridge','wingWalls must be an object')
            else:
                for k in wings:
                    if k not in ('length','splay','thickness','endHeight','color'): L.err('bridge',f'unknown wingWalls key {k}')
                for k,lo,hi in [('length',.5,15),('splay',0,8),('thickness',.15,2),('endHeight',.3,4)]:
                    if k in wings and (type(wings[k]) not in (int,float) or not lo<=wings[k]<=hi): L.err('bridge',f'wingWalls.{k} must be between {lo} and {hi} metres')
        count = spec.get('arches',3)
        if type(count) is not int or not 1 <= count <= 12: L.err('bridge', 'arches must be an integer 1..12')
        for k in ('tracks','railing','approaches'):
            if k in spec and type(spec[k]) is not bool: L.err('bridge', f'{k} must be boolean')
        if L.errors: return L
        length = b['obb']['d' if spec.get('axis') == 'v' else 'w']
        pier = spec.get('pierWidth', min(2, length/(count*5)))
        if spec['type'] == 'masonry-arch' and length - (count+1)*pier <= count*.3:
            L.err('bridge','piers leave no room for open arches')
        h, deck = spec.get('height',6), spec.get('deckThickness',.65)
        if deck >= h or spec.get('archRise',0) > h-deck:
            L.err('bridge','deck and arch rise must fit below the bridge top')
        return L
    if 'pavilion' in bp:
        spec = bp['pavilion']
        if not L.keys(spec, 'pavilion', 'pavilion'): return L
        if bp.get('volumes') or bp.get('porches') or bp.get('bridge'):
            L.err('pavilion', 'an integrated pavilion must not contain enclosing building volumes or porches')
        if spec.get('axis', 'u') not in ('u', 'v'): L.err('pavilion', 'axis must be u or v')
        for k, default, lo, hi in [('height',3.1,1.5,8), ('pitch',.43,.15,.8), ('postWidth',.26,.12,1.2), ('floorH',.1,0,3), ('wallH',0,0,1.5)]:
            value = spec.get(k, default)
            if type(value) not in (int,float) or not lo <= value <= hi: L.err('pavilion', f'{k} must be between {lo} and {hi}')
        for k, default, lo, hi in [('bents',3,2,14), ('endPosts',0,0,8), ('seatingRows',0,0,24)]:
            if type(spec.get(k,default)) is not int or not lo <= spec.get(k,default) <= hi: L.err('pavilion', f'{k} must be an integer {lo}..{hi}')
        for k in ('furniture','railing'):
            if k in spec and type(spec[k]) is not bool: L.err('pavilion', f'{k} must be boolean')
        for k, default, choices in [('columns','square',('square','classical')), ('roofType','gable',('gable','flat')), ('entranceEnd','positive',('positive','negative')), ('railingStyle','picket',('picket','ornamental'))]:
            if spec.get(k,default) not in choices: L.err('pavilion', f'{k} must be one of {choices}')
        if 'entranceStairs' in spec and L.keys(spec['entranceStairs'], 'pavilion.stairs', 'pavilion.entranceStairs'):
            stairs = spec['entranceStairs']
            for k, default, lo, hi in [('length',None,.5,20), ('width',5,1,12), ('bottomY',0,-10,3), ('foundationDepth',.4,.1,5)]:
                value = stairs.get(k, default)
                if type(value) not in (int,float) or not lo <= value <= hi:
                    L.err('pavilion.entranceStairs', f'{k} must be between {lo} and {hi}')
            bottom, floor = stairs.get('bottomY',0), spec.get('floorH',.1)
            if type(bottom) in (int,float) and type(floor) in (int,float) and bottom >= floor:
                L.err('pavilion.entranceStairs', 'bottomY must be below the pavilion floor')
            span = b['obb']['w'] if spec.get('axis','u') == 'v' else b['obb']['d']
            if type(stairs.get('width',5)) in (int,float) and stairs.get('width',5) > span - 1:
                L.err('pavilion.entranceStairs', 'width must leave room for the end columns')
            if 'railing' in stairs and type(stairs['railing']) is not bool:
                L.err('pavilion.entranceStairs', 'railing must be boolean')
        for k in ('floorColor','columnColor','trimColor'): L.color(spec.get(k), 'pavilion.'+k)
        if min(b['obb']['w'], b['obb']['d']) < 2: L.err('pavilion', 'pavilion footprint must be at least 2 metres across')
        if L.errors: return L
    vols = bp.get("volumes", [] if 'pavilion' in bp else None)
    if not isinstance(vols, list) or (not vols and 'pavilion' not in bp):
        L.err("top", "`volumes` must be a non-empty list")
        return L
    o = b["obb"]
    hw, hd = o["w"] / 2, o["d"] / 2
    ids = set()
    boxes = []
    polygons = []
    for i, vol in enumerate(vols):
        where = f"volumes[{i}]" + (f"({vol.get('id')})" if isinstance(vol, dict) and vol.get("id") else "")
        if not L.keys(vol, "volume", where):
            continue
        if vol.get("id") in ids:
            L.warn(where, f"duplicate volume id `{vol['id']}`")
        ids.add(vol.get("id"))
        ok = True
        polygon = vol.get("polygon")
        if "polygon" in vol:
            if "u" in vol or "v" in vol:
                L.err(where, "use `polygon` or `u`/`v`, not both")
            if not lint_polygon(L, polygon, where):
                continue
            # The renderer derives these bounds too, for shared facade/detail code.
            vol = {**vol, "u": [min(p[0] for p in polygon), max(p[0] for p in polygon)],
                   "v": [min(p[1] for p in polygon), max(p[1] for p in polygon)]}
        for ax, half in (("u", hw), ("v", hd)):
            r = vol.get(ax)
            if not (isinstance(r, list) and len(r) == 2 and all(isinstance(x, (int, float)) for x in r)):
                L.err(where, f"`{ax}` must be [lo, hi] in metres, got {r!r}")
                ok = False
                continue
            if r[0] >= r[1]:
                L.err(where, f"`{ax}` = {r} must be [lo, hi] with lo < hi")
                ok = False
            if (r[0] < -half - 1.5 or r[1] > half + 1.5) and not PROTRUDING.search(str(vol.get("id") or "")):
                L.warn(where, f"`{ax}` = {r} sticks out of the footprint box (±{half:.1f} m); u runs along the LONG side (name the volume porch/stoop/portico/canopy if it is meant to protrude)")
        H = vol.get("height", 6)
        # Explicit roofless bases may be short cladding/foundation sections
        # underneath a full-height mass with a different wall material.
        L.num(H, where, "height", .1 if (vol.get('roof') or {}).get('type') == 'none' else 1.5, 40)
        L.num(vol.get("bottom"), where, "bottom", -2, H - 0.1 if isinstance(H, (int, float)) else 40)
        if ok and not PROTRUDING.search(str(vol.get("id") or "")):
            if polygon:
                polygons.append(polygon)
            else:
                boxes.append((vol["u"], vol["v"]))
        for c in ("wall", "upperWall", "trim"):
            L.color(vol.get(c), f"{where}.{c}")
        if 'wallMaterial' in vol: L.enum(vol['wallMaterial'],'wallMaterial',where+'.wallMaterial')
        roof = vol.get("roof") or {}
        if L.keys(roof, "roof", where + ".roof"):
            if polygon and roof.get("type") not in (None, "none", "flat"):
                L.err(where + ".roof", "polygon volumes currently require a flat roof")
                continue
            L.enum(roof.get("type"), "roof.type", where + ".roof"); L.enum(roof.get("ridge"), "roof.ridge", where + ".roof")
            for c in ("color", "gableColor", "crossColor", "capColor"):
                L.color(roof.get(c), f"{where}.roof.{c}")
            L.num(roof.get("pitch"), where + ".roof", "pitch", 0.05, 1.5)
            if roof.get('type') == 'barrel':
                L.num(roof.get('h',1.4), where+'.roof', 'h', .1, 8)
                if ok and type(roof.get('h',1.4)) in (int,float) and roof.get('h',1.4) > min(vol['u'][1]-vol['u'][0],vol['v'][1]-vol['v'][0])/2:
                    L.err(where+'.roof','barrel rise must not exceed half the smaller span')
                if roof.get('dormers'): L.err(where+'.roof','barrel roofs do not support dormers')
            if roof.get("dormers") is not None and L.keys(roof["dormers"], "dormers", where + ".roof.dormers"):
                L.enum(roof["dormers"].get("style"), "dormers.style", where + ".roof.dormers")
                if roof.get("type") in (None, "flat"):
                    L.err(where + ".roof.dormers", "dormers need a pitched roof (gable, hip, gambrel or mansard)")
                for f in roof["dormers"].get("faces") or []:
                    if f not in FACES:
                        L.err(where + ".roof.dormers", f"face `{f}` not one of {FACES}")
                    elif roof.get("type") in ("gable", "gambrel") and ok:
                        W, D = vol["u"][1] - vol["u"][0], vol["v"][1] - vol["v"][0]
                        ridge_u = (roof.get("ridge") or ("u" if W >= D else "v")) == "u"
                        if f[1] == ("u" if ridge_u else "v"):
                            L.warn(where + ".roof.dormers", f"face `{f}` is a gable end (ridge along {'u' if ridge_u else 'v'}) — no slope there, dormer skipped")
                for f in roof["dormers"].get("at") or []:
                    L.frac(f, where + ".roof.dormers")
        for k, kind in (("cornice", "cornice"), ("plinth", "plinth"), ("cupola", "cupola")):
            if vol.get(k) is not None and L.keys(vol[k], kind, f"{where}.{k}"):
                L.color(vol[k].get("color"), f"{where}.{k}.color")
        for i2, bc in enumerate(vol.get("beltCourses") or []):
            if L.keys(bc, "beltCourse", f"{where}.beltCourses[{i2}]"):
                L.num(bc.get("y"), f"{where}.beltCourses[{i2}]", "y", 0, 30, allow_none=False)
                L.color(bc.get("color"), f"{where}.beltCourses[{i2}].color")
        for i2, tw in enumerate(vol.get("towers") or []):
            if L.keys(tw, "tower", f"{where}.towers[{i2}]"):
                L.color(tw.get("wall"), f"{where}.towers[{i2}].wall")
        for i2, ch in enumerate(vol.get("chimneys") or []):
            L.keys(ch, "chimney", f"{where}.chimneys[{i2}]")
        faces = vol.get("faces") or {}
        lengths = {}
        if polygon:
            lengths = {f"edge{i}": math.dist(p, polygon[(i + 1) % len(polygon)]) for i, p in enumerate(polygon)}
        elif ok:
            W, D = vol["u"][1] - vol["u"][0], vol["v"][1] - vol["v"][0]
            lengths = {"+u": D, "-u": D, "+v": W, "-v": W}
        if not isinstance(faces, dict):
            L.err(where, "`faces` must be an object keyed by face name")
            continue
        for key, spec in faces.items():
            if not ok:
                continue
            if key not in lengths and key != "default":
                L.err(where + ".faces", f"face `{key}` not one of {', '.join(lengths)}, default")
                continue
            L_face = lengths.get(key, min(lengths.values()))
            lint_face(L, spec, key, vol, f"{where}.faces[{key}]", L_face, H if isinstance(H, (int, float)) else 6)
    # footprint coverage
    if boxes or polygons:
        poly = polygon_uv(b, 3)
        inside_poly = covered = outside = 0
        step = 1.0
        for iu in range(int(-hw - 3), int(hw + 4)):
            for iv in range(int(-hd - 3), int(hd + 4)):
                u, v = iu + 0.5, iv + 0.5
                inp = _point_in_poly(poly, u, v)
                inb = (any(bu[0] <= u <= bu[1] and bv[0] <= v <= bv[1] for bu, bv in boxes)
                       or any(_point_in_poly(p, u, v) for p in polygons))
                inside_poly += inp
                covered += inp and inb
                outside += (not inp) and inb
        if inside_poly:
            cov = covered / inside_poly
            if cov < 0.75:
                L.warn("volumes", f"volumes cover only {cov:.0%} of the footprint — u and v swapped, or a wing missing?")
            if outside > 0.35 * inside_poly:
                L.warn("volumes", f"volumes spill over ~{outside / inside_poly:.0%} of the footprint area outside it")
    for i, p in enumerate(bp.get("porches") or []):
        w = f"porches[{i}]"
        if L.keys(p, "porch", w):
            face = p.get("face")
            if face not in FACES:
                L.err(w, f"top-level porch needs `face` (outward normal, one of {FACES}), got {face!r}")
            else:
                along = "u" if face[1] == "v" else "v"
                r = p.get(along)
                if not (isinstance(r, list) and len(r) == 2 and all(isinstance(x, (int, float)) for x in r) and r[0] < r[1]):
                    L.err(w, f"a porch on face {face} needs `{along}`: [lo, hi] in metres along the wall, got {r!r}")
                L.num(p.get("wall"), w, "wall", allow_none=False)
            L.enum(p.get("style"), "porch.style", w); L.enum(p.get("roof"), "porch.roof", w)
            lint_side_rail_gaps(L, p, w)
            if "railSides" in p and (not isinstance(p["railSides"], list) or any(s not in ("front", "left", "right") for s in p["railSides"])):
                L.err(w, "railSides must be an array of front/left/right (as viewed facing the wall)")
            if p.get("roof") == "shed": L.num(p.get("pitch", .25), w, "pitch", .05, 1)
            if p.get("roof") == "main":
                L.err(w, "a shared main roof must be attached to a volume face, not a top-level porch")
            if "floorThickness" in p:
                L.num(p["floorThickness"], w, "floorThickness", 0.05, 1, allow_none=False)
            if "stepsAt" in p:
                L.frac(p["stepsAt"], w, "stepsAt")
            for c in ("wall_color", "trim", "roofColor", "gableColor", "floorColor", "postColor"):
                L.color(p.get(c), f"{w}.{c}")
    for i, d in enumerate(bp.get("details") or []):
        w = f"details[{i}]"
        if L.keys(d, "detail", w):
            L.enum(d.get("type"), "detail.type", w)
            if d.get("type") == "lawnsign" and not d.get("text"):
                L.err(w, "lawnsign without `text`")
            if "postHeight" in d:
                L.num(d["postHeight"], w, "postHeight", 0.1, 5, allow_none=False)
            if d.get("type") in ("ramp", "stair", "landing"):
                L.num(d.get("length"), w, "length", 0.5, 30); L.num(d.get("height"), w, "height", 0.1, 5)
                if "dir" in d and not (isinstance(d["dir"], list) and len(d["dir"]) == 2
                        and all(isinstance(x, (int, float)) and math.isfinite(x) for x in d["dir"])
                        and math.hypot(*d["dir"]) > 0):
                    L.err(w, "`dir` must be a nonzero numeric vector [du, dv]")
                L.enum(d.get("construction"), "detail.construction", w)
                L.num(d.get("foundationDepth"), w, "foundationDepth", .05, 10)
                if "railSides" in d and (not isinstance(d["railSides"], list) or any(s not in ("front", "back", "left", "right") for s in d["railSides"])):
                    L.err(w, "railSides must be an array of front/back/left/right")
                L.color(d.get("color"), w + ".color"); L.color(d.get("railColor"), w + ".railColor")
            for ax in ("u", "v"):
                L.num(d.get(ax), w, ax, allow_none=False)
    n_win = sum(len(st.get("windows", {}).get("at", [])) or st.get("windows", {}).get("count", 3)
                for vol in vols if isinstance(vol, dict) for spec in (vol.get("faces") or {}).values()
                if isinstance(spec, dict) for st in spec.get("storeys") or [] if isinstance(st, dict))
    if n_win > 140:
        L.warn("top", f"about {n_win} windows — heavy for the phone vertex budget; use fewer, larger windows")
    return L


def _point_in_poly(poly, u, v):
    inside = False
    n = len(poly)
    for i in range(n):
        (u1, v1), (u2, v2) = poly[i], poly[(i + 1) % n]
        if (v1 > v) != (v2 > v) and u < (u2 - u1) * (v - v1) / ((v2 - v1) or 1e-9) + u1:
            inside = not inside
    return inside


# --- geometry audit -----------------------------------------------------------
# Conservative blueprint geometry findings requiring repair or visual triage.
# These are candidate defects, not a solid-model collision solver. Intentional
# intersecting wings are normal; only near-coplanar wall overlaps are flagged.

def audit_geometry(bp):
    findings = []
    def add(key, detail):
        findings.append({'id': key, 'finding': detail})
    rects = []
    for i, v in enumerate(bp.get('volumes', [])):
        name = v.get('id', str(i)); H = v.get('height', 6)
        poly = v.get('polygon')
        if poly:
            lengths = {f'edge{j}': math.dist(p, poly[(j+1) % len(poly)]) for j, p in enumerate(poly)}
        else:
            if not all(k in v for k in ('u', 'v')): continue
            W, D = v['u'][1]-v['u'][0], v['v'][1]-v['v'][0]
            lengths = {'+u': D, '-u': D, '+v': W, '-v': W}
            rects.append((name, v))
        for face, length in lengths.items():
            spec = v.get('faces', {}).get(face, v.get('faces', {}).get('default', {}))
            if not isinstance(spec, dict): continue
            windows = []
            for j, st in enumerate(spec.get('storeys', [])):
                w = st.get('windows', {}); width = w.get('w', 1.1); height = w.get('h', 1.8)
                n = w.get('count', max(1, int(length // 3))); margin = w.get('margin', .9)/length
                at = w.get('at')
                if at is None:
                    at = [w.get('center', .5)+(k-(n-1)/2)*w['spread']/length for k in range(n)] if 'spread' in w else [margin+(k+.5)/n*(1-2*margin) for k in range(n)]
                at = [x for x in at if not any(a <= x <= b for a,b in st.get('skip', []))]
                for k,x in enumerate(at):
                    left, right = x*length-width/2, x*length+width/2
                    bottom, top = st.get('y', 0), st.get('y', 0)+height
                    if left < -.03 or right > length+.03:
                        add(f'{name}/{face}/window-{j}-{k}/edge', 'Opening crosses the end of its wall.')
                    for l,r,b,t in windows:
                        if min(right,r)-max(left,l) > .025 and min(top,t)-max(bottom,b) > .025:
                            add(f'{name}/{face}/window-{j}-{k}/overlap', 'Window openings overlap. Check grouped lights versus duplicated frames.'); break
                    windows.append((left,right,bottom,top))
                    if top > H and (v.get('roof', {}).get('type', 'flat') in ('flat','hip') or
                                    (v.get('roof', {}).get('type') == 'gable' and face[1:] != v.get('roof', {}).get('ridge', 'u'))):
                        add(f'{name}/{face}/window-{j}-{k}/roof', 'Opening extends above the eave on a roof slope face.')
            pl = spec.get('pilasters')
            if pl and pl.get('cap', True) is not False and not pl.get('fitUnderEave'):
                top = pl.get('height', H+.35)+pl.get('capHeight', .3)-.05
                if v.get('roof', {}).get('type') in ('hip','mansard','gable') and top > H+.02:
                    add(f'{name}/{face}/capital-roof', 'Pilaster capitals extend into the roof; lower them or use fitUnderEave.')
            for j, door in enumerate(spec.get('doors', [])):
                if door.get('y', 0) > .25 and not door.get('steps') and not spec.get('porches'):
                    add(f'{name}/{face}/door-{j}/support', 'Raised door has no local steps or porch; verify its external approach.')
    for i,(an,a) in enumerate(rects):
        for bn,b in rects[i+1:]:
            if min(a.get('height',6),b.get('height',6)) <= max(a.get('bottom',0),b.get('bottom',0)): continue
            for ax,other in [('u','v'),('v','u')]:
                overlap = min(a[other][1],b[other][1])-max(a[other][0],b[other][0])
                if overlap > .05 and any(abs(x-y)<.02 for x in a[ax] for y in b[ax]):
                    add(f'{an}/{bn}/{ax}-coplanar', 'Wall planes coincide over a shared extent; inspect exposed faces for z-fighting.')
    return findings


def massing_signature(bp):
    """Protect approved volume and roof geometry; facade detail remains editable.

    Kept from the legacy fidelity workflow: a repair that changes this
    signature changed the silhouette, not just the decoration.
    """
    keys = ('id', 'u', 'v', 'polygon', 'height', 'bottom')
    roof_keys = ('type', 'ridge', 'pitch', 'maxH', 'overhang', 'flatTop', 'h', 'run', 'inset', 'kneeH', 'kneeIn')
    shapes = []
    for v in bp['volumes']:
        silhouette = {}
        for face, spec in v.get('faces', {}).items():
            if not isinstance(spec, dict): continue
            selected = {kind: [{k: x[k] for k in fields if k in x} for x in spec.get(kind, [])] for kind, fields in {
                'parapets': ('type', 'outline', 'at', 'width', 'height', 'depth'),
                'bays': ('at', 'w', 'd', 'y0', 'y1', 'h', 'roof'),
                'porches': ('at', 'range', 'w', 'd', 'height', 'roof', 'style', 'floorH')}.items() if spec.get(kind)}
            if selected: silhouette[face] = selected
        shapes.append({**{k: v[k] for k in keys if k in v},
                       'roof': {k: v.get('roof', {})[k] for k in roof_keys if k in v.get('roof', {})},
                       'silhouette': silhouette})
    return fingerprint({'volumes': shapes, 'porches': bp.get('porches', [])})


# --- render evidence ------------------------------------------------------------
# Render records (buildings/<id>/renders/<view>.png.json) bind an image to the
# blueprint, footprint frame, visual context, renderer and neighbours it was
# made from. A review may only rely on renders that are current on all of them.

CHECKS = ("identity", "massing_roof", "facades_openings", "materials", "grounding", "geometry")
VIEWS = {"+u", "-u", "+v", "-v", "iso"}
STAGES = ('massing', 'detail')


def _paths(root):
    """Accept SitePaths, a site name, or a data/<site> directory."""
    return root if isinstance(root, SitePaths) else site_paths(root)


def file_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _local_renderer_signature(root=ROOT):
    return fingerprint([(p.name, file_hash(p)) for p in sorted((Path(root) / "src").glob("*.js"))])


def renderer_signature(root=ROOT):
    """Hash of the viewer source; a change invalidates every render and review.

    render.py owns the canonical definition; fall back to hashing src/*.js when
    that module is not present (tests, partial checkouts).
    """
    try:
        from . import render
    except ImportError:
        return _local_renderer_signature(root)
    canonical = getattr(render, 'renderer_signature', None)
    return canonical(root) if canonical else _local_renderer_signature(root)


def visual_context(site, building):
    # Blueprints inherit style defaults and are seated using terrain/street
    # geometry. Accepting a reviewed draft must not itself change this signature.
    return fingerprint({"style": building.get("style"), "front": building.get("front"),
                        "terrain": site.get("terrain"), "roads": site.get("roads"),
                        "size": site.get("size")})


def evidence_path(root, name):
    """A file named in a review report, which must lie inside the site's data directory."""
    root = Path(root)
    path = (root / name).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("review evidence must be inside the site directory")
    return path


def render_record(image):
    """The provenance record next to a render: <view>.png -> <view>.png.json."""
    return Path(str(image) + '.json')


def _label(paths, path):
    try:
        return paths.relative(path)
    except ValueError:
        return str(path)


def render_errors(paths, site, building, blueprint, renders, stage='detail', require_views=True):
    """Why these renders cannot serve as review evidence (empty when they can).

    `renders` maps a view name to the image path (buildings/<id>/renders/<view>.png).
    `require_views` may be True (all of VIEWS), an iterable of view names, or False.
    """
    paths = _paths(paths)
    errors = []
    if require_views is True and set(renders) != VIEWS:
        errors.append('review requires all four face renders and an isometric render')
    elif require_views and require_views is not True and not set(require_views) <= set(renders):
        errors.append('review requires renders of ' + ', '.join(sorted(set(require_views) - set(renders))))
    renderer = renderer_signature(paths.root)
    for view, image in renders.items():
        image = Path(image)
        name = _label(paths, image)
        meta_path = render_record(image)
        if not image.is_file() or not meta_path.is_file():
            errors.append(f'missing render or provenance: {name}')
            continue
        try:
            meta = json.loads(meta_path.read_text())
        except ValueError:
            errors.append(f'invalid render provenance: {name}')
            continue
        expected = {'blueprint': fingerprint(blueprint), 'frame': building_frame(site, building),
                    'context': visual_context(site, building), 'renderer': renderer, 'view': view,
                    'stage': stage}
        if any(meta.get(key) != value for key, value in expected.items()):
            errors.append(f'stale or wrong-stage render: {name}; render again with --force')
        for oid, source in (meta.get('neighbors') or {}).items():
            other = next((x for x in site['buildings'] if str(x['id']) == oid), None)
            if other is None:
                errors.append(f'render neighbor disappeared: {oid}'); continue
            try:
                current = read_json(paths.building(oid).draft) if source['draft'] else other.get('blueprint')
                if source['draft'] and current is None:
                    raise FileNotFoundError(oid)
                if fingerprint(current) != source['blueprint'] or building_frame(site, other) != source['frame']:
                    errors.append(f'render neighbor changed: {oid}; render again')
            except (OSError, ValueError, KeyError, TypeError):
                errors.append(f'render neighbor unavailable: {oid}')
    return errors


def report_errors(paths, site, building, blueprint, report, stage='detail'):
    """Check a hand-written visual review report against its evidence.

    The report names its reference images and renders relative to data/<site>/.
    """
    paths = _paths(paths)
    errors = []
    if not report.get("reviewer") or not str(report.get("summary", "")).strip():
        errors.append("reviewer and comparison summary are required")
    if any(report.get("checks", {}).get(key) is not True for key in CHECKS):
        errors.append("every visual acceptance check must pass")
    if not isinstance(report.get("limitations"), list):
        errors.append("limitations must list uncertain or unobserved details (may be empty)")
    refs, renders = report.get("references", []), report.get("renders", {})
    if not refs:
        errors.append("at least one reference image is required; missing imagery is unfinished research")
    for name in list(refs) + list(renders.values()):
        if not evidence_path(paths.data, name).is_file():
            errors.append(f"missing evidence: {name}")
    errors += render_errors(paths, site, building, blueprint,
                            {view: evidence_path(paths.data, name) for view, name in renders.items()}, stage)
    return errors


# --- review records ---------------------------------------------------------------
# buildings/<id>/review.json:
# {
#   "draft_hash": fingerprint(draft),        binds the review to one draft (state.building_status)
#   "frame": building_frame(site, b) | null, footprint the renders were made in
#   "passed": bool,                          no findings and the report did not ask for repair
#   "findings": [str, ...],                  lint errors, render-evidence errors, scene-review requests
#   "geometry": [{"id", "finding"}, ...],    audit_geometry candidates for visual triage (informational)
#   "report": {...} | null,                  the model's response: verdict, summary, orientation, issues
#   "renderer_signature": str | null,        renderer the reviewed renders came from
#   "model": str | null,                     reviewer model alias
#   "stage": "detail" | "massing",
#   "repairs": int,                          completed_repairs() when the review was made
#   "timestamp": float
# }
# Legacy files holding a bare model response ({verdict, summary, ...}) read back
# wrapped in this shape with draft_hash null, so they never count as current.

REPAIR_VERDICTS = ('repair', 'insufficient-evidence')
BAD_ORIENTATION = ('incorrect', 'uncertain')
BAD_SEVERITY = ('major', 'broken')


def report_needs_repair(report):
    """Does a model review response (verdict/orientation/issues) ask for a repair?"""
    review = report or {}
    if not isinstance(review, dict):
        return False
    return bool(review.get('verdict') in REPAIR_VERDICTS or
                (review.get('orientation') or {}).get('status') in BAD_ORIENTATION or
                any(isinstance(x, dict) and x.get('severity') in BAD_SEVERITY for x in review.get('issues') or []))


def read_review(paths, bid):
    """The review record for a building, or None. Legacy bare responses are wrapped."""
    record = read_json(_paths(paths).building(bid).review)
    if record is None or not isinstance(record, dict):
        return None
    if 'draft_hash' in record:
        return record
    return {'draft_hash': None, 'frame': None, 'passed': not report_needs_repair(record), 'findings': [],
            'geometry': [], 'report': record, 'renderer_signature': None, 'model': None, 'stage': 'detail',
            'repairs': None, 'timestamp': None, 'legacy': True}


def write_review(paths, bid, draft, report, *, renderer_signature=None, model=None, findings=(),
                 geometry=None, frame=None, stage='detail'):
    """Record a review of `draft`; returns the record. Idempotent: an identical verdict is not rewritten."""
    paths = _paths(paths)
    b = paths.building(bid)
    findings = [str(x) for x in findings]
    record = {'draft_hash': fingerprint(draft), 'frame': frame,
              'passed': not findings and not report_needs_repair(report),
              'findings': findings, 'geometry': copy.deepcopy(list(geometry or [])),
              'report': copy.deepcopy(report), 'renderer_signature': renderer_signature, 'model': model,
              'stage': stage, 'repairs': completed_repairs(paths, bid), 'timestamp': time.time()}
    previous = read_json(b.review)
    if isinstance(previous, dict) and all(previous.get(k) == v for k, v in record.items() if k != 'timestamp'):
        return previous
    atomic_json(b.review, record)
    return record


def review_errors(root, site, building, blueprint):
    """Fail closed on a missing, stale, or failed review of `blueprint` (empty list = accepted)."""
    paths = _paths(root)
    try:
        record = read_review(paths, building['id'])
        if record is None:
            return ["visual review not recorded"]
        if record.get("draft_hash") != fingerprint(blueprint) or (
                record.get("frame") is not None and record["frame"] != building_frame(site, building)):
            return ["visual review belongs to an older blueprint or footprint"]
        errors = []
        signature = record.get('renderer_signature')
        if signature is not None and signature != renderer_signature(paths.root):
            errors.append("visual review predates the current renderer; review again")
        if not record.get("passed"):
            errors += [str(x) for x in record.get("findings") or []] or ["visual review did not pass"]
        return errors
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as error:
        return [f"invalid review: {error}"]


def check(paths, bid, *, stage='detail', views=FACE_NAMES, site=None, building=None, blueprint=None):
    """Every non-model review check for one building's draft.

    Returns {'id', 'label', 'blueprint', 'lint', 'geometry', 'render_errors', 'findings'};
    `findings` (lint errors + render-evidence errors) is what a recorded review fails on.
    """
    paths = _paths(paths)
    b = paths.building(bid)
    if site is None:
        site = load_site(paths)
    if building is None:
        building = find_building(site, bid)
    if blueprint is None:
        blueprint = read_json(b.draft)
        if blueprint is None:
            raise FileNotFoundError(f'no draft for {bid}: {b.draft}')
    label = _label(paths, b.draft)
    lint = lint_blueprint(blueprint, building, label)
    geometry = audit_geometry(blueprint) if not lint.errors else []
    renders = {view: b.render(view) for view in views}
    errors = render_errors(paths, site, building, blueprint, renders, stage, require_views=False)
    return {'id': str(bid), 'label': label, 'blueprint': blueprint, 'site': site, 'building': building,
            'lint': lint, 'geometry': geometry, 'render_errors': errors, 'findings': lint.errors + errors}


# --- repair policy ----------------------------------------------------------------
# Two bounded repair rounds, then publication with the failed inspection kept
# intact. Nothing here talks to a model.

MAX_REPAIRS = 2
POLICY = 'two-repairs-then-publish-v1'
SCENE_FINDING = 'scene review requested repair'


def completed_repairs(paths, bid):
    """How many repair rounds exist on disk: the highest repair-<n>.json present."""
    b = _paths(paths).building(bid)
    for number in range(MAX_REPAIRS, 0, -1):
        if b.repair(number).is_file():
            return number
    return 0


def repair_phase(number, queue_pass=None):
    """Render-file phase name for a repair round: initial, repaired, repaired-2, repaired-pass-3[-2]."""
    if not number:
        return 'initial'
    base = f'repaired-pass-{queue_pass}' if queue_pass is not None else 'repaired'
    return base if number == 1 else f'{base}-{number}'


def needs_repair(st):
    """Does this building need another repair round?

    Accepts a review record (from read_review) or a legacy structure-state dict
    with `review`, `validation_errors`, `errors`, `scene_repair_requested`.
    """
    st = st or {}
    if 'passed' in st:
        return bool(st.get('scene_repair_requested') or not st['passed'])
    return bool(st.get('scene_repair_requested') or st.get('validation_errors') or
                st.get('errors') or report_needs_repair(st.get('review')))


def scene_repairs(paths, state):
    """Use a failed scene inspection as repair feedback while repair rounds remain.

    `state` holds the scene critique as {'scene_review': {'buildings': [{'id', 'verdict', 'orientation'}]}}.
    Each failed building with repairs remaining gets its review.json marked failed
    (passed false, scene_review attached) so its status derives to needs-repair;
    the scene record is then reset. Returns the ids selected for repair.
    """
    paths = _paths(paths)
    selected = []
    for verdict in (state.get('scene_review') or {}).get('buildings', []):
        bid = str(verdict['id'])
        failed = (verdict.get('verdict') != 'ready' or
                  (verdict.get('orientation') or {}).get('status') in BAD_ORIENTATION)
        if not failed or completed_repairs(paths, bid) >= MAX_REPAIRS:
            continue
        b = paths.building(bid)
        record = read_review(paths, bid)
        if record is None or record.get('draft_hash') is None:
            draft = read_json(b.draft)
            if draft is None:
                continue
            record = {'draft_hash': fingerprint(draft), 'frame': None, 'passed': True, 'findings': [],
                      'geometry': [], 'report': (record or {}).get('report'), 'renderer_signature': None,
                      'model': None, 'stage': 'detail', 'repairs': completed_repairs(paths, bid),
                      'timestamp': time.time()}
        record.pop('legacy', None)
        record['followup_review'] = copy.deepcopy(verdict)
        record['scene_repair_requested'] = True
        record['passed'] = False
        if SCENE_FINDING not in record.setdefault('findings', []):
            record['findings'].append(SCENE_FINDING)
        atomic_json(b.review, record)
        selected.append(bid)
    if selected:
        reset_scene(state)
    return selected


def reset_scene(state):
    """Archive the scene critique and start a new scene generation (in place)."""
    if state.get('scene_review'):
        state.setdefault('scene_review_history', []).append(copy.deepcopy(state['scene_review']))
    state.pop('scene_review', None)
    state.pop('queue_scene_captured', None)
    state['scene_generation'] = state.get('scene_generation', 0) + 1
    return state


def publication_record(st, bp, run_id, scene, repairs, *, retroactive=False):
    """Keep failed inspection intact even when policy authorizes publication.

    `st` is the structure's state: {'status': 'ready'|'needs-attention', 'review': {...},
    'validation_errors': [...], 'baseline_comparison': {...}}. Returns None while
    the inspection failed and repair rounds remain.
    """
    passed = st['status'] == 'ready'
    if not passed and repairs < MAX_REPAIRS:
        return None
    return {'published': True, 'forced': not passed, 'policy': POLICY,
            'reason': 'inspection-passed' if passed else 'repair-limit-reached',
            'inspection_passed': passed, 'inspection_status': st['status'],
            'repair_attempts': repairs, 'repair_limit': MAX_REPAIRS,
            'retroactive': retroactive, 'published_at': time.time(),
            'run': run_id, 'blueprint_hash': fingerprint(bp),
            'inspection': {'building': copy.deepcopy(st.get('review')),
                           'scene': copy.deepcopy(scene),
                           'baseline_comparison': copy.deepcopy(st.get('baseline_comparison')),
                           'validation_errors': copy.deepcopy(st.get('validation_errors', []))}}


def review_record(st, run_id):
    """The overrides.json `miniature_review` entry for a structure."""
    record = {'status': st['status'], 'run': run_id}
    if st.get('publication'):
        record['publication'] = copy.deepcopy(st['publication'])
    return record


# --- CLI ------------------------------------------------------------------------

def lint_targets(paths, ids=(), merged=False, file=None, file_id=None):
    """[(label, bid, loader)] for `town lint`."""
    ids = [str(x) for x in ids or ()]
    targets = []
    if file:
        if not file_id:
            raise ValueError("--file needs --id")
        targets.append((file, str(file_id), lambda p=file: json.loads(Path(p).read_text())))
    elif merged:
        for bid, bp in (load_overrides(paths).get("blueprints") or {}).items():
            if not ids or bid in ids:
                targets.append((f"overrides.json#{bid}", bid, lambda bp=bp: bp))
    else:
        for bid in ids or [x for x in paths.building_ids() if paths.building(x).draft.is_file()]:
            draft = paths.building(bid).draft
            targets.append((_label(paths, draft), bid, lambda p=draft: json.loads(p.read_text())))
    return targets


def lint(paths, ids=(), *, merged=False, file=None, file_id=None, quiet=False, out=print):
    """Lint drafts (or merged blueprints); returns the number of targets with errors."""
    paths = _paths(paths)
    targets = lint_targets(paths, ids, merged, file, file_id)
    if not targets:
        out("nothing to lint")
        return 0
    site = load_site(paths)
    bad = 0
    for label, bid, load in targets:
        try:
            b = find_building(site, bid)
        except KeyError as e:
            out(f"{label}: ERROR {e}")
            bad += 1
            continue
        try:
            bp = load()
        except FileNotFoundError:
            out(f"{label}: ERROR file not found")
            bad += 1
            continue
        except json.JSONDecodeError as e:
            out(f"{label}: ERROR invalid JSON: {e}")
            bad += 1
            continue
        L = lint_blueprint(bp, b, label)
        if L.errors:
            bad += 1
        if L.errors or L.warnings or not quiet:
            out(f"{label}: {len(L.errors)} error(s), {len(L.warnings)} warning(s)")
        for e in L.errors:
            out(f"  ERROR   {e}")
        for w in L.warnings:
            out(f"  warning {w}")
    return bad


def review(paths, ids, *, stage='detail', record=False, quiet=False, out=print):
    """Run the non-model checks for each building and print findings; returns the number failing.

    With `record`, writes buildings/<id>/review.json via write_review (no model verdict).
    """
    paths = _paths(paths)
    site = load_site(paths)
    signature = renderer_signature(paths.root)
    failed = 0
    for bid in ids:
        try:
            result = check(paths, bid, stage=stage, site=site)
        except (KeyError, FileNotFoundError) as error:
            out(f"{bid}: ERROR {error}")
            failed += 1
            continue
        L = result['lint']
        if result['findings']:
            failed += 1
        if result['findings'] or L.warnings or result['geometry'] or not quiet:
            out(f"{result['label']}: {len(L.errors)} error(s), {len(L.warnings)} warning(s), "
                f"{len(result['render_errors'])} render issue(s), {len(result['geometry'])} geometry finding(s)")
        for e in L.errors:
            out(f"  ERROR   {e}")
        for e in result['render_errors']:
            out(f"  ERROR   {e}")
        for w in L.warnings:
            out(f"  warning {w}")
        for g in result['geometry']:
            out(f"  geometry {g['id']}: {g['finding']}")
        if record:
            frame = building_frame(site, result['building'])
            write_review(paths, bid, result['blueprint'], None, renderer_signature=signature,
                         findings=result['findings'], geometry=result['geometry'], frame=frame, stage=stage)
            out(f"  recorded {_label(paths, paths.building(bid).review)}")
    return failed


def register(subparsers):
    p = subparsers.add_parser('lint', help='check draft blueprints, or with --merged the blueprints in overrides.json')
    p.add_argument('site')
    p.add_argument('ids', nargs='*', help='structure ids (default: every draft, or every merged blueprint)')
    p.add_argument('--merged', action='store_true', help='lint the blueprints in overrides.json instead of drafts')
    p.add_argument('--file', help='lint this JSON file (needs --id)')
    p.add_argument('--id', help='building id for --file')
    p.add_argument('-q', '--quiet', action='store_true', help='only print files with findings')
    p.set_defaults(run=_run_lint)
    r = subparsers.add_parser('review', help='non-model review checks: lint, geometry audit, render evidence')
    r.add_argument('site')
    r.add_argument('ids', nargs='+')
    r.add_argument('--stage', choices=STAGES, default='detail')
    r.add_argument('--record', action='store_true', help='write buildings/<id>/review.json')
    r.add_argument('-q', '--quiet', action='store_true', help='only print buildings with findings')
    r.set_defaults(run=_run_review)


def _run_lint(args):
    try:
        bad = lint(args.site, args.ids, merged=args.merged, file=args.file, file_id=args.id, quiet=args.quiet)
    except ValueError as error:
        print(f'error: {error}')
        return 2
    return 1 if bad else 0


def _run_review(args):
    return 1 if review(args.site, args.ids, stage=args.stage, record=args.record, quiet=args.quiet) else 0
