#!/usr/bin/env bash
# smoke.sh — live end-to-end smoke test for @chio/claude-code-plugin.
#
# Proves every README-claimed capability against real `chio` + real `claude` +
# the canonical chio-test-harness. No mocks. Idempotent; stops the harness it
# starts. Produces a timestamped log under ./smoke-results/.
#
# Exit 0 on full green, non-zero on any step failure.

set -euo pipefail

# --- paths & ports -----------------------------------------------------------
PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_SRC="/Users/connor/Medica/backbay/standalone/chio-test-harness"
HARNESS_DIR="/tmp/chio-smoke-claude-code"
# Wave 5.0.1: chio-policy re-landed first-class velocity/human_in_loop
# variants on the renamed crate, so the `chio` binary once again accepts
# the canonical smoke policy. Swap back to `chio`.
CHIO_BIN_PATH="/Users/connor/Medica/backbay/standalone/arc/target/release/chio"
BRIDGE_DIST="/Users/connor/Medica/backbay/standalone/chio-bridge/dist/index.js"
CLAUDE_HOME_DIR="${HARNESS_DIR}/claude-home"

RESULTS_DIR="${PLUGIN_DIR}/smoke-results"
mkdir -p "${RESULTS_DIR}"
LOG="${RESULTS_DIR}/run-$(date +%s).log"

# Canonical smoke policy — allows Bash so Claude Code's built-in Bash tool
# can round-trip through the chio PreToolUse hook without "tool not in scope".
SMOKE_POLICY="${HARNESS_DIR}/policy/claude-smoke.yaml"
TINY_POLICY="${HARNESS_DIR}/policy/tiny-budget.yaml"

# --- logging helpers ---------------------------------------------------------
log() { printf '%s %s\n' "[$(date -u +%H:%M:%S)]" "$*" | tee -a "${LOG}"; }
pass() { log "[PASS] step $1 passed: $2"; }
fail() { log "[FAIL] step $1 FAILED: $2"; exit 1; }

# --- teardown ----------------------------------------------------------------
cleanup() {
  log "teardown: stopping harness"
  bash "${HARNESS_DIR}/bin/stop.sh" >>"${LOG}" 2>&1 || true
  log "teardown: wiping local plugin state"
  rm -rf "${HOME}/.claude/plugins/chio/pending" \
         "${HOME}/.claude/plugins/chio/receipts" \
         "${HOME}/.claude/plugins/chio/state.json" || true
}
trap 'cleanup' EXIT

# --- pre-flight --------------------------------------------------------------
log "smoke: plugin=${PLUGIN_DIR}"
log "smoke: log=${LOG}"

[[ -x "${CHIO_BIN_PATH}" ]] || fail 0 "chio binary missing: ${CHIO_BIN_PATH}"
command -v claude >/dev/null || fail 0 "claude CLI not on PATH"
[[ -f "${BRIDGE_DIST}" ]] || fail 0 "chio-bridge not built: ${BRIDGE_DIST}"
CLAUDE_VERSION="$(claude --version 2>&1 | tr -d '\r')"
log "smoke: claude=${CLAUDE_VERSION}"

# Ensure the plugin is built.
if [[ ! -f "${PLUGIN_DIR}/dist/index.js" ]]; then
  log "smoke: building plugin"
  ( cd "${PLUGIN_DIR}" && bun install && bun run build ) >>"${LOG}" 2>&1 \
    || fail 0 "plugin build failed"
fi

# Clone harness (fresh var/ so we don't inherit past receipts).
if [[ -d "${HARNESS_DIR}" ]]; then
  bash "${HARNESS_DIR}/bin/stop.sh" >>"${LOG}" 2>&1 || true
  rm -rf "${HARNESS_DIR}"
fi
cp -r "${HARNESS_SRC}" "${HARNESS_DIR}"
rm -f "${HARNESS_DIR}/var/"*.sqlite* "${HARNESS_DIR}/var/"*.pid \
       "${HARNESS_DIR}/var/trust.token" "${HARNESS_DIR}/var/passport-statuses.json" || true

