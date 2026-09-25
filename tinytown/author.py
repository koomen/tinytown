"""Stages 4-6: author a blueprint per building, review and repair it (bounded), critique the scene, accept.

    town author <site> [IDS...] [--all] [--reauthor ID...] [--accept] [--dry-run] ...
    town accept <site> IDS... [--all-reviewed] [--force] [--no-rebuild]

`author` is a resumable per-building state machine. Each selected building's
status is derived from the files under data/<site>/buildings/<id>/ (see
state.building_status and docs/ARCHITECTURE.md) and only the missing steps run:

    references   fronts.json (Street View), aerial.json (crop), references.json (the packet)
    author       one fresh, schema-bound model response -> author.json, draft.json
    fix          an invalid response gets one cheap validation-fix call (no images, no repair round)
    render       renders/<phase>-{+u,-u,+v,-v,overview}.png (+ .json provenance), <phase>-faces.jpg,
                 <phase>-pairs.jpg (each face's geolocated photo beside its render)
    self-check N the author sees its own render beside the photos and may patch the draft (--self-checks)
    review       one reviewer response -> review.json (review.write_review): verdict, orientation, rubric scores
    repair N     while the review asks for repair and N <= max_repairs -> repair-N.json, draft.json
    scene        one batch critique of every reviewed building; failures become repairs
    compare      a re-authored building is compared against its accepted blueprint -> comparison.json
    accept       drafts -> overrides.json (blueprints, blueprint_frames, miniature_review), then site.build

Policies ported from pipeline/miniature_pipeline.py and pipeline/expand_diorama.py:
at most MAX_REPAIRS repairs, then the building is recorded as reviewed with its
failed inspection intact ("forced publication": `accept` refuses it without
--force) and the best-scoring reviewed draft, not merely the last one, is the
draft that stays; a re-authored building must be explicitly approved against the
accepted baseline by the reviewer or the baseline stays. An unresolved entrance
("uncertain" orientation) blocks only landmark, commercial, civic and large
buildings (orientation_policy). Model calls share one in-process model.Budget
and a per-building token cap; budget exhaustion or Ctrl-C stops admitting new
calls while in-flight calls finish and are recorded. There is no campaign ledger, no
runs directory (model call scratch goes to runs/model-calls/, gitignored), no
supervisor: re-running the same command resumes.

Files written under buildings/<id>/ (all JSON via state.atomic_json):
    author.json      the model.execute() result of the author call plus: role, number (0), run,
                     blueprint (canonical, may be invalid), validation_errors, cues, uncertainties,
                     entrance_plan, packet_hash, frame, draft_hash (when valid), attempts (earlier
                     failed tries), terminal (True when the call failed for good -> status 'failed'),
                     fixes (validation-fix calls; a successful one moves the rejected blueprint to
                     invalid_blueprint and its errors to initial_validation_errors)
    self-check-N.json the same shape for self-check N plus base_hash and phase (the render phase of the
                     draft it produced, None when it changed nothing)
    repair-N.json    the same shape for repair pass N (role 'repair', base_hash of the repaired candidate)
    draft.json       the current valid blueprint (only written when validate() passes)
    review.json      review.write_review record (+ call, renders, phase, scene_review, followup_review,
                     history of earlier drafts' reviews, selected_draft when a better earlier draft won)
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
import math
from pathlib import Path
import threading
import time
import uuid

from . import model
from .paths import ROOT, SitePaths, site_paths
from .review import (MAX_REPAIRS, SCORE_KEYS, audit_geometry, bad_orientation, lint_blueprint, needs_repair,
                     publication_record, read_review, repair_phase, review_errors, review_record, review_score,
                     scene_repairs, schema_errors, write_review)
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
SCORE = {'type': 'integer', 'enum': [1, 2, 3, 4, 5]}
SCORES = model.object_schema({key: SCORE for key in (*SCORE_KEYS, 'overall')})
REVIEW = model.object_schema({'verdict': {'type': 'string', 'enum': ['ready', 'repair', 'insufficient-evidence']},
                              'summary': STRING, 'orientation': ORIENTATION, 'scores': SCORES,
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
                 'than inventing certainty. Keep blueprint under 8000 output tokens. Do not narrate. If a search photo '
                 'shows the wrong subject, ignore it and say so in uncertainties.')
LENGTH_TARGET = 'Keep blueprint under 8000 output tokens.'
BASELINE_LENGTH = 'Preserve existing detail; the output length target must not remove baseline features.'
BASELINE_REFERENCE = ('\nPUBLISHED PRODUCTION BASELINE (refine this; retain existing detail, signs, mural/texture fields and '
                      'silhouette unless photographs demonstrate a defect):\n')
BASELINE_GATE = ('\nA generic ready verdict cannot authorize replacing this baseline. An explicit visual baseline comparison '
                 'is required separately; do not simplify to satisfy an output length target.')
INVALID_NOTE = ('\nThe draft failed schema validation and was NOT rendered. The attached model views and prior visual review '
                'describe the generic fallback, not this draft. Fix the validation errors in the supplied draft and use '
                'photographs to judge its design; do not blindly apply critique of fallback geometry.')
REVIEW_TASK = '''Review one recognizable, charming architectural miniature. This is a caricature, not a measured reconstruction. Check silhouette, roof form, porches, characteristic features, palette/materials, coherent miniature style and obvious visible defects. Ignore exact counts and tiny differences. Explicitly audit principal-entry orientation: compare the map, geolocated SV views, the photo|render pairs and actual door inventory. Author entrance plans are not evidence. Do not confuse camera heading with outward face bearing, assume the nearest road is the entrance, accept a mirrored wing, or approve duplicated principal portals (a duplicated or mirrored principal entrance is orientation "incorrect"). Unlocated web photos establish appearance only. Record correct/incorrect/uncertain orientation with a concrete source-to-face explanation; follow the ORIENTATION POLICY given below. Every issue must be a concrete blueprint edit the author can make (name the volume/face/component and the change in `fix`). Missing or unverifiable evidence (an entrance no photograph shows, an unseen elevation) is NOT an issue: say it in the summary and the orientation status instead. Request at most 3 issues, most visible first. Score the miniature 1-5 (5 best) for silhouette, roof, materials (palette and cladding), entrance, details (characteristic features) and overall recognizability; scores compare drafts of the same building, so be consistent. Images: references first (orientation map, aerial, any web photos); then a PHOTO|RENDER sheet with one row per face (the geolocated Street View photo on the left, the miniature seen from the same side on the right, labelled with outward bearing and road) or, without photos, a labelled four-face render sheet; last the miniature overview. Search results may show wrong subjects. Keep under 650 words.\n'''
STRICT_POLICY = ('\nORIENTATION POLICY: strict. This is a landmark, commercial, civic, institutional or large building: an '
                 'unresolved principal-entry placement (orientation "uncertain") is not ready.')
LENIENT_POLICY = ('\nORIENTATION POLICY: lenient. This is an ordinary house, garage or outbuilding: report "uncertain" '
                  'when no photograph settles the entrance, but that alone does not block ready. A demonstrably wrong, '
                  'mirrored or duplicated entrance ("incorrect") still does.')
SCENE_TASK = '''Give one final batch critique of the scene and the per-building photo|render sheets (in listed building order). Assess charm, recognizable silhouettes, coherent materials/scale, and obvious rendering defects. Do not demand photographic reconstruction. Explicitly check entrance orientation against the prior independent source-to-face findings and actual final door inventory; author plans are unverified claims. A wrong or duplicated principal entrance is needs-attention, even if it looks charming. An unresolved principal entrance is needs-attention only for buildings whose orientation_policy is strict. Failed repairs leave the prior valid draft visible: do not claim those changes were applied. Return one entry for EVERY ID: ready or needs-attention, and correct/incorrect/uncertain orientation with concrete reasons; needs-attention must name a visible blueprint defect or a wrong entrance, never only missing evidence. No further automated loop. Under 800 words.\n'''
FIX_TASK = ('Your miniature blueprint failed schema validation and cannot be rendered. Correct ONLY the listed validation '
            'errors using the component catalog below; keep every other design choice. Unknown keys must be removed or '
            'replaced by the documented key for the same intent. Return a hash-bound patch (preferred) or the full corrected '
            'blueprint, empty cues/uncertainties are fine, and repeat the entrance plan unchanged if you know it.\n')
SELF_CHECK_TASK = ('\nSELF-CHECK {n} OF {total}. You authored the blueprint below; it validated and was rendered. The last '
                   'images show it: a PHOTO|RENDER sheet (the geolocated photo of each face beside your miniature seen from '
                   'the same side) and an overview. Compare them honestly: silhouette and massing, roof type/pitch/ridge '
                   'direction, porches and steps, window and door rhythm, palette and cladding, characteristic details and '
                   'entrance placement. Fix the most visible discrepancies with a hash-bound patch. If it already reads well '
                   'at diorama distance, return an empty operations list. Do not invent features no reference shows.\n')
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

# Admission estimates per call role (tokens): prompt (kit, examples, packet) plus an up-to-8k-token blueprint.
RESERVE = {'author': 30000, 'repair': 30000, 'self-check': 30000, 'fix': 12000, 'review': 12000,
           'scene-review': 16000, 'baseline-comparison': 12000}
ATTEMPTS = 3                     # tries per model call before the failure is terminal (expansion_queue stage_attempts)
MAX_FIXES = 1                    # validation-fix calls per author/repair response; they never consume a repair round
MAX_SELF_CHECKS = 2              # author looks at its own render before the independent review
MAX_TOKENS_PER_BUILDING = 300_000
EXAMPLE_COUNT = 4                # style examples retrieved per building
EXAMPLE_CHARS = 24_000           # total characters of example blueprints in one prompt
LEGACY_KEYS = ('image', 'moldings', 'profile', 'archSpandrels')
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
        legacy_keys = LEGACY_KEYS
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
        errors = result.errors + [w for w in result.warnings if 'unknown key' in w.lower()]
        return errors + [f'schema: {e}' for e in schema_errors(bp)]
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


def image_path(paths, name, bid=None):
    """A packet image path: absolute, or relative to buildings/<id>/ (current packets), data/<site>/ or the repo root."""
    path = Path(name)
    if path.is_absolute():
        return path
    bases = ([paths.building(bid).dir] if bid is not None else []) + [paths.data, paths.root]
    for base in bases:
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


# --- self-checks and render phases ------------------------------------------------------------

def self_check_path(b, number):
    return b.dir / f'self-check-{int(number)}.json'


def completed_checks(b):
    """How many self-check-<n>.json exist, counting 1, 2, ... without gaps."""
    number = 0
    while self_check_path(b, number + 1).is_file():
        number += 1
    return number


def human_repair_path(b, number):
    return b.dir / f'human-repair-{int(number)}.json'


def completed_human_repairs(b):
    """How many human-repair-<n>.json exist, counting 1, 2, ... without gaps."""
    number = 0
    while human_repair_path(b, number + 1).is_file():
        number += 1
    return number


def pending_feedback(b):
    """Human review entries (buildings/<id>/human-feedback.json, written by the change queue) not yet answered.

    An entry is pending while it names the current draft's hash and no
    human-repair-<n>.json has answered it. Each entry gets one repair call, so an
    invalid response cannot loop.
    """
    draft = read_json(b.draft)
    if draft is None:
        return []
    digest = fingerprint(draft)
    answered = set()
    for n in range(1, completed_human_repairs(b) + 1):
        record = read_json(human_repair_path(b, n)) or {}
        if not record.get('error'):  # a failed call leaves the feedback pending
            answered.update(record.get('feedback_ids') or [])
    entries = (read_json(b.human_feedback) or {}).get('entries') or []
    return [e for e in entries if isinstance(e, dict) and e.get('draft_hash') == digest and e.get('id') not in answered
            and str(e.get('text') or '').strip()]


def human_requested(b, draft):
    """Was `draft` produced by answering a human review (a human-repair-<n>.json names its hash)?"""
    if draft is None:
        return False
    digest = fingerprint(draft)
    return any((read_json(human_repair_path(b, n)) or {}).get('draft_hash') == digest
               for n in range(1, completed_human_repairs(b) + 1))


def fix_applies(b, record, baseline=None):
    """May a fix of `record` still write draft.json? Only while no newer valid draft superseded its base."""
    draft = read_json(b.draft)
    if draft is None:
        return True
    base = record.get('base_hash') or (fingerprint(baseline) if baseline is not None else None)
    return base is not None and fingerprint(draft) == base


def current_phase(b, max_repairs=MAX_REPAIRS):
    """The render phase of the current draft: a repair phase, else the last self-check that changed it, else initial."""
    number = completed_repairs(b, max_repairs)
    if number:
        return repair_phase(number)
    phase = 'initial'
    for n in range(1, completed_checks(b) + 1):
        phase = (read_json(self_check_path(b, n)) or {}).get('phase') or phase
    return phase


def drafted_blueprints(b, max_repairs=MAX_REPAIRS):
    """{draft_hash: blueprint} of every valid draft this building's records produced."""
    records = [b.author, *(self_check_path(b, n) for n in range(1, completed_checks(b) + 1)),
               *(b.repair(n) for n in range(1, max_repairs + 1)),
               *(human_repair_path(b, n) for n in range(1, completed_human_repairs(b) + 1))]
    found = {}
    for path in records:
        record = read_json(path)
        if isinstance(record, dict) and record.get('draft_hash') and isinstance(record.get('blueprint'), dict):
            found[record['draft_hash']] = record['blueprint']
    draft = read_json(b.draft)
    if draft is not None:
        found[fingerprint(draft)] = draft
    return found


