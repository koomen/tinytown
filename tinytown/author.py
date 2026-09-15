"""Stages 4-6: author a blueprint per building, review and repair it (bounded), critique the scene, accept.

    town author <site> [IDS...] [--all] [--reauthor ID...] [--accept] [--dry-run] ...
    town accept <site> IDS... [--all-reviewed] [--force] [--no-rebuild]

`author` is a resumable per-building state machine. Each selected building's
status is derived from the files under data/<site>/buildings/<id>/ (see
state.building_status and docs/ARCHITECTURE.md) and only the missing steps run:

    references   fronts.json (Street View), aerial.json (crop), references.json (the packet)
    author       one fresh, schema-bound model response -> author.json, draft.json
    render       renders/<phase>-{+u,-u,+v,-v,overview}.png (+ .json provenance), <phase>-faces.jpg
    review       one reviewer response -> review.json (review.write_review)
    repair N     while the review asks for repair and N <= max_repairs -> repair-N.json, draft.json
    scene        one batch critique of every reviewed building; failures become repairs
    compare      a re-authored building is compared against its accepted blueprint -> comparison.json
    accept       drafts -> overrides.json (blueprints, blueprint_frames, miniature_review), then site.build

Policies ported from pipeline/miniature_pipeline.py and pipeline/expand_diorama.py:
at most MAX_REPAIRS repairs, then the building is recorded as reviewed with its
failed inspection intact ("forced publication": `accept` refuses it without
--force); a re-authored building must be explicitly approved against the
accepted baseline by the reviewer or the baseline stays. Model calls share one
in-process model.Budget; budget exhaustion or Ctrl-C stops admitting new calls
while in-flight calls finish and are recorded. There is no campaign ledger, no
runs directory (model call scratch goes to runs/model-calls/, gitignored), no
supervisor: re-running the same command resumes.

Files written under buildings/<id>/ (all JSON via state.atomic_json):
    author.json      the model.execute() result of the author call plus: role, number (0), run,
                     blueprint (canonical, may be invalid), validation_errors, cues, uncertainties,
                     entrance_plan, packet_hash, frame, draft_hash (when valid), attempts (earlier
                     failed tries), terminal (True when the call failed for good -> status 'failed')
    repair-N.json    the same shape for repair pass N (role 'repair', base_hash of the repaired candidate)
    draft.json       the current valid blueprint (only written when validate() passes)
    review.json      review.write_review record (+ call, renders, scene_review, followup_review)
    comparison.json  {verdict, reason, baseline_hash, candidate_hash, reviewer, baseline_views,
                      candidate_views, call, timestamp} for a re-authored building
    renders/         phase-prefixed images and their provenance records

Standard library only at import time; render, browser, references, sources and
PIL are imported inside the functions that need them.
"""
import argparse
from collections import Counter
import concurrent.futures
import copy
import json
from pathlib import Path
import threading
import time
import uuid

from . import model
from .paths import ROOT, SitePaths, site_paths
from .review import (MAX_REPAIRS, BAD_ORIENTATION, audit_geometry, lint_blueprint, needs_repair,
                     publication_record, read_review, repair_phase, review_errors, review_record, scene_repairs,
                     write_review)
from .site import FACE_NAMES, find_building, load_overrides, load_site, settings
from .state import apply_patch, atomic_json, building_frame, building_status, fingerprint, read_json

# --- schemas (pipeline/miniature_pipeline.py, pipeline/expand_diorama.py) -------------

STRING = {'type': 'string'}
STRINGS = {'type': 'array', 'items': STRING, 'maxItems': 5}
ENTRANCE = model.object_schema({'volume': STRING, 'face': STRING, 'role': STRING, 'evidence': STRINGS,
                                'confidence': {'type': 'string', 'enum': ['observed', 'inferred', 'unknown']}})
AUTHOR = model.object_schema({'blueprint_json': STRING, 'patch_json': STRING, 'cues': STRINGS,
                              'references_used': STRINGS, 'uncertainties': STRINGS,
                              'entrance_plan': {'type': 'array', 'items': ENTRANCE, 'maxItems': 8}})
ISSUE = model.object_schema({'severity': {'type': 'string', 'enum': ['major', 'broken', 'minor']},
                             'problem': STRING, 'fix': STRING})
ORIENTATION = model.object_schema({'status': {'type': 'string', 'enum': ['correct', 'incorrect', 'uncertain']},
                                   'summary': STRING})
REVIEW = model.object_schema({'verdict': {'type': 'string', 'enum': ['ready', 'repair', 'insufficient-evidence']},
                              'summary': STRING, 'orientation': ORIENTATION,
                              'issues': {'type': 'array', 'items': ISSUE, 'maxItems': 3}})
BATCH = model.object_schema({'summary': STRING, 'buildings': {'type': 'array', 'items': model.object_schema({
    'id': STRING, 'verdict': {'type': 'string', 'enum': ['ready', 'needs-attention']}, 'summary': STRING,
    'orientation': ORIENTATION})}})
COMPARISON = model.object_schema({'verdict': {'type': 'string', 'enum': ['approved', 'rejected']}, 'reason': STRING})

# --- prompts ----------------------------------------------------------------------------

AUTHOR_TASK = 'Create a complete charming miniature. Focus on recognizable features at normal diorama viewing distance.\n'
AUTHOR_RETURN = ('\nReturn blueprint_json as a JSON-encoded complete blueprint, patch_json empty, 3–5 short recognition cues, '
                 'reference IDs used, and brief uncertainties. In entrance_plan identify each important entry by volume, '
                 'outward face, principal/secondary role, evidence IDs and confidence. First locate features using the '
                 'north-up map and actual camera poses; do not default a web-photo entrance to the nearest-road side, '
                 'mirror a wing, or duplicate the same distinctive portal on several faces. An unlocated web close-up '
                 'supplies appearance, not orientation. If placement cannot be corroborated, keep it uncertain rather '
                 'than inventing certainty. Keep blueprint under 3500 output tokens. Do not narrate. If a search photo '
                 'shows the wrong subject, ignore it and say so in uncertainties.')
LENGTH_TARGET = 'Keep blueprint under 3500 output tokens.'
BASELINE_LENGTH = 'Preserve existing detail; the output length target must not remove baseline features.'
BASELINE_REFERENCE = ('\nPUBLISHED PRODUCTION BASELINE (refine this; retain existing detail, signs, mural/texture fields and '
                      'silhouette unless photographs demonstrate a defect):\n')
BASELINE_GATE = ('\nA generic ready verdict cannot authorize replacing this baseline. An explicit visual baseline comparison '
                 'is required separately; do not simplify to satisfy an output length target.')
INVALID_NOTE = ('\nThe draft failed schema validation and was NOT rendered. The attached model views and prior visual review '
                'describe the generic fallback, not this draft. Fix the validation errors in the supplied draft and use '
                'photographs to judge its design; do not blindly apply critique of fallback geometry.')
