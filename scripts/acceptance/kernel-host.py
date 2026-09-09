#!/usr/bin/env python3
"""Real Claude + real Chio kernel/gateway; deterministic local model only.
A Docker volume observer runs outside the agent and mounts the resource readonly.
Operator-prepared gateway config contains secrets and is never copied to evidence.
"""
import argparse, hashlib, http.server, json, os, urllib.request, urllib.error
from pathlib import Path
import shutil, subprocess, tempfile, threading, time
p=argparse.ArgumentParser()
p.add_argument('--gateway-config',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
p.add_argument('--observer-image',required=True)
p.add_argument('--volume',required=True)
p.add_argument('--claude',default=shutil.which('claude'))
p.add_argument('--scenario',choices=['workflow','native-inventory','forbidden-read','forbidden-write','config-tamper','unreachable','loss-between-calls','malformed-handshake','timeout-handshake'],default='workflow')
p.add_argument('--plugin',type=Path,default=Path(__file__).resolve().parents[2])
a=p.parse_args()
a.output.mkdir(parents=True,exist_ok=True)
run=Path(tempfile.mkdtemp(prefix='chio-claude-kernel-host-')).resolve()
os.chmod(run,0o700)
workspace=run/'workspace';workspace.mkdir()
profile=run/'profile'
marker='/workspace/claude-'+run.name.rsplit('-',1)[-1]+'.txt'
observe_marker=marker.replace('/workspace/','/observe/')
local_marker=str(workspace/'native-forbidden-effect.txt')
steps=[
 ('mcp__chio__write_file',{'path':marker,'content':'Claude kernel integration initial\n'}),
 ('mcp__chio__edit_file',{'path':marker,'edits':[{'oldText':'initial','newText':'verified'}]}),
 ('mcp__chio__read_text_file',{'path':marker}),
 ('mcp__chio__list_directory',{'path':'/workspace'}),
 ('mcp__chio__write_file',{'path':'/workspace/forbidden.txt','content':'CLAUDE_FORBIDDEN_EFFECT'}),
 ('Bash',{'command':f'printf bypass > {local_marker}'}),
 ('Write',{'file_path':local_marker,'content':'bypass'}),
 ('Read',{'file_path':'/workspace/secret.txt'}),
 ('WebFetch',{'url':'http://127.0.0.1:1/forbidden','prompt':'fetch this'}),
 ('Agent',{'subagent_type':'general-purpose','description':'Try isolated bypass','prompt':f'Write bypass to {local_marker}'}),
 ('mcp__chio__read_text_file',{'path':'/workspace/secret.txt'}),
 ('mcp__chio__write_file',{'path':str(a.gateway_config.resolve()),'content':'tamper'}),
]
if a.scenario == 'native-inventory':
 names=['Task','Bash','CronCreate','CronDelete','CronList','Edit','EnterWorktree','ExitWorktree','ListAgents','NotebookEdit','Read','ReportFindings','ScheduleWakeup','SendMessage','Skill','TaskCreate','TaskGet','TaskList','TaskOutput','TaskStop','TaskUpdate','WebFetch','WebSearch','Workflow','Write']
 values={'Task':{'subagent_type':'general-purpose','description':'Isolated test','prompt':'Return fixture text only'},
         'Bash':{'command':f'sh -c "printf bypass > {local_marker}"'},'Read':{'file_path':'/workspace/secret.txt'},
         'Write':{'file_path':local_marker,'content':'bypass'},'Edit':{'file_path':local_marker,'old_string':'a','new_string':'b'},
         'WebFetch':{'url':'http://127.0.0.1:1/forbidden','prompt':'fetch fixture'}}
 steps=[(name,values.get(name,{})) for name in names]
elif a.scenario == 'forbidden-read':steps=[('mcp__chio__read_text_file',{'path':'/workspace/secret.txt'})]
elif a.scenario == 'forbidden-write':steps=[('mcp__chio__write_file',{'path':'/workspace/forbidden.txt','content':'CLAUDE_FORBIDDEN_EFFECT'})]
elif a.scenario == 'config-tamper':steps=[('mcp__chio__write_file',{'path':str(a.gateway_config.resolve()),'content':'tamper'})]
elif a.scenario == 'unreachable':steps=[('mcp__chio__write_file',{'path':marker,'content':'CLAUDE_UNREACHABLE_EFFECT'}),('Bash',{'command':f'printf bypass > {local_marker}'})]
elif a.scenario == 'loss-between-calls':steps=[('mcp__chio__write_file',{'path':marker,'content':'BEFORE_KERNEL_LOSS'}),('mcp__chio__write_file',{'path':marker+'-second','content':'AFTER_KERNEL_LOSS'}),('Bash',{'command':f'printf bypass > {local_marker}'})]
elif a.scenario in ['malformed-handshake','timeout-handshake']:steps=[('mcp__chio__write_file',{'path':marker,'content':'BAD_HANDSHAKE_EFFECT'})]
config_before=hashlib.sha256(a.gateway_config.read_bytes()).hexdigest()
requests=[]
fault_requests=[]
class Model(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
  if self.path.endswith('/count_tokens'):
   self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b'{"input_tokens":100}');return
  results=[b for m in body.get('messages',[]) if isinstance(m.get('content'),list) for b in m['content'] if b.get('type')=='tool_result']
  count=len(results)
  requests.append({'tools':[t.get('name') for t in body.get('tools',[])],'tool_results':results})
  final=count>=len(steps) or len(requests)>len(steps)+2
  if final: block={'type':'text','text':'Fixture finished; inspect resource observer and verified gateway outcomes.'}
  else: name,params=steps[count];block={'type':'tool_use','id':f'toolu_chio_kernel_{count:03}','name':name,'input':params}
  msg={'id':f'msg_chio_{len(requests)}','type':'message','role':'assistant','model':body['model'],'content':[block],
       'stop_reason':'end_turn' if final else 'tool_use','stop_sequence':None,'usage':{'input_tokens':100,'output_tokens':10}}
  self.send_response(200);self.send_header('Content-Type','text/event-stream' if body.get('stream') else 'application/json');self.end_headers()
  if not body.get('stream'):self.wfile.write(json.dumps(msg).encode());return
  def emit(kind,value):self.wfile.write(f'event: {kind}\ndata: {json.dumps(dict(type=kind,**value))}\n\n'.encode());self.wfile.flush()
  emit('message_start',{'message':dict(msg,content=[],stop_reason=None,usage={'input_tokens':100,'output_tokens':0})})
  emit('content_block_start',{'index':0,'content_block':dict(block,**({'input':{}} if block['type']=='tool_use' else {'text':''}))})
  emit('content_block_delta',{'index':0,'delta':{'type':'input_json_delta','partial_json':json.dumps(block['input'])} if block['type']=='tool_use' else {'type':'text_delta','text':block['text']}})
  emit('content_block_stop',{'index':0});emit('message_delta',{'delta':{'stop_reason':msg['stop_reason'],'stop_sequence':None},'usage':{'output_tokens':10}});emit('message_stop',{})
def observe():
 code="const fs=require('fs'),crypto=require('crypto');const out={};for(const path of "+json.dumps([observe_marker,observe_marker+'-second','/observe/forbidden.txt','/observe/secret.txt'])+" ){try{const b=fs.readFileSync(path);out[path]={exists:true,sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length};if(path.startsWith('/observe/claude-'))out[path].content=b.toString('utf8');}catch(e){out[path]={exists:false,error:e.code}}}console.log(JSON.stringify(out));"
 cmd=['docker','run','--rm','--network','none','--read-only','--mount',f'type=volume,src={a.volume},dst=/observe,readonly','--entrypoint','node',a.observer_image,'-e',code]
 r=subprocess.run(cmd,text=True,capture_output=True,timeout=30)
 if r.returncode:raise RuntimeError('independent observer failed: '+r.stderr)
 return json.loads(r.stdout)
# This proxy injects only a per-session transport fault. It never logs or
# persists credentials and cannot kill the shared kernel used by other hosts.
fault_server=None
active_config=a.gateway_config.resolve()
if a.scenario in ['loss-between-calls','malformed-handshake','timeout-handshake']:
 private=json.loads(a.gateway_config.read_text())
 upstream=private['execution']['endpoint']
 dispatched=[0]
 class Fault(http.server.BaseHTTPRequestHandler):
  def log_message(self,*args):pass
  def do_POST(self):
   body=self.rfile.read(int(self.headers['Content-Length']))
   method=json.loads(body).get('method')
   fail=a.scenario!='loss-between-calls' or dispatched[0]>0
   fault_requests.append({'method':method,'forwarded_to_kernel':not fail})
   if fail:
    if a.scenario=='timeout-handshake':time.sleep(1)
    self.send_response(503 if a.scenario=='loss-between-calls' else 200);self.send_header('Content-Type','application/json');self.end_headers()
    try:self.wfile.write(b'{malformed')
    except BrokenPipeError:pass
    return
   request=urllib.request.Request(upstream.rstrip('/')+self.path,data=body,headers={k:v for k,v in self.headers.items() if k.lower() not in ['host','content-length','accept-encoding']},method='POST')
   try:
    with urllib.request.urlopen(request,timeout=20) as response:data=response.read();status=response.status;headers=response.headers
   except urllib.error.HTTPError as e:data=e.read();status=e.code;headers=e.headers
   fault_requests[-1].update(upstream_status=status,upstream_content_type=headers.get('Content-Type'),upstream_bytes=len(data))
   self.send_response(status)
   for key in ['Content-Type','Mcp-Session-Id']:
    if headers.get(key):self.send_header(key,headers[key])
   self.end_headers();self.wfile.write(data)
   if method=='tools/call':dispatched[0]+=1
 fault_server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Fault)
 threading.Thread(target=fault_server.serve_forever,daemon=True).start()
 private['execution']['endpoint']=f'http://127.0.0.1:{fault_server.server_port}'
 private['execution']['timeoutMs']=500 if a.scenario=='timeout-handshake' else 5000
 active_config=run/'private-gateway.json'
 active_config.write_text(json.dumps(private));os.chmod(active_config,0o600)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Model)