def fixable(record):
    """Is `record` an author/repair response that failed validation and still has a fix call left?"""
    return bool(record and not record.get('error') and record.get('validation_errors')
                and len(record.get('fixes') or []) < MAX_FIXES)


def reviewed_since_authoring(b, record):
    """Was any review recorded after the current author response? (Self-checks only precede the first review.)"""
    if not record:
        return False
    return (record.get('timestamp') or 0) >= ((read_json(b.author) or {}).get('timestamp') or 0)


class BuildingBudgetExhausted(Exception):
    """One building spent its --max-tokens-per-building; the rest of the run continues."""


# --- building kinds, orientation policy, style examples ------------------------------------------

OUTBUILDINGS = {'shed', 'hut', 'cabin', 'barn', 'farm_auxiliary', 'greenhouse', 'roof', 'carport', 'stable', 'boathouse'}
GARAGES = {'garage', 'garages', 'carport'}
APARTMENTS = {'apartments', 'dormitory', 'hotel', 'terrace', 'residential'}
COMMERCIAL = {'commercial', 'retail', 'office', 'industrial', 'warehouse', 'supermarket', 'kiosk'}
CIVIC = {'school', 'civic', 'public', 'government', 'hospital', 'university', 'college', 'library', 'fire_station',
         'train_station', 'transportation', 'museum', 'theatre', 'grandstand', 'stadium', 'pavilion', 'bridge'}
