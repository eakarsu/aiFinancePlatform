'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const { Pool } = require('pg');
const { createGovernedTradingRouter } = require('../src/routes/governedTrading');
const { sign } = require('../src/services/tradingControls');
const { parseProviderContracts } = require('../src/services/providerContracts');

const run = process.env.RUN_DB_TESTS === 'true' && Boolean(process.env.DATABASE_URL);
const secret = process.env.FINANCE_GATEWAY_SECRET || '';

function identity(tenant, actor, role, permissions, accounts) {
  const now = Math.floor(Date.now() / 1000);
  const encoded = Buffer.from(JSON.stringify({
    sub: actor, tenantId: tenant, role, permissions, accounts,
    aud: 'finance-trading', iat: now - 1, exp: now + 300,
  })).toString('base64url');
  return { 'x-finance-identity': encoded, 'x-finance-signature': sign(encoded, secret) };
}

async function expectJson(response, status) {
  const text = await response.text();
  assert.equal(response.status, status, text);
  return text ? JSON.parse(text) : null;
}

test('live PostgreSQL/HTTP paper-trading workflow fails closed and preserves ledger evidence', { skip: !run }, async (t) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(fs.readFileSync(path.resolve(__dirname, '../../migrations/001_governed_paper_trading.sql'), 'utf8'));
  const app = express();
  app.use(express.json());
  app.set('governedPool', pool);
  const providerContracts = parseProviderContracts(JSON.stringify([
    { id: 'market-test', mode: 'paper', contractRef: 'test:market-agreement', capabilities: ['market-data'] },
    { id: 'custody-test', mode: 'paper', contractRef: 'test:custody-agreement',
      capabilities: ['custody-snapshot', 'custody-reconciliation'] },
    { id: 'broker-test', mode: 'paper', contractRef: 'test:broker-agreement', capabilities: ['paper-fill'] },
    { id: 'actions-test', mode: 'paper', contractRef: 'test:actions-agreement', capabilities: ['corporate-action'] },
  ]));
  app.use('/api/governed-trading', createGovernedTradingRouter({ providerContracts }));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/api/governed-trading`;
  const tenant = `tenant:${crypto.randomUUID()}`;
  const account = `account:${crypto.randomUUID()}`;
  const headers = (actor, role, permissions, key = `request:${crypto.randomUUID()}`) => ({
    'content-type': 'application/json', 'Idempotency-Key': key,
    ...identity(tenant, actor, role, permissions, [account]),
  });
  const operation = (actor, role, permissions, body, key) => fetch(`${url}/operations`, {
    method: 'POST', headers: headers(actor, role, permissions, key), body: JSON.stringify(body),
  });

  const market = await operation('service:market', 'PROVIDER', ['market:ingest'], {
    action: 'market-ingest', provider: 'market-test', externalEventId: `quote:${crypto.randomUUID()}`,
    symbol: 'AAPL', price: 100, volume: 100000, sourceTimestamp: new Date().toISOString(),
    provenance: { sourceRef: 'fixture:market-1', sha256: 'a'.repeat(64) },
  });
  await expectJson(market, 201);

  const snapshot = await operation('service:custody', 'PROVIDER', ['custody:ingest'], {
    action: 'risk-snapshot-ingest', provider: 'custody-test', externalEventId: `risk:${crypto.randomUUID()}`,
    accountRef: account, custodyAccountRef: `custody:${crypto.randomUUID()}`,
    grossExposure: 1000, netExposure: 500, dailyPnl: -50, availableCash: 10000,
    sourceTimestamp: new Date().toISOString(),
    provenance: { sourceRef: 'fixture:custody-risk-1', sha256: 'b'.repeat(64) },
  });
  await expectJson(snapshot, 201);

  const pending = await expectJson(await operation('user:risk-author', 'ANALYST', ['risk:configure'], {
    action: 'limit-create', accountRef: account, version: 1, reason: 'Initial paper limits.',
    limits: { maxOrderNotional: 5000, maxGrossExposure: 20000, maxNetExposure: 15000,
      maxDailyLoss: 1000, minLiquidity: 1000, maxStalenessSeconds: 300,
      maxRiskSnapshotStalenessSeconds: 300, minCashReserve: 500 },
  }), 201);
  const selfApproval = await operation('user:risk-author', 'RISK_OFFICER', ['risk:approve'], {
    action: 'limit-approve', id: pending.id,
  });
  assert.equal(selfApproval.status, 409);
  await expectJson(await operation('user:risk-approver', 'RISK_OFFICER', ['risk:approve'], {
    action: 'limit-approve', id: pending.id,
  }), 200);

  await expectJson(await operation('service:market', 'PROVIDER', ['market:ingest'], {
    action: 'market-ingest', provider: 'market-test', externalEventId: `quote:${crypto.randomUUID()}`,
    symbol: 'MSFT', price: 200, volume: 100000,
    sourceTimestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    provenance: { sourceRef: 'fixture:stale-market', sha256: '1'.repeat(64) },
  }), 201);
  const staleOrder = await expectJson(await operation('user:trader', 'TRADER', ['trade:paper'], {
    action: 'paper-order', accountRef: account, clientOrderId: `order:${crypto.randomUUID()}`,
    order: { mode: 'paper', symbol: 'MSFT', side: 'buy', quantity: 1, limitPrice: 200 },
  }), 422);
  assert.ok(staleOrder.risk_result.failures.includes('stale_market_data'));

  const orderKey = `request:${crypto.randomUUID()}`;
  const orderBody = {
    action: 'paper-order', accountRef: account, clientOrderId: `order:${crypto.randomUUID()}`,
    order: { mode: 'paper', symbol: 'AAPL', side: 'buy', quantity: 10, limitPrice: 100 },
  };
  const order = await expectJson(await operation('user:trader', 'TRADER', ['trade:paper'], orderBody, orderKey), 201);
  assert.equal(order.state, 'paper_approved');
  const orderReplay = await expectJson(
    await operation('user:trader', 'TRADER', ['trade:paper'], orderBody, orderKey), 200,
  );
  assert.equal(orderReplay.replay, true);
  const orderConflict = await operation('user:trader', 'TRADER', ['trade:paper'],
    { ...orderBody, order: { ...orderBody.order, quantity: 9 } }, orderKey);
  assert.equal(orderConflict.status, 409);

  const firstFillId = `fill:${crypto.randomUUID()}`;
  const firstFillBody = {
    action: 'fill-ingest', provider: 'broker-test', externalFillId: firstFillId,
    orderId: order.id, quantity: 4, price: 100, feeAmount: 0.4, sourceTimestamp: new Date().toISOString(),
    provenance: { sourceRef: 'fixture:fill-1', sha256: 'c'.repeat(64) },
  };
  const firstFill = await expectJson(await operation('service:broker', 'PROVIDER', ['fill:ingest'], firstFillBody), 201);
  const fillReplay = await expectJson(await operation('service:broker', 'PROVIDER', ['fill:ingest'], firstFillBody), 200);
  assert.equal(fillReplay.replay, true);
  const fillConflict = await operation('service:broker', 'PROVIDER', ['fill:ingest'],
    { ...firstFillBody, quantity: 3 });
  assert.equal(fillConflict.status, 409);
  const secondFill = await expectJson(await operation('service:broker', 'PROVIDER', ['fill:ingest'], {
    action: 'fill-ingest', provider: 'broker-test', externalFillId: `fill:${crypto.randomUUID()}`,
    orderId: order.id, quantity: 6, price: 100, feeAmount: 0.6, sourceTimestamp: new Date().toISOString(),
    provenance: { sourceRef: 'fixture:fill-2', sha256: 'd'.repeat(64) },
  }), 201);
  assert.equal(secondFill.orderState, 'filled');

  const correction = await expectJson(await operation('user:operations', 'RISK_OFFICER', ['ledger:correct'], {
    action: 'fill-correction', fillId: firstFill.id, reason: 'Paper broker cancelled the first partial fill.',
  }), 201);
  assert.equal(correction.orderState, 'partially_filled');

  const matched = await expectJson(await operation('service:custody', 'PROVIDER', ['custody:reconcile'], {
    action: 'reconcile', provider: 'custody-test', externalEventId: `statement:${crypto.randomUUID()}`,
    accountRef: account,
    providerNotional: 600, tolerance: 0.01, sourceTimestamp: new Date().toISOString(),
    provenance: { sourceRef: 'fixture:statement-1', sha256: 'e'.repeat(64) },
  }), 201);
  assert.equal(matched.status, 'matched');
  const exception = await expectJson(await operation('service:custody', 'PROVIDER', ['custody:reconcile'], {
    action: 'reconcile', provider: 'custody-test', externalEventId: `statement:${crypto.randomUUID()}`,
    accountRef: account, providerNotional: 601, tolerance: 0.01,
    sourceTimestamp: new Date().toISOString(),
    provenance: { sourceRef: 'fixture:statement-exception', sha256: '2'.repeat(64) },
  }), 422);
  assert.equal(exception.status, 'exception');

  await expectJson(await operation('service:actions', 'PROVIDER', ['corporate:ingest'], {
    action: 'corporate-action-ingest', provider: 'actions-test',
    externalActionId: `action:${crypto.randomUUID()}`, symbol: 'AAPL', actionType: 'split',
    effectiveAt: '2027-01-01', sourceTimestamp: new Date().toISOString(),
    terms: { numerator: 2, denominator: 1 },
    provenance: { sourceRef: 'fixture:action-1', sha256: 'f'.repeat(64) },
  }), 201);

  await expectJson(await operation('user:risk-approver', 'RISK_OFFICER', ['risk:kill'], {
    action: 'kill-switch', accountRef: account, enabled: true, reason: 'Failure-path exercise.',
  }), 201);
  const rejected = await operation('user:trader', 'TRADER', ['trade:paper'], {
    action: 'paper-order', accountRef: account, clientOrderId: `order:${crypto.randomUUID()}`,
    order: { mode: 'paper', symbol: 'AAPL', side: 'buy', quantity: 1, limitPrice: 100 },
  });
  const rejectedBody = await expectJson(rejected, 422);
  assert.ok(rejectedBody.risk_result.failures.includes('kill_switch'));

  const scenario = await fetch(`${url}/scenario-evaluations`, {
    method: 'POST', headers: headers('user:model-risk', 'ANALYST', ['scenario:evaluate']),
    body: JSON.stringify({ accountRef: account, name: 'stale-duplicate-partial-fill', scenario: {
      limits: { maxOrderNotional: 5000, maxGrossExposure: 20000, maxNetExposure: 15000,
        maxDailyLoss: 1000, minLiquidity: 1000, maxStalenessSeconds: 300,
        maxRiskSnapshotStalenessSeconds: 300, minCashReserve: 500 },
      events: [
        { type: 'quote', at: '2026-01-01T00:00:00.000Z', symbol: 'AAPL', price: 100, volume: 100000 },
        { type: 'risk-snapshot', at: '2026-01-01T00:00:00.000Z', grossExposure: 0,
          netExposure: 0, dailyPnl: 0, availableCash: 10000 },
        { type: 'order', at: '2026-01-01T00:01:00.000Z', clientOrderId: 'scenario:order-1',
          mode: 'paper', symbol: 'AAPL', side: 'buy', quantity: 10, limitPrice: 100 },
        { type: 'fill', at: '2026-01-01T00:01:01.000Z', clientOrderId: 'scenario:order-1', quantity: 4 },
        { type: 'order', at: '2026-01-01T00:01:02.000Z', clientOrderId: 'scenario:order-1',
          mode: 'paper', symbol: 'AAPL', side: 'buy', quantity: 10, limitPrice: 100 },
      ],
    } }),
  });
  const scenarioBody = await expectJson(scenario, 201);
  assert.equal(scenarioBody.result.partialFills, 1);

  const otherAccount = `account:${crypto.randomUUID()}`;
  await expectJson(await fetch(`${url}/operations`, {
    method: 'POST', headers: {
      'content-type': 'application/json', 'Idempotency-Key': `request:${crypto.randomUUID()}`,
      ...identity(tenant, 'user:risk-approver', 'RISK_OFFICER', ['risk:kill'], [otherAccount]),
    },
    body: JSON.stringify({ action: 'kill-switch', accountRef: otherAccount, enabled: true,
      reason: 'Scope isolation evidence.' }),
  }), 201);
  const missingKey = `request:${crypto.randomUUID()}`;
  const missingBody = { action: 'paper-order', accountRef: otherAccount,
    clientOrderId: `order:${crypto.randomUUID()}`,
    order: { mode: 'paper', symbol: 'AAPL', side: 'buy', quantity: 1, limitPrice: 100 } };
  const missingHeaders = {
    'content-type': 'application/json', 'Idempotency-Key': missingKey,
    ...identity(tenant, 'user:other-trader', 'TRADER', ['trade:paper'], [otherAccount]),
  };
  const missing = await expectJson(await fetch(`${url}/operations`, {
    method: 'POST', headers: missingHeaders, body: JSON.stringify(missingBody),
  }), 422);
  assert.ok(missing.failures.includes('active_limits_missing'));
  const missingReplay = await expectJson(await fetch(`${url}/operations`, {
    method: 'POST', headers: missingHeaders, body: JSON.stringify(missingBody),
  }), 422);
  assert.equal(missingReplay.replay, true);

  const audit = await fetch(`${url}/audit-export`, {
    headers: identity(tenant, 'user:auditor', 'AUDITOR', ['audit:export'], [account]),
  });
  const exported = await expectJson(audit, 200);
  const journalBalances = new Map();
  for (const entry of exported.ledgerEntries) {
    const key = `${entry.journal_id}:${entry.currency}`;
    journalBalances.set(key, (journalBalances.get(key) || 0) + Number(entry.signed_amount));
  }
  assert.ok([...journalBalances.values()].every((value) => Math.abs(value) < 1e-8));
  assert.ok(exported.orderEvents.some((event) => event.event_type === 'filled'));
  assert.ok(exported.orderEvents.some((event) => event.event_type === 'fill_corrected'));
  assert.ok(exported.reconciliations.some((item) => item.status === 'matched'));
  assert.ok(exported.reconciliations.some((item) => item.status === 'exception'));
  assert.equal(exported.corporateActions[0].action_type, 'split');
  assert.equal(exported.killSwitchEvents[0].enabled, true);
  assert.ok(exported.killSwitchEvents.every((event) => event.account_ref === account));
  assert.equal(exported.scenarioRuns.length, 1);
  assert.ok(exported.limitPolicyEvents.some((event) => event.event_type === 'created'));
  assert.ok(exported.limitPolicyEvents.some((event) => event.event_type === 'approved'));
  assert.ok(exported.orders.every((item) => item.account_ref === account));
  assert.match(exported.manifest.contentSha256, /^[a-f0-9]{64}$/);

  await assert.rejects(
    pool.query(`UPDATE finance_order_events SET reason='tampered' WHERE tenant_id=$1`, [tenant]),
    /immutable/,
  );
  const unbalanced = await pool.connect();
  try {
    await unbalanced.query('BEGIN');
    const journalId = crypto.randomUUID();
    await unbalanced.query(
      `INSERT INTO finance_journals(tenant_id,id,order_id,journal_type,created_by)
       VALUES($1,$2,$3,'constraint_test',$4)`,
      [tenant, journalId, order.id, 'test:constraint'],
    );
    await unbalanced.query(
      `INSERT INTO finance_ledger_entries(tenant_id,journal_id,ledger_account,signed_amount)
       VALUES($1,$2,'TEST:UNBALANCED',1)`,
      [tenant, journalId],
    );
    await assert.rejects(unbalanced.query('COMMIT'), /unbalanced/);
  } finally {
    await unbalanced.query('ROLLBACK');
    unbalanced.release();
  }
});
