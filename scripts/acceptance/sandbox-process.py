#!/usr/bin/env python3
"""Real Claude and adversarial process under identical macOS policy.
Uses only public dummy authority and localhost model/resource fixtures.
This is an OS/host contract probe, never real-kernel or real-model acceptance.
"""
import argparse,hashlib,http.server,json,os,shutil,subprocess,tempfile,threading,time,uuid
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--plugin',type=Path,default=Path(__file__).resolve().parents[2]);p.add_argument('--host',default=shutil.which('claude'));a=p.parse_args()
a.output.mkdir(parents=True,exist_ok=True);run=Path(tempfile.mkdtemp(prefix='chio-claude-os-')).resolve();os.chmod(run,0o700)
workspace=run/'workspace';workspace.mkdir();journal=run/'journal';journal.mkdir(mode=0o700)
operator=run/'operator-canary';operator.write_text('DISPOSABLE_OPERATOR_CANARY');operator.chmod(0o600)
cross=run/'other-host-canary';cross.write_text('DISPOSABLE_OTHER_HOST_CANARY');cross.chmod(0o600)
model_requests=[];network=[]
class Model(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_POST(self):
  body=json.loads(self.rfile.read(int(self.headers['Content-Length'])));model_requests.append({'path':self.path,'keys':list(body),'tools':[t['name'] for t in body.get('tools',[])]})
  msg={'id':'msg_os_fixture','type':'message','role':'assistant','model':body['model'],'content':[{'type':'text','text':'Local fixture only; no protected action requested.'}],'stop_reason':'end_turn','stop_sequence':None,'usage':{'input_tokens':100,'output_tokens':10}}
  if self.path.endswith('/count_tokens'):msg={'input_tokens':100}
  self.send_response(200);self.send_header('Content-Type','text/event-stream' if body.get('stream') else 'application/json');self.end_headers()
  if not body.get('stream'):self.wfile.write(json.dumps(msg).encode());return
  for kind,value in [('message_start',{'message':dict(msg,content=[],stop_reason=None)}),('content_block_start',{'index':0,'content_block':{'type':'text','text':''}}),('content_block_delta',{'index':0,'delta':{'type':'text_delta','text':msg['content'][0]['text']}}),('content_block_stop',{'index':0}),('message_delta',{'delta':{'stop_reason':'end_turn','stop_sequence':None},'usage':{'output_tokens':10}}),('message_stop',{})]:self.wfile.write(f'event: {kind}\ndata: {json.dumps(dict(type=kind,**value))}\n\n'.encode());self.wfile.flush()
class Observe(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):network.append({'port':self.server.server_port,'path':self.path});self.send_response(200);self.end_headers();self.wfile.write(b'LOCAL_OBSERVER')
model=http.server.ThreadingHTTPServer(('127.0.0.1',0),Model);kernel=http.server.ThreadingHTTPServer(('127.0.0.1',0),Observe);other=http.server.ThreadingHTTPServer(('127.0.0.1',0),Observe)
for server in [model,kernel,other]:threading.Thread(target=server.serve_forever,daemon=True).start()
now=int(time.time());sid=str(uuid.uuid4());subject='1'*64;cap='disposable-fixture-capability';config=run/'gateway.json'
config.write_text(json.dumps({'execution':{'endpoint':f'http://127.0.0.1:{kernel.server_port}','bearerToken':'DUMMY_NOT_KERNEL_AUTHORITY','sessionId':sid,'subjectKey':subject,'capabilityId':cap,'serverId':'workspace','trustedSigners':['2'*64]},'sessionId':sid,'journalDir':str(journal),'tools':[{'name':'read_text_file','inputSchema':{'type':'object','properties':{'path':{'type':'string'}},'required':['path']}}],'sessionCredential':{'schema':'chio.mcp.session-credential.v1','sessionId':sid,'subjectKey':subject,'capabilityIds':[cap],'serverId':'workspace','endpointPath':'/mcp','allowedTools':['read_text_file'],'issuedAt':now,'expiresAt':now+600}}));config.chmod(0o600)
profile=run/'profile';gateway=a.plugin/'dist/gateway.js';node=shutil.which('node')
cmd=[node,str(a.plugin/'scripts/restricted.mjs'),'--host',a.host,'--host-sha256',hashlib.sha256(Path(a.host).read_bytes()).hexdigest(),'--gateway-sha256',hashlib.sha256(gateway.read_bytes()).hexdigest(),'--gateway-config',str(config),'--profile',str(profile),'--workspace',str(workspace),'--model','claude-sonnet-4-5']
env={k:v for k,v in os.environ.items() if not k.startswith(('CLAUDE_','ANTHROPIC_','CHIO_'))};env.update(ANTHROPIC_API_KEY='LOCAL_FIXTURE_ONLY',ANTHROPIC_BASE_URL=f'http://127.0.0.1:{model.server_port}')
r=subprocess.run(cmd,input='Return fixture text only. Do not call a tool.',text=True,capture_output=True,env=env,timeout=60)
(a.output/'host.stdout.jsonl').write_text(r.stdout);(a.output/'host.stderr.txt').write_text(r.stderr);(a.output/'model-requests.json').write_text(json.dumps(model_requests,indent=2)+'\n')
if not (profile/'launch.json').exists():
 (a.output/'summary.json').write_text(json.dumps({'evidence_class':'LAUNCH_PREFLIGHT_FAILURE_NO_PROTECTED_EFFECT','accepted':False,'host_exit':r.returncode,'probe_integrity':'FAIL','run_directory':str(run)},indent=2)+'\n')
 raise SystemExit(r.returncode or 1)
manifest=json.loads((profile/'launch.json').read_text());policy=Path(manifest['sandboxPath']);(a.output/'host.sb').write_text(policy.read_text());(a.output/'launch.json').write_text(json.dumps(manifest,indent=2)+'\n');control=Path(manifest['control']);(a.output/'model-relay.json').write_text((control/'model-relay.json').read_text())
# Reuse the exact already-applied policy, including its fixed loopback ports.
relay_port=int(__import__('re').findall(r'localhost:(\d+)',policy.read_text())[-1]);relay_observer=http.server.ThreadingHTTPServer(('127.0.0.1',relay_port),Observe);threading.Thread(target=relay_observer.serve_forever,daemon=True).start()
alias=profile/'outside-alias';alias.symlink_to(operator)
probe='''const fs=require('fs'),cp=require('child_process');const a=JSON.parse(process.argv[1]),out={};const record=(name,fn)=>{try{fn();out[name]={allowed:true}}catch(e){out[name]={allowed:false,error:e.code}}};
record('own_config_read',()=>fs.readFileSync(a.config));
for(const [name,path]of Object.entries({operator_read:a.operator,crosshost_read:a.cross,data_alias_read:'/System/Volumes/Data'+a.operator,tmp_alias_read:a.operator.replace('/private/tmp/','/tmp/'),profile_symlink_read:a.alias}))record(name,()=>fs.readFileSync(path));
for(const [name,path]of Object.entries({config_write:a.config,gateway_write:a.gateway,host_write:a.host,node_write:process.execPath,settings_write:a.settings,workspace_write:a.workspace+'/escape'}))record(name,()=>{const fd=fs.openSync(path,name==='workspace_write'?'w':'r+');fs.closeSync(fd)});
record('profile_write',()=>fs.writeFileSync(a.profile+'/allowed-write','PROFILE_OK'));record('journal_write',()=>fs.writeFileSync(a.journal+'/allowed-write','JOURNAL_OK'));
record('config_hardlink',()=>fs.linkSync(a.config,a.profile+'/config-hardlink'));
for(const [name,path]of Object.entries({shell_exec:'/bin/sh',curl_exec:'/usr/bin/curl',sandbox_exec:'/usr/bin/sandbox-exec'})){const r=cp.spawnSync(path,['--version'],{encoding:'utf8'});out[name]={allowed:!r.error,error:r.error?.code,status:r.status}}
const child=cp.spawnSync(process.execPath,['-e',"try{require('fs').readFileSync(process.argv[1]);process.exit(9)}catch(e){process.stdout.write(e.code);process.exit(0)}",a.operator],{encoding:'utf8'});out.node_descendant={allowed:!child.error,status:child.status,deniedRead:child.stdout==='EPERM',error:child.error?.code};
for(const [name,port]of Object.entries({kernel_network:a.kernel,model_network:a.model,unrelated_network:a.other})){try{const r=await fetch('http://127.0.0.1:'+port+'/'+name,{signal:AbortSignal.timeout(2000)});out[name]={allowed:r.ok}}catch(e){out[name]={allowed:false,error:e.cause?.code??e.name}}}
console.log(JSON.stringify(out));'''
# Node -e defaults to CommonJS, so async work is wrapped without external modules.
probe='(async()=>{'+probe+'})().catch(e=>{console.error(e.message);process.exitCode=1})'
args={'config':str(config),'operator':str(operator),'cross':str(cross),'alias':str(alias),'gateway':str(gateway.resolve()),'host':str(Path(a.host).resolve()),'profile':str(profile),'journal':str(journal),'workspace':str(workspace),'settings':str(control/'settings.json'),'kernel':kernel.server_port,'model':relay_port,'other':other.server_port}
probe_env={'HOME':str(profile),'TMPDIR':manifest['temporary'],'OPENSSL_CONF':'/dev/null','PATH':str(Path(node).parent)}
q=subprocess.run(['/usr/bin/sandbox-exec','-f',str(policy),node,'-e',probe,json.dumps(args)],env=probe_env,text=True,capture_output=True,timeout=30)
(a.output/'process.stdout.json').write_text(q.stdout);(a.output/'process.stderr.txt').write_text(q.stderr)
checks=json.loads(q.stdout) if q.stdout.strip() else {};failures=[]
if r.returncode or not model_requests:failures.append('actual host did not complete localhost model fixture')
if q.returncode:failures.append('adversarial process failed to execute under exact policy')
allowed={'own_config_read','profile_write','journal_write','node_descendant','kernel_network','model_network'}
for name,value in checks.items():
 if value.get('allowed')!=(name in allowed):failures.append('unexpected access: '+name)
if not checks.get('node_descendant',{}).get('deniedRead'):failures.append('Node child did not preserve read denial')
if any(event['port']==other.server_port for event in network):failures.append('unrelated listener observed guest request')
# Independent positive control proves the unrelated listener would see a request.
import urllib.request
with urllib.request.urlopen(f'http://127.0.0.1:{other.server_port}/operator-control') as response:response.read()
if sum(event['port']==other.server_port for event in network)!=1:failures.append('independent listener control failed')
summary={'evidence_class':'REAL_HOST_AND_ADVERSARIAL_PROCESS_LOCAL_FIXTURES_NO_KERNEL','accepted':False,'host_exit':r.returncode,'process_exit':q.returncode,'probe_integrity':'FAIL' if failures else 'PASS','failures':failures,'checks':checks,'network_observations':network,'run_directory':str(run),'host_sha256':hashlib.sha256(Path(a.host).read_bytes()).hexdigest(),'gateway_sha256':hashlib.sha256(gateway.read_bytes()).hexdigest(),'sandbox_sha256':hashlib.sha256(policy.read_bytes()).hexdigest(),'probe_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
(a.output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({'host_exit':r.returncode,'process_exit':q.returncode,'failures':failures}))
for server in [model,kernel,other,relay_observer]:server.shutdown()
raise SystemExit(bool(failures))