CHURCHES = {'church', 'chapel', 'cathedral', 'religious', 'temple', 'mosque', 'synagogue'}
NOTABLE_TAGS = ('amenity', 'shop', 'office', 'tourism', 'historic', 'craft', 'leisure', 'religion')
LENIENT_MAX_AREA = 600  # m²; a bigger "house" (inn, big cottage) keeps the strict entrance audit


def building_kind(building):
    """house | garage | outbuilding | apartments | commercial | civic | church, from OSM tags and the generic style."""
    tags = building.get('tags') or {}
    kind = (building.get('style') or {}).get('kind')
    tag = tags.get('building')
    if tag in CHURCHES or kind == 'church' or tags.get('amenity') == 'place_of_worship':
        return 'church'
    if tag in GARAGES or kind == 'garage':
        return 'garage'
    if tag in OUTBUILDINGS or kind == 'shed':
        return 'outbuilding'
    if tags.get('shop') or tags.get('office') or tag in COMMERCIAL or kind == 'commercial':
        return 'commercial'
    if tag in CIVIC or kind in ('civic', 'pavilion') or tags.get('amenity') or tags.get('tourism'):
        return 'civic'
    if tag in APARTMENTS:
        return 'apartments'
    return 'house'


def orientation_policy(building):
    """'lenient' for an ordinary house, garage or outbuilding; 'strict' for everything else (review.ORIENTATION_POLICIES)."""
    tags = building.get('tags') or {}
    if building_kind(building) not in ('house', 'garage', 'outbuilding'):
        return 'strict'
    if any(tags.get(key) for key in NOTABLE_TAGS) or (building.get('area') or 0) > LENIENT_MAX_AREA:
        return 'strict'
    return 'lenient'


def roof_type(blueprint):
    """The main roof of a blueprint (or generic style value), for example retrieval."""
    if not isinstance(blueprint, dict):
        return None
    for key in ('pavilion', 'bridge', 'fountain', 'amphitheater'):
        if blueprint.get(key):
            return key
    volumes = [v for v in blueprint.get('volumes') or [] if isinstance(v, dict)]
    if not volumes:
        return None
    main = max(volumes, key=lambda v: _span(v.get('u')) * _span(v.get('v')))
    roof = main.get('roof')
    return roof.get('type') if isinstance(roof, dict) else None


def _span(pair):
    try:
        return max(0.0, float(pair[1]) - float(pair[0]))
    except (TypeError, ValueError, IndexError):
        return 0.0


def _legacy(value):
    if isinstance(value, dict):
        return any(k in LEGACY_KEYS for k in value) or any(_legacy(v) for v in value.values())
    return isinstance(value, list) and any(_legacy(v) for v in value)


def example_candidates(site, overrides):
    """Accepted blueprints that passed inspection (not forced), as retrieval candidates, in id order."""
    buildings = {str(b['id']): b for b in site.get('buildings') or []}
    reviews = overrides.get('miniature_review') or {}
    result = []
    for bid, bp in sorted((overrides.get('blueprints') or {}).items()):
        entry = reviews.get(bid) or {}
        publication = entry.get('publication') or {}
        if entry.get('status') != 'ready' or publication.get('forced') or bid not in buildings or _legacy(bp):
            continue
        if not isinstance(bp, dict):
            continue
        text = json.dumps(bp, separators=(',', ':'))
        building = buildings[bid]
        result.append({'id': bid, 'kind': building_kind(building), 'area': building.get('area') or 0,
                       'roof': roof_type(bp), 'blueprint': bp, 'chars': len(text)})
    return result