REVIEW_TASK = '''Review one recognizable, charming architectural miniature. This is a caricature, not a measured reconstruction. Check silhouette, characteristic features, coherent miniature style and obvious visible defects. Ignore exact counts and tiny differences. Explicitly audit principal-entry orientation: compare the map, geolocated SV views, labeled four-face render sheet and actual door inventory. Author entrance plans are not evidence. Do not confuse camera heading with outward face bearing, assume the nearest road is the entrance, accept a mirrored wing, or approve duplicated principal portals. Unlocated web photos establish appearance only. Record correct/incorrect/uncertain orientation with a concrete source-to-face explanation; unresolved principal-entry placement is not ready. Request at most 3 actionable issues. First images are references; last two are model overview and four-face sheet. Search results may show wrong subjects. Keep under 650 words.\n'''
SCENE_TASK = '''Give one final batch critique of the scene and labeled four-face sheets (in listed building order). Assess charm, recognizable silhouettes, coherent materials/scale, and obvious rendering defects. Do not demand photographic reconstruction. Explicitly check entrance orientation against the prior independent source-to-face findings and actual final door inventory; author plans are unverified claims. A wrong, duplicated or unresolved principal entrance is needs-attention, even if it looks charming. Failed repairs leave the prior valid draft visible: do not claim those changes were applied. Return one entry for EVERY ID: ready or needs-attention, and correct/incorrect/uncertain orientation with concrete reasons. No further automated loop. Under 800 words.\n'''
COMPARISON_TASK = ('Compare the published production miniature against the final candidate. References come first, then TWO '
                   'BASELINE images (overview, four-face sheet), then TWO CANDIDATE images in the identical poses. Approve only '
                   'if the candidate preserves or improves recognizable silhouette, facade detail, signs, mural/texture artwork, '
                   'entrances, roof and characteristic features. Generic simplification, lost artwork or dropped detail is a '
                   'regression even if the candidate is individually plausible. Reject when uncertain. Name preserved and '
                   'changed features in your reason. This explicit comparison is the publication gate.\n')
ORIENTATION_SOURCE = ('Actual doors are computed from the rendered blueprint; author entrance plans are claims to verify. '
                      'Integrated amphitheaters use open perimeter gates: audit stageEnd and axis instead of expecting door leaves.')

KIT = ROOT / 'docs' / 'MINIATURE_KIT.md'
EXAMPLES = (Path(__file__).resolve().parent / 'miniature_examples.json',)

# Admission estimates per call role (tokens), from miniature_pipeline.call.
RESERVE = {'author': 18000, 'repair': 18000, 'review': 10000, 'scene-review': 10000, 'baseline-comparison': 10000}
ATTEMPTS = 3                     # tries per model call before the failure is terminal (expansion_queue stage_attempts)
BASELINE_FINDING = 'baseline comparison rejected the candidate'
VIEWS = (*FACE_NAMES, 'overview')
COMPARISON_FILE = 'comparison.json'
SCRATCH = ROOT / 'runs' / 'model-calls'


# --- lazy third-party-backed modules (mocked in tests) -----------------------------------

def _references():
    from . import references
    return references


def _sources():
    from . import sources
    return sources


def _render():
    from . import render
    return render


def _browser():
    from . import browser
    return browser


# --- blueprint policy (pipeline/miniature_pipeline.py, pipeline/production_baseline.py) ---

def canonical_blueprint(source):
    """Resolve an unambiguous color alias before spending a visual repair pass.

    The canonical schema still requires volume roof.color. Conflicting values
    are rejected instead of silently choosing one of the author's colors.
    """
    bp = copy.deepcopy(source)
    if not isinstance(bp, dict) or not isinstance(bp.get('volumes'), list):
        return bp
    for volume in bp['volumes']:
        if not isinstance(volume, dict) or 'roofColor' not in volume:
            continue
        roof = volume.get('roof') or {}
        if not isinstance(roof, dict):
            raise ValueError('A volume roof must be an object.')
        if 'color' in roof and roof['color'] != volume['roofColor']:
            raise ValueError('Conflicting volume roofColor and roof.color; choose the intended color.')
        volume['roof'] = {**roof, 'color': volume.pop('roofColor')}
    return bp


def validate(bp, building, baseline=None):
    """Errors that keep a blueprint out of draft.json: shape, kit-only content, lint errors, unknown keys.

    Custom images/profiles are allowed only where the accepted `baseline` already had them.
    """
    try:
        if not isinstance(bp, dict) or (not bp.get('bridge') and not bp.get('pavilion') and not bp.get('fountain')
                                        and not bp.get('amphitheater') and not 1 <= len(bp.get('volumes', [])) <= 10):
            return ['Blueprint must contain 1–10 main volumes, an integrated bridge, an open pavilion, a fountain, or an amphitheater.']
        legacy_keys = ('image', 'moldings', 'profile', 'archSpandrels')
        preserved = Counter()

        def collect(value):
            if isinstance(value, dict):
                for k, v in value.items():
                    if k in legacy_keys:
                        preserved[(k, fingerprint(v))] += 1
                    collect(v)
            elif isinstance(value, list):
                for v in value:
                    collect(v)
        collect(baseline)

        def forbidden(value):
            if isinstance(value, dict):
                for k, v in value.items():
                    if k in legacy_keys:
                        key = (k, fingerprint(v))
                        if preserved[key] <= 0:
                            return True
                        preserved[key] -= 1
                return any(forbidden(v) for v in value.values())
            return isinstance(value, list) and any(forbidden(v) for v in value)
        if forbidden(bp):
            return ['Use integrated kit components; custom profiles, panels and images are outside this workflow.']
        result = lint_blueprint(bp, building, str(building['id']))
        return result.errors + [w for w in result.warnings if 'unknown key' in w.lower()]
    except (TypeError, KeyError, ValueError, AttributeError) as exc:
        return [str(exc)]


def comparison_approved(baseline, candidate, comparison):
    """Approval is specific to both models and saved baseline/candidate views.

    A normal ready verdict is intentionally insufficient. The comparison record
    is produced by a separate reviewer call after review; authoring never
    manufactures one.
    """
    if fingerprint(baseline) == fingerprint(candidate):
        return True
    return bool(comparison and comparison.get('verdict') == 'approved'
                and comparison.get('baseline_hash') == fingerprint(baseline)
                and comparison.get('candidate_hash') == fingerprint(candidate)
                and comparison.get('reviewer') and comparison.get('reason')
                and comparison.get('baseline_views') and comparison.get('candidate_views'))


# --- per-building files -------------------------------------------------------------------

def _paths(site_or_paths):
    return site_or_paths if isinstance(site_or_paths, SitePaths) else site_paths(site_or_paths)


def comparison_path(b):
    return b.dir / COMPARISON_FILE


def completed_repairs(b, max_repairs=MAX_REPAIRS):
    """The highest repair-<n>.json present (a failed repair call still consumes its round)."""
    for number in range(max_repairs, 0, -1):
        if b.repair(number).is_file():
            return number
    return 0


def last_response(b, max_repairs=MAX_REPAIRS):
    """The newest author/repair record: repair-<n>.json for the highest n, else author.json, else None."""
    number = completed_repairs(b, max_repairs)
    record = read_json(b.repair(number)) if number else read_json(b.author)
    return record if isinstance(record, dict) else None


def candidate(b, max_repairs=MAX_REPAIRS):
    """The blueprint a repair starts from: draft.json, else the last (invalid) response's blueprint."""
    draft = read_json(b.draft)
    if draft is not None:
        return draft
    last = last_response(b, max_repairs) or {}
    return last.get('blueprint')


def status(paths, bid, overrides=None, max_repairs=MAX_REPAIRS):
    """state.building_status plus 'invalid-draft': authored, but no response has validated yet."""
    paths = _paths(paths)
    base = building_status(paths, bid, overrides, max_repairs)
    if base == 'referenced':
        last = last_response(paths.building(bid), max_repairs)
        if last and not last.get('error') and last.get('validation_errors'):
            return 'invalid-draft'
    return base


