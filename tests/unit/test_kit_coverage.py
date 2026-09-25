"""docs/MINIATURE_KIT.md (sent verbatim to the author model) keeps up with the blueprint schema.

A renderer feature the kit never mentions is a feature the model never uses:
before this test existed, dormers and gambrel roofs were supported but absent
from the kit, and reviews kept asking for them.
"""
import json
import re
import unittest

from tinytown.paths import ROOT
from tinytown.review import KEYS, lint_blueprint

KIT = (ROOT / 'docs' / 'MINIATURE_KIT.md').read_text()
SCHEMA = (ROOT / 'docs' / 'BLUEPRINT_SCHEMA.md').read_text()

# Keys deliberately kept out of the automated authoring prompt.
ALLOWLIST = {
    # Bookkeeping, not geometry.
    'notes', 'id', 'name', '_comment', 'wall_color', 'opts',
    # Hand-curated assets and measured profiles; validate() rejects them in authoring.
    'image', 'profile', 'moldings', 'outline', 'trimWidth', 'trimDepth', 'divisions',
    'capHeight', 'capOverhang', 'fitUnderEave', 'mullionColor', 'transomY', 'crossColor',
    # Arcades: rare civic recesses, authored by hand.
    'arcade', 'backColor', 'approachDepth',
    # One-off landmark composites (one building each) and their parameters.
    'athenaeumFront', 'alumniHallBalcony', 'lennaHall', 'hultquistCenter', 'bunting', 'radius',
    'annexOutline', 'porchDepth', 'eave', 'foundationDepth', 'stringLightSpacing', 'interiorLighting',
    'rearWingChamfer', 'bowlDepth', 'audienceChamfer', 'railingStyle', 'entranceStairs', 'bottomY',
    'girderHeight', 'approaches',
    # Schema example placeholders, not keys.
    'center', 'size', 'edge2',
}


def mentioned(key):
    return re.search(r'(?<![A-Za-z0-9])' + re.escape(key) + r'(?![A-Za-z0-9])', KIT) is not None


class KitCoverage(unittest.TestCase):
    def test_schema_keys_are_in_the_kit(self):
        keys = set(re.findall(r'"([a-zA-Z_][a-zA-Z0-9_]{1,})"\s*:', SCHEMA))
        missing = sorted(k for k in keys - ALLOWLIST if not mentioned(k))
        self.assertEqual(missing, [], 'document these in MINIATURE_KIT.md or add them to ALLOWLIST')

    def test_lint_accepted_keys_are_in_the_kit(self):
        keys = set().union(*KEYS.values())
        missing = sorted(k for k in keys - ALLOWLIST if not mentioned(k))
        self.assertEqual(missing, [], 'lint accepts these but the model is never told about them')

    def test_kit_does_not_claim_dormers_are_unsupported(self):
        self.assertIn('"dormers":', KIT)
        self.assertIn('"type":"gambrel"', KIT)


class KitExamplesLint(unittest.TestCase):
    """Every fenced full-blueprint example lints clean against a matching rectangular footprint."""

    def test_fenced_blueprints_lint_clean(self):
        blocks = [json.loads(b) for b in re.findall(r'```json\n(.*?)```', KIT, re.S)]
        blueprints = [b for b in blocks if isinstance(b, dict) and b.get('volumes')]
        self.assertGreaterEqual(len(blueprints), 2)
        for bp in blueprints:
            us = [x for v in bp['volumes'] for x in v['u']]
            vs = [x for v in bp['volumes'] for x in v['v']]
            u0, u1, v0, v1 = min(us), max(us), min(vs), max(vs)
            building = {'id': 1, 'obb': {'cx': 0, 'cz': 0, 'angle': 0, 'w': u1 - u0, 'd': v1 - v0},
                        'pts': [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], 'area': (u1 - u0) * (v1 - v0),
                        'front': {'dir': 0}, 'style': {'kind': 'house'}}
            result = lint_blueprint(bp, building, 'kit')
            self.assertEqual((result.errors, result.warnings), ([], []), json.dumps(bp)[:120])


if __name__ == '__main__':
    unittest.main()
