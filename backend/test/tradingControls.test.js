'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  digest, sign, verifyIdentity, validateLimits, evaluatePaperOrder, reconciliation,
} = require('../src/services/tradingControls');
const { parseProviderContracts, providerFor } = require('../src/services/providerContracts');
const { evaluatePaperScenario } = require('../src/services/paperScenario');

const root = path.resolve(__dirname, '../..');
const limits = {
  maxOrderNotional: 5000, maxGrossExposure: 20000, maxNetExposure: 15000,
  maxDailyLoss: 1000, minLiquidity: 1000, maxStalenessSeconds: 300,
  maxRiskSnapshotStalenessSeconds: 300, minCashReserve: 500, killSwitch: false,
};
const quote = { price: 100, volume: 100000, sourceTimestamp: '2026-01-01T00:00:00.000Z' };
const snapshot = { grossExposure: 1000, netExposure: 500, dailyPnl: -50,
  availableCash: 10000, sourceTimestamp: '2026-01-01T00:00:00.000Z' };
const order = { mode: 'paper', symbol: 'AAPL', side: 'buy', quantity: 10, limitPrice: 100 };
const now = Date.parse('2026-01-01T00:01:00.000Z');

test('canonical digest is stable and payload bound', () => {
  assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }));
  assert.notEqual(digest({ a: 1 }), digest({ a: 2 }));
});

test('signed gateway identity is audience, tenant, permission, role, and account scoped', () => {
  const secret = 'x'.repeat(32);
  const encoded = Buffer.from(JSON.stringify({
    sub: 'user:trader', tenantId: 'tenant:fund', role: 'TRADER', permissions: ['trade:paper'],
    accounts: ['account:paper'], aud: 'finance-trading', iat: 1, exp: 200,
  })).toString('base64url');
  const headers = { 'x-finance-identity': encoded, 'x-finance-signature': sign(encoded, secret) };
  assert.deepEqual(verifyIdentity(headers, secret, 100).accounts, ['account:paper']);
  assert.equal(verifyIdentity({ ...headers, 'x-finance-signature': 'a'.repeat(64) }, secret, 100), null);
});

test('deterministic limit policy validates every positive bound', () => {
  assert.deepEqual(validateLimits(limits), []);
  assert.ok(validateLimits({ ...limits, maxDailyLoss: 0 }).includes('maxDailyLoss must be positive'));
});

test('valid paper order passes deterministic controls', () => {
  const result = evaluatePaperOrder(order, quote, limits, snapshot, now);
  assert.equal(result.passed, true);
  assert.equal(result.metrics.projectedGrossExposure, 2000);
});

test('live orders fail closed outside any model path', () => {
  assert.ok(evaluatePaperOrder({ ...order, mode: 'live' }, quote, limits, snapshot, now).failures.includes('paper_mode_required'));
});

test('stale and future market timestamps fail closed', () => {
  assert.ok(evaluatePaperOrder(order, quote, limits, snapshot, now + 600000).failures.includes('stale_market_data'));
  assert.ok(evaluatePaperOrder(order, quote, limits, snapshot, now - 180000).failures.includes('stale_market_data'));
});

test('stale custody risk and in-flight reservations fail closed', () => {
  assert.ok(evaluatePaperOrder(order, quote, limits, snapshot, now + 600000).failures.includes('stale_risk_snapshot'));
  const result = evaluatePaperOrder(order, quote, { ...limits, maxGrossExposure: 2500 },
    { ...snapshot, reservedGrossExposure: 600 }, now);
  assert.ok(result.failures.includes('gross_exposure'));
});

test('kill switch rejects otherwise valid orders', () => {
  assert.ok(evaluatePaperOrder(order, quote, { ...limits, killSwitch: true }, snapshot, now).failures.includes('kill_switch'));
});

test('order, gross, and net exposure bounds are enforced', () => {
  const result = evaluatePaperOrder({ ...order, quantity: 1000 }, quote, limits,
    { ...snapshot, grossExposure: 19999, netExposure: 14999 }, now);
  assert.ok(result.failures.includes('order_notional'));
  assert.ok(result.failures.includes('gross_exposure'));
  assert.ok(result.failures.includes('net_exposure'));
});

test('daily loss and liquidity bounds are enforced', () => {
  const result = evaluatePaperOrder(order, { ...quote, volume: 10 }, limits,
    { ...snapshot, dailyPnl: -1001 }, now);
  assert.ok(result.failures.includes('daily_loss'));
  assert.ok(result.failures.includes('liquidity'));
});

test('custody cash liquidity includes in-flight buy reservations', () => {
  const result = evaluatePaperOrder(order, quote, limits,
    { ...snapshot, availableCash: 1600, reservedCash: 200 }, now);
  assert.ok(result.failures.includes('cash_liquidity'));
});

