#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

check() {
  case "${DATABASE_URL:-}" in
    postgres://*|postgresql://*) ;;
    *) fail "DATABASE_URL must be an explicit PostgreSQL connection string" ;;
  esac
  local browser_secret="${JWT_SECRET:-}"
  local gateway_secret="${FINANCE_GATEWAY_SECRET:-}"
  [ "${#browser_secret}" -ge 32 ] || fail "JWT_SECRET must contain at least 32 characters"
  [ "${#gateway_secret}" -ge 32 ] || fail "FINANCE_GATEWAY_SECRET must contain at least 32 characters"
  [ -n "${CLIENT_URL:-}" ] || fail "CLIENT_URL must be an explicit browser origin"
  [ -n "${FINANCE_PROVIDER_CONTRACTS:-}" ] || fail "FINANCE_PROVIDER_CONTRACTS must define approved providers"
  (cd "$ROOT_DIR/backend" && node -e '
    const {parseProviderContracts,missingCapabilities}=require("./src/services/providerContracts");
    const missing=missingCapabilities(parseProviderContracts(process.env.FINANCE_PROVIDER_CONTRACTS));
    if(missing.length) throw new Error(`missing provider capabilities: ${missing.join(", ")}`);
    const origins=process.env.CLIENT_URL.split(",").map((value)=>new URL(value.trim()));
    if(!origins.length||origins.some((url)=>!["http:","https:"].includes(url.protocol)
      ||url.origin!==url.href.replace(/\/$/,"")))
      throw new Error("CLIENT_URL must contain HTTP(S) origins without paths");
  ') || fail "provider contracts or CLIENT_URL are invalid"
}

if [ "${NODE_ENV:-development}" = test ]; then
  FINANCE_GATEWAY_SECRET="${FINANCE_GATEWAY_SECRET:-runtime-acceptance-finance-gateway-secret}"
  CLIENT_URL="${CLIENT_URL:-http://127.0.0.1:${FRONTEND_PORT:-${PORT:-3002}}}"
  if [ -z "${FINANCE_PROVIDER_CONTRACTS:-}" ]; then
    FINANCE_PROVIDER_CONTRACTS='[{"id":"runtime-paper","mode":"paper","contractRef":"runtime:disposable-validation","capabilities":["market-data","custody-snapshot","paper-fill","corporate-action","custody-reconciliation"]}]'
  fi
  export FINANCE_GATEWAY_SECRET CLIENT_URL FINANCE_PROVIDER_CONTRACTS
fi

case "${1:-backend}" in
  check)
    check
    ;;
  migrate)
    check
    [ "${ALLOW_SCHEMA_MIGRATION:-0}" = 1 ] || fail "set ALLOW_SCHEMA_MIGRATION=1 for the approved migration step"
    [ -x "$ROOT_DIR/backend/node_modules/.bin/prisma" ] || fail "backend dependencies are missing"
    command -v psql >/dev/null 2>&1 || fail "psql is required"
    (cd "$ROOT_DIR/backend" && ./node_modules/.bin/prisma migrate deploy)
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/migrations/001_governed_paper_trading.sql"
    ;;
  backend)
    check
    [ -d "$ROOT_DIR/backend/node_modules" ] || fail "backend dependencies are missing; install explicitly"
    cd "$ROOT_DIR/backend"
    exec npm start
    ;;
  frontend)
    check
    [ -d "$ROOT_DIR/frontend/node_modules" ] || fail "frontend dependencies are missing; install explicitly"
    [ -d "$ROOT_DIR/frontend/build" ] || fail "frontend production build is missing; build explicitly"
    cd "$ROOT_DIR/frontend"
    exec node scripts/serve-build.cjs
    ;;
  *) fail "usage: ./start.sh [check|migrate|backend|frontend]" ;;
esac
