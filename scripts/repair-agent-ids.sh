#!/bin/bash
# Repair sub-agent CLAUDE.md files whose curl examples baked the legacy
# literal "marveen" into the `"to":"..."` field at scaffold time. Each
# match is rewritten to the current MAIN_AGENT_ID (from .env, falling
# back to "marveen" only if the env file does not define it).
#
# Usage:
#   bash scripts/repair-agent-ids.sh           # dry-run, prints what would change
#   bash scripts/repair-agent-ids.sh --apply   # writes the changes in place
#
# Safe to re-run: files without the bad literal are skipped.

set -euo pipefail

INSTALL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

MAIN_AGENT_ID=""
if [ -f "$INSTALL_DIR/.env" ]; then
  MAIN_AGENT_ID="$(grep -E '^MAIN_AGENT_ID=' "$INSTALL_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"')"
fi
MAIN_AGENT_ID="${MAIN_AGENT_ID:-marveen}"

if [ "$MAIN_AGENT_ID" = "marveen" ]; then
  echo "WARNING: MAIN_AGENT_ID resolves to legacy 'marveen'. Nothing to repair."
  exit 0
fi

found=0
for f in "$INSTALL_DIR"/agents/*/CLAUDE.md "$INSTALL_DIR"/agents/heartbeat/CLAUDE.md; do
  [ -f "$f" ] || continue
  if grep -q '"to":"marveen"\|"to\\":\\"marveen\\"' "$f"; then
    found=1
    if [ "$APPLY" = "1" ]; then
      sed -i "s/\"to\":\"marveen\"/\"to\":\"$MAIN_AGENT_ID\"/g; s/\\\\\"to\\\\\":\\\\\"marveen\\\\\"/\\\\\"to\\\\\":\\\\\"$MAIN_AGENT_ID\\\\\"/g" "$f"
      echo "patched: $f"
    else
      echo "would patch: $f"
    fi
  fi
done

if [ "$found" = "0" ]; then
  echo "No agent CLAUDE.md files contain the legacy 'to:marveen' literal."
elif [ "$APPLY" != "1" ]; then
  echo
  echo "Dry-run only. Re-run with --apply to write the changes."
fi