def image_path(paths, name):
    """A packet image path: absolute, or relative to data/<site>/ (falling back to the repo root)."""
    path = Path(name)
    if path.is_absolute():
        return path
    for base in (paths.data, paths.root):
        if (base / path).exists():
            return base / path
    return paths.data / path


def render_record(image):
    return read_json(Path(str(image) + '.json')) or {}


def rendered(paths, b, blueprint, phase, renderer, no_bp=False):
    """Are this phase's five views on disk, made from `blueprint` with the current renderer?"""
    digest = fingerprint(blueprint)
    for view in VIEWS:
        image = b.renders / f'{phase}-{view}.png'
        record = render_record(image)
        if not image.is_file() or record.get('renderer') != renderer:
            return False
        if not no_bp and record.get('blueprint') != digest:
            return False
    return (b.renders / f'{phase}-faces.jpg').is_file()


def review_current(record, draft, renderer):
    """Does review.json judge exactly this draft with the current renderer?"""
    if not record or record.get('draft_hash') != fingerprint(draft):
        return False
    signature = record.get('renderer_signature')
    return signature is None or signature == renderer


def call_directory(paths, bid, role):
    stamp = time.strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:6]
    return paths.root / 'runs' / 'model-calls' / paths.name / str(bid) / f'{stamp}-{role}'


# --- the run ------------------------------------------------------------------------------

