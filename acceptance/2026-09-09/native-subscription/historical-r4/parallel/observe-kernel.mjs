// Read-only request ordering observer, loaded only in trusted parent.
import {appendFileSync} from 'node:fs';
const original=globalThis.fetch;
const record=value=>appendFileSync(process.env.CHIO_PARALLEL_LOG,JSON.stringify({...value,time:process.hrtime.bigint().toString()})+'\n',{mode:0o600});
globalThis.fetch=async function(input,init){
 let call;try{const body=JSON.parse(init?.body);if(String(input)===process.env.CHIO_PARALLEL_ENDPOINT&&body.method==='tools/call')call={rpcId:body.id,path:body.params.arguments.path};}catch{}
 if(call)record({phase:'start',...call});
 const response=await original.call(this,input,init);
 if(call)record({phase:'response',...call,status:response.status});
 return response;
};
