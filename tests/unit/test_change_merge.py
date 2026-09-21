import json
import unittest
from tinytown.change_merge import content, Conflict
from tests.unit.test_changes import ChangeQueueFixture


class MergeValues(unittest.TestCase):
    def test_nonoverlapping_text(self):
        base = b'one\na\nb\nc\nd\ne\nf\ntwo\n'
        self.assertEqual(content('a.js', base, base.replace(b'one', b'ONE'), base.replace(b'two', b'TWO')),
                         base.replace(b'one', b'ONE').replace(b'two', b'TWO'))

    def test_json_merges_different_keys_and_building_ids(self):
        base = {'buildings': [{'id': 1, 'roof': 'red'}, {'id': 2, 'roof': 'red'}], 'notes': {}}
        current = {**base, 'buildings': [{'id': 1, 'roof': 'blue'}, base['buildings'][1]], 'notes': {'first': True}}
        task = {**base, 'buildings': [base['buildings'][0], {'id': 2, 'roof': 'green'}], 'notes': {'second': True}}
        result = json.loads(content('data.json', *(json.dumps(v).encode() for v in (base, current, task))))
        self.assertEqual([b['roof'] for b in result['buildings']], ['blue', 'green'])
        self.assertEqual(result['notes'], {'first': True, 'second': True})

    def test_ambiguous_changes_fail_without_choosing_a_side(self):
        for name, base, current, task in [('a.js', b'one', b'two', b'three'),
            ('a.json', b'{"a":1}', b'{"a":2}', b'{"a":3}'),
            ('a.json', b'[1,2]', b'[2,3]', b'[1,3]'),
            ('a.png', b'\0a', b'\0b', b'\0c'), ('a.js', b'one', None, b'two'),
            ('a.js', None, b'one', b'two')]:
            with self.subTest(name=name, base=base), self.assertRaises(Conflict):
                content(name, base, current, task)


class ApprovalMerges(ChangeQueueFixture):
    def test_parallel_approvals_preserve_both_json_changes(self):
        self.write('src/settings.json', '{"left":0,"right":0}')
        first = self.complete()
        second = self.complete()
        self.queue.stop()
        for record, field in ((first, 'left'), (second, 'right')):
            path = self.queue.paths.workspace(record['id']) / 'src/settings.json'
            path.write_text(json.dumps({'left': 0, 'right': 0, field: 1}))
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda r: self.queue.approve(r['id']), (first, second)))
        self.assertTrue(all(r['status'] == 'approved' for r in results))
        self.assertEqual(json.loads((self.root / 'src/settings.json').read_text()), {'left': 1, 'right': 1})

    def test_conflicts_run_repair_and_return_for_review(self):
        record = self.complete()
        self.write('src/main.js', 'approved first task\n')
        self.set_worker("inputs=json.loads(Path('runs/change-worker/merge.json').read_text())\n"
                        "assert Path(inputs[0]['current']).read_text() == 'approved first task\\n'\n"
                        "assert Path(inputs[0]['task']).read_text() == 'worker edit\\n'\n"
                        "Path('src/main.js').write_text('approved first task and worker edit\\n')")
        queued = self.queue.approve(record['id'])
        self.assertEqual(queued['iteration'], 2)
        repaired = self.wait_status(record['id'], 'pending_approval')
        self.assertEqual((self.root / 'src/main.js').read_text(), 'approved first task\n')
        self.assertEqual(repaired['merge']['status'], 'needs_review')
        self.queue.approve(record['id'])
        self.assertEqual((self.root / 'src/main.js').read_text(), 'approved first task and worker edit\n')

    def test_failed_repair_keeps_original_task_and_checkout(self):
        record = self.complete()
        self.write('src/main.js', 'approved first task\n')
        self.set_worker('sys.exit(1)')
        self.queue.approve(record['id'])
        self.wait_status(record['id'], 'failed')
        self.assertEqual((self.root / 'src/main.js').read_text(), 'approved first task\n')
        self.assertEqual((self.queue.paths.merge_backup(record['id'], 1) / 'src/main.js').read_text(), 'worker edit\n')

    def test_failed_merge_preparation_restores_original_workspace(self):
        from unittest.mock import patch
        record = self.complete()
        self.queue.stop()
        self.write('src/main.js', 'approved first task\n')
        with patch.object(self.queue, '_save', side_effect=OSError('disk error')):
            with self.assertRaisesRegex(OSError, 'disk error'):
                self.queue.approve(record['id'])
        self.assertEqual(self.queue.get(record['id'])['baseline'], record['baseline'])
        self.assertEqual((self.queue.paths.workspace(record['id']) / 'src/main.js').read_text(), 'worker edit\n')
        self.assertEqual((self.root / 'src/main.js').read_text(), 'approved first task\n')