class Run:
    """One `town author` invocation: options, shared budget, serialized rendering, per-building work."""

    def __init__(self, paths, ids=None, *, all=False, workers=3, max_tokens=100_000, max_seconds=600,
                 author_model='astra', reviewer_model='sol', reasoning_effort='medium', building_review=True,
                 scene_review=True, max_repairs=MAX_REPAIRS, capture='missing', image_search='bing',
                 max_web_images=1, extra_street_views=0, render_distance=90, call_timeout=120, codex='codex',
                 location='', labels=None, web_references=None, reauthor=(), dry_run=False, accept=False,
                 force=False, log=None):
        if not 1 <= int(workers) <= 6:
            raise ValueError('workers must be between 1 and 6')
        if not 0 <= int(max_web_images) <= 2:
            raise ValueError('max_web_images must be between 0 and 2')
        if int(extra_street_views) not in (0, 1, 2):
            raise ValueError('extra_street_views must be 0, 1 or 2')
        if not 1 <= int(max_repairs) <= MAX_REPAIRS:
            raise ValueError(f'max_repairs must be between 1 and {MAX_REPAIRS} (policy two-repairs-then-publish-v1)')
        if capture not in ('missing', 'reuse-only') or image_search not in ('bing', 'off'):
            raise ValueError('capture must be missing|reuse-only and image_search bing|off')
        for name, value in (('max_seconds', max_seconds), ('call_timeout', call_timeout), ('render_distance', render_distance)):
            if value is None or value <= 0:
                raise ValueError(f'{name} must be positive')
        self.paths = _paths(paths)
        self.site = load_site(self.paths)
        self.overrides = load_overrides(self.paths)
        self.config = settings(self.paths)
        self.ids, self.all, self.reauthor = [str(x) for x in ids or ()], all, {str(x) for x in reauthor or ()}
        self.workers, self.max_repairs = int(workers), int(max_repairs)
        self.author_model, self.reviewer_model, self.reasoning_effort = author_model, reviewer_model, reasoning_effort
        self.building_review, self.scene_review = building_review, scene_review
        self.capture, self.image_search = capture, image_search
        self.max_web_images, self.extra_street_views = int(max_web_images), int(extra_street_views)
        self.render_distance, self.call_timeout, self.codex = render_distance, call_timeout, codex
        self.location = location or self.config.get('title') or self.site.get('title') or ''
        self.labels = self._load(labels)
        self.web = self._load(web_references)
        self.dry_run, self.accept, self.force = dry_run, accept, force
        self.budget = model.Budget(max_tokens, max_seconds)
        self.stop = threading.Event()
        self.stopped = None
        self.lock = threading.RLock()
        self.run_id = time.strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:6]
        self.kit = KIT.read_text() if KIT.is_file() else ''
        self.examples = next((json.loads(p.read_text()) for p in EXAMPLES if p.is_file()), [])
        self.renders = Renders(self)
        self.buildings = {}
        self.performed = Counter()
        self.skipped = {}
        self._log = log or (lambda text: print(time.strftime('%H:%M:%S'), text, flush=True))
        self._sleep = time.sleep
        self._renderer = None

    @staticmethod
    def _load(value):
        if value is None:
            return {}
        if isinstance(value, dict):
            return value
        path = Path(value)
        return json.loads(path.read_text()) if path.is_file() else {}

    def log(self, text):
        self._log(text)

    @property
    def renderer(self):
        if self._renderer is None:
            self._renderer = _render().renderer_signature(self.paths.root)
        return self._renderer

    # --- selection and planning ---------------------------------------------------

    def select(self):
        mapped = [str(b['id']) for b in self.site['buildings']]
        if self.all:
            ids = list(mapped)
        elif self.ids:
            ids = list(dict.fromkeys(self.ids))
        else:
            raise ValueError('give structure ids or --all')
        ids = list(dict.fromkeys([*ids, *sorted(self.reauthor)]))
        unknown = [x for x in ids if x not in mapped]
        if unknown:
            raise ValueError(f'not in site.json: {", ".join(unknown)}')
        selected = []
        for bid in ids:
            state = self.status(bid)
            if state in ('accepted', 'failed') and bid not in self.reauthor:
                self.skipped[bid] = state
                continue
            selected.append(bid)
            self.buildings[bid] = {'status': state, 'steps': []}
        return selected

    def status(self, bid):
        return status(self.paths, bid, self.overrides, self.max_repairs)

    def building(self, bid):
        return find_building(self.site, bid)

    def baseline(self, bid):
        """The accepted blueprint a re-authored building must beat, or None."""
        if bid not in self.reauthor:
            return None
        return (self.overrides.get('blueprints') or {}).get(str(bid))

    def plan(self, bid):
        """The next step for one building, or None when it is finished for this run."""
        b = self.paths.building(bid)
        packet = read_json(b.references)
        if packet is None:
            return ('references',)
        draft = read_json(b.draft)
        last = last_response(b, self.max_repairs)
        state = self.status(bid)
        number = completed_repairs(b, self.max_repairs)
        if state in ('accepted', 'failed'):
            if bid not in self.reauthor:
                return None
            if not self.performed[(bid, 'author 0')]:
                return ('author', 0)
            if state == 'failed':
                return None
            # Re-authored in this run, but the draft still equals the accepted blueprint:
            # an invalid response continues through the bounded repairs; a no-op patch is final.
            if last and not last.get('error') and last.get('validation_errors') and number < self.max_repairs:
                return ('repair', number + 1)
            return None
        if draft is None:
            if last is None or (not last.get('number') and last.get('error')):
                return ('author', 0)
            return ('repair', number + 1) if number < self.max_repairs else None
        record = read_review(self.paths, bid)
        if review_current(record, draft, self.renderer):
            if needs_repair(record) and number < self.max_repairs:
                return ('repair', number + 1)
            return None
        phase = repair_phase(number)
        if not rendered(self.paths, b, draft, phase, self.renderer):
            return ('render', phase)
        return ('review', number)

    # --- references -------------------------------------------------------------------

    def capture_references(self, ids):
        """Street View fronts and aerial crops for every selected building that lacks them."""
        needing = [bid for bid in ids if not self.paths.building(bid).fronts.is_file()]
        if needing and self.capture == 'missing':
            self.log(f'capturing Street View fronts for {len(needing)} building(s)')
            try:
                _references().capture_fronts(self.paths, needing, faces=list(FACE_NAMES), missing=True,
                                             max_photos=1, workers=2)
            except Exception as exc:  # captures are best effort; the packet says what is missing
                self.log(f'capture unavailable: {exc}')
        aerials = [bid for bid in ids if not self.paths.building(bid).aerial.is_file()]
        if aerials and self.paths.satellite.is_file():
            try:
                _sources().crop_aerials(self.paths, aerials)
            except Exception as exc:
                self.log(f'aerial crop unavailable: {exc}')

    def step_references(self, bid):
        b = self.paths.building(bid)
        building = self.building(bid)
        name = self.labels.get(bid) or building.get('name') or building.get('addr') or f'Structure {bid}'
        packet = _references().packet(self.paths, building, name, self.location, self.web.get(bid, []),
                                      image_search=self.image_search, max_web=self.max_web_images,
                                      extra_views=self.extra_street_views)
        if not isinstance(packet, dict):
            raise ValueError('references.packet returned no packet')
        atomic_json(b.references, packet)

    def describe(self, packet):
        """The reference packet as the model sees it: a compact description and the attached images."""
        description = {k: packet.get(k) for k in ('id', 'name', 'location', 'address', 'frame')}
        description['source_tags'] = packet.get('source_tags', {})
        if packet.get('caller_notes'):
            description['caller_notes'] = packet['caller_notes']
        attachments = packet.get('attachments', packet.get('images', []))
        description['attached_references'] = [{k: r[k] for k in ('id', 'kind', 'caption', 'members') if k in r}
                                              for r in attachments]
        description['photo_evidence'] = [{k: r[k] for k in ('id', 'kind', 'caption', 'camera', 'north_up', 'page_url') if k in r}
                                         for r in packet.get('images', [])]
        return json.dumps(description, separators=(',', ':')), [image_path(self.paths, r['path']) for r in attachments]

    def orientation(self, bid, packet, blueprint):
        last = last_response(self.paths.building(bid), self.max_repairs) or {}
        doors = _references().entrance_inventory(blueprint, self.building(bid), self.site) if blueprint else []
        return {'frame': packet.get('frame'), 'author_entrance_plan': last.get('entrance_plan') or [],
                'actual_doors': doors, 'integrated_amphitheater': (blueprint or {}).get('amphitheater'),
                'source': ORIENTATION_SOURCE}

    # --- model calls ------------------------------------------------------------------

    def call(self, bid, role, prompt, schema, images):
        """One admitted, measured model call. Raises BudgetExhausted before spending."""
        which = self.author_model if role in ('author', 'repair') else self.reviewer_model
        with self.budget.reserve(RESERVE.get(role, 10000), cancel=self.stop):
            directory = call_directory(self.paths, bid, role)
            self.log(f'{bid}: {role} ({which}, one fresh response)')
            result = model.execute(directory, prompt, schema, [str(p) for p in images], model=which,
                                   effort=self.reasoning_effort, timeout=self.budget.call_timeout(self.call_timeout),
                                   binary=self.codex)
        self.budget.record(result)
        result.update(role=role, building=str(bid), model_alias=which, run=self.run_id)
        return result

    def call_with_retries(self, bid, role, prompt, schema, images):
        """Retry a failed call up to ATTEMPTS times; the last failure is marked terminal."""
        attempts = []
        for attempt in range(ATTEMPTS):
            result = self.call(bid, role, prompt, schema, images)
            if not result.get('error'):
                result['attempts'] = attempts
                return result
            transient = model.capacity_rejection(result) or model.timeout_interruption(result)
            attempts.append({k: result.get(k) for k in ('error', 'directory', 'usage', 'usage_complete',
                                                         'started_at', 'finished_at')} | {'transient': transient})
            self.log(f'{bid}: {role} failed ({result["error"]})')
            if attempt + 1 < ATTEMPTS and not self.stop.is_set():
                self._sleep(min(15, 2 ** attempt))
                continue
            result.update(attempts=attempts[:-1], terminal=True, transient=transient)
            return result
        return result

    # --- author and repair -------------------------------------------------------------

    def step_author(self, bid, number=0):
        """The author call (number 0) or repair pass `number`; writes author.json / repair-N.json and draft.json."""
        b = self.paths.building(bid)
        building = self.building(bid)
        packet = read_json(b.references) or {}
        description, images = self.describe(packet)
        baseline = self.baseline(bid)
        if baseline:
            description += BASELINE_REFERENCE + json.dumps(baseline, separators=(',', ':')) + BASELINE_GATE
        prompt = AUTHOR_TASK + self.kit + '\nREFERENCE PACKET\n' + description
        prompt += '\nAPPROVED STYLE EXAMPLES (different structures; do not copy their architecture)\n' + json.dumps(
            [e for e in self.examples if str(e.get('source_id')) != str(bid)], separators=(',', ':'))
        prompt += AUTHOR_RETURN
        repair = number > 0
        current = baseline
        if baseline:
            prompt = prompt.replace(LENGTH_TARGET, BASELINE_LENGTH)
            if not repair:
                prompt += ('\nREFINEMENT: prefer a small patch to the production baseline. Leave blueprint_json empty and '
                           'encode patch_json as {"base_hash":"' + fingerprint(baseline) +
                           '","operations":[{"op":"replace","path":"/volumes/@main/height","value":7}]}. Supports '
                           'add/replace/remove and @id selectors; an empty operations list retains the baseline unchanged. '
                           'Do not replace the model wholesale merely to fit a shorter response.')
        if repair:
            current = candidate(b, self.max_repairs)
            last = last_response(b, self.max_repairs) or {}
            record = read_review(self.paths, bid) or {}
            followup = record.get('followup_review')
            prior_errors = [a.get('error') for a in last.get('attempts') or [] if a.get('error')]
            prompt += (f'\nREPAIR PASS {number} OF {self.max_repairs}. Fix important defects and validation errors. Preserve the '
                       'rest. A fresh inspection will follow this repair. The current building review describes the attached '
                       'renders; the previous scene review supplies additional context.\n' +
                       json.dumps({'blueprint': current, 'base_hash': fingerprint(current),
                                   'review': record.get('report') or followup, 'previous_scene_review': followup,
                                   'validation_errors': last.get('validation_errors'), 'prior_errors': prior_errors},
                                  separators=(',', ':')))
            if not b.draft.is_file():
                prompt += INVALID_NOTE
            prompt += ('\nFor a small repair, leave blueprint_json empty and encode patch_json as ' +
                       json.dumps({'base_hash': fingerprint(current),
                                   'operations': [{'op': 'replace', 'path': '/volumes/@main/height', 'value': 7}]},
                                  separators=(',', ':')) +
                       '. Copy this exact base_hash; do not compute a new hash. Supports add/replace/remove and @id '
                       'selectors. Otherwise return the full corrected blueprint.')
            phase = repair_phase(completed_repairs(b, self.max_repairs))
            images += [p for p in (b.renders / f'{phase}-overview.png', b.renders / f'{phase}-faces.jpg') if p.is_file()]
        result = self.call_with_retries(bid, 'repair' if repair else 'author', prompt, AUTHOR, images)
        record = {**result, 'number': number, 'packet_hash': fingerprint(packet),
                  'frame': building_frame(self.site, building), 'timestamp': time.time()}
        if repair:
            record['base_hash'] = fingerprint(current)
        target = b.repair(number) if repair else b.author
        if result.get('error'):
            atomic_json(target, record)
            raise RuntimeError(f'{"repair" if repair else "author"} call failed: {result["error"]}')
        self.apply_response(b, building, record, result['response'], current, baseline)
        atomic_json(target, record)
        if record['validation_errors']:
            self.log(f'{bid}: response rejected: {record["validation_errors"][0]}')

    def apply_response(self, b, building, record, response, current, baseline):
        """Interpret an author/repair response: full blueprint or hash-bound patch; draft.json only when valid."""
        try:
            if response['blueprint_json'] and response['patch_json']:
                raise ValueError('Use full blueprint or patch, not both.')
            bp = (apply_patch(current, json.loads(response['patch_json'])) if current is not None and response['patch_json']
                  else json.loads(response['blueprint_json']))
            bp = canonical_blueprint(bp)
            errors = validate(bp, building, baseline)
        except (ValueError, TypeError, KeyError) as exc:
            bp, errors = None, [str(exc)]
        record.update(blueprint=bp, validation_errors=errors, cues=response.get('cues') or [],
                      uncertainties=response.get('uncertainties') or [], entrance_plan=response.get('entrance_plan') or [])
        if not errors:
            atomic_json(b.draft, bp)
            record['draft_hash'] = fingerprint(bp)
        return record

    # --- render and review -------------------------------------------------------------

    def step_render(self, bid, phase):
        self.renders.views(bid, phase)

    def step_review(self, bid, number):
        b = self.paths.building(bid)
        building = self.building(bid)
        draft = read_json(b.draft)
        frame = building_frame(self.site, building)
        lint = lint_blueprint(draft, building, str(bid))
        geometry = audit_geometry(draft) if not lint.errors else []
        if not self.building_review:
            write_review(self.paths, bid, draft, None, renderer_signature=self.renderer, findings=lint.errors,
                         geometry=geometry, frame=frame)
            return
        packet = read_json(b.references) or {}
        description, refs = self.describe(packet)
        last = last_response(b, self.max_repairs) or {}
        prior_errors = [a.get('error') for a in last.get('attempts') or [] if a.get('error')]
        prompt = REVIEW_TASK + description + '\n' + json.dumps({
            'cues': last.get('cues'), 'validation_errors': last.get('validation_errors'), 'author_errors': prior_errors,
            'orientation_audit': self.orientation(bid, packet, draft)})
        tags = packet.get('source_tags') or {}
        if tags.get('building') == 'bridge':
            prompt += '\nFor this bridge, audit the span axis, open spans and approaches. A bridge has no principal entrance; absence of doors is correct.'
        if tags.get('amenity') == 'fountain':
            prompt += '\nFor this fountain, audit basin, pylon, stepped crown and corner jets. It has no principal entrance; an empty door inventory is correct.'
        if 'amphitheater' in str(packet.get('name', '')).lower():
            prompt += ('\nFor an open amphitheater, audit stage-house orientation and the open perimeter gates. The integrated '
                       'component has no door leaves; an empty door inventory is expected. Compare the current replacement '
                       'with current references; pre-replacement photos establish location only.')
        phase = repair_phase(number)
        views = {'overview': b.renders / f'{phase}-overview.png', 'faces': b.renders / f'{phase}-faces.jpg'}
        result = self.call_with_retries(bid, 'review', prompt, REVIEW, refs + list(views.values()))
        if result.get('error'):
            raise RuntimeError(f'review call failed: {result["error"]}')
        record = write_review(self.paths, bid, draft, result['response'], renderer_signature=self.renderer,
                              model=self.reviewer_model, findings=lint.errors, geometry=geometry, frame=frame)
        record['call'] = {k: result.get(k) for k in ('directory', 'usage', 'usage_complete', 'duration', 'run', 'model')}
        record['renders'] = {view: self.paths.relative(path) for view, path in views.items()}
        atomic_json(b.review, record)
        verdict = (result['response'] or {}).get('verdict')
        self.log(f'{bid}: review {verdict}' + ('' if record['passed'] else ' (repair requested)'))

    # --- scene critique ------------------------------------------------------------------

    def scene_round(self, ids):
        """One batch critique of every reviewed building; returns the ids selected for another repair."""
        members = []
        for bid in ids:
            b = self.paths.building(bid)
            draft = read_json(b.draft)
            record = read_review(self.paths, bid)
            if draft is None or not review_current(record, draft, self.renderer) or self.buildings[bid].get('error'):
                continue
            members.append(bid)
        if not members:
            return []
        if all((read_review(self.paths, bid).get('scene_review') or {}).get('draft_hash') ==
               fingerprint(read_json(self.paths.building(bid).draft)) for bid in members):
            return []  # this exact set of drafts was already critiqued
        summary, sheets = [], []
        for bid in members:
            b = self.paths.building(bid)
            draft = read_json(b.draft)
            record = read_review(self.paths, bid)
            packet = read_json(b.references) or {}
            last = last_response(b, self.max_repairs) or {}
            number = completed_repairs(b, self.max_repairs)
            phase = repair_phase(number)
            if not rendered(self.paths, b, draft, phase, self.renderer):
                self.renders.views(bid, phase)
            sheets.append(b.renders / f'{phase}-faces.jpg')
            summary.append({'id': bid, 'name': packet.get('name'), 'cues': last.get('cues'), 'prior_review': record.get('report'),
                            'repair_applied': number > 0, 'validation_errors': last.get('validation_errors'),
                            'orientation_audit': self.orientation(bid, packet, draft)})
        scene = call_directory(self.paths, 'scene', 'scene-capture') / 'scene.png'
        self.renders.scene(members, scene)
        result = self.call_with_retries('scene', 'scene-review', SCENE_TASK + json.dumps(summary, separators=(',', ':')),
                                        BATCH, [scene, *sheets])
        if result.get('error'):
            raise RuntimeError(f'scene review failed: {result["error"]}')
        response = result['response']
        entries = response.get('buildings') or []
        if len(entries) != len(members) or {str(x.get('id')) for x in entries} != set(members):
            raise ValueError('Scene critique did not cover each requested structure exactly once.')
        for verdict in entries:
            b = self.paths.building(verdict['id'])
            record = read_review(self.paths, verdict['id'])
            record.pop('legacy', None)
            record['scene_review'] = {**copy.deepcopy(verdict), 'draft_hash': fingerprint(read_json(b.draft)),
                                      'model': self.reviewer_model, 'run': self.run_id, 'timestamp': time.time()}
            atomic_json(b.review, record)
        selected = scene_repairs(self.paths, {'scene_review': response})
        self.log(f'scene critique: {len(selected)} of {len(members)} building(s) sent back for repair')
        return selected

    # --- baseline comparison -------------------------------------------------------------

    def compare(self, bid):
        """Judge a re-authored draft against its accepted blueprint; returns 'repair' when another round follows."""
        b = self.paths.building(bid)
        baseline = self.baseline(bid)
        draft = read_json(b.draft)
        if not baseline or draft is None or fingerprint(baseline) == fingerprint(draft):
            return None
        record = read_review(self.paths, bid)
        if not review_current(record, draft, self.renderer):
            return None
        existing = read_json(comparison_path(b)) or {}
        if existing.get('baseline_hash') == fingerprint(baseline) and existing.get('candidate_hash') == fingerprint(draft):
            return None
        number = completed_repairs(b, self.max_repairs)
        baseline_views = self.renders.views(bid, 'production-baseline', no_bp=True)
        candidate_views = self.renders.views(bid, repair_phase(number))
        packet = read_json(b.references) or {}
        description, refs = self.describe(packet)
        pick = lambda views: [views['overview'], views['faces']]  # noqa: E731
        result = self.call_with_retries(bid, 'baseline-comparison', COMPARISON_TASK + description, COMPARISON,
                                        refs + pick(baseline_views) + pick(candidate_views))
        if result.get('error'):
            raise RuntimeError(f'baseline comparison failed: {result["error"]}')
        comparison = {**result['response'], 'baseline_hash': fingerprint(baseline), 'candidate_hash': fingerprint(draft),
                      'reviewer': self.reviewer_model, 'baseline_views': [str(p) for p in pick(baseline_views)],
                      'candidate_views': [str(p) for p in pick(candidate_views)],
                      'call': {k: result.get(k) for k in ('directory', 'usage', 'usage_complete', 'duration', 'run', 'model')},
                      'timestamp': time.time()}
        atomic_json(comparison_path(b), comparison)
        self.log(f'{bid}: baseline comparison {comparison.get("verdict")}')
        if comparison.get('verdict') == 'approved':
            return None
        record.pop('legacy', None)
        if number >= self.max_repairs:
            # No round left to answer the rejection: the accepted model stays; accept refuses without --force.
            record.update(repairs_exhausted=True, repair_limit=self.max_repairs, baseline_rejected=True)
            atomic_json(b.review, record)
            return None
        record['followup_review'] = {'verdict': 'repair', 'summary': comparison.get('reason') or BASELINE_FINDING}
        record['scene_repair_requested'] = True
        record['passed'] = False
        if BASELINE_FINDING not in record.setdefault('findings', []):
            record['findings'].append(BASELINE_FINDING)
        atomic_json(b.review, record)
        return 'repair'

    # --- driving -------------------------------------------------------------------------

    def perform(self, bid, step):
        kind = step[0]
        if kind == 'references':
            self.step_references(bid)
        elif kind == 'author':
            self.step_author(bid, 0)
        elif kind == 'repair':
            self.step_author(bid, step[1])
        elif kind == 'render':
            self.step_render(bid, step[1])
        elif kind == 'review':
            self.step_review(bid, step[1])
        else:
            raise ValueError(f'unknown step {step}')

    def work(self, bid):
        """Advance one building until it is finished, fails, or the run stops."""
        entry = self.buildings[bid]
        while not self.stop.is_set():
            step = self.plan(bid)
            if step is None:
                break
            name = ' '.join(str(x) for x in step)
            key = (bid, name)
            if self.performed[key] >= ATTEMPTS or (step[0] == 'author' and self.performed[key]):
                entry['error'] = f'{name}: did not advance the building; stopping'
                break
            self.performed[key] += 1
            entry['steps'].append(name)
            try:
                self.perform(bid, step)
            except model.BudgetExhausted as exc:
                self.halt(exc)
                break
            except Exception as exc:
                entry['error'] = f'{name}: {type(exc).__name__}: {exc}'
                self.log(f'{bid}: {entry["error"][:200]}')
                break
        self.mark_exhausted(bid)
        entry['status'] = self.status(bid)

    def mark_exhausted(self, bid):
        """A failed inspection whose repair rounds are spent is recorded as such in review.json (forced publication)."""
        b = self.paths.building(bid)
        draft = read_json(b.draft)
        record = read_review(self.paths, bid)
        if draft is None or not review_current(record, draft, self.renderer) or record.get('passed'):
            return
        if completed_repairs(b, self.max_repairs) < self.max_repairs or record.get('repairs_exhausted'):
            return
        record.pop('legacy', None)
        record.update(repairs_exhausted=True, repair_limit=self.max_repairs)
        atomic_json(b.review, record)

    def drive(self, ids):
        ids = [bid for bid in ids if not self.buildings[bid].get('error')]
        if not ids:
            return
        pool = concurrent.futures.ThreadPoolExecutor(max_workers=self.workers, thread_name_prefix='author')
        futures = {pool.submit(self.work, bid): bid for bid in ids}
        try:
            for future in concurrent.futures.as_completed(futures):
                future.result()
        except BaseException as exc:  # Ctrl-C: stop admitting work, let in-flight calls settle
            self.halt(str(exc) or type(exc).__name__)
            raise
        finally:
            pool.shutdown(wait=True, cancel_futures=True)

    def summary(self, selected, accepted=(), refused=()):
        return {'site': self.paths.name, 'run': self.run_id, 'selected': list(selected), 'skipped': dict(self.skipped),
                'buildings': {bid: self.buildings[bid] for bid in selected},
                'counts': dict(Counter(self.buildings[bid].get('status') for bid in selected)),
                'budget': self.budget.summary(), 'stopped': self.stopped,
                'accepted': list(accepted), 'refused': list(refused), 'dry_run': self.dry_run}

    def halt(self, exc):
        self.stopped = self.stopped or str(exc)
        self.stop.set()

    def followups(self, selected):
        """After every building settled: the scene critique, then baseline comparisons. Returns ids to repair again."""
        pending = []
        if self.scene_review:
            try:
                pending += self.scene_round(selected)
            except model.BudgetExhausted as exc:
                self.halt(exc)
                return []
            except Exception as exc:
                self.log(f'scene critique skipped: {exc}')
        if pending:
            return pending
        for bid in selected:
            if not self.baseline(bid) or self.buildings[bid].get('error'):
                continue
            try:
                if self.compare(bid) == 'repair':
                    pending.append(bid)
            except model.BudgetExhausted as exc:
                self.halt(exc)
                return []
            except Exception as exc:
                self.buildings[bid]['error'] = f'compare: {type(exc).__name__}: {exc}'
        return pending

    def run(self):
        selected = self.select()
        if self.dry_run:
            for bid in selected:
                step = self.plan(bid)
                self.buildings[bid]['next'] = ' '.join(str(x) for x in step) if step else None
            return self.summary(selected)
        if not selected:
            self.log('nothing to do')
            return self.summary(selected)
        try:
            self.capture_references(selected)
            pending = list(selected)
            for _ in range(self.max_repairs + 2):
                self.drive(pending)
                if self.stop.is_set():
                    break
                pending = self.followups(selected)
                if self.stop.is_set() or not pending:
                    break
        except KeyboardInterrupt:
            self.stopped = self.stopped or 'interrupted'
        finally:
            self.renders.close()
        for bid in selected:
            self.buildings[bid]['status'] = self.status(bid)
        accepted, refused = [], []
        if self.accept and not self.stop.is_set():
            ready = [bid for bid in selected if self.buildings[bid]['status'] == 'reviewed']
            if ready:
                accepted, refused = _accept(self.paths, ready, rebuild=True, force=self.force, out=self.log)
                for bid in accepted:
                    self.buildings[bid]['status'] = 'accepted'
        result = self.summary(selected, accepted, [f'{bid}: {why}' for bid, why in refused])
        self.log(f'{self.paths.name}: ' + ' '.join(f'{k}={v}' for k, v in sorted(result['counts'].items())) +
                 f'; {result["budget"]["tokens"]:,} tokens in {result["budget"]["calls"]} calls, {result["budget"]["seconds"]}s' +
                 (f'; stopped: {self.stopped}' if self.stopped else ''))
        return result