test('reconciliation deterministically classifies matches and exceptions', () => {
  assert.equal(reconciliation(100, 100.005, 0.01).status, 'matched');
  assert.deepEqual(reconciliation(100, 102, 0.01), { difference: 2, status: 'exception' });
});

test('provider contracts are explicit, capability scoped, and never inferred from provider names', () => {
  const contracts = parseProviderContracts(JSON.stringify([
    { id: 'paper-market', mode: 'paper', contractRef: 'agreement:test-1', capabilities: ['market-data'] },
  ]));
  assert.equal(providerFor(contracts, 'paper-market', 'market-data').mode, 'paper');
  assert.equal(providerFor(contracts, 'paper-market', 'paper-fill'), null);
  assert.throws(() => parseProviderContracts('[{"id":"claimed-provider"}]'));
});

test('deterministic scenario replay covers stale data, duplicate orders, kill switch, and partial fills', () => {
  const result = evaluatePaperScenario({ limits, events: [
    { type: 'quote', at: '2026-01-01T00:00:00.000Z', symbol: 'AAPL', price: 100, volume: 100000 },
    { type: 'risk-snapshot', at: '2026-01-01T00:00:00.000Z', grossExposure: 0, netExposure: 0,
      dailyPnl: 0, availableCash: 10000 },
    { type: 'order', at: '2026-01-01T00:01:00.000Z', clientOrderId: 'scenario:order-1',
      mode: 'paper', symbol: 'AAPL', side: 'buy', quantity: 10, limitPrice: 100 },
    { type: 'fill', at: '2026-01-01T00:01:01.000Z', clientOrderId: 'scenario:order-1', quantity: 4 },
    { type: 'order', at: '2026-01-01T00:01:02.000Z', clientOrderId: 'scenario:order-1',
      mode: 'paper', symbol: 'AAPL', side: 'buy', quantity: 10, limitPrice: 100 },
    { type: 'kill-switch', at: '2026-01-01T00:01:03.000Z', enabled: true },
    { type: 'order', at: '2026-01-01T00:01:04.000Z', clientOrderId: 'scenario:order-2',
      mode: 'paper', symbol: 'AAPL', side: 'buy', quantity: 1, limitPrice: 100 },
    { type: 'kill-switch', at: '2026-01-01T00:01:05.000Z', enabled: false },
    { type: 'provider-outage', at: '2026-01-01T00:01:06.000Z', providerType: 'market' },
    { type: 'order', at: '2026-01-01T00:10:00.000Z', clientOrderId: 'scenario:order-3',
      mode: 'paper', symbol: 'AAPL', side: 'buy', quantity: 1, limitPrice: 100 },
  ] });
  assert.equal(result.partialFills, 1);
  assert.ok(result.decisions.some((item) => item.state === 'duplicate_replay'));
  assert.ok(result.decisions.some((item) => item.assessment?.failures.includes('kill_switch')));
  assert.ok(result.decisions.some((item) => item.assessment?.failures.includes('stale_market_data')));
  assert.ok(result.decisions.some((item) => item.state === 'provider_unavailable'));
  assert.match(result.resultHash, /^[a-f0-9]{64}$/);
});

test('migration includes idempotency, custody boundaries, corrections, double-entry ledger, and immutable audit', () => {
  const sql = fs.readFileSync(path.join(root, 'migrations/001_governed_paper_trading.sql'), 'utf8');
  assert.match(sql, /external_event_id/);
  assert.match(sql, /custody_account_ref/);
  assert.match(sql, /correction_of/);
  assert.match(sql, /finance_ledger_entries/);
  assert.match(sql, /finance_immutable_records/);
  assert.match(sql, /finance_balanced_journal/);
  assert.match(sql, /finance_scenario_runs/);
  assert.match(sql, /provider_contract_ref/);
  assert.doesNotMatch(sql, /DROP TABLE|TRUNCATE/i);
});

test('route, CI, authentication, launcher, and runbook expose governed controls', () => {
  const route = fs.readFileSync(path.join(root, 'backend/src/routes/governedTrading.js'), 'utf8');
  const auth = fs.readFileSync(path.join(root, 'backend/src/middleware/auth.js'), 'utf8');
  const launcher = fs.readFileSync(path.join(root, 'start.sh'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/governed-paper-trading.yml'), 'utf8');
  assert.match(route, /paper-order/);
  assert.match(route, /fill-correction/);
  assert.match(route, /audit-export/);
  assert.match(route, /account_ref=ANY/);
  assert.match(route, /scenario-evaluations/);
  assert.match(auth, /issuer: 'ai-finance-platform'/);
  assert.doesNotMatch(launcher, /pkill|kill -9|npm install|db push|seed/);
  assert.match(launcher, /ALLOW_SCHEMA_MIGRATION/);
  assert.match(workflow, /test:integration/);
  assert.match(fs.readFileSync(path.join(root, 'RUNBOOK.md'), 'utf8'), /Rollback/);
});
