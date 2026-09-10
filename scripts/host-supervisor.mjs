#!/usr/bin/env node
// Trusted process lifeline for the native host. FD 3 belongs only to the parent;
// the sandboxed host never inherits it. Parent death closes the pipe.
import {readFileSync} from 'node:fs';
import {Socket} from 'node:net';
import {spawn} from 'node:child_process';
const [configuration] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(configuration, 'utf8'));
if (spec.command !== '/usr/bin/sandbox-exec' || !Array.isArray(spec.args) || typeof spec.cwd !== 'string' || !spec.env) throw new Error('Invalid trusted host launch specification');
const lifeline = new Socket({fd:3,readable:true,writable:false});
let closed = false, stopping = false, timer;
const child = spawn(spec.command, spec.args, {cwd:spec.cwd,env:spec.env,detached:true,stdio:['inherit','pipe','inherit']});
child.stdout.pipe(process.stdout);
function signal(value) {
  if (closed || !child.pid) return;
  try { process.kill(-child.pid,value); } catch (error) { if (error.code !== 'ESRCH') throw error; }
}
function stop() {
  if (closed || stopping) return;
  stopping = true;
  signal('SIGTERM');
  timer = setTimeout(()=>signal('SIGKILL'),5000);
}
lifeline.on('end',stop);lifeline.on('error',stop);lifeline.on('close',stop);lifeline.resume();
process.once('SIGINT',stop);process.once('SIGTERM',stop);
child.once('error',()=>{closed=true;lifeline.destroy();if(timer)clearTimeout(timer);process.exitCode=1;});
child.once('close',(code,reason)=>{closed=true;lifeline.destroy();if(timer)clearTimeout(timer);process.exitCode=stopping?143:code??(reason?1:0);});
