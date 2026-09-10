#!/usr/bin/env bash
# Real host contract probe with a localhost model/resource fixture.
# This is not Chio kernel acceptance. All profiles and effects are disposable.
set -euo pipefail
plugin_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
output_dir="${1:-$(mktemp -d "${TMPDIR:-/tmp}/chio-claude-contract-evidence.XXXXXX")}"
python3 "${plugin_dir}/scripts/acceptance/host-contract.py" --output "${output_dir}"
printf 'Contract evidence: %s\nIntegration acceptance remains unresolved; see acceptance/2026-09-09/REPORT.md\n' "${output_dir}"
