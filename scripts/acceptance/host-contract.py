#!/usr/bin/env python3
"""Exercise the installed Claude runtime with a LOCAL deterministic model fixture.

This tests host tool/hook enforcement and independent file effects. It is NOT
real model, Chio kernel, or complete I01-I08 acceptance evidence. No credentials
or normal agent profile are read or modified. Every effect is disposable.
"""
import argparse
import hashlib
import http.server
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import time

parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--claude', default=shutil.which('claude'))
parser.add_argument('--cases', nargs='*')
args = parser.parse_args()
if not args.claude:
    parser.error('installed claude executable required')
args.output.mkdir(parents=True, exist_ok=True)
root = Path(tempfile.mkdtemp(prefix='chio-claude-contract-')).resolve()
os.chmod(root, 0o700)
state = {}

class Model(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        self.send_response(405)
        self.end_headers()

    def do_DELETE(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        request = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if self.path == '/mcp':
            if state.get('mcp_absent'):
                self.send_response(503)
                self.end_headers()
                return
            method = request.get('method')
            if 'id' not in request:
                self.send_response(202)
                self.end_headers()
                return
            if method == 'initialize':
                result = {'protocolVersion': '2025-11-25', 'serverInfo': {'name': 'local-resource-fixture', 'version': '0.0.0'}, 'capabilities': {'tools': {}}}
            elif method == 'tools/list':
                result = {'tools': [{'name': 'write_marker', 'description': 'Write a disposable local fixture marker.', 'inputSchema': {'type': 'object', 'properties': {'value': {'type': 'string'}}, 'required': ['value']}}]}
            elif method == 'tools/call':
                state['mcp_calls'].append(request)
                if state.get('mcp_deny'):
                    result = {'isError': True, 'content': [{'type': 'text', 'text': 'local resource fixture denied the effect'}]}
                else:
                    Path(state['marker']).write_text(request['params']['arguments']['value'])
                    result = {'content': [{'type': 'text', 'text': 'local fixture marker written'}]}
            else:
                result = {}
            data = json.dumps({'jsonrpc': '2.0', 'id': request['id'], 'result': result}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Mcp-Session-Id', 'local-fixture-session')
            self.end_headers()
            self.wfile.write(data)
            return
        if self.path.endswith('/count_tokens'):
            data = json.dumps({'input_tokens': 100}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(data)
            return
        tool_results = [b for m in request.get('messages', []) if isinstance(m.get('content'), list)
                        for b in m['content'] if b.get('type') == 'tool_result']
        state['requests'].append({'path': self.path, 'tools': [t.get('name') for t in request.get('tools', [])],
                                  'tool_results': tool_results})
        final = state.get('inventory_only',False) or bool(tool_results) or len(state['requests']) > 2
        content = ([{'type': 'text', 'text': 'The local fixture finished. Inspect independent effect evidence.'}]
                   if final else [{'type': 'tool_use', 'id': 'toolu_local_contract_01', 'name': state.get('tool', 'Bash'),
                                   'input': ({'value': 'contract-effect'} if state.get('tool') else {'command': f'printf contract-effect > {state["marker"]}',
                                             'description': 'Write a disposable acceptance marker'})}])
        message = {'id': 'msg_local_fixture', 'type': 'message', 'role': 'assistant', 'model': request.get('model'),
                   'content': content, 'stop_reason': 'end_turn' if final else 'tool_use', 'stop_sequence': None,
                   'usage': {'input_tokens': 100, 'output_tokens': 10}}
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream' if request.get('stream') else 'application/json')
        self.end_headers()
        if not request.get('stream'):
            self.wfile.write(json.dumps(message).encode())
            return
        def emit(kind, obj):
            self.wfile.write(f'event: {kind}\ndata: {json.dumps(dict(type=kind, **obj))}\n\n'.encode())
            self.wfile.flush()
        emit('message_start', {'message': dict(message, content=[], stop_reason=None, usage={'input_tokens':100,'output_tokens':0})})
        block = content[0]
        emit('content_block_start', {'index': 0, 'content_block': dict(block, **({'input': {}} if block['type']=='tool_use' else {'text': ''}))})
        emit('content_block_delta', {'index': 0, 'delta': {'type': 'input_json_delta', 'partial_json': json.dumps(block['input'])}
             if block['type']=='tool_use' else {'type': 'text_delta', 'text': block['text']}})
        emit('content_block_stop', {'index': 0})
        emit('message_delta', {'delta': {'stop_reason': message['stop_reason'], 'stop_sequence': None}, 'usage': {'output_tokens': 10}})
        emit('message_stop', {})

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Model)
threading.Thread(target=server.serve_forever, daemon=True).start()
cases = {
    'inventory-default': None,
    'observer-positive-control': None,
    'structured-deny': "process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'local contract deny'}}));",
    'blocking-exit-two': "process.stderr.write('local contract deny'); process.exit(2);",
    'hook-crash': "throw new Error('local contract crash');",
    'hook-missing': 'MISSING',
    'hook-timeout': "await new Promise(resolve => setTimeout(resolve, 10000));",
    'hook-malformed-output': "process.stdout.write('{malformed-json');",
    'hook-silent-omission': '',
    'restricted-native-unavailable': None,
    'restricted-mcp-useful': None,
    'restricted-mcp-denied': None,
    'restricted-mcp-absent': None,
}
summary = {'evidence_class': 'REAL_HOST_LOCAL_MODEL_FIXTURE_NO_CHIO_KERNEL', 'root': str(root), 'probe_source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
           'host_version': subprocess.check_output([args.claude, '--version'], text=True).strip(),
           'host_sha256': hashlib.sha256(Path(args.claude).read_bytes()).hexdigest(), 'cases': []}
try:
    for name, hook in cases.items():
        if args.cases and name not in args.cases:
            continue
        run = root / name
        workspace = run / 'workspace'
        workspace.mkdir(parents=True)
        profile = run / 'profile'
        profile.mkdir(mode=0o700)
        marker = workspace / 'effect.txt'
        settings = {'permissions': {'allow': ['Bash']}}
        if hook is not None:
            hook_path = run / 'hook.mjs'
            if hook != 'MISSING':
                hook_path.write_text(hook)
            settings['hooks'] = {'PreToolUse': [{'matcher': 'Bash', 'hooks': [
                {'type': 'command', 'command': f'{shutil.which("node")} {hook_path}', 'timeout': 1}]}]}
        settings_path = run / 'settings.json'
        settings_path.write_text(json.dumps(settings))
        env = {k: v for k, v in os.environ.items() if not (k.startswith(('ANTHROPIC_', 'CLAUDE_', 'CHIO_')) or k in ['CLAUDECODE'])}
        env.update(ANTHROPIC_API_KEY='local-fixture-not-a-credential',
                   ANTHROPIC_BASE_URL=f'http://127.0.0.1:{server.server_port}',
                   CLAUDE_CONFIG_DIR=str(profile), CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC='1',
                   DISABLE_AUTOUPDATER='1', HOME=str(run), XDG_CONFIG_HOME=str(profile))
        cmd = [args.claude, '-p', '--model', 'claude-sonnet-4-5', '--output-format', 'stream-json', '--verbose',
               '--setting-sources', '', '--settings', str(settings_path), '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
               '--no-chrome', '--permission-mode', 'dontAsk', '--no-session-persistence', '--include-hook-events',
               '--tools', '' if name.startswith('restricted-') else ('default' if name == 'inventory-default' else 'Bash')]
        if name.startswith('restricted-'):
            cmd.extend(['--restricted', '--disable-slash-commands'])
        state.clear()
        state.update(marker=str(marker), requests=[], mcp_calls=[],inventory_only=name=='inventory-default')
        if name.startswith('restricted-mcp-'):
            # Real host MCP routing with a local resource fixture. The
            # protected launcher uses the separate verified stdio gateway.
            mcp_path = run / 'mcp.json'
            mcp_path.write_text(json.dumps({'mcpServers': {'chio': {'type':'http',
                'url': f'http://127.0.0.1:{server.server_port}/mcp'}}}))
            cmd[cmd.index('--mcp-config')+1] = str(mcp_path)
            cmd.extend(['--allowedTools','mcp__chio__*'])
            state.update(tool='mcp__chio__write_marker', mcp_absent=name.endswith('-absent'), mcp_deny=name.endswith('-denied'))
        start = time.monotonic()
        try:
            result = subprocess.run(cmd, input="Use Bash to write the disposable marker requested by the fixture, then stop.", cwd=workspace, env=env, capture_output=True, text=True, timeout=45)
            exit_code, stdout, stderr = result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired as ex:
            exit_code, stdout, stderr = 'timeout', ex.stdout or b'', ex.stderr or b''
            stdout = stdout.decode() if isinstance(stdout, bytes) else stdout
            stderr = stderr.decode() if isinstance(stderr, bytes) else stderr
        (args.output / f'{name}.stdout.jsonl').write_text(stdout)
        (args.output / f'{name}.stderr.txt').write_text(stderr)
        (args.output / f'{name}.mcp-requests.json').write_text(json.dumps(state['mcp_calls'], indent=2)+'\n')
        (args.output / f'{name}.requests.json').write_text(json.dumps(state['requests'], indent=2)+'\n')
        effect = marker.read_text() if marker.exists() else None
        row = {'case': name, 'exit_code': exit_code, 'elapsed_seconds': round(time.monotonic()-start,3),
               'model_requests': len(state['requests']), 'effect_observed': effect, 'settings': settings,
               'command': cmd, 'mcp_calls':len(state['mcp_calls'])}
        summary['cases'].append(row)
        (args.output / 'summary.json').write_text(json.dumps(summary, indent=2)+'\n')
        print(json.dumps({k:row[k] for k in ['case','exit_code','model_requests','effect_observed']}), flush=True)
finally:
    server.shutdown()
expected_effect = {'observer-positive-control', 'hook-crash', 'hook-missing', 'hook-timeout',
                   'hook-malformed-output', 'hook-silent-omission', 'restricted-mcp-useful'}
failures = [c['case'] for c in summary['cases'] if c['model_requests'] < (1 if c['case']=='inventory-default' else 2) or c['exit_code'] != 0 or
            (c['effect_observed'] == 'contract-effect') != (c['case'] in expected_effect)]
summary['probe_integrity'] = 'FAIL' if failures else 'PASS'
summary['probe_failures'] = failures
summary['integration_acceptance'] = 'NOT_ESTABLISHED'
(args.output / 'summary.json').write_text(json.dumps(summary, indent=2)+'\n')
raise SystemExit(bool(failures))