class Renders:
    """Every browser render of a run, serialized: one render.RenderBatch per phase and draft revision."""

    def __init__(self, run):
        self.run = run
        self.lock = threading.Lock()
        self.batch = None
        self.key = None

    def close(self):
        with self.lock:
            if self.batch is not None:
                self.batch.close()
            self.batch, self.key = None, None

    def _batch(self, phase, drafts):
        revision = fingerprint([phase, [(x, fingerprint(read_json(self.run.paths.building(x).draft))) for x in drafts]])
        if self.key != (phase, revision):
            if self.batch is not None:
                self.batch.close()
            self.batch = _render().RenderBatch(self.run.paths, drafts=drafts, phase=phase, site=self.run.site)
            self.key = (phase, revision)
        return self.batch

    def views(self, bid, phase, *, no_bp=False):
        """Render the five review views of `bid` for `phase` (+ the labelled four-face sheet); returns {view: path}."""
        run = self.run
        b = run.paths.building(bid)
        building = run.building(bid)
        with self.lock:
            drafts = [] if no_bp else sorted(x for x in run.buildings if run.paths.building(x).draft.is_file())
            batch = self._batch(phase, drafts)
            distance = max(run.render_distance, 2.6 * max(building['obb']['w'], building['obb']['d']))
            out = {}
            for face in FACE_NAMES:
                out[face] = Path(batch.capture(building, face, distance, False, b.renders / f'{phase}-{face}.png', no_bp=no_bp))
            out['overview'] = Path(batch.capture(building, 'front', distance, True, b.renders / f'{phase}-overview.png', no_bp=no_bp))
            faces = ((read_json(b.references) or {}).get('frame') or {}).get('faces') or {}
            labels = []
            for face in FACE_NAMES:
                context = faces.get(face) or {}
                road = (context.get('nearest_road_outward') or {}).get('name', 'no named road')
                bearing = context.get('bearing', '?')
                labels.append((out[face], f'{face} | outward {bearing} deg | {road}'))
            sheet = b.renders / f'{phase}-faces.jpg'
            _references().contact_sheet(labels, sheet, cell=(650, 460))
            out['faces'] = sheet
            return out

    def scene(self, ids, out):
        """Screenshot the viewer with every draft of `ids` loaded (the assembled batch scene)."""
        run = self.run
        with self.lock:
            browser, render = _browser(), _render()
            browser.ensure_server()
            browser.ensure_browser()
            url = f'{render.viewer_url()}?site={run.paths.name}&bp={",".join(ids)}&notrees=1'
            Path(out).parent.mkdir(parents=True, exist_ok=True)
            with browser.Tab(1200, 900, 1) as tab:
                tab.go(url)
                tab.wait_town()
                tab.hide(render.HIDE_UI)
                tab.ev('(()=>{const w=window.__town; if(w.bokeh) w.bokeh.enabled=false; w.renderLoop.wake(); return 1})()')
                time.sleep(.6)
                tab.shot(str(out))
            return Path(out)


