#!/usr/bin/env bash
set -euo pipefail

export EVUKB_WEB_CONFIG_PATH="/workspace/apps/web/dist/config.js"

node <<'NODE'
const fs = require('node:fs');

const config = {
  apiBaseUrl: process.env.VITE_EVUKB_API_BASE_URL?.trim() || '',
  mcpBaseUrl: process.env.VITE_EVUKB_MCP_BASE_URL?.trim() || '',
  workspaceId: process.env.VITE_EVUKB_WORKSPACE_ID?.trim() || 'local-dev',
};

fs.writeFileSync(
  process.env.EVUKB_WEB_CONFIG_PATH,
  `window.__EVUKB_CONFIG__ = ${JSON.stringify(config)};\n`,
);
NODE

exec pnpm --filter @evu/kb-web preview --host 0.0.0.0 --port 4200
