#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

operator_key_status="$(
  EVUKB_ROOT="${ROOT_DIR}" bash "${ROOT_DIR}/scripts/ensure-operator-api-key.sh"
)"

compose_args=(--project-directory . -f deploy/docker-compose.yml up --build)
if [[ "${operator_key_status}" == "added" ]]; then
  compose_args+=(--force-recreate evukb-api evukb-web)
fi

exec docker compose "${compose_args[@]}"