def author(paths, ids=None, **options):
    """Run stages 3-6 for the selected buildings; see `Run`. Returns the summary dict."""
    return Run(paths, ids, **options).run()


# --- accept -----------------------------------------------------------------------------------

def _forced_record(st, bp, run, scene, repairs):
    """A publication record for --force when policy alone would not publish (repairs remain / no review)."""
    return {'published': True, 'forced': True, 'policy': 'operator-forced', 'reason': 'operator-forced',
            'inspection_passed': st['status'] == 'ready', 'inspection_status': st['status'],
            'repair_attempts': repairs, 'repair_limit': MAX_REPAIRS, 'retroactive': False, 'published_at': time.time(),
            'run': run, 'blueprint_hash': fingerprint(bp),
            'inspection': {'building': copy.deepcopy(st.get('review')), 'scene': copy.deepcopy(scene),
                           'baseline_comparison': copy.deepcopy(st.get('baseline_comparison')),
                           'validation_errors': copy.deepcopy(st.get('validation_errors', []))}}


def _judge(paths, site, overrides, bid, force):
    """Validate one draft for acceptance. Returns (blueprint, record | None, reasons); reasons refuse."""
    b = paths.building(bid)
    draft = read_json(b.draft)
    if draft is None:
        return None, None, ['no draft.json']
    try:
        building = find_building(site, bid)
    except KeyError as exc:
        return None, None, [str(exc)]
    errors = validate(draft, building)
    if errors:
        return None, None, [f'lint: {e}' for e in errors]
    existing = (overrides.get('blueprints') or {}).get(str(bid))
    if existing is not None and fingerprint(existing) == fingerprint(draft):
        return draft, None, []  # already accepted: idempotent skip
    reasons = []
    review = read_review(paths, bid) or {}
    review_problems = review_errors(paths, site, building, draft)
    if review_problems:
        reasons += review_problems
    scene = review.get('scene_review')
    if scene and scene.get('draft_hash') not in (None, fingerprint(draft)):
        scene = None  # a critique of an older draft
    scene_ok = not scene or (scene.get('verdict') == 'ready' and (scene.get('orientation') or {}).get('status') not in BAD_ORIENTATION)
    comparison = read_json(comparison_path(b))
    comparison_ok = existing is None or comparison_approved(existing, draft, comparison)
    if not comparison_ok:
        reasons.append('existing accepted model retained: the re-authored draft was not approved against it (comparison.json)')
    ready = not review_problems and scene_ok and comparison_ok
    st = {'status': 'ready' if ready else 'needs-attention', 'review': review.get('report'), 'validation_errors': [],
          'baseline_comparison': comparison}
    repairs = completed_repairs(b)
    run = (read_json(b.author) or {}).get('run') or time.strftime('%Y%m%d-%H%M%S') + '-' + fingerprint(draft)[:6]
    publication = publication_record(st, draft, run, scene, repairs)
    if publication is None:
        reasons.append('review did not pass and repair rounds remain' if review_problems else 'not ready and repairs remain')
        if force:
            publication = _forced_record(st, draft, run, scene, repairs)
    elif publication['forced']:
        reasons.append(f'forced publication ({publication["reason"]}): inspection failed after {repairs} repair(s)')
    if force:
        reasons = []
    record = review_record({**st, 'publication': publication}, run)
    return draft, record, reasons


