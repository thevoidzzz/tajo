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

read_page_url() {
  node -e '
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  const absolute = (host) =>
    host.startsWith("http://") || host.startsWith("https://") ? host : "https://" + host;
  let page = "";
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const json = JSON.parse(raw.slice(start, end + 1));
      const alias = Array.isArray(json.alias)
        ? json.alias.find((item) => typeof item === "string" && item !== "")
        : "";
      const host = alias || json.url;
      if (typeof host === "string" && host !== "") page = absolute(host);
    } catch {
      page = "";
    }
  }
  if (!page) {
    const matches = raw.match(/https?:\/\/\S+/g);
    if (matches && matches.length) page = matches[matches.length - 1];
  }
  if (!page) process.exit(1);
  process.stdout.write(page);
});
'
}

read_previous_image() {
  node -e '
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  let releases;
  try {
    releases = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
  } catch {
    process.exit(1);
  }
  const previous = Array.isArray(releases) ? releases[1] : undefined;
  const image = previous && (previous.ImageRef || previous.image_ref);
  if (typeof image !== "string" || image === "") process.exit(1);
  process.stdout.write(image);
});
'
}

rollback() {
  printf 'paso: rollback\n'
  if ! releases=$("$fly" releases --json --app "$FLY_APP"); then
    printf 'no se pudo leer la imagen anterior\n' >&2
    exit 1
  fi
  if ! previous=$(printf '%s' "$releases" | read_previous_image); then
    printf 'no hay imagen anterior\n' >&2
    exit 1
  fi
  if ! "$fly" deploy --image "$previous" --ha=false --now --app "$FLY_APP" --config "$config"; then
    printf 'no se pudo restaurar la imagen anterior\n' >&2
    exit 1
  fi
  exit 1
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

if [[ ! "$FLY_APP" =~ ^[a-z0-9-]+$ ]]; then
  printf 'FLY_APP no sirve como nombre de la app\n' >&2
  exit 1
fi

fly=$(command -v fly || command -v flyctl)
api_url="https://${FLY_APP}.fly.dev"

printf 'paso: pagina\n'
if ! page_json=$(vercel deploy web --prod --yes --non-interactive --build-env "VITE_API_URL=${api_url}"); then
  printf 'no se pudo publicar la pagina\n' >&2
  exit 1
fi
if ! page_url=$(printf '%s' "$page_json" | read_page_url); then
  printf 'no se pudo leer la URL de la pagina\n' >&2
  exit 1
fi

printf 'paso: api\n'
if ! "$fly" status --app "$FLY_APP" >/dev/null 2>&1; then
  "$fly" apps create "$FLY_APP"
fi
"$fly" secrets set "DATABASE_URL=${DATABASE_URL}" "WEB_ORIGIN=${page_url}" --app "$FLY_APP" --stage
config="$(pwd)/fly.deploy.toml"
trap 'rm -f "$config"' EXIT
sed "s/^app = .*/app = \"${FLY_APP}\"/" fly.toml > "$config"
"$fly" deploy --remote-only --ha=false --now --app "$FLY_APP" --config "$config"

printf 'paso: migrar\n'
require_tool npm
npm run build
node dist/migrate-cli.js

printf 'paso: pagina-ok\n'
curl --fail --silent --show-error --max-time 30 "$page_url"

printf 'paso: health\n'
if ! curl --fail --silent --show-error --max-time 30 "${api_url}/health"; then
  rollback
fi
