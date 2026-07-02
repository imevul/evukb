#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if pnpm install --frozen-lockfile --lockfile-only >/dev/null 2>&1; then
  exit 0
fi

echo "pnpm-lock.yaml is out of date with package.json; syncing lockfile..."
pnpm install --no-frozen-lockfile --lockfile-only