def _accept(paths, ids, *, rebuild=True, force=False, out=print):
    """Accept the acceptable drafts among `ids`; returns (accepted ids, [(id, reason)] refused)."""
    paths = _paths(paths)
    site = load_site(paths)
    overrides = load_overrides(paths)
    accepted, refused, changed = [], [], False
    for bid in [str(x) for x in ids]:
        draft, record, reasons = _judge(paths, site, overrides, bid, force)
        if reasons:
            refused.append((bid, '; '.join(reasons)))
            out(f'{bid}: refused: {reasons[0]}' + (f' (+{len(reasons) - 1} more)' if len(reasons) > 1 else ''))
            continue
        if record is None:
            accepted.append(bid)  # identical draft already accepted
            continue
        building = find_building(site, bid)
        overrides.setdefault('blueprints', {})[bid] = draft
        overrides.setdefault('blueprint_frames', {})[bid] = building_frame(site, building)
        overrides.setdefault('miniature_review', {})[bid] = record
        accepted.append(bid)
        changed = True
        out(f'{bid}: accepted ({record["status"]})')
    if changed:
        atomic_json(paths.overrides, overrides, compact=True)
        if rebuild:
            from . import site as site_module
            site_module.build(paths, write=True)
    return accepted, refused


def accept(paths, ids, *, rebuild=True, force=False, out=print):
    """Drafts -> overrides.json blueprints (+ blueprint_frames, miniature_review), then site.build.

    All-or-nothing: a draft with lint errors, a missing/stale/failed review, an
    exhausted-repairs ("forced") inspection, or an unapproved baseline comparison
    refuses the whole call (ValueError) unless `force`. Identical drafts are
    skipped, so repeating a call changes nothing. Returns the accepted ids.
    """
    paths = _paths(paths)
    site = load_site(paths)
    overrides = load_overrides(paths)
    problems = []
    for bid in [str(x) for x in ids]:
        _, _, reasons = _judge(paths, site, overrides, bid, force)
        problems += [f'{bid}: {r}' for r in reasons]
    if problems:
        raise ValueError('accept refused; nothing changed:\n  ' + '\n  '.join(problems))
    accepted, _ = _accept(paths, ids, rebuild=rebuild, force=force, out=out)
    return accepted


