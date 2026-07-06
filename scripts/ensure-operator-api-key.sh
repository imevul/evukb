#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "${EVUKB_ROOT:-$(dirname "${BASH_SOURCE[0]}")/..}" && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
ENV_LABEL=".env"

log() {
  echo "$*" >&2
}

has_valid_operator_key() {
  [[ -f "${ENV_FILE}" ]] && grep -qE '^EVUKB_OPERATOR_API_KEY=evukb_ops_[[:alnum:]]{16,}$' "${ENV_FILE}"
}

write_operator_key() {
  local generated="$1"

  if [[ ! -f "${ENV_FILE}" ]]; then
    cp "${ROOT_DIR}/.env.example" "${ENV_FILE}"
  fi

  if [[ ! -w "${ENV_FILE}" ]]; then
    log "Cannot write ${ENV_LABEL} (permission denied)."
    exit 1
  fi

  local tmp_file
  tmp_file="$(mktemp "${ENV_FILE}.XXXXXX")"
  cleanup() {
    rm -f "${tmp_file}"
  }
  trap cleanup EXIT

  if grep -qE '^EVUKB_OPERATOR_API_KEY=' "${ENV_FILE}"; then
    grep -vE '^EVUKB_OPERATOR_API_KEY=' "${ENV_FILE}" > "${tmp_file}"
  else
    cp "${ENV_FILE}" "${tmp_file}"
  fi

  {
    printf '\n# Auto-generated operator API key for production Web/API auth\n'
    printf 'EVUKB_OPERATOR_API_KEY=%s\n' "${generated}"
  } >> "${tmp_file}"

  mv "${tmp_file}" "${ENV_FILE}"
  trap - EXIT

  if ! grep -qF "EVUKB_OPERATOR_API_KEY=${generated}" "${ENV_FILE}"; then
    log "Failed to write EVUKB_OPERATOR_API_KEY to ${ENV_LABEL}"
    exit 1
  fi

  local line_count
  line_count="$(grep -cE '^EVUKB_OPERATOR_API_KEY=' "${ENV_FILE}")"
  if [[ "${line_count}" -ne 1 ]]; then
    log "Expected exactly one EVUKB_OPERATOR_API_KEY entry in ${ENV_LABEL}, found ${line_count}"
    exit 1
  fi
}

if has_valid_operator_key; then
  log "EVUKB_OPERATOR_API_KEY already configured in ${ENV_LABEL}"
  echo ok
  exit 0
fi

generated="evukb_ops_$(openssl rand -base64 32 | tr -d '/+=' | tr '[:upper:]' '[:lower:]')"
write_operator_key "${generated}"
log "Added EVUKB_OPERATOR_API_KEY to ${ENV_LABEL}"
log "Recreating evukb-api and evukb-web so containers pick up the new key."
echo added
