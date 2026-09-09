import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, symlinkSync, rmSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { canonicalLocation, isWithin } from "../scripts/restricted.mjs";

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
