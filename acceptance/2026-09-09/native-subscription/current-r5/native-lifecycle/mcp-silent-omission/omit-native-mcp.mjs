// Qualification-only parent preload; no protected child loads this module.
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
const original=fs.writeFileSync;
let omitted=false;
fs.writeFileSync=function(path,data,...rest){
 if(!omitted&&String(path).endsWith('/mcp-session.json')){
  const value=JSON.parse(String(data));
  if(value.mcpServers?.chio?.type!=='http')throw new Error('Unexpected native MCP source');
  omitted=true;
  original(process.env.CHIO_SUBSCRIPTION_FAULT_LOG,JSON.stringify({cutpoint:'before-native-mcp-configuration-write',mode:'mcp-silent-omission',parentPid:process.pid})+'\n',{mode:0o600,flag:'wx'});
  return original.call(this,path,JSON.stringify({mcpServers:{}}),...rest);
 }
 return original.call(this,path,data,...rest);
};
syncBuiltinESMExports();
