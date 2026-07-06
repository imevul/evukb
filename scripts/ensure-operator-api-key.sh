#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [[ -f "${ENV_FILE}" ]] && grep -qE '^EVUKB_OPERATOR_API_KEY=.+$' "${ENV_FILE}"; then
  exit 0
fi

generated="evukb_ops_$(openssl rand -base64 32 | tr -d '/+=' | tr '[:upper:]' '[:lower:]')"

if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${ROOT_DIR}/.env.example" "${ENV_FILE}"
fi

printf '\n# Auto-generated operator API key for production Web/API auth\nEVUKB_OPERATOR_API_KEY=%s\n' "${generated}" >> "${ENV_FILE}"
echo "Added EVUKB_OPERATOR_API_KEY to ${ENV_FILE}"
