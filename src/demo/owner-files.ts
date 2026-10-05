// Run each fixture file operation with an inode-bound working directory. The child
// is deliberately tiny: no asynchronous filesystem work or changes to the parent's cwd.
import { execFileSync } from "node:child_process";
import { lstatSync } from "node:fs";

const worker = String.raw`
import { constants as C, lstatSync, statSync, mkdirSync, openSync, closeSync, fstatSync, readSync, writeFileSync, readFileSync } from 'node:fs';
const input=JSON.parse(readFileSync(0,'utf8')), limit=1024*1024;
const identity=s=>[s.dev.toString(),s.ino.toString()];
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
let fd;
try {
  if(!same(identity(statSync('.',{bigint:true})),input.identity)) throw Error();
  const parts=input.path.split('/');
  for(const segment of parts.slice(0,-1)) {
    let before;
    try { before=lstatSync(segment,{bigint:true}); }
    catch(error) { if(error.code!=='ENOENT'||input.action!=='write') throw error; mkdirSync(segment,{mode:0o700}); before=lstatSync(segment,{bigint:true}); }
    if(!before.isDirectory()||before.isSymbolicLink()) throw Error();
    process.chdir(segment);
    // If an ancestor changed between lstat and chdir, do no file operation.
    if(!same(identity(statSync('.',{bigint:true})),identity(before))) throw Error();
  }
  const leaf=parts.at(-1);
  if(input.action==='write') {
    fd=openSync(leaf,C.O_WRONLY|C.O_CREAT|C.O_EXCL|C.O_NOFOLLOW,0o600);
    writeFileSync(fd,input.content);
    process.stdout.write(JSON.stringify({ok:true}));
  } else {
    fd=openSync(leaf,C.O_RDONLY|C.O_NOFOLLOW|C.O_NONBLOCK);
    const s=fstatSync(fd);
    if(!s.isFile()||s.nlink!==1||s.size>limit) throw Error();
    const buffer=Buffer.alloc(limit+1); let size=0,n;
    while(size<buffer.length&&(n=readSync(fd,buffer,size,buffer.length-size,null))>0) size+=n;
    if(size>limit) throw Error();
    process.stdout.write(JSON.stringify({ok:true,text:buffer.subarray(0,size).toString('utf8')}));
  }
} catch(error) { process.stdout.write(JSON.stringify({ok:false,exists:error.code==='EEXIST'})); }
finally { if(fd!==undefined) closeSync(fd); }
`;

export function createOwnerFiles(owner: string) {
  const root = lstatSync(owner, { bigint: true });
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error("demo owner must be a real directory");
  const identity = [root.dev.toString(), root.ino.toString()];
  return (action: "read" | "write", path: unknown, content?: string): { ok: boolean; text?: string; exists?: boolean } => {
    if (typeof path !== "string" || !path || path.length > 4096 || path.includes("\0") || path.includes("\\")
      || path.split("/").length > 64 || path.split("/").some(p => !p || p === "." || p === "..")) return { ok: false };
    if (action === "write" && (typeof content !== "string" || Buffer.byteLength(content) > 1024 * 1024)) return { ok: false };
    try {
      const result = execFileSync(process.execPath, ["--input-type=module", "-e", worker], {
        cwd: owner, input: JSON.stringify({ action, path, content, identity }), encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 5000,
        // An inherited preload must not turn a bounded file helper into arbitrary code.
        env: {}, stdio: ["pipe", "pipe", "pipe"],
      });
      return JSON.parse(result) as { ok: boolean; text?: string; exists?: boolean };
    } catch { return { ok: false }; }
  };
}
