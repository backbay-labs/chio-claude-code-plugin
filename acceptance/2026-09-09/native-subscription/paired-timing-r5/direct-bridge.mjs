import fs from 'node:fs';import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';
const [entry,configPath,resource,recordDir]=process.argv.slice(2);
const {createMcpExecutionClient}=await import(pathToFileURL(entry).href);
const config=JSON.parse(fs.readFileSync(configPath));const client=createMcpExecutionClient(config.execution);
if(!(await client.validateSession({allowedTools:['read_text_file']})).ok)throw Error('Baseline authority validation failed');
fs.mkdirSync(recordDir,{mode:0o700});
function persist(name,value){const fd=fs.openSync(recordDir+'/'+name,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd)}finally{fs.closeSync(fd)}const dir=fs.openSync(recordDir,'r');try{fs.fsyncSync(dir)}finally{fs.closeSync(dir)}}
const request={tool:'read_text_file',arguments:{path:resource},requestId:'claude-timing:'+randomUUID()};
persist('pending.json',request);
const start=process.hrtime.bigint();const outcome=await client.execute(request);const end=process.hrtime.bigint();
persist('outcome.json',outcome);
if(outcome.state!=='completed'||outcome.evidence!=='verified'||outcome.result?.isError)throw Error('Unsuccessful baseline retained; never retry automatically');
const ack=await client.acknowledge(outcome);persist('acknowledgement.json',ack);
if(!ack.acknowledged)throw Error('Baseline delivery ACK failed');
console.log(JSON.stringify({startMonotonicNs:String(start),endMonotonicNs:String(end),elapsedMs:Number(end-start)/1e6,requestId:request.requestId,state:outcome.state,evidence:outcome.evidence,acknowledged:ack.acknowledged}));
