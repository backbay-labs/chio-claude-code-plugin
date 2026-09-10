// Unit regressions with an explicit bridge fixture. These do not establish
// real host or kernel acceptance; see scripts/acceptance/host-contract.py.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const key = "a".repeat(64);
const input = { session_id: "session-a", tool_name: "Read", tool_input: { file_path: "/tmp/local" }, tool_use_id: "toolu_a" };
const receipt = { id: "receipt", kernel_key: key, capability_id: "cap-a", tool_name: "Read", tool_server: "*", action: { parameters: input.tool_input }, decision: { verdict: "allow" } };
const bond = { sessionId: "session-a", policyPath: "/tmp/policy", passport: { capabilityId: "cap-a", expiresAt: "2099-01-01T00:00:00Z" } };

function fixture(t, opts = {}) {
  const tmp = mkdtempSync(join(tmpdir(), "chio-hook-unit-"));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  cpSync(join(root, "hooks"), join(tmp, "hooks"), { recursive: true });
  mkdirSync(join(tmp, "dist", "state"), { recursive: true });
  const verdict = Object.hasOwn(opts, "verdict") ? opts.verdict : { decision: "allow", receipt };
  writeFileSync(join(tmp, "dist", "state", "bridge.js"), `export function buildBridge() { ${opts.buildThrow ? "throw new Error('build failure');" : ""} return { check: async () => { ${opts.checkThrow ? "throw new Error('connection refused');" : ""} return ${JSON.stringify(verdict)}; }, verifyReceipt: async () => ${opts.verify !== false} }; }`);
  writeFileSync(join(tmp, "dist", "state", "store.js"), `export function getBond(id) { return ${JSON.stringify(Object.hasOwn(opts,"bond") ? opts.bond : bond)}; } export function getSoleBond() { return ${JSON.stringify(bond)}; }`);
  writeFileSync(join(tmp, "dist", "state", "paths.js"), `export const PENDING_DIR=${JSON.stringify(join(tmp,"pending"))}; export const RECEIPT_CACHE_DIR=${JSON.stringify(join(tmp,"receipts"))};`);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("CHIO_") && !k.startsWith("CLAUDE_PLUGIN_OPTION_")));
  Object.assign(env, { CHIO_TRUSTED_RECEIPT_KEY: key }, opts.env);
  const run = (event = input, hook = "pretooluse") => spawnSync(process.execPath, [join(tmp,"hooks",`${hook}.mjs`)], { env, input: JSON.stringify(event), encoding:"utf8", timeout:5000 });
  return { run, tmp };
}
function denied(result, pattern) {
  assert.equal(result.status, 0, result.stderr);
  const out = JSON.parse(result.stdout).hookSpecificOutput;
  assert.equal(out.permissionDecision, "deny");
  if (pattern) assert.match(out.permissionDecisionReason, pattern);
}

test("matching explicit allow persists authorization before native dispatch", t => {
  const f=fixture(t); const r=f.run(); assert.equal(r.status,0,r.stderr); assert.equal(r.stdout,"");
  const names=readdirSync(join(f.tmp,"pending")); assert.equal(names.length,1);
  const record=JSON.parse(readFileSync(join(f.tmp,"pending",names[0]),"utf8"));
  assert.equal(record.executionState,"not-observed"); assert.equal(record.sessionId,"session-a");
  denied(f.run(), /EEXIST/);
});
for (const decision of [undefined,"pending","ask","incomplete","cancelled","deny",true]) {
  test(`non-allow verdict ${decision} denies`, t => denied(fixture(t,{verdict:{decision}}).run()));
}
for (const opts of [{checkThrow:true},{buildThrow:true},{bond:null},{bond:{...bond,sessionId:"session-b"}},{bond:{...bond,passport:{...bond.passport,expiresAt:"2001-01-01T00:00:00Z"}}},{verify:false},{env:{CHIO_TRUSTED_RECEIPT_KEY:""}},{env:{CHIO_SERVICE_TOKEN:"fixture"}}]) {
  test(`failure denies: ${JSON.stringify(opts)}`, t => denied(fixture(t,opts).run()));
}
for (const changed of [{kernel_key:"b".repeat(64)},{capability_id:"wrong"},{tool_server:"wrong"},{tool_name:"Write"},{action:{parameters:{file_path:"/tmp/other"}}}]) {
  test(`substituted receipt rejected: ${Object.keys(changed)[0]}`,t => denied(fixture(t,{verdict:{decision:"allow",receipt:{...receipt,...changed}}}).run()));
}
test("cost oracle failures never become zero spend", t => denied(fixture(t,{env:{CHIO_COST_ORACLE_PATH:"/missing-oracle.mjs"}}).run()));
test("budgeted calls require an oracle", t => denied(fixture(t,{bond:{...bond,budgetCapUsd:0}}).run(),/cost oracle/));
test("missing exact session is rejected even with sole bond",t=>denied(fixture(t).run({...input,session_id:undefined})));
test("untrusted receipt is not archived after a post-tool event", t => {
  const f=fixture(t); assert.equal(f.run().stdout,"");
  const file=join(f.tmp,"pending",readdirSync(join(f.tmp,"pending"))[0]);
  const record=JSON.parse(readFileSync(file,"utf8"));record.authorizationReceipt.kernel_key="b".repeat(64);writeFileSync(file,JSON.stringify(record));
  const r=f.run({...input,tool_response:"success"},"posttooluse");assert.match(r.stderr,/unresolved/);
  assert.throws(()=>readdirSync(join(f.tmp,"receipts")));assert.equal(readdirSync(join(f.tmp,"pending")).length,1);
});
test("post-tool observation stays unverified and request bound", t=>{
  const f=fixture(t);assert.equal(f.run().stdout,"");
  const r=f.run({...input,tool_response:{ok:true}},"posttooluse");assert.equal(r.status,0);assert.equal(r.stderr,"");
  const record=JSON.parse(readFileSync(join(f.tmp,"receipts",readdirSync(join(f.tmp,"receipts"))[0]),"utf8"));
  assert.equal(record.executionState,"host-reported-success-unverified");
  denied(f.run(), /EEXIST/);
});
