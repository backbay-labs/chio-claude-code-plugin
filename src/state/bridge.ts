import { ChioBridge } from "@chio/bridge";

/**
 * Construct a bridge using the plugin's environment. Precedence:
 *  1. CHIO_SERVICE_TOKEN / CHIO_TRUST_URL / CHIO_MCP_EDGE_URL set → daemon mode.
 *  2. Otherwise → CLI mode (shell out to `chio`).
 *
 * The plugin's userConfig lands in env as CLAUDE_PLUGIN_OPTION_* per the
 * Claude Code plugin spec; we honor those too so users never hand-edit JSON.
 */
export function buildBridge(): ChioBridge {
  const token =
    process.env.CHIO_SERVICE_TOKEN ??
    process.env.CLAUDE_PLUGIN_OPTION_SERVICE_TOKEN;
  const trustUrl =
    process.env.CHIO_TRUST_URL ??
    process.env.CLAUDE_PLUGIN_OPTION_TRUST_URL;
  const mcpEdgeUrl =
    process.env.CHIO_MCP_EDGE_URL ??
    process.env.CLAUDE_PLUGIN_OPTION_MCP_EDGE_URL;
  const chioBinary =
    process.env.CHIO_BINARY ??
    process.env.CHIO_BIN ??
    process.env.CLAUDE_PLUGIN_OPTION_CHIO_BINARY ??
    "chio";

  if (token) {
    return ChioBridge.fromDaemon({
      token,
      ...(trustUrl ? { trustUrl } : {}),
      ...(mcpEdgeUrl ? { mcpEdgeUrl } : {}),
    });
  }
  return ChioBridge.fromCli({ chioBinary });
}

export function getPolicyPath(): string | undefined {
  return (
    process.env.CHIO_POLICY_PATH ??
    process.env.CLAUDE_PLUGIN_OPTION_POLICY_PATH ??
    undefined
  );
}
