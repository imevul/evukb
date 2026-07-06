#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="${ROOT_DIR}/scripts/ensure-operator-api-key.sh"
TMP_ROOT="$(mktemp -d)"
cleanup() {
  rm -rf "${TMP_ROOT}"
}
trap cleanup EXIT

run_in_fixture() {
  local fixture_dir="${TMP_ROOT}/fixture"
  mkdir -p "${fixture_dir}/scripts"
  cp "${SCRIPT}" "${fixture_dir}/scripts/ensure-operator-api-key.sh"
  printf 'EVUKB_TOKEN_PEPPER=test\n' > "${fixture_dir}/.env.example"
  (
    cd "${fixture_dir}"
    EVUKB_ROOT="${fixture_dir}" bash scripts/ensure-operator-api-key.sh
  )
}

status="$(run_in_fixture)"
if [[ "${status}" != "added" ]]; then
  echo "expected added on first run, got ${status}" >&2
  exit 1
fi
if ! grep -qE '^EVUKB_OPERATOR_API_KEY=evukb_ops_[[:alnum:]]{16,}$' "${TMP_ROOT}/fixture/.env"; then
  echo "operator key missing after first run" >&2
  exit 1
fi

status="$(run_in_fixture)"
if [[ "${status}" != "ok" ]]; then
  echo "expected ok on second run, got ${status}" >&2
  exit 1
fi

printf 'EVUKB_TOKEN_PEPPER=test\nEVUKB_OPERATOR_API_KEY=\n' > "${TMP_ROOT}/fixture/.env"
status="$(run_in_fixture)"
if [[ "${status}" != "added" ]]; then
  echo "expected added when replacing empty key, got ${status}" >&2
  exit 1
fi

printf 'EVUKB_TOKEN_PEPPER=test\nEVUKB_OPERATOR_API_KEY= \n' > "${TMP_ROOT}/fixture/.env"
status="$(run_in_fixture)"
if [[ "${status}" != "added" ]]; then
  echo "expected added when replacing whitespace key, got ${status}" >&2
  exit 1
fi
if grep -cE '^EVUKB_OPERATOR_API_KEY=' "${TMP_ROOT}/fixture/.env" | grep -qx 1; then
  :
else
  echo "expected exactly one operator key line after replacing empty value" >&2
  exit 1
fi

echo "ensure-operator-api-key.test.sh passed"
