"""Private browser ownership, context isolation, restart contracts, and the CDP Tab."""
from concurrent.futures import ThreadPoolExecutor
import io
import json
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

import websocket

from tinytown import browser as b
from tinytown.paths import ROOT


class PrivateBrowser(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name).resolve()
        state = patch.object(b, 'STATE_DIR', self.root)
        state.start(); self.addCleanup(state.stop)
        self.record = {'provider': b.PROVIDER, 'key': 'a' * 32, 'pid': 123,
                       'profile': str(self.root / 'profiles' / ('a' * 32)), 'port': 41234,
                       'webSocketDebuggerUrl': 'ws://127.0.0.1:41234/devtools/browser/private'}
        b.atomic_json(self.root / 'browser.json', self.record)
        self.lease = {**self.record, 'lease_id': 'b' * 32, 'owner_pid': 456,
                      'context_id': 'context', 'target_id': 'target', 'opened_at': 0}

    def save_lease(self):
        b.atomic_json(b.lease_path(self.lease), self.lease)

    def test_module_imports_without_websocket(self):
        script = 'import sys, tinytown.browser, tinytown.render; sys.exit(int("websocket" in sys.modules))'
        result = subprocess.run([sys.executable, '-B', '-c', script], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_health_requires_exact_endpoint_profile_and_headless(self):
        valid = [f'--user-data-dir={self.record["profile"]}', '--headless']
        for arguments, expected in [(valid, True), (valid[:1], False), (['--headless'], False)]:
            with patch.object(b.urllib.request, 'urlopen', return_value=io.StringIO(json.dumps(self.record))), \
                    patch.object(b, 'request', return_value={'arguments': arguments}):
                self.assertEqual(b.healthy(self.record), expected)
        foreign = {**self.record, 'webSocketDebuggerUrl': self.record['webSocketDebuggerUrl'] + '-other'}
        with patch.object(b.urllib.request, 'urlopen', return_value=io.StringIO(json.dumps(foreign))), \
                patch.object(b, 'request') as request:
            self.assertFalse(b.healthy(self.record)); request.assert_not_called()

    def test_health_treats_websocket_failures_as_unhealthy(self):
        with patch.object(b.urllib.request, 'urlopen', return_value=io.StringIO(json.dumps(self.record))), \
                patch.object(b, 'request', side_effect=websocket.WebSocketTimeoutException('hung')):
            self.assertFalse(b.healthy(self.record))

    def test_foreign_profile_is_rejected_without_connecting(self):
        with patch.object(b.urllib.request, 'urlopen') as connect:
            self.assertFalse(b.healthy({**self.record, 'profile': '/Users/person/Chrome'}))
        connect.assert_not_called()

    def test_concurrent_startup_and_crashed_instance_replacement(self):
        started = []
        def launch():
            started.append(True)
            return self.record
        with patch.object(b, 'healthy', side_effect=lambda _: bool(started)), \
                patch.object(b, 'launch', side_effect=launch) as start, \
                patch.object(b, 'stop_owned') as stop, patch.object(b, 'cleanup_orphans'):
            with ThreadPoolExecutor(max_workers=5) as pool:
                records = list(pool.map(lambda _: b.ensure_browser(), range(5)))
        self.assertEqual(records, [self.record] * 5)
        start.assert_called_once(); stop.assert_called_once_with(self.record)

    def test_launch_requires_the_installed_runtime(self):
        with patch.object(b, 'RUNTIME', self.root / 'runtime'):
            with self.assertRaisesRegex(RuntimeError, 'town browser setup'):
                b.launch()

    def test_cross_process_lock_times_out_without_leaking(self):
        script = (f'import tinytown.browser as b; from pathlib import Path; b.STATE_DIR=Path({str(self.root)!r}); '
                  'b.LOCK_SECONDS=.15\nwith b.browser_lock(): pass')
        with b.browser_lock():
            result = subprocess.run([sys.executable, '-B', '-c', script], cwd=ROOT, capture_output=True, text=True, timeout=10)
        self.assertNotEqual(result.returncode, 0); self.assertIn('startup lock', result.stderr)
        with b.browser_lock(): pass

    def test_stop_never_signals_an_unrelated_process(self):
        with patch.object(b.subprocess, 'run', return_value=Mock(returncode=0, stdout='/Applications/Google Chrome')), \
                patch.object(b.os, 'kill') as kill:
            b.stop_owned(self.record)
        kill.assert_not_called()

    def test_stop_terminates_only_the_owned_supervisor_group(self):
        command = ' '.join(b.supervisor_command(b.RUNTIME / 'bin/python', self.record['key']))
        with patch.object(b.subprocess, 'run', return_value=Mock(returncode=0, stdout=command)), \
                patch.object(b.os, 'getpgid', return_value=123), \
                patch.object(b.os, 'kill', side_effect=[None, ProcessLookupError()]) as kill:
            b.stop_owned(self.record)
        self.assertEqual(kill.call_args_list[0].args, (123, signal.SIGTERM))
        with patch.object(b.subprocess, 'run', return_value=Mock(returncode=0, stdout=command)), \
                patch.object(b.os, 'getpgid', return_value=1), patch.object(b.os, 'kill') as kill:
            b.stop_owned(self.record)  # not a session leader: never ours
        kill.assert_not_called()

    def test_new_target_is_in_its_own_context_and_disposal_is_idempotent(self):
        with patch.object(b, 'request', side_effect=[{'browserContextId': 'context'}, {'targetId': 'target'},
                                                     {'success': True}, {}]) as request:
            lease = b.open_tab(self.record, owner_pid=789)
            self.assertEqual(b.read(b.lease_path(lease))['owner_pid'], 789)
            self.assertEqual(request.call_args.kwargs['browserContextId'], 'context')
            b.close_tab(lease); b.close_tab(lease)
        self.assertEqual(request.call_count, 4)
        # The page is closed before its context is disposed, and disposal gets the long timeout.
        self.assertEqual(request.call_args_list[2].args[1:], ('Target.closeTarget',))
        self.assertEqual(request.call_args_list[2].kwargs, {'targetId': 'target'})
        self.assertEqual(request.call_args.args[1], 'Target.disposeBrowserContext')
        self.assertEqual(request.call_args.kwargs, {'timeout': b.DISPOSE_SECONDS, 'browserContextId': 'context'})
        self.assertFalse(b.lease_path(lease).exists())

    def test_dispose_tolerates_gone_targets_and_contexts(self):
        self.save_lease()
        with patch.object(b, 'request', side_effect=[RuntimeError("{'code': -32602, 'message': 'No target with given id found'}"),
                                                     RuntimeError('Failed to find context with id context')]) as request:
            b.close_tab(self.lease)
        self.assertEqual(request.call_count, 2); self.assertFalse(b.lease_path(self.lease).exists())

    def test_slow_dispose_is_verified_against_the_browser(self):
        # The renderer of a loaded WebGL scene takes seconds to exit: a socket timeout
        # counts as closed once the browser no longer lists the context...
        self.save_lease()
        with patch.object(b, 'request', side_effect=[{'success': True}, websocket.WebSocketTimeoutException('Connection timed out'),
                                                     {'browserContextIds': ['other']}]):
            b.close_tab(self.lease)
        self.assertFalse(b.lease_path(self.lease).exists())
        # ...and stays a `closing` lease for cleanup to retry while it is still there.
        self.save_lease()
        with patch.object(b, 'request', side_effect=[{'success': True}, websocket.WebSocketTimeoutException('Connection timed out'),
                                                     {'browserContextIds': ['context']}]):
            with self.assertRaisesRegex(TimeoutError, 'did not dispose'):
                b.close_tab(self.lease)
        self.assertTrue(b.read(b.lease_path(self.lease))['closing'])

    def test_request_honours_its_timeout(self):
        ws = Mock(); ws.recv.return_value = json.dumps({'id': 1, 'result': {'ok': True}})
        with patch.object(websocket, 'create_connection', return_value=ws) as connect:
            self.assertEqual(b.request(self.record, 'Target.getBrowserContexts'), {'ok': True})
            self.assertEqual(connect.call_args.kwargs['timeout'], b.REQUEST_SECONDS)
            b.request(self.record, 'Target.disposeBrowserContext', timeout=30, browserContextId='c')
            self.assertEqual(connect.call_args.kwargs['timeout'], 30)
        self.assertEqual(json.loads(ws.send.call_args.args[0])['params'], {'browserContextId': 'c'})
        ws.close.assert_called()

    def test_failed_target_creation_disposes_context(self):
        with patch.object(b, 'request', side_effect=[{'browserContextId': 'context'}, RuntimeError('target failed'), {}]) as request:
            with self.assertRaisesRegex(RuntimeError, 'target failed'):
                b.open_tab(self.record)
        self.assertEqual(request.call_args.args[1], 'Target.disposeBrowserContext')
        self.assertEqual(list((self.root / 'leases').glob('*.json')), [])

    def test_old_lease_never_touches_replacement_browser(self):
        self.save_lease()
        b.atomic_json(self.root / 'browser.json', {**self.record, 'key': 'c' * 32})
        with patch.object(b, 'request') as request:
            b.close_tab(self.lease)
        request.assert_not_called()
        self.assertFalse(b.lease_path(self.lease).exists())

    def test_changed_lease_is_not_closed(self):
        self.save_lease()
        with patch.object(b, 'request') as request:
            with self.assertRaisesRegex(ValueError, 'lease changed'):
                b.close_tab({**self.lease, 'context_id': 'foreign'})
        request.assert_not_called()

    def test_dead_owner_cleanup_preserves_live_and_recent_persistent_contexts(self):
        for live, persistent, age, expected in [(True, False, 900, 0), (False, False, 0, 1),
                                              (False, True, 599, 0), (False, True, 601, 1)]:
            self.lease.update(persistent=persistent, opened_at=1000-age)
            self.save_lease()
            with patch.object(b, 'alive', return_value=live), patch.object(b.time, 'time', return_value=1000), \
                    patch.object(b, 'close_tab') as close:
                b.cleanup_orphans(record=self.record)
            self.assertEqual(close.call_count, expected)

    def test_failed_cleanup_is_retried_even_with_a_live_owner(self):
        self.save_lease()
        with patch.object(b, 'request', side_effect=TimeoutError('busy')):
            with self.assertRaises(TimeoutError): b.close_tab(self.lease)
        self.assertTrue(b.read(b.lease_path(self.lease))['closing'])
        with patch.object(b, 'alive', return_value=True), patch.object(b, 'request', return_value={}):
            result = b.cleanup_orphans(record=self.record)
        self.assertEqual(result, {'closed': ['target'], 'errors': []})

    def test_persistent_tab_reuses_target_and_recreates_after_restart(self):
        self.save_lease()
        b.atomic_json(self.root / 'agent-tabs.json', {'building': self.lease})
        with patch.object(b, 'ensure_browser', return_value=self.record), \
                patch.object(b, 'request', return_value={'targetInfo': {'browserContextId': 'context'}}), \
                patch.object(b, 'open_tab') as opened:
            self.assertEqual(b.persistent_tab('building')['target_id'], 'target')
            opened.assert_not_called()
        fresh = {**self.lease, 'lease_id': 'd' * 32, 'target_id': 'target-2'}
        with patch.object(b, 'ensure_browser', return_value=self.record), \
                patch.object(b, 'request', return_value={'targetInfo': {'browserContextId': 'other'}}), \
                patch.object(b, 'close_tab') as close, patch.object(b, 'open_tab', return_value=fresh) as opened:
            self.assertEqual(b.persistent_tab('building')['target_id'], 'target-2')
            close.assert_called_once(); opened.assert_called_once_with(self.record, persistent=True)
        self.assertEqual(b.read(self.root / 'agent-tabs.json')['building']['target_id'], 'target-2')

    def test_status_reports_installation_record_and_leases(self):
        self.save_lease()
        with patch.object(b, 'healthy', return_value=True), patch.object(b, 'RUNTIME', self.root / 'runtime'):
            report = b.status()
        self.assertFalse(report['installed']); self.assertTrue(report['healthy'])
        self.assertEqual(report['record']['key'], 'a' * 32)
        self.assertEqual([lease['owner_pid'] for lease in report['leases']], [456])

    def test_cli_actions(self):
        with patch.object(b, 'cleanup_orphans', return_value={'closed': [], 'errors': []}) as cleanup, \
                patch('builtins.print'):
            self.assertEqual(b.main(['cleanup']), 0)
        cleanup.assert_called_once()
        with patch.object(b, 'stop_owned') as stop:
            b.main(['stop'])
        stop.assert_called_once_with(self.record)
        with patch.object(b, 'open_tab', return_value=self.lease) as opened, patch('builtins.print'):
            b.main(['open-tab', '--owner-pid', '77'])
        opened.assert_called_once_with(owner_pid=77)
        with patch.object(b, 'close_tab') as close, patch.object(b.sys, 'stdin', io.StringIO(json.dumps(self.lease))):
            b.main(['close-tab'])
        close.assert_called_once_with(self.lease)
        with self.assertRaises(SystemExit):
            b.main(['serve', '--instance', 'not-a-token'])


class DevServer(unittest.TestCase):
    def test_running_server_is_reused(self):
        with patch.object(b, 'server_up', return_value=True), patch.object(b.subprocess, 'Popen') as start:
            self.assertEqual(b.ensure_server(8734), 8734)
        start.assert_not_called()

    def test_server_is_started_and_waited_for(self):
        with patch.object(b, 'server_up', side_effect=[False, False, True]), patch.object(b.time, 'sleep'), \
                patch.object(b.subprocess, 'Popen') as start:
            self.assertEqual(b.ensure_server(8734), 8734)
        command = start.call_args.args[0]
        self.assertEqual(command[0], sys.executable); self.assertIn('8734', ' '.join(command))
        self.assertTrue(start.call_args.kwargs['start_new_session'])

    def test_server_command_prefers_deploy_module(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertIn('http.server', b.server_command(8734, root))
            (root / 'tinytown').mkdir(); (root / 'tinytown' / 'deploy.py').write_text('')
            self.assertIn('tinytown.deploy', ' '.join(b.server_command(8734, root)))


class TabTests(unittest.TestCase):
    def setUp(self):
        self.lease = {'provider': b.PROVIDER, 'key': 'a' * 32, 'port': 41234, 'lease_id': 'b' * 32,
                      'webSocketDebuggerUrl': 'ws://127.0.0.1:41234/devtools/browser/private',
                      'context_id': 'context', 'target_id': 'owned-target'}

    def test_partial_tab_initialization_closes_tab_and_connection(self):
        ws = Mock()
        with patch.object(b, 'open_tab', return_value=self.lease), patch.object(b, 'close_tab') as close, \
                patch.object(websocket, 'create_connection', return_value=ws), \
                patch.object(b.Tab, 'send', side_effect=RuntimeError('attach failed')):
            with self.assertRaisesRegex(RuntimeError, 'attach failed'):
                b.Tab()
        close.assert_called_once_with(self.lease); ws.close.assert_called_once()

    def test_tab_close_still_closes_connection_when_browser_is_gone(self):
        tab = object.__new__(b.Tab); tab.ws = Mock(); ws = tab.ws; tab.record = self.lease; tab.keep_open = False; tab.tid = 'owned-target'
        with patch.object(b, 'close_tab', side_effect=RuntimeError('gone')), self.assertLogs(b._log, level='WARNING'):
            tab.close()
        ws.close.assert_called_once(); self.assertIsNone(tab.ws)

    def test_keep_open_leaves_the_lease_alone(self):
        tab = object.__new__(b.Tab); tab.ws = Mock(); tab.record = self.lease; tab.keep_open = True; tab.tid = 'owned-target'
        with patch.object(b, 'close_tab') as close:
            tab.close()
        close.assert_not_called(); self.assertEqual(tab.record, self.lease)

    def test_setup_attaches_enables_domains_and_sets_viewport(self):
        ws = Mock()
        with patch.object(b, 'open_tab', return_value=self.lease), patch.object(websocket, 'create_connection', return_value=ws), \
                patch.object(b.Tab, 'send', return_value={'sessionId': 'session'}) as send:
            tab = b.Tab(1000, 750, 2)
        methods = [call.args[0] for call in send.call_args_list]
        self.assertEqual(methods[0], 'Target.attachToTarget')
        self.assertEqual(methods[1:4], ['Page.enable', 'Runtime.enable', 'Network.enable'])
        self.assertEqual(methods[4], 'Network.setUserAgentOverride')
        self.assertEqual(send.call_args_list[-1].kwargs, {'sid': 'session', 'width': 1000, 'height': 750, 'deviceScaleFactor': 2, 'mobile': False})
        self.assertEqual(tab._viewport, (1000, 750, 2)); self.assertEqual(tab.sid, 'session')
        ws.settimeout.assert_called_once_with(120)

    def test_viewer_and_maps_keep_the_requested_viewport(self):
        tab = object.__new__(b.Tab); tab.sid = 'session'; tab.send = Mock(return_value={})
        tab.viewport(1000, 750, 1)
        tab.go('https://www.google.com/maps/@42,-77,3a')
        self.assertEqual(tab.send.call_args_list[-2].args[0], 'Emulation.setDeviceMetricsOverride')
        tab.go('http://localhost:8734/?site=avon')
        self.assertEqual(tab.send.call_args_list[-1].args[0], 'Page.navigate')
        self.assertEqual(tab.send.call_args_list[-1].kwargs['url'], 'http://localhost:8734/?site=avon')
        self.assertEqual((tab._viewport[0], tab._viewport[1]), (1000, 750))

    def test_send_collects_console_and_exceptions_and_raises_cdp_errors(self):
        tab = object.__new__(b.Tab); tab.logs = []
        tab.ws = Mock()
        tab.ws.recv.side_effect = [
            json.dumps({'method': 'Runtime.consoleAPICalled', 'params': {'args': [{'value': 'hello'}, {'description': 'obj'}]}}),
            json.dumps({'method': 'Runtime.exceptionThrown', 'params': {'exceptionDetails': {'text': 'boom'}}}),
            json.dumps({'id': 1, 'result': {'ok': 1}}),
        ]
        with patch.object(b, '_ids', iter([1, 2])):
            self.assertEqual(tab.send('Runtime.evaluate', sid='s', expression='1'), {'ok': 1})
            self.assertEqual(tab.logs, ['hello obj', 'EXC boom'])
            sent = json.loads(tab.ws.send.call_args.args[0])
            self.assertEqual((sent['id'], sent['sessionId'], sent['params']), (1, 's', {'expression': '1'}))
            tab.ws.recv.side_effect = [json.dumps({'id': 2, 'error': {'message': 'no'}})]
            with self.assertRaisesRegex(RuntimeError, 'Page.navigate'):
                tab.send('Page.navigate', url='x')

    def test_ev_unwraps_values_and_raises_page_exceptions(self):
        tab = object.__new__(b.Tab); tab.sid = 's'
        tab.send = Mock(return_value={'result': {'value': 42}})
        self.assertEqual(tab.ev('6*7'), 42)
        tab.send = Mock(return_value={'exceptionDetails': {'exception': {'description': 'ReferenceError: x'}}})
        with self.assertRaisesRegex(RuntimeError, 'ReferenceError'):
            tab.ev('x')

    def test_wait_town_reports_the_last_page_exception(self):
        tab = object.__new__(b.Tab); tab.sid = 's'; tab.logs = ['EXC TypeError: bad blueprint']
        tab.send = Mock(return_value={'result': {'value': False}})
        with patch.object(b.time, 'time', side_effect=[0, 0, 100, 100]), patch.object(b.time, 'sleep'):
            with self.assertRaisesRegex(TimeoutError, 'bad blueprint'):
                tab.wait_town(timeout=90)

    def test_wait_pano_parses_the_pano_id_and_reports_no_coverage(self):
        tab = object.__new__(b.Tab); tab.sid = 's'
        tab.url = Mock(return_value='https://www.google.com/maps/@1,2,3a/data=!3m1!1sPANO123!2e0')
        with patch.object(b.time, 'sleep'):
            self.assertEqual(tab.wait_pano(settle=0), 'PANO123')
        tab.url = Mock(return_value='https://www.google.com/maps/')
        tab.ev = Mock(return_value='Sorry, we have no imagery here. No Street View')
        with patch.object(b.time, 'sleep'):
            self.assertIsNone(tab.wait_pano(timeout=5))

    def test_shot_writes_decoded_png_and_clip(self):
        tab = object.__new__(b.Tab); tab.sid = 's'
        tab.send = Mock(return_value={'data': 'aGVsbG8='})
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'nested' / 'shot.png'
            tab.shot(str(path), clip={'x': 1, 'y': 2, 'width': 3, 'height': 4})
            self.assertEqual(path.read_bytes(), b'hello')
        self.assertEqual(tab.send.call_args.kwargs['clip'], {'x': 1, 'y': 2, 'width': 3, 'height': 4, 'scale': 1})


if __name__ == '__main__':
    unittest.main()
