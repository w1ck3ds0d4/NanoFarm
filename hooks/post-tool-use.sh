#!/usr/bin/env bash
# NanoFarm claude code hook: appends one record per tool call to ~/.nanofarm/tokens.jsonl.
# wired up via PostToolUse in claude code's settings.json (see ./INSTALL.md).

set -euo pipefail

dir="${HOME}/.nanofarm"
mkdir -p "${dir}"
file="${dir}/tokens.jsonl"

input=$(cat)

tool=$(printf '%s' "${input}" \
  | grep -oE '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -n1 \
  | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/' || true)

if [ -z "${tool}" ]; then
  tool="unknown"
fi

ts=$(( $(date +%s) * 1000 ))

esc=$(printf '%s' "${tool}" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')

printf '{"t":%s,"tool":"%s","v":1}\n' "${ts}" "${esc}" >> "${file}"
