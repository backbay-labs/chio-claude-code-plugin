import {readFileSync} from 'node:fs';
import {createPublicKey,verify,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const [snapshot,publicKeyPath,canonicalPath,sessionId,subjectKey,requestId]=process.argv.slice(2);
const {canonicalizeJson}=await import(pathToFileURL(canonicalPath).href);
const raw=readFileSync(publicKeyPath,'utf8').trim();
if(!/^[0-9a-f]{64}$/i.test(raw))throw Error('Unexpected pinned signer format');
const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(raw,'hex')]),format:'der',type:'spki'});
const data=JSON.parse(readFileSync(snapshot,'utf8')),results=[];
for(const table of ['remote_session_credential_calls','remote_session_credential_latches']){
 const rows=data.databases['sessions.sqlite'][table].filter(row=>row.request_id===requestId);
 if(rows.length!==1)throw Error('Expected one retained original fence');
 const row=rows[0],body=JSON.parse(row.record_json);
 if(body.schema!=='chio.mcp.session-credential-call.v1'||body.state!=='fenced'||body.sessionId!==sessionId||body.subjectKey!==subjectKey||body.requestId!==requestId||row.session_id!==sessionId)throw Error('Fence identity mismatch');
 const preimage=Buffer.from(canonicalizeJson(body));
 if(!verify(null,preimage,key,Buffer.from(row.signature,'hex')))throw Error('Fence signature rejected');
 if(verify(null,Buffer.from(canonicalizeJson({...body,requestId:requestId+'-tampered'})),key,Buffer.from(row.signature,'hex')))throw Error('Tampered fence unexpectedly verified');
 results.push({table,requestId,state:body.state,signatureVerifiedAgainstPinnedKernel:true,tamperedRequestRejected:true,canonicalPreimageSha256:createHash('sha256').update(preimage).digest('hex')});
}
console.log(JSON.stringify(results));