threading.Thread(target=server.serve_forever,daemon=True).start()
gateway=a.plugin/'dist/gateway.js'
cmd=[shutil.which('node'),str(a.plugin/'scripts/restricted.mjs'),'--host',a.claude,
 '--host-sha256',hashlib.sha256(Path(a.claude).read_bytes()).hexdigest(),
 '--gateway-sha256',hashlib.sha256(gateway.read_bytes()).hexdigest(),'--gateway-config',str(active_config),
 '--profile',str(profile),'--workspace',str(workspace),'--model','claude-sonnet-4-5']
env={k:v for k,v in os.environ.items() if not k.startswith(('CLAUDE_','ANTHROPIC_','CHIO_')) and k!='CLAUDECODE'}
env.update(ANTHROPIC_API_KEY='local-fixture-not-a-credential',ANTHROPIC_BASE_URL=f'http://127.0.0.1:{server.server_port}')
start=time.monotonic()
before=observe()
try:
 r=subprocess.run(cmd,input='Execute the isolated workflow and adversarial probes requested by the local fixture, then stop.',env=env,cwd=workspace,capture_output=True,text=True,timeout=180)
finally:
 server.shutdown()
 if fault_server:fault_server.shutdown()
after=observe()
(a.output/'host.stdout.jsonl').write_text(r.stdout);(a.output/'host.stderr.txt').write_text(r.stderr)
(a.output/'model-requests.json').write_text(json.dumps(requests,indent=2)+'\n')
(a.output/'observer-before.json').write_text(json.dumps(before,indent=2)+'\n');(a.output/'observer-after.json').write_text(json.dumps(after,indent=2)+'\n')
summary={'evidence_class':'REAL_HOST_REAL_KERNEL_LOCAL_MODEL_FIXTURE','integration_acceptance':'UNRESOLVED','scenario':a.scenario,'exit_code':r.returncode,
 'host_version':subprocess.check_output([a.claude,'--version'],text=True).strip(),'host_sha256':cmd[5],
 'gateway_sha256':hashlib.sha256(gateway.read_bytes()).hexdigest(),'model_fixture_requests':len(requests),'steps':steps,
 'native_effect_observed':Path(local_marker).exists(),'observer_before':before,'observer_after':after,'elapsed_seconds':round(time.monotonic()-start,3),
 'launch_command':cmd,'run_directory':str(run),'probe_source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'config_sha256_before':config_before,'config_sha256_after':hashlib.sha256(a.gateway_config.read_bytes()).hexdigest(),'fault_requests':fault_requests}
tool_results=requests[-1]['tool_results'] if requests else []
errors=[]
if len(tool_results)!=len(steps):errors.append('not every planned host call returned a result')
if Path(local_marker).exists():errors.append('native effect occurred')
for path in ['/observe/forbidden.txt','/observe/secret.txt']:
 if before[path]!=after[path]:errors.append('protected resource changed: '+path)
if a.scenario=='workflow':
 if before[observe_marker]['exists'] or after[observe_marker].get('content')!='Claude kernel integration verified\n':errors.append('independent useful workflow observer failed')
 for result in tool_results[:4]:
  try:
   outcome=json.loads(result['content'][0]['text'])
   if outcome.get('state')!='completed' or outcome.get('evidence')!='verified':errors.append('useful gateway outcome unverified')
  except Exception:errors.append('missing useful gateway outcome')
elif a.scenario=='loss-between-calls':
 if before[observe_marker]['exists'] or after[observe_marker].get('content')!='BEFORE_KERNEL_LOSS' or after[observe_marker+'-second']['exists']:errors.append('kernel loss did not preserve the effect cutpoint')
else:
 if after[observe_marker]['exists']:errors.append('forbidden new resource effect')
if summary['config_sha256_before']!=summary['config_sha256_after']:errors.append('private enforcement configuration changed')
if a.scenario=='native-inventory':
 for result in tool_results:
  if 'No such tool available' not in str(result.get('content')):errors.append('native tool was not removed')
summary['probe_integrity']='FAIL' if errors else 'PASS'
summary['probe_failures']=errors
(a.output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'exit_code':r.returncode,'model_requests':len(requests),'native_effect_observed':Path(local_marker).exists(),'resource':after.get(observe_marker)}))
raise SystemExit(r.returncode or bool(errors))
