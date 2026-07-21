# Governed paper-trading runbook

## Scope and hard boundaries

`/api/governed-trading` is paper-trading only; there is no live-order transport. Its provider endpoints are signed inbound adapters, not proof that a market-data, broker, custody, banking, or corporate-action agreement exists. Do not set a provider to `licensed` until the contract owner has recorded the actual agreement reference and approved the data uses. This code is not regulatory validation, books-and-records certification, custody, or production infrastructure.

Configure an explicit PostgreSQL `DATABASE_URL`, independent 32-character-or-longer `JWT_SECRET` and `FINANCE_GATEWAY_SECRET`, comma-separated HTTP(S) origins in `CLIENT_URL`, and `REACT_APP_API_BASE_URL` when the frontend is not reverse-proxied to `/api`. Secrets belong in the deployment secret manager.

`FINANCE_PROVIDER_CONTRACTS` is a JSON array. Every entry needs a stable `id`, a `mode` of `paper` or `licensed`, a non-secret `contractRef`, and one or more capabilities from `market-data`, `custody-snapshot`, `paper-fill`, `corporate-action`, and `custody-reconciliation`. Startup fails until all five capabilities are covered. For local tests, use clearly named paper providers and internal test agreement references; never label fixtures as licensed.

## Verification and release

Install locked dependencies explicitly with `npm ci`. The release gate runs:

```text
backend: npm test; npm audit --omit=dev --audit-level=high; Prisma validate/generate/deploy
database: psql -v ON_ERROR_STOP=1 -f migrations/001_governed_paper_trading.sql
integration: RUN_DB_TESTS=true npm run test:integration
frontend: CI=true npm test -- --watchAll=false; npm audit --omit=dev --audit-level=critical; npm run build
launcher: bash -n start.sh
```

The current Create React App dependency tree still has known high-severity transitive build-tool advisories and pre-existing lint warnings. The workflow fails on critical advisories but this narrower gate is not a waiver for production: migrate the frontend toolchain, clear the high findings, and restore warning-free `CI=true` builds before release.

`./start.sh check` is read-only. Schema mutation is a separate `./start.sh migrate` action requiring `ALLOW_SCHEMA_MIGRATION=1`. Backend and frontend are separate process-manager targets. Startup never installs packages, seeds data, pushes a schema, or terminates another process.

## Identity, controls, and evidence

Only a trusted gateway may issue the HMAC-signed `finance-trading` identity. Claims expire within 15 minutes and scope the actor, tenant, permissions, role, and account list. Rotate gateway keys atomically and reject identities minted from browser sessions.

Market, custody, fill, corporate-action, and reconciliation ingestion require configured provider capability, stable external IDs, explicit source timestamps, hashed provenance, and payload-bound replay checks. A reused external ID with changed content is a conflict. Risk policies are versioned and require a different creator and approver. Paper orders are serialized per account and include fresh market/custody timestamps plus in-flight exposure and cash reservations. Gross/net exposure, available-cash reserve, order notional, market liquidity/participation, daily loss, approval, and kill-switch controls execute deterministically without an LLM.

Paper fills create balanced custody/position journals. Partial fills are explicit. Corrections append a negative fill and reversing journal; they never overwrite the original. Corporate actions retain source and effective timestamps. Reconciliation compares a provider statement with fills as of the statement timestamp under a serializable transaction. Audit exports run from a repeatable-read snapshot, are account-scoped, include source/control/fill/ledger/scenario evidence, and contain a canonical content hash.

Persist scenario evaluations before approving a policy change. Required cases include stale market and custody data, changed-payload duplicate orders/fills, partial fill and overfill, loss/liquidity/exposure breaches, kill-switch activation, correction, and reconciliation exceptions. Alert on every such failure, transaction retry response, audit-export failure, and provider ingestion gap.

## Credential incident

Historical tracked files named `alpace_keys.xtt`, `apaca.txt`, and `users.txt` contained sensitive-looking patterns and are now placeholder-only. Treat every prior value as compromised: revoke and rotate it at the relevant provider, invalidate affected user credentials, review access logs, and coordinate any history rewrite with the repository owner. Working-tree environment files must not be printed, committed, or copied into evidence.

## Rollback and recovery

Stop traffic to the new artifact and restore the prior backend/frontend artifacts. The governed migration is additive; retain all new tables and immutable evidence during application rollback. Never drop, truncate, update, or delete fill, journal, ledger, market, custody, control-event, corporate-action, reconciliation, or scenario evidence. Resume only after resolving statement exceptions, replaying the same idempotency keys for uncertain operations, verifying provider contract configuration, and confirming gateway/JWT key versions.
