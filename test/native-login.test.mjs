import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {nativeLogin} from '../scripts/native-login.mjs';
import {startModelRelay} from '../scripts/model-relay.mjs';
import {createServer} from 'node:http';

test('native credential observation waits for the child and returns only provider headers',async t=>{
 const root=mkdtempSync(join(tmpdir(),'chio-auth-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const host=join(root,'host');writeFileSync(host,`#!${process.execPath}\nawait fetch(process.env.ANTHROPIC_BASE_URL+'/v1/messages?beta=true',{method:'POST',headers:{authorization:'Bearer isolated-fixture','anthropic-beta':'oauth-fixture'},body:'{}'});`,{mode:0o700});
 assert.deepEqual(await nativeLogin(host,root),{authorization:'Bearer isolated-fixture',beta:'oauth-fixture'});
 writeFileSync(host,`#!${process.execPath}\nprocess.exit(1);`,{mode:0o700});
 await assert.rejects(nativeLogin(host,root),/subscription authentication unavailable/);
});

test('subscription relay exchanges the guest credential and preserves beta query without exposing provider auth',async t=>{
 let observed;
 const upstream=createServer(async(req,res)=>{let body='';for await(const b of req)body+=b;observed={url:req.url,headers:req.headers,body:JSON.parse(body)};res.writeHead(200,{'content-type':'application/json'});res.end('{}');});
 await new Promise(resolve=>upstream.listen(0,'127.0.0.1',resolve));
 t.after(()=>{upstream.closeAllConnections();upstream.close();});
 const relay=await startModelRelay({upstreamBaseUrl:`http://127.0.0.1:${upstream.address().port}`,oauth:{authorization:'Bearer parent-only',beta:'oauth-required'},model:'test-model',toolNames:[]});
 t.after(()=>relay.close());
 const url=`http://127.0.0.1:${relay.port}/v1/messages?beta=true`;
 const request={method:'POST',headers:{'x-api-key':relay.token,'anthropic-beta':'client-feature'},body:JSON.stringify({model:'test-model',messages:[{role:'user',content:'inline'}],stream:true})};
 assert.equal((await fetch(url,{...request,headers:{'x-api-key':'wrong'}})).status,403);assert.equal(observed,undefined);
 assert.equal((await fetch(url,request)).status,200);
 assert.equal(observed.url,'/v1/messages?beta=true');assert.equal(observed.headers.authorization,'Bearer parent-only');assert.equal(observed.headers['x-api-key'],undefined);
 assert.equal(observed.headers['anthropic-beta'],'oauth-required,client-feature');assert.ok(!JSON.stringify(relay.events).includes('parent-only'));
 const refused=await fetch(url,{...request,body:JSON.stringify({model:'test-model',messages:[],tools:[{type:'web_search_20250305',name:'web_search'}]})});
 assert.equal(refused.status,403);
});
