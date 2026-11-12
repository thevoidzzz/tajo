#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ "${TAJO_DOTENV:-1}" != "0" && -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

require_tool() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    printf 'falta la herramienta %s\n' "$name" >&2
    exit 1
  fi
}

require_fly() {
  if command -v fly >/dev/null 2>&1 || command -v flyctl >/dev/null 2>&1; then
    return 0
  fi
  printf 'falta la herramienta fly\n' >&2
  exit 1
}

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    printf 'falta la variable %s\n' "$name" >&2
    exit 1
  fi
}

printf 'paso: preflight\n'
require_fly
require_tool vercel
require_tool node
require_tool curl
require_var DATABASE_URL
require_var FLY_APP
require_var FLY_API_TOKEN
require_var VERCEL_ORG_ID
require_var VERCEL_PROJECT_ID
require_var VERCEL_TOKEN
