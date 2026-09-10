import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, symlinkSync, rmSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { canonicalLocation, isWithin, hasExactHostTools } from "../scripts/restricted.mjs";

test("native initialization must activate exactly the protected MCP tool inventory",()=>{
  const tools=["mcp__chio__read_text_file","mcp__chio__write_file"];
  const ready={type:"system",subtype:"init",tools:[...tools].reverse(),mcp_servers:[{name:"chio",status:"connected"}]};
  assert.equal(hasExactHostTools(ready,tools),true);
  for(const event of [
    {type:"result",subtype:"success"},
    {...ready,tools:[],mcp_servers:[{name:"chio",status:"failed"}]},
    {...ready,tools:[...tools,"Bash"]},
    {...ready,tools:[tools[0],tools[0]]},
    {...ready,mcp_servers:[{name:"other",status:"connected"}]},
    {...ready,mcp_servers:[...ready.mcp_servers,{name:"extra",status:"connected"}]},
  ]) assert.equal(hasExactHostTools(event,tools),false);
});

test("private paths cannot hide inside workspace using two-dot names or symlink ancestors", t=>{
  const root=mkdtempSync(join(tmpdir(),"chio-containment-"));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const workspace=join(root,"workspace");mkdirSync(workspace);
  const nested=join(workspace,"..private");mkdirSync(nested);
  const alias=join(root,"outside-alias");symlinkSync(nested,alias);
  const realWorkspace=realpathSync(workspace);
  assert.equal(isWithin(realWorkspace,nested),true);
  assert.equal(isWithin(realWorkspace,join(nested,"new-profile")),true);
  assert.equal(isWithin(realWorkspace,join(alias,"new-profile")),true);
  assert.equal(isWithin(realWorkspace,join(root,"legitimate-private")),false);
  assert.equal(canonicalLocation(join(alias,"new-profile")),join(realpathSync(nested),"new-profile"));
});

test("launcher runs validation through preserved symlink main paths",t=>{
  const root=mkdtempSync(join(tmpdir(),"chio-entrypoint-"));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const path=join(root,"restricted.mjs");
  symlinkSync(fileURLToPath(new URL("../scripts/restricted.mjs",import.meta.url)),path);
  const result=spawnSync(process.execPath,["--preserve-symlinks-main",path],{encoding:"utf8"});
  assert.equal(result.status,1);
  assert.match(result.stderr,/--host is required/);
});

test("trusted host supervisor stops its process group when the parent lifeline closes", {skip:process.platform!=="darwin"}, async t=>{
  const {writeFileSync}=await import('node:fs');
  const {spawn}=await import('node:child_process');
  const root=mkdtempSync(join(tmpdir(),'chio-supervisor-lifecycle-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const policy=join(root,'test.sb'),config=join(root,'launch.json');
  writeFileSync(policy,'(version 1) (allow default)');
  writeFileSync(config,JSON.stringify({command:'/usr/bin/sandbox-exec',args:['-f',policy,process.execPath,'-e','process.stdout.write("ready\\n");setInterval(()=>{},1000)'],cwd:root,env:{PATH:'/usr/bin:/bin'}}));
  const child=spawn(process.execPath,[fileURLToPath(new URL('../scripts/host-supervisor.mjs',import.meta.url)),config],{stdio:['ignore','pipe','pipe','pipe']});
  let stderr='';child.stderr.on('data',data=>{stderr+=data});
  t.after(()=>child.kill('SIGKILL'));
  const closed=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
  await new Promise((resolve,reject)=>{child.stdout.once('data',data=>String(data).includes('ready')?resolve():reject(new Error('missing child readiness')));child.once('error',reject)});
  child.stdio[3].end();
  let deadline;
  const result=await Promise.race([closed,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('orphan host remains: '+stderr)),8000)})]).finally(()=>clearTimeout(deadline));
  assert.equal(result.code,143,stderr);
});