def select_examples(building, candidates, fallback=(), count=EXAMPLE_COUNT, max_chars=EXAMPLE_CHARS):
    """3-4 style examples close to `building`: same kind, similar footprint area, same generic roof guess.

    Deterministic for the same inputs (ties break on id). Falls back to the
    fixed examples in miniature_examples.json when too few accepted ones fit.
    """
    bid = str(building['id'])
    kind = building_kind(building)
    area = max(1.0, float(building.get('area') or 1))
    roof = (building.get('style') or {}).get('roof')

    def score(c):
        closeness = 1 - min(1.0, abs(math.log(max(1.0, c['area']) / area)) / math.log(4))
        return 4 * (c['kind'] == kind) + (roof is not None and c['roof'] == roof) + 2 * closeness

    chosen, used = [], 0
    for c in sorted((c for c in candidates if c['id'] != bid and c['chars'] <= max_chars // 2),
                    key=lambda c: (-round(score(c), 6), c['id'])):
        if len(chosen) >= count:
            break
        if used + c['chars'] > max_chars:
            continue
        chosen.append({'source_id': c['id'], 'kind': c['kind'], 'blueprint': c['blueprint']})
        used += c['chars']
    for example in fallback:
        if len(chosen) >= 2:
            break
        if str(example.get('source_id')) != bid and all(str(e['source_id']) != str(example.get('source_id')) for e in chosen):
            chosen.append(example)
    return chosen


# --- the run ------------------------------------------------------------------------------

class Run:
    """One `town author` invocation: options, shared budget, serialized rendering, per-building work."""

    def __init__(self, paths, ids=None, *, all=False, workers=3, max_tokens=None, max_seconds=None,
                 max_tokens_per_building=MAX_TOKENS_PER_BUILDING, author_model='astra', reviewer_model='sol',
                 reasoning_effort=None, author_effort='high', reviewer_effort='medium', self_checks=1,
                 building_review=True, scene_review=True, max_repairs=MAX_REPAIRS, capture='missing', image_search='bing',
                 max_web_images=1, extra_street_views=0, render_distance=90, call_timeout=300, codex='codex',
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
        if not 0 <= int(self_checks) <= MAX_SELF_CHECKS:
            raise ValueError(f'self_checks must be between 0 and {MAX_SELF_CHECKS}')
        if capture not in ('missing', 'reuse-only') or image_search not in ('bing', 'off'):
            raise ValueError('capture must be missing|reuse-only and image_search bing|off')
        for name, value in (('call_timeout', call_timeout), ('render_distance', render_distance)):
            if value is None or value <= 0:
                raise ValueError(f'{name} must be positive')
        for name, value in (('max_seconds', max_seconds), ('max_tokens', max_tokens),
                            ('max_tokens_per_building', max_tokens_per_building)):
            if value is not None and value < 0:
                raise ValueError(f'{name} must be positive (0 or omitted: unlimited)')
        if reasoning_effort:  # the old single knob sets both roles
            author_effort = reviewer_effort = reasoning_effort
        self.paths = _paths(paths)
        self.site = load_site(self.paths)
        self.overrides = load_overrides(self.paths)
        self.config = settings(self.paths)
        self.ids, self.all, self.reauthor = [str(x) for x in ids or ()], all, {str(x) for x in reauthor or ()}
        self.workers, self.max_repairs, self.self_checks = int(workers), int(max_repairs), int(self_checks)
        self.author_model, self.reviewer_model = author_model, reviewer_model
        self.author_effort, self.reviewer_effort = author_effort, reviewer_effort
        self.reasoning_effort = reasoning_effort or author_effort
        self.building_review, self.scene_review = building_review, scene_review
        self.capture, self.image_search = capture, image_search
        self.max_web_images, self.extra_street_views = int(max_web_images), int(extra_street_views)
        self.render_distance, self.call_timeout, self.codex = render_distance, call_timeout, codex
        self.location = location or self.config.get('title') or self.site.get('title') or ''
        self.labels = self._load(labels)
        self.web = self._load(web_references)
        self.dry_run, self.accept, self.force = dry_run, accept, force
        self.budget = model.Budget(max_tokens, max_seconds)
        self.max_tokens_per_building = max_tokens_per_building or None
        self.building_tokens = Counter()
        self.stop = threading.Event()
        self.stopped = None
        self.lock = threading.RLock()
        self.run_id = time.strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:6]
        self.kit = KIT.read_text() if KIT.is_file() else ''
        self.examples = next((json.loads(p.read_text()) for p in EXAMPLES if p.is_file()), [])
        self._candidates = None
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
            self.seed_legacy_feedback(bid)
            state = self.status(bid)
            if (state in ('unreferenced', 'referenced') and bid not in self.reauthor
                    and (self.overrides.get('blueprints') or {}).get(bid) is not None
                    and not self.paths.building(bid).draft.is_file()):
                state = 'accepted'  # authored before per-building drafts were kept
            if (state in ('accepted', 'failed') and bid not in self.reauthor
                    and not pending_feedback(self.paths.building(bid))):
                self.skipped[bid] = state
                continue
            selected.append(bid)
            self.buildings[bid] = {'status': state, 'steps': []}
        return selected

    def seed_legacy_feedback(self, bid):
        """Feedback on a building accepted before drafts were kept (draft_hash null) starts from its accepted blueprint."""
        b = self.paths.building(bid)
        accepted = (self.overrides.get('blueprints') or {}).get(bid)
        record = read_json(b.human_feedback) or {}
        entries = record.get('entries') or []
        if self.dry_run or accepted is None or b.draft.is_file() or not any(
                isinstance(e, dict) and e.get('draft_hash') is None for e in entries):
            return
        atomic_json(b.draft, accepted)
        digest = fingerprint(accepted)
        atomic_json(b.human_feedback, {**record, 'entries': [
            {**e, 'draft_hash': digest} if isinstance(e, dict) and e.get('draft_hash') is None else e for e in entries]})

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
        if draft is not None and pending_feedback(b):
            # A human review outranks every policy stop: passed reviews, spent repair rounds, acceptance.
            phase = current_phase(b, self.max_repairs)
            if not rendered(self.paths, b, draft, phase, self.renderer):
                return ('render', phase)
            return ('human-repair', completed_human_repairs(b) + 1)
        if state in ('accepted', 'failed'):
            if bid not in self.reauthor:
                return None
            if not self.performed[(bid, 'author 0')]:
                return ('author', 0)
            if state == 'failed':
                return None
            if fixable(last) and fix_applies(b, last, self.baseline(bid)):
                return ('fix', last.get('number') or 0)
            # Re-authored in this run, but the draft still equals the accepted blueprint:
            # an invalid response continues through the bounded repairs; a no-op patch is final.
            if last and not last.get('error') and last.get('validation_errors') and number < self.max_repairs:
                return ('repair', number + 1)
            return None
        if fixable(last) and fix_applies(b, last, self.baseline(bid)):
            return ('fix', last.get('number') or 0)
        if draft is None:
            if last is None or (not last.get('number') and last.get('error')):
                return ('author', 0)
            return ('repair', number + 1) if number < self.max_repairs else None
        record = read_review(self.paths, bid)
        if review_current(record, draft, self.renderer):
            if needs_repair(record) and number < self.max_repairs:
                return ('repair', number + 1)
            return None
        phase = current_phase(b, self.max_repairs)
        if not rendered(self.paths, b, draft, phase, self.renderer):
            return ('render', phase)
        checks = completed_checks(b)
        if not number and checks < self.self_checks and not reviewed_since_authoring(b, record):
            return ('self-check', checks + 1)
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
        return json.dumps(description, separators=(',', ':')), [image_path(self.paths, r['path'], packet.get('id'))
                                                                 for r in attachments]

    def view_images(self, bid, packet, phase):
        """Reference and render images for a call that judges the `phase` renders, at most ~8.

        With a photo|render sheet the street-view atlas is dropped (its directional
        photos are in the sheet) unless the packet holds extra oblique views.
        Returns (references, render views) as path lists.
        """
        b = self.paths.building(bid)
        pairs = b.renders / f'{phase}-pairs.jpg'
        extra = (packet.get('street_view_counts') or {}).get('additional')
        refs = [image_path(self.paths, r['path'], bid) for r in packet.get('attachments', packet.get('images', []))
                if not (pairs.is_file() and r.get('kind') == 'street-view-atlas' and not extra)]
        views = [pairs if pairs.is_file() else b.renders / f'{phase}-faces.jpg', b.renders / f'{phase}-overview.png']
        return refs, [p for p in views if p.is_file()]

    def orientation(self, bid, packet, blueprint):
        last = last_response(self.paths.building(bid), self.max_repairs) or {}
        doors = _references().entrance_inventory(blueprint, self.building(bid), self.site) if blueprint else []
        return {'frame': packet.get('frame'), 'author_entrance_plan': last.get('entrance_plan') or [],
                'actual_doors': doors, 'integrated_amphitheater': (blueprint or {}).get('amphitheater'),
                'orientation_policy': orientation_policy(self.building(bid)), 'source': ORIENTATION_SOURCE}

    # --- model calls ------------------------------------------------------------------

    def call(self, bid, role, prompt, schema, images):
        """One admitted, measured model call. Raises BudgetExhausted (run) or BuildingBudgetExhausted before spending."""
        author_role = role in ('author', 'repair', 'self-check', 'fix')
        which = self.author_model if author_role else self.reviewer_model
        effort = self.author_effort if author_role else self.reviewer_effort
        reserve = RESERVE.get(role, 10000)
        cap = self.max_tokens_per_building if bid != 'scene' else None
        with self.lock:
            if cap is not None and self.building_tokens[bid] + reserve > cap:
                raise BuildingBudgetExhausted(f'building token budget exhausted ({self.building_tokens[bid]:,} of {cap:,})')
        with self.budget.reserve(reserve, cancel=self.stop):
            directory = call_directory(self.paths, bid, role)
            self.log(f'{bid}: {role} ({which}, one fresh response)')
            result = model.execute(directory, prompt, schema, [str(p) for p in images], model=which,
                                   effort=effort, timeout=self.budget.call_timeout(self.call_timeout),
                                   binary=self.codex)
        self.budget.record(result)
        with self.lock:
            self.building_tokens[bid] += (result.get('usage') or {}).get('total_tokens', 0) or 0
        result.update(role=role, building=str(bid), model_alias=which, run=self.run_id)
        return result

    def call_with_retries(self, bid, role, prompt, schema, images, attempts=ATTEMPTS):
        """Retry a failed call up to `attempts` times; the last failure is marked terminal."""
        failures = []
        for attempt in range(attempts):
            result = self.call(bid, role, prompt, schema, images)
            if not result.get('error'):
                result['attempts'] = failures
                return result
            transient = (model.capacity_rejection(result) or model.timeout_interruption(result)
                         or model.anthropic_transient(result))
            failures.append({k: result.get(k) for k in ('error', 'directory', 'usage', 'usage_complete',
                                                         'started_at', 'finished_at')} | {'transient': transient})
            self.log(f'{bid}: {role} failed ({result["error"]})')
            if attempt + 1 < attempts and not self.stop.is_set():
                self._sleep(min(15, 2 ** attempt))
                continue
            result.update(attempts=failures[:-1], terminal=True, transient=transient)
            return result
        return result

    # --- prompts --------------------------------------------------------------------------

    def candidates(self):
        with self.lock:
            if self._candidates is None:
                self._candidates = example_candidates(self.site, self.overrides)
            return self._candidates

    def examples_for(self, bid):
        return select_examples(self.building(bid), self.candidates(), self.examples)

    def author_prompt(self, bid, packet, baseline=None):
        """[task + kit (cached), style examples (cached), packet + return contract] as model prompt segments.

        The first segment is identical for every building and call, the second for
        every call of one building, so providers with prompt caching reuse them.
        """
        description, _ = self.describe(packet)
        if baseline:
            description += BASELINE_REFERENCE + json.dumps(baseline, separators=(',', ':')) + BASELINE_GATE
        examples = ('\nAPPROVED STYLE EXAMPLES (different structures; do not copy their architecture)\n' +
                    json.dumps(self.examples_for(bid), separators=(',', ':')))
        tail = '\nREFERENCE PACKET\n' + description + AUTHOR_RETURN
        if baseline:
            tail = tail.replace(LENGTH_TARGET, BASELINE_LENGTH)
        return [{'text': AUTHOR_TASK + self.kit, 'cache': True}, {'text': examples, 'cache': True},
                {'text': tail, 'cache': False}]

    @staticmethod
    def extend(segments, text):
        """Append `text` to the uncached tail segment."""
        return [*segments[:-1], {**segments[-1], 'text': segments[-1]['text'] + text}]

    # --- author and repair -------------------------------------------------------------

    def step_author(self, bid, number=0, human=False):
        """The author call (number 0) or repair pass `number`; writes author.json / repair-N.json and draft.json.

        `human=True` answers pending human feedback as human-repair-N.json; it never uses a repair round.
        """
        b = self.paths.building(bid)
        building = self.building(bid)
        packet = read_json(b.references) or {}
        _, images = self.describe(packet)
        baseline = self.baseline(bid)
        prompt = self.author_prompt(bid, packet, baseline)
        repair = number > 0
        current = baseline
        feedback = pending_feedback(b) if human else []
        if baseline and not repair:
            prompt = self.extend(prompt, '\nREFINEMENT: prefer a small patch to the production baseline. Leave blueprint_json '
                                 'empty and encode patch_json as {"base_hash":"' + fingerprint(baseline) +
                                 '","operations":[{"op":"replace","path":"/volumes/@main/height","value":7}]}. Supports '
                                 'add/replace/remove and @id selectors; an empty operations list retains the baseline '
                                 'unchanged. Do not replace the model wholesale merely to fit a shorter response.')
        if repair:
            current = candidate(b, self.max_repairs)
            last = last_response(b, self.max_repairs) or {}
            record = read_review(self.paths, bid) or {}
            followup = record.get('followup_review')
            prior_errors = [a.get('error') for a in last.get('attempts') or [] if a.get('error')]
            text = ''
            if human:
                text = ('\nHUMAN REVIEW (highest priority): the operator looked at the attached renders of this draft and '
                        'asked for the changes below. Make them, even where the automated review passed. Where they '
                        'conflict with the automated review, the human wins. Preserve everything else.\n' +
                        json.dumps([e['text'] for e in feedback]))
            text += (f'\n{"HUMAN REPAIR" if human else "REPAIR PASS"} {number}' + ('' if human else f' OF {self.max_repairs}') +
                     '. Fix important defects and validation errors. Preserve the '
                    'rest. A fresh inspection will follow this repair. The current building review describes the attached '
                    'renders; the previous scene review supplies additional context.\n' +
                    json.dumps({'blueprint': current, 'base_hash': fingerprint(current),
                                'review': record.get('report') or followup, 'previous_scene_review': followup,
                                'validation_errors': last.get('validation_errors'), 'prior_errors': prior_errors},
                               separators=(',', ':')))
            if not b.draft.is_file():
                text += INVALID_NOTE
            text += ('\nFor a small repair, leave blueprint_json empty and encode patch_json as ' +
                     json.dumps({'base_hash': fingerprint(current),
                                 'operations': [{'op': 'replace', 'path': '/volumes/@main/height', 'value': 7}]},
                                separators=(',', ':')) +
                     '. Copy this exact base_hash; do not compute a new hash. Supports add/replace/remove and @id '
                     'selectors. Otherwise return the full corrected blueprint.')
            prompt = self.extend(prompt, text)
            refs, views = self.view_images(bid, packet, current_phase(b, self.max_repairs))
            images = refs + views
        else:
            for n in range(1, completed_checks(b) + 1):  # a new authoring starts a new self-check sequence
                self_check_path(b, n).unlink(missing_ok=True)
        result = self.call_with_retries(bid, 'repair' if repair else 'author', prompt, AUTHOR, images)
        record = {**result, 'number': number, 'packet_hash': fingerprint(packet),
                  'frame': building_frame(self.site, building), 'timestamp': time.time()}
        if repair:
            record['base_hash'] = fingerprint(current)
        if human:
            record['role'] = 'human-repair'
            if not result.get('error'):
                record['feedback_ids'] = [e['id'] for e in feedback]
        target = human_repair_path(b, number) if human else b.repair(number) if repair else b.author
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

    def step_fix(self, bid, number):
        """One cheap validation-fix call for an invalid author/repair response; never consumes a repair round.

        Appends to the response record's `fixes`; when the fix validates, the record
        takes the fixed blueprint (the rejected one stays in `invalid_blueprint`) and
        draft.json is written.
        """
        b = self.paths.building(bid)
        target = b.repair(number) if number else b.author
        record = read_json(target) or {}
        response = record.get('response') or {}
        base = record.get('blueprint') if isinstance(record.get('blueprint'), dict) else None
        submitted = {'blueprint': base} if base is not None else {'blueprint_json': response.get('blueprint_json') or None}
        if base is None and response.get('patch_json'):
            # A patch that failed to apply: fix it against the blueprint it was aimed at, never from nothing.
            base = self.patch_base(b, record)
            if base is None:
                record.setdefault('fixes', []).append({'error': 'no base blueprint for the failed patch; left to repair',
                                                       'timestamp': time.time()})
                atomic_json(target, record)
                return
            submitted = {'base_blueprint': base, 'failed_patch_json': response['patch_json']}
        text = ('\nINVALID BLUEPRINT\n' + json.dumps({**submitted, 'validation_errors': record.get('validation_errors')},
                                                     separators=(',', ':')))
        if base is not None:
            text += ('\nEncode patch_json as {"base_hash":"' + fingerprint(base) + '","operations":[...]} with add/replace/remove '
                     'operations and @id selectors, leaving blueprint_json empty; or return the full corrected blueprint.')
        else:
            text += '\nThe submission did not parse as a blueprint object: return the full corrected blueprint in blueprint_json.'
        prompt = [{'text': FIX_TASK + self.kit, 'cache': True}, {'text': text, 'cache': False}]
        result = self.call_with_retries(bid, 'fix', prompt, AUTHOR, [], attempts=1)
        entry = {k: result.get(k) for k in ('directory', 'usage', 'usage_complete', 'duration', 'model', 'error')}
        entry['timestamp'] = time.time()
        if not result.get('error'):
            trial = self.apply_response(b, self.building(bid), {}, result['response'], base, self.baseline(bid))
            entry.update(validation_errors=trial['validation_errors'], blueprint=trial['blueprint'])
            if not trial['validation_errors']:
                record.update(invalid_blueprint=record.get('blueprint'), initial_validation_errors=record.get('validation_errors'),
                              blueprint=trial['blueprint'], validation_errors=[], draft_hash=trial['draft_hash'])
                self.log(f'{bid}: validation fixed without a repair round')
        record.setdefault('fixes', []).append(entry)
        atomic_json(target, record)

    def patch_base(self, b, record):
        """The blueprint a failed patch response was aimed at: by base_hash, else the baseline."""
        baseline = self.baseline(b.id)
        wanted = record.get('base_hash') or (fingerprint(baseline) if baseline is not None else None)
        if wanted is None:
            return None
        known = {**drafted_blueprints(b, self.max_repairs)}
        for bp in (read_json(b.draft), baseline):
            if isinstance(bp, dict):
                known[fingerprint(bp)] = bp
        return known.get(wanted)

    def step_self_check(self, bid, number):
        """The author looks at its own render beside the photos and may patch the draft (self-check-N.json).

        Not a repair: it happens before the first independent review. `phase` in
        the record names the renders of the draft it produced (None when unchanged).
        """
        b = self.paths.building(bid)
        building = self.building(bid)
        packet = read_json(b.references) or {}
        draft = read_json(b.draft)
        refs, views = self.view_images(bid, packet, current_phase(b, self.max_repairs))
        last = last_response(b, self.max_repairs) or {}
        prompt = self.extend(self.author_prompt(bid, packet, self.baseline(bid)),
                             SELF_CHECK_TASK.format(n=number, total=self.self_checks) + json.dumps(
                                 {'blueprint': draft, 'base_hash': fingerprint(draft), 'cues': last.get('cues'),
                                  'entrance_plan': last.get('entrance_plan'),
                                  'orientation_audit': self.orientation(bid, packet, draft)}, separators=(',', ':')))
        result = self.call_with_retries(bid, 'self-check', prompt, AUTHOR, refs + views)
        record = {**result, 'number': number, 'base_hash': fingerprint(draft), 'phase': None, 'timestamp': time.time()}
        if not result.get('error'):
            self.apply_response(b, building, record, result['response'], draft, self.baseline(bid))
            if not record['validation_errors'] and record['draft_hash'] != fingerprint(draft):
                record['phase'] = f'initial-check-{number}'
            elif record['validation_errors']:
                self.log(f'{bid}: self-check {number} rejected: {record["validation_errors"][0]}')
        else:
            self.log(f'{bid}: self-check {number} skipped ({result["error"]})')
        atomic_json(self_check_path(b, number), record)

    # --- render and review -------------------------------------------------------------

    def step_render(self, bid, phase):
        self.renders.views(bid, phase)

    def step_review(self, bid, number):
        b = self.paths.building(bid)
        building = self.building(bid)
        draft = read_json(b.draft)
        frame = building_frame(self.site, building)
        policy = orientation_policy(building)
        lint = lint_blueprint(draft, building, str(bid))
        geometry = audit_geometry(draft) if not lint.errors else []
        if not self.building_review:
            write_review(self.paths, bid, draft, None, renderer_signature=self.renderer, findings=lint.errors,
                         geometry=geometry, frame=frame, orientation_policy=policy)
            return
        packet = read_json(b.references) or {}
        description, _ = self.describe(packet)
        last = last_response(b, self.max_repairs) or {}
        prior_errors = [a.get('error') for a in last.get('attempts') or [] if a.get('error')]
        prompt = REVIEW_TASK + description + '\n' + json.dumps({
            'cues': last.get('cues'), 'validation_errors': last.get('validation_errors'), 'author_errors': prior_errors,
            'orientation_audit': self.orientation(bid, packet, draft)})
        prompt += LENIENT_POLICY if policy == 'lenient' else STRICT_POLICY
        tags = packet.get('source_tags') or {}
        if tags.get('building') == 'bridge':
            prompt += '\nFor this bridge, audit the span axis, open spans and approaches. A bridge has no principal entrance; absence of doors is correct.'
        if tags.get('amenity') == 'fountain':
            prompt += '\nFor this fountain, audit basin, pylon, stepped crown and corner jets. It has no principal entrance; an empty door inventory is correct.'
        if 'amphitheater' in str(packet.get('name', '')).lower():
            prompt += ('\nFor an open amphitheater, audit stage-house orientation and the open perimeter gates. The integrated '
                       'component has no door leaves; an empty door inventory is expected. Compare the current replacement '
                       'with current references; pre-replacement photos establish location only.')
        phase = current_phase(b, self.max_repairs)
        refs, views = self.view_images(bid, packet, phase)
        result = self.call_with_retries(bid, 'review', prompt, REVIEW, refs + views)
        if result.get('error'):
            raise RuntimeError(f'review call failed: {result["error"]}')
        record = write_review(self.paths, bid, draft, result['response'], renderer_signature=self.renderer,
                              model=self.reviewer_model, findings=lint.errors, geometry=geometry, frame=frame,
                              orientation_policy=policy)
        record['call'] = {k: result.get(k) for k in ('directory', 'usage', 'usage_complete', 'duration', 'run', 'model')}
        record['renders'] = {Path(path).stem.removeprefix(phase + '-'): self.paths.relative(path) for path in views}
        record['phase'] = phase
        atomic_json(b.review, record)
        verdict = (result['response'] or {}).get('verdict')
        score = review_score(record)
        self.log(f'{bid}: review {verdict}' + (f' (score {score[0]})' if score else '') +
                 ('' if record['passed'] else ' (repair requested)'))

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
            phase = current_phase(b, self.max_repairs)
            if not rendered(self.paths, b, draft, phase, self.renderer):
                self.renders.views(bid, phase)
            pairs = b.renders / f'{phase}-pairs.jpg'
            sheets.append(pairs if pairs.is_file() else b.renders / f'{phase}-faces.jpg')
            summary.append({'id': bid, 'name': packet.get('name'), 'cues': last.get('cues'), 'prior_review': record.get('report'),
                            'repair_applied': number > 0, 'validation_errors': last.get('validation_errors'),
                            'orientation_policy': record.get('orientation_policy', 'strict'),
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
        candidate_views = self.renders.views(bid, current_phase(b, self.max_repairs))
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
        elif kind == 'human-repair':
            self.step_author(bid, step[1], human=True)
        elif kind == 'fix':
            self.step_fix(bid, step[1])
        elif kind == 'self-check':
            self.step_self_check(bid, step[1])
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
        """A failed inspection whose repair rounds are spent is recorded as such in review.json (forced publication).

        The best-scoring reviewed draft (rubric overall, then the sum of the
        criteria) is published rather than the last one: it is restored to
        draft.json together with its own review record, `selected_draft` says why.
        """
        b = self.paths.building(bid)
        draft = read_json(b.draft)
        record = read_review(self.paths, bid)
        if draft is None or not review_current(record, draft, self.renderer) or record.get('passed'):
            return
        if completed_repairs(b, self.max_repairs) < self.max_repairs or record.get('repairs_exhausted'):
            return
        record.pop('legacy', None)
        record.update(repairs_exhausted=True, repair_limit=self.max_repairs)
        best = None if human_requested(b, draft) else self.best_reviewed(b, record)
        if best is not None:
            bp, chosen = best
            others = [{k: v for k, v in r.items() if k != 'history'}
                      for r in [*record.get('history', []), record] if r.get('draft_hash') != chosen['draft_hash']]
            record = {**{k: v for k, v in chosen.items() if k != 'history'}, 'history': others,
                      'repairs_exhausted': True, 'repair_limit': self.max_repairs,
                      'selected_draft': {'reason': 'best-scoring reviewed draft', 'score': review_score(chosen),
                                         'latest_hash': fingerprint(draft), 'latest_score': review_score(record)}}
            atomic_json(b.draft, bp)
            self.log(f'{bid}: repairs exhausted; publishing the best-scoring draft {chosen["draft_hash"][:8]}')
        atomic_json(b.review, record)

    def best_reviewed(self, b, record):
        """(blueprint, review record) of a strictly better-scoring earlier draft than `record`'s, or None."""
        current = review_score(record)
        if current is None:
            return None
        blueprints = drafted_blueprints(b, self.max_repairs)
        building = self.building(b.id)
        best, best_key = None, (bool(record.get('passed')), current)
        for old in record.get('history') or []:
            score = review_score(old)
            bp = blueprints.get(old.get('draft_hash'))
            if score is None or bp is None or old.get('frame') != record.get('frame'):
                continue
            if old.get('renderer_signature') not in (None, self.renderer) or validate(bp, building, self.baseline(b.id)):
                continue
            key = (bool(old.get('passed')), score)
            if key > best_key:
                best, best_key = (bp, old), key
        return best

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
            pairs = b.renders / f'{phase}-pairs.jpg'
            rows = [] if no_bp else self.pairs(bid, dict(labels))
            if rows:
                _references().contact_sheet(rows, pairs, columns=2, cell=(650, 460))
                out['pairs'] = pairs
            else:
                pairs.unlink(missing_ok=True)  # never leave another draft's pairs behind
            return out

    def pairs(self, bid, labels):
        """[(photo, label), (render, label), ...]: each face's geolocated Street View photo beside its render."""
        run = self.run
        packet = read_json(run.paths.building(bid).references) or {}
        photos = {}
        for record in packet.get('images') or []:
            face = record.get('face')
            if record.get('kind') == 'street-view' and face and not record.get('additional_view') and face not in photos:
                path = image_path(run.paths, record.get('path', ''), bid)
                if path.is_file():
                    photos[face] = (path, record.get('id') or 'SV')
        finder = getattr(_render(), 'reference_photo', None)
        rows = []
        for render_path, label in labels.items():
            face = label.split(' |', 1)[0]
            photo = photos.get(face)
            if photo is None and finder is not None:
                found = finder(run.paths, bid, face)
                photo = (Path(found), 'fronts') if found else None
            if photo is None:
                continue
            rows += [(photo[0], f'PHOTO {face} ({photo[1]})'), (render_path, 'RENDER ' + label)]
        return rows

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
    policy = review.get('orientation_policy', 'strict')
    scene_ok = not scene or (scene.get('verdict') == 'ready' and
                             (scene.get('orientation') or {}).get('status') not in bad_orientation(policy))
    comparison = read_json(comparison_path(b))
    # A draft produced by answering a human review replaces the accepted one on that human's say-so.
    comparison_ok = existing is None or human_requested(b, draft) or comparison_approved(existing, draft, comparison)
    if not comparison_ok:
        reasons.append('existing accepted model retained: the re-authored draft was not approved against it (comparison.json)')
    ready = not review_problems and scene_ok and comparison_ok
    st = {'status': 'ready' if ready else 'needs-attention', 'review': review.get('report'), 'validation_errors': [],
          'baseline_comparison': comparison, 'selected_draft': review.get('selected_draft')}
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
    p.add_argument('--max-tokens', type=int, default=None, help='run token budget (default: unlimited; the per-building cap bounds it)')
    p.add_argument('--max-tokens-per-building', type=int, default=MAX_TOKENS_PER_BUILDING,
                   help=f'token cap per building in this run (default {MAX_TOKENS_PER_BUILDING:,}; 0 = unlimited)')
    p.add_argument('--max-seconds', type=float, default=None, help='wall-time budget for the run (default: unlimited)')
    p.add_argument('--author-model', default='astra', help='author/repair/self-check model alias or id (astra, opus, ...)')
    p.add_argument('--reviewer-model', default='sol', help='review/scene/comparison model alias or id (sol, sonnet, ...)')
    p.add_argument('--author-effort', choices=['low', 'medium', 'high'], default='high')
    p.add_argument('--reviewer-effort', choices=['low', 'medium', 'high'], default='medium')
    p.add_argument('--reasoning-effort', choices=['low', 'medium', 'high'], default=None,
                   help='set both --author-effort and --reviewer-effort')
    p.add_argument('--self-checks', type=int, default=1, choices=range(0, MAX_SELF_CHECKS + 1),
                   help='times the author revises its draft from its own render before review (default 1)')
    p.add_argument('--no-building-review', dest='building_review', action='store_false', help='record lint-only reviews')
    p.add_argument('--no-scene-review', dest='scene_review', action='store_false')
    p.add_argument('--max-repairs', type=int, default=MAX_REPAIRS)
    p.add_argument('--capture', choices=['missing', 'reuse-only'], default='missing')
    p.add_argument('--image-search', choices=['bing', 'off'], default='bing')
    p.add_argument('--max-web-images', type=int, default=1)
    p.add_argument('--extra-street-views', type=int, choices=[0, 1, 2], default=0)
    p.add_argument('--render-distance', type=float, default=90)
    p.add_argument('--call-timeout', type=float, default=300)
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
                        max_seconds=args.max_seconds, max_tokens_per_building=args.max_tokens_per_building,
                        author_model=args.author_model, reviewer_model=args.reviewer_model,
                        reasoning_effort=args.reasoning_effort, author_effort=args.author_effort,
                        reviewer_effort=args.reviewer_effort, self_checks=args.self_checks,
                        building_review=args.building_review,
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