# Write the smoke policy (allows Bash so claude's built-in tool passes).
cat > "${SMOKE_POLICY}" <<'EOF'
hushspec: "0.1.0"
name: claude-smoke
description: Smoke policy for Claude Code default tools. Bash allowed; /etc/** forbidden.

rules:
  forbidden_paths:
    enabled: true
    patterns:
      - "/etc/**"
      - "/var/**"
      - "/System/**"

  tool_access:
    enabled: true
    default: block
    allow:
      - Bash
      - Read
      - echo
      - paid_action

  velocity:
    enabled: true
    max_invocations_per_window: 100
    window_secs: 3600
    burst_factor: 1.0
EOF

export CHIO_BIN="${CHIO_BIN_PATH}"
export CHIO_BINARY="${CHIO_BIN_PATH}"
export PATH="$(dirname "${CHIO_BIN_PATH}"):${PATH}"

# ============================================================================
# Step 1 — install / validate plugin
# ============================================================================
log ""
log "=== step 1: install plugin into scratch profile ==="
claude plugin validate "${PLUGIN_DIR}" >>"${LOG}" 2>&1 \
  || fail 1 "claude plugin validate rejected the plugin manifest"
# Claude supports --plugin-dir for a session-scoped install; no marketplace
# needed. The real claude CLI does NOT support isolating CLAUDE_CONFIG_DIR
# cleanly because auth/keychain lives in the user profile — use --plugin-dir
# for plugin isolation and leave the user profile alone.
pass 1 "plugin manifest validated; loaded for session via --plugin-dir"

# ============================================================================
# Step 2 — start harness
# ============================================================================
log ""
log "=== step 2: start harness ==="
CHIO_POLICY="${SMOKE_POLICY}" bash "${HARNESS_DIR}/bin/start.sh" >>"${LOG}" 2>&1 \
  || fail 2 "bin/start.sh did not reach READY"
# Source env so the downstream steps see CHIO_TOKEN etc.
source "${HARNESS_DIR}/bin/env.sh"
export CHIO_SERVICE_TOKEN="${CHIO_TOKEN}"
export CHIO_POLICY="${SMOKE_POLICY}"
export CHIO_RECEIPT_DB="${HARNESS_DIR}/var/receipts.sqlite"
export CLAUDE_PLUGIN_OPTION_POLICY_PATH="${SMOKE_POLICY}"
pass 2 "harness READY at trust=${CHIO_TRUST_URL} mcp=${CHIO_MCP_URL}"

# ============================================================================
# Step 3 — bond via the plugin's /chio:bond script
# ============================================================================
log ""
log "=== step 3: bond (real did:chio) ==="
# Warm up the receipt DB with one successful check. chio passport create's
# resolveSubjectPublicKey() requires at least one prior receipt. This is a
# documented limitation in chio-bridge/dist/passport.js (see comment above
# resolveSubjectPublicKey). Cheap and fully real — uses the same chio CLI.
"${CHIO_BIN_PATH}" --receipt-db "${CHIO_RECEIPT_DB}" check --policy "${SMOKE_POLICY}" \
    --tool echo --params '{"msg":"bond-warmup"}' --server hello-mcp \
    --format json >>"${LOG}" 2>&1 \
  || fail 3 "bond warm-up check failed"

BOND_OUT="$(node "${PLUGIN_DIR}/scripts/bond.mjs" "${SMOKE_POLICY}" 1h 100 2>&1)" \
  || fail 3 "bond script exited non-zero: ${BOND_OUT}"
echo "${BOND_OUT}" >>"${LOG}"
DID=$(echo "${BOND_OUT}" | grep -oE 'did:(chio|arc):[0-9a-f]+' | head -1)
[[ -n "${DID}" ]] || fail 3 "bond output missing did:chio: ${BOND_OUT}"
# Verify state file persisted the bond
[[ -f "${HOME}/.claude/plugins/chio/state.json" ]] \
  || fail 3 "plugin state.json not written"
grep -q "${DID}" "${HOME}/.claude/plugins/chio/state.json" \
  || fail 3 "state.json missing did:chio"
pass 3 "bonded with ${DID}"

# ============================================================================
# Step 4 — allowed tool call via real claude headless
# ============================================================================
log ""
log "=== step 4: allowed tool call (Bash via claude -p) ==="
# Count receipts before so we can assert exactly one new allow for Bash.
BEFORE=$("${CHIO_BIN_PATH}" --receipt-db "${CHIO_RECEIPT_DB}" receipt list --tool-name Bash --outcome allow --format json 2>/dev/null | wc -l | tr -d ' ')
# Note: we intentionally use the real user's CLAUDE_CONFIG_DIR (auth / keychain)
# rather than an empty scratch dir — the plugin itself is isolated via
# --plugin-dir (session-scoped, not installed into the user's plugins). This
# matches how a real developer would evaluate the plugin.
CLAUDE_OUT="$(timeout 60 claude \
    --plugin-dir "${PLUGIN_DIR}" \
    --permission-mode bypassPermissions \
    --allowedTools "Bash" \
    -p "run the bash command: echo SMOKE_BASH_OK" 2>&1 || true)"
echo "${CLAUDE_OUT}" >>"${LOG}"
echo "${CLAUDE_OUT}" | grep -q "SMOKE_BASH_OK" \
  || fail 4 "claude did not produce SMOKE_BASH_OK — output: ${CLAUDE_OUT}"
AFTER=$("${CHIO_BIN_PATH}" --receipt-db "${CHIO_RECEIPT_DB}" receipt list --tool-name Bash --outcome allow --format json 2>/dev/null | wc -l | tr -d ' ')
NEW_ALLOW=$(( AFTER - BEFORE ))
[[ "${NEW_ALLOW}" -ge 1 ]] \
  || fail 4 "expected >=1 new Bash allow receipt; got ${NEW_ALLOW}"
# Verify signature on the newest Bash allow receipt.
LATEST=$("${CHIO_BIN_PATH}" --receipt-db "${CHIO_RECEIPT_DB}" receipt list --tool-name Bash --outcome allow --limit 1 --format json 2>/dev/null | tail -1)
echo "${LATEST}" >>"${LOG}"
SIG_OK=$(node -e "
import('${BRIDGE_DIST}').then(async m => {
  const r = JSON.parse(process.argv[1]);
  const ok = await m.verifyReceiptValue(r);
  console.log(ok ? 'true' : 'false');
});" "${LATEST}" 2>&1 | tail -1)
[[ "${SIG_OK}" == "true" ]] || fail 4 "Bash allow receipt signature verification failed (got ${SIG_OK})"
pass 4 "Bash tool allowed; ${NEW_ALLOW} new allow receipt(s); ed25519 signature verified"

# ============================================================================
# Step 5 — denied tool call
# ============================================================================
log ""
log "=== step 5: denied tool call (delete_file via direct hook invocation) ==="
# Drive the PreToolUse hook directly with a synthetic delete_file call. The
# smoke policy has no 'delete_file' in tool_access.allow, so chio must DENY with
# the real "not in capability scope" guard reason.
BEFORE_DENY=$("${CHIO_BIN_PATH}" --receipt-db "${CHIO_RECEIPT_DB}" receipt list --tool-name delete_file --outcome deny --format json 2>/dev/null | wc -l | tr -d ' ')
HOOK_OUT="$(printf '%s' '{"session_id":"smoke-5","tool_name":"delete_file","tool_input":{"path":"/etc/hosts"},"tool_use_id":"smoke-use-5"}' \
  | node "${PLUGIN_DIR}/hooks/pretooluse.mjs" 2>&1)"
echo "${HOOK_OUT}" >>"${LOG}"
echo "${HOOK_OUT}" | grep -q '"permissionDecision":"deny"' \
  || fail 5 "hook did not emit deny permissionDecision: ${HOOK_OUT}"
echo "${HOOK_OUT}" | grep -q "not in capability scope" \
  || fail 5 "hook deny reason missing chio guard text"
AFTER_DENY=$("${CHIO_BIN_PATH}" --receipt-db "${CHIO_RECEIPT_DB}" receipt list --tool-name delete_file --outcome deny --format json 2>/dev/null | wc -l | tr -d ' ')
[[ $(( AFTER_DENY - BEFORE_DENY )) -ge 1 ]] \
  || fail 5 "no new deny receipt recorded for delete_file"
pass 5 "delete_file denied; guard reason=\"not in capability scope\"; deny receipt persisted"

# ============================================================================
# Step 6 — budget exhaust with tiny-budget policy
# ============================================================================
log ""
log "=== step 6: budget exhaust (tiny policy, 5x paid_action) ==="
# Must reuse a single MCP session for the velocity counter to accumulate, per
# SMOKE_HARNESS_VERIFY step 4. Restart the harness under tiny-budget policy.
bash "${HARNESS_DIR}/bin/stop.sh" >>"${LOG}" 2>&1 || true
CHIO_POLICY="${TINY_POLICY}" bash "${HARNESS_DIR}/bin/start.sh" >>"${LOG}" 2>&1 \
  || fail 6 "harness restart under tiny-budget failed"
source "${HARNESS_DIR}/bin/env.sh"
export CHIO_SERVICE_TOKEN="${CHIO_TOKEN}"

MCP="${CHIO_MCP_URL}/mcp"
AUTH="Authorization: Bearer ${CHIO_TOKEN}"
CT="Content-Type: application/json"
ACC="Accept: application/json, text/event-stream"

INIT=$(curl -s -i -X POST "${MCP}" -H "${AUTH}" -H "${CT}" -H "${ACC}" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{"sampling":{"tools":true}},"clientInfo":{"name":"smoke","version":"0.0.1"}}}')
SID=$(echo "${INIT}" | tr -d '\r' | grep -i '^mcp-session-id:' | awk '{print $2}')
[[ -n "${SID}" ]] || fail 6 "MCP session id missing from init response"
echo "MCP session: ${SID}" >>"${LOG}"
curl -s -o /dev/null -X POST "${MCP}" -H "${AUTH}" -H "${CT}" -H "${ACC}" \
  -H "Mcp-Session-Id: ${SID}" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

CANCELLED=0
ALLOW_COUNT=0
for i in 1 2 3 4 5; do
  RESP=$(curl -s -X POST "${MCP}" -H "${AUTH}" -H "${CT}" -H "${ACC}" \
    -H "Mcp-Session-Id: ${SID}" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$((i+10)),\"method\":\"tools/call\",\"params\":{\"name\":\"paid_action\",\"arguments\":{\"usd\":50}}}")
  DATA=$(echo "${RESP}" | grep '^data:' | head -1 | sed 's/^data: //')
  echo "iter $i: ${DATA}" >>"${LOG}"
  if echo "${DATA}" | grep -q '"isError":true'; then
    if echo "${DATA}" | grep -q 'velocity'; then
      CANCELLED=$(( CANCELLED + 1 ))
    fi
  else
    ALLOW_COUNT=$(( ALLOW_COUNT + 1 ))
  fi
done
[[ ${ALLOW_COUNT} -ge 1 ]] || fail 6 "expected at least one allow before exhaust; got ${ALLOW_COUNT}"
[[ ${CANCELLED} -ge 1 ]] || fail 6 "expected at least one velocity-guard cancel; got ${CANCELLED}"
# Confirm a deny receipt is present for paid_action.
DENY_PAID=$("${CHIO_BIN_PATH}" --receipt-db "${CHIO_RECEIPT_DB}" receipt list --tool-name paid_action --outcome deny --format json --limit 10 2>/dev/null | grep -c '"verdict":"deny"' || true)
[[ ${DENY_PAID} -ge 1 ]] || fail 6 "no paid_action deny receipt persisted"
pass 6 "budget exhaust: ${ALLOW_COUNT} allow then ${CANCELLED} cancel(s); deny receipt present"

# ============================================================================
# Step 7 — revoke
# ============================================================================
log ""
log "=== step 7: revoke ==="
# Restart harness under smoke policy so we have a bond to revoke.
bash "${HARNESS_DIR}/bin/stop.sh" >>"${LOG}" 2>&1 || true
CHIO_POLICY="${SMOKE_POLICY}" bash "${HARNESS_DIR}/bin/start.sh" >>"${LOG}" 2>&1 \
  || fail 7 "harness restart under smoke policy failed"
source "${HARNESS_DIR}/bin/env.sh"
export CHIO_SERVICE_TOKEN="${CHIO_TOKEN}"
export CHIO_POLICY="${SMOKE_POLICY}"
export CHIO_RECEIPT_DB="${HARNESS_DIR}/var/receipts.sqlite"
export CLAUDE_PLUGIN_OPTION_POLICY_PATH="${SMOKE_POLICY}"

# Clear state so revoke has a single target to kill (bond3).
rm -f "${HOME}/.claude/plugins/chio/state.json"

# Warm up receipts + fresh bond against this restarted harness identity.
"${CHIO_BIN_PATH}" --receipt-db "${CHIO_RECEIPT_DB}" check --policy "${SMOKE_POLICY}" \
    --tool echo --params '{"msg":"step7-warmup"}' --server hello-mcp \
    --format json >>"${LOG}" 2>&1 \
  || fail 7 "step 7 warm-up check failed"
BOND2=$(node "${PLUGIN_DIR}/scripts/bond.mjs" "${SMOKE_POLICY}" 1h 100 2>&1)
echo "${BOND2}" >>"${LOG}"
echo "${BOND2}" | grep -q '"status": "bonded"' \
  || fail 7 "bond2 failed: ${BOND2}"
DID2=$(echo "${BOND2}" | grep -oE 'did:(chio|arc):[0-9a-f]+' | head -1)

REVOKE_OUT="$(node "${PLUGIN_DIR}/scripts/revoke.mjs" 2>&1)" \
  || fail 7 "revoke script exited non-zero: ${REVOKE_OUT}"
echo "${REVOKE_OUT}" >>"${LOG}"
echo "${REVOKE_OUT}" | grep -q '"status": "revoked"' \
  || fail 7 "revoke output missing revoked status"

# After revoke, the trust plane must mark that passport status=revoked.
STATUSES=$(curl -s "${CHIO_TRUST_URL}/v1/passport/statuses" -H "Authorization: Bearer ${CHIO_TOKEN}")
echo "${STATUSES}" >>"${LOG}"
REVOKED_COUNT=$(echo "${STATUSES}" | node -e '
let buf=""; process.stdin.on("data",d=>buf+=d).on("end",()=>{
  const j=JSON.parse(buf);
  const hits = (j.passports||[]).filter(p => p.subject === process.argv[1] && p.status === "revoked");
  console.log(hits.length);
});' "${DID2}")
[[ "${REVOKED_COUNT}" -ge 1 ]] \
  || fail 7 "trust plane did not record a revoked passport for ${DID2}"

# After revoke, any subsequent chio check without a bond must fail-closed.
# We already drop state for the current did, so a new PreToolUse call with a
# random tool should DENY with a chio-visible reason.
rm -f "${HOME}/.claude/plugins/chio/state.json"
unset CLAUDE_PLUGIN_OPTION_POLICY_PATH CHIO_POLICY_PATH
FAILCLOSED=$(printf '%s' '{"session_id":"after-revoke","tool_name":"echo","tool_input":{"msg":"test"},"tool_use_id":"after-1"}' \
  | node "${PLUGIN_DIR}/hooks/pretooluse.mjs" 2>&1)
echo "${FAILCLOSED}" >>"${LOG}"
echo "${FAILCLOSED}" | grep -qE 'no capability bonded|permissionDecision":"deny"' \
  || fail 7 "post-revoke hook did not fail-closed: ${FAILCLOSED}"
# Re-export for downstream steps
export CLAUDE_PLUGIN_OPTION_POLICY_PATH="${SMOKE_POLICY}"

pass 7 "revoke succeeded for ${DID2}; trust plane marked revoked; hook fails-closed"

# ============================================================================
# Step 8 — receipt export + verify
# ============================================================================
log ""
log "=== step 8: receipt-export + verify ==="
# Need a fresh bond so receipt-export has a "since" anchor via getSoleBond.
BOND3=$(node "${PLUGIN_DIR}/scripts/bond.mjs" "${SMOKE_POLICY}" 1h 100 2>&1)
echo "${BOND3}" >>"${LOG}"

EVIDENCE_OUT="${HARNESS_DIR}/evidence.json"
rm -f "${EVIDENCE_OUT}"
# Call the plugin's receipt-export script in daemon mode (CHIO_SERVICE_TOKEN set).
EXPORT_OUT="$(node "${PLUGIN_DIR}/scripts/receipt-export.mjs" 1h "${EVIDENCE_OUT}" 2>&1)" \
  || fail 8 "receipt-export script exited non-zero: ${EXPORT_OUT}"
echo "${EXPORT_OUT}" >>"${LOG}"
[[ -f "${EVIDENCE_OUT}" ]] || fail 8 "evidence file not written at ${EVIDENCE_OUT}"

# Verify every receipt in the bundle via bridge.verifyReceipt (ed25519).
VERIFY=$(node -e "
import('${BRIDGE_DIST}').then(async m => {
  const fs = require('fs');
  const bundle = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
  const receipts = (bundle.bundle && bundle.bundle.toolReceipts) || bundle.toolReceipts || [];
  let ok = 0, bad = 0;
  for (const entry of receipts) {
    const r = entry.receipt || entry;
    try {
      const v = await m.verifyReceiptValue(r);
      if (v) ok++; else bad++;
    } catch (e) { bad++; }
  }
  console.log(JSON.stringify({ok, bad, total: receipts.length}));
});" "${EVIDENCE_OUT}" 2>&1 | tail -1)
echo "verify result: ${VERIFY}" >>"${LOG}"
echo "${VERIFY}" | grep -q '"bad":0' \
  || fail 8 "evidence bundle verification had failures: ${VERIFY}"
echo "${VERIFY}" | grep -qE '"total":[1-9]' \
  || fail 8 "evidence bundle empty: ${VERIFY}"
pass 8 "evidence exported to ${EVIDENCE_OUT}; ${VERIFY}"

# ============================================================================
# Summary
# ============================================================================
log ""
log "==================== SMOKE COMPLETE ===================="
log "All 8 steps passed."
log "Log: ${LOG}"
log "========================================================="
exit 0