def reviewed_ids(paths):
    """Every building whose derived status is 'reviewed' (drafts ready for accept)."""
    paths = _paths(paths)
    overrides = load_overrides(paths)
    return [bid for bid in paths.building_ids() if building_status(paths, bid, overrides) == 'reviewed']


# --- CLI ----------------------------------------------------------------------------------------

class _IntermixedParser(argparse.ArgumentParser):
    """Lets `town author <site> --dry-run ID ID` work: positional ids may follow options."""
    _intermixed = False

    def parse_known_args(self, args=None, namespace=None):
        if self._intermixed:
            return super().parse_known_args(args, namespace)
        self._intermixed = True
        try:
            return self.parse_known_intermixed_args(args, namespace)
        finally:
            self._intermixed = False


def _intermixed(parser):
    parser.__class__ = _IntermixedParser  # add_parser fixes the class; only the parsing method differs
    return parser


def register(subparsers):
    p = _intermixed(subparsers.add_parser('author', help='author, review, repair (bounded) and optionally accept blueprints',
                                          description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter))
    p.add_argument('site')
    p.add_argument('ids', nargs='*', help='structure ids (default: --all)')
    p.add_argument('--all', action='store_true', help='every structure in site.json that is not accepted or failed')
    p.add_argument('--reauthor', nargs='*', default=[], metavar='ID', help='author these again, even if accepted or failed')
    p.add_argument('--workers', type=int, default=3)
    p.add_argument('--max-tokens', type=int, default=100_000)
    p.add_argument('--max-seconds', type=float, default=600)
    p.add_argument('--author-model', default='astra')
    p.add_argument('--reviewer-model', default='sol')
    p.add_argument('--reasoning-effort', choices=['low', 'medium', 'high'], default='medium')
    p.add_argument('--no-building-review', dest='building_review', action='store_false', help='record lint-only reviews')
    p.add_argument('--no-scene-review', dest='scene_review', action='store_false')
    p.add_argument('--max-repairs', type=int, default=MAX_REPAIRS)
    p.add_argument('--capture', choices=['missing', 'reuse-only'], default='missing')
    p.add_argument('--image-search', choices=['bing', 'off'], default='bing')
    p.add_argument('--max-web-images', type=int, default=1)
    p.add_argument('--extra-street-views', type=int, choices=[0, 1, 2], default=0)
    p.add_argument('--render-distance', type=float, default=90)
    p.add_argument('--call-timeout', type=float, default=120)
    p.add_argument('--codex', default='codex')
    p.add_argument('--location', default='', help='place name for image searches (default: the site title)')
    p.add_argument('--labels', help='JSON {id: name} (default: sites/<site>/labels.json when present)')
    p.add_argument('--web-references', help='JSON {id: [{url, page_url, title}]} (default: sites/<site>/web-references.json)')
    p.add_argument('--accept', action='store_true', help='accept every building that ends the run reviewed')
    p.add_argument('--force', action='store_true', help='with --accept: also accept forced publications')
    p.add_argument('--dry-run', action='store_true', help='print each building\'s status and next step; no model or browser')
    p.set_defaults(run=_run_author)
    a = _intermixed(subparsers.add_parser('accept', help='copy reviewed drafts into overrides.json and rebuild the scene'))
    a.add_argument('site')
    a.add_argument('ids', nargs='*')
    a.add_argument('--all-reviewed', action='store_true', help='every building whose status is reviewed')
    a.add_argument('--force', action='store_true', help='accept forced publications and unapproved re-authoring too')
    a.add_argument('--no-rebuild', dest='rebuild', action='store_false')
    a.set_defaults(run=_run_accept)


def _run_author(args):
    paths = site_paths(args.site)
    labels = args.labels or (paths.labels if paths.labels.is_file() else None)
    web = args.web_references or (paths.web_references if paths.web_references.is_file() else None)
    try:
        result = author(paths, args.ids, all=args.all or not (args.ids or args.reauthor), workers=args.workers, max_tokens=args.max_tokens,
                        max_seconds=args.max_seconds, author_model=args.author_model, reviewer_model=args.reviewer_model,
                        reasoning_effort=args.reasoning_effort, building_review=args.building_review,
                        scene_review=args.scene_review, max_repairs=args.max_repairs, capture=args.capture,
                        image_search=args.image_search, max_web_images=args.max_web_images,
                        extra_street_views=args.extra_street_views, render_distance=args.render_distance,
                        call_timeout=args.call_timeout, codex=args.codex, location=args.location, labels=labels,
                        web_references=web, reauthor=args.reauthor, dry_run=args.dry_run, accept=args.accept,
                        force=args.force)
    except (ValueError, FileNotFoundError) as exc:
        print(f'error: {exc}')
        return 2
    if args.dry_run:
        for bid, entry in result['buildings'].items():
            print(f'{entry["status"]:13} {bid}  next: {entry.get("next") or "-"}')
        for bid, state in result['skipped'].items():
            print(f'{state:13} {bid}  skipped (use --reauthor to author again)')
        print(json.dumps({k: result[k] for k in ('counts', 'skipped')}))
        return 0
    for bid, entry in result['buildings'].items():
        line = f'{entry["status"]:13} {bid}  ' + ' > '.join(entry['steps'])
        if entry.get('error'):
            line += f'  ERROR {entry["error"]}'
        print(line)
    for line in result['refused']:
        print('refused', line)
    if result['stopped']:
        print(f'stopped: {result["stopped"]}')
        return 1
    return 1 if any(e.get('error') for e in result['buildings'].values()) else 0


def _run_accept(args):
    paths = site_paths(args.site)
    ids = list(args.ids)
    if args.all_reviewed:
        ids += [x for x in reviewed_ids(paths) if x not in ids]
    if not ids:
        print('nothing to accept (give ids or --all-reviewed)')
        return 0
    try:
        accepted = accept(paths, ids, rebuild=args.rebuild, force=args.force)
    except ValueError as exc:
        print(exc)
        return 1
    print(f'accepted {len(accepted)} blueprint(s): {", ".join(accepted)}')
    return 0
