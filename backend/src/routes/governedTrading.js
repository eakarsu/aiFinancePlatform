'use strict';

const express = require('express');
const crypto = require('node:crypto');
const { financeIdentity } = require('../middleware/financeIdentity');
const {
  KEY, SYMBOL, digest, validateLimits, evaluatePaperOrder, reconciliation,
} = require('../services/tradingControls');
const { parseProviderContracts, providerFor } = require('../services/providerContracts');
const { evaluatePaperScenario } = require('../services/paperScenario');

const RISK_ROLES = new Set(['RISK_OFFICER', 'ADMIN']);

async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function hasAccount(identity, accountRef) {
  return identity.accounts.includes(accountRef);
}

function requireKey(req, res, next) {
  const key = req.get('Idempotency-Key') || '';
  if (!KEY.test(key)) return res.status(400).json({ error: 'valid Idempotency-Key required' });
  req.idempotencyKey = key;
  return next();
}

function validSourceTimestamp(value, now = Date.now()) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= now + 60_000;
}

function roundLedgerNumber(value) {
  return Number(Number(value).toFixed(8));
}

async function readSnapshot(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function createGovernedTradingRouter(options = {}) {
  const providerContracts = options.providerContracts
    || parseProviderContracts(process.env.FINANCE_PROVIDER_CONTRACTS || '');
  const router = express.Router();
  router.use(financeIdentity);

  router.get('/audit-export', async (req, res) => {
    if (!req.finance.permissions.includes('audit:export')) return res.status(403).json({ error: 'audit:export required' });
    if (req.finance.accounts.length === 0) return res.status(403).json({ error: 'at least one account scope required' });
    const pool = req.app.get('governedPool');
    try {
      const records = await readSnapshot(pool, async (client) => {
        const params = [req.finance.tenant, req.finance.accounts];
        const orderScope = 'tenant_id=$1 AND account_ref=ANY($2::text[])';
        const [orders, rejections, events, fills, journals, ledger, reconciliations, actions, kills,
          market, snapshots, policies, policyEvents, scenarios] = await Promise.all([
          client.query(`SELECT * FROM finance_paper_orders WHERE ${orderScope} ORDER BY created_at DESC LIMIT 1001`, params),
          client.query(`SELECT * FROM finance_operation_rejections WHERE ${orderScope} ORDER BY created_at DESC LIMIT 1001`, params),
          client.query(`SELECT event.* FROM finance_order_events event JOIN finance_paper_orders orders
            ON orders.tenant_id=event.tenant_id AND orders.id=event.order_id
            WHERE orders.tenant_id=$1 AND orders.account_ref=ANY($2::text[]) ORDER BY event.seq DESC LIMIT 5001`, params),
          client.query(`SELECT fill.* FROM finance_fills fill JOIN finance_paper_orders orders
            ON orders.tenant_id=fill.tenant_id AND orders.id=fill.order_id
            WHERE orders.tenant_id=$1 AND orders.account_ref=ANY($2::text[]) ORDER BY fill.created_at DESC LIMIT 5001`, params),
          client.query(`SELECT journal.* FROM finance_journals journal JOIN finance_paper_orders orders
            ON orders.tenant_id=journal.tenant_id AND orders.id=journal.order_id
            WHERE orders.tenant_id=$1 AND orders.account_ref=ANY($2::text[]) ORDER BY journal.created_at DESC LIMIT 5001`, params),
          client.query(`SELECT entry.* FROM finance_ledger_entries entry JOIN finance_journals journal
            ON journal.tenant_id=entry.tenant_id AND journal.id=entry.journal_id JOIN finance_paper_orders orders
            ON orders.tenant_id=journal.tenant_id AND orders.id=journal.order_id
            WHERE orders.tenant_id=$1 AND orders.account_ref=ANY($2::text[]) ORDER BY entry.seq DESC LIMIT 10001`, params),
          client.query(`SELECT * FROM finance_reconciliations WHERE ${orderScope} ORDER BY created_at DESC LIMIT 1001`, params),
          client.query(`SELECT action.* FROM finance_corporate_actions action WHERE action.tenant_id=$1
            AND EXISTS(SELECT 1 FROM finance_paper_orders orders WHERE orders.tenant_id=action.tenant_id
              AND orders.account_ref=ANY($2::text[]) AND orders.symbol=action.symbol)
            ORDER BY action.effective_at DESC LIMIT 1001`, params),
          client.query(`SELECT * FROM finance_kill_switch_events WHERE ${orderScope} ORDER BY seq DESC LIMIT 1001`, params),
          client.query(`SELECT market.* FROM finance_market_events market WHERE market.tenant_id=$1
            AND EXISTS(SELECT 1 FROM finance_paper_orders orders WHERE orders.tenant_id=market.tenant_id
              AND orders.account_ref=ANY($2::text[]) AND orders.market_event_id=market.id)
            ORDER BY market.source_timestamp DESC LIMIT 1001`, params),
          client.query(`SELECT * FROM finance_risk_snapshots WHERE ${orderScope} ORDER BY source_timestamp DESC LIMIT 1001`, params),
          client.query(`SELECT * FROM finance_limit_policies WHERE ${orderScope} ORDER BY created_at DESC LIMIT 1001`, params),
          client.query(`SELECT event.* FROM finance_limit_policy_events event JOIN finance_limit_policies policy
            ON policy.tenant_id=event.tenant_id AND policy.id=event.policy_id
            WHERE policy.tenant_id=$1 AND policy.account_ref=ANY($2::text[]) ORDER BY event.seq DESC LIMIT 5001`, params),
          client.query(`SELECT * FROM finance_scenario_runs WHERE ${orderScope} ORDER BY created_at DESC LIMIT 1001`, params),
        ]);
        return { orders: orders.rows, operationRejections: rejections.rows,
          orderEvents: events.rows, fills: fills.rows,
          journals: journals.rows, ledgerEntries: ledger.rows, reconciliations: reconciliations.rows,
          corporateActions: actions.rows, killSwitchEvents: kills.rows, marketEvents: market.rows,
          riskSnapshots: snapshots.rows, limitPolicies: policies.rows,
          limitPolicyEvents: policyEvents.rows, scenarioRuns: scenarios.rows };
      });
      const caps = { orders: 1000, operationRejections: 1000, orderEvents: 5000,
        fills: 5000, journals: 5000,
        ledgerEntries: 10000, reconciliations: 1000, corporateActions: 1000,
        killSwitchEvents: 1000, marketEvents: 1000, riskSnapshots: 1000,
        limitPolicies: 1000, limitPolicyEvents: 5000, scenarioRuns: 1000 };
      const truncated = {};
      const bounded = Object.fromEntries(Object.entries(records).map(([name, rows]) => {
        truncated[name] = rows.length > caps[name];
        return [name, rows.slice(0, caps[name])];
      }));
      const normalized = JSON.parse(JSON.stringify(bounded));
      const counts = Object.fromEntries(Object.entries(normalized).map(([name, rows]) => [name, rows.length]));
      return res.json({ schemaVersion: 2, generatedAt: new Date().toISOString(), accountRefs: req.finance.accounts,
        manifest: { contentSha256: digest({ accountRefs: req.finance.accounts, records: normalized }), counts, truncated },
        ...normalized });
    } catch (error) {
      console.error('finance audit export failed', { code: error.code });
      return res.status(500).json({ error: 'audit export failed' });
    }
  });

  router.post('/scenario-evaluations', requireKey, async (req, res) => {
    const identity = req.finance;
    const body = req.body || {};
    if (!identity.permissions.includes('scenario:evaluate') || !hasAccount(identity, body.accountRef)) {
      return res.status(403).json({ error: 'scenario:evaluate and account scope required' });
    }
    const requestHash = digest({ accountRef: body.accountRef, name: body.name, scenario: body.scenario });
    try {
      const evaluated = evaluatePaperScenario(body.scenario);
      const result = await transaction(req.app.get('governedPool'), async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',
          [`scenario:${identity.tenant}:${body.accountRef}:${req.idempotencyKey}`]);
        const prior = await client.query(
          `SELECT * FROM finance_scenario_runs
           WHERE tenant_id=$1 AND account_ref=$2 AND idempotency_key=$3`,
          [identity.tenant, body.accountRef, req.idempotencyKey],
        );
        if (prior.rowCount) return prior.rows[0].request_hash === requestHash
          ? { ...prior.rows[0], replay: true } : null;
        const inserted = await client.query(
          `INSERT INTO finance_scenario_runs
            (tenant_id,id,account_ref,name,idempotency_key,request_hash,input,result,result_hash,created_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [identity.tenant, crypto.randomUUID(), body.accountRef, String(body.name || '').slice(0, 200),
            req.idempotencyKey, requestHash, body.scenario, evaluated, evaluated.resultHash, identity.actor],
        );
        return { ...inserted.rows[0], replay: false };
      });
      return result ? res.status(result.replay ? 200 : 201).json(result)
        : res.status(409).json({ error: 'scenario idempotency conflict' });
    } catch (error) {
      if (error.statusCode === 422) return res.status(422).json({ error: error.message });
      console.error('paper scenario evaluation failed', { code: error.code });
      return res.status(500).json({ error: 'paper scenario evaluation failed' });
    }
  });

  router.post('/operations', requireKey, async (req, res) => {
    const identity = req.finance;
    const pool = req.app.get('governedPool');
    const body = req.body || {};
    try {
      if (body.action === 'market-ingest') {
        const provider = providerFor(providerContracts, body.provider, 'market-data');
        if (!identity.permissions.includes('market:ingest') || !provider
          || !KEY.test(String(body.externalEventId || '')) || !SYMBOL.test(String(body.symbol || '').toUpperCase())) {
          return res.status(403).json({ error: 'configured market provider permission and stable identifiers required' });
        }
        const price = Number(body.price); const volume = Number(body.volume);
        if (!(price > 0) || !(volume >= 0) || !validSourceTimestamp(body.sourceTimestamp)
          || !body.provenance?.sourceRef
          || !/^[a-f0-9]{64}$/i.test(String(body.provenance?.sha256 || ''))) {
          return res.status(422).json({ error: 'price, volume, source timestamp, and hashed provenance required' });
        }
        const normalized = { symbol: String(body.symbol).toUpperCase(), price, volume,
          sourceTimestamp: new Date(body.sourceTimestamp).toISOString(), provenance: body.provenance,
          providerContractRef: provider.contractRef };
        const hash = digest(normalized);
        const result = await transaction(pool, async (client) => {
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${identity.tenant}:${body.provider}:${body.externalEventId}`]);
          const prior = await client.query(
            'SELECT * FROM finance_market_events WHERE tenant_id=$1 AND provider=$2 AND external_event_id=$3',
            [identity.tenant, body.provider, body.externalEventId],
          );
          if (prior.rowCount) return prior.rows[0].payload_hash === hash ? { ...prior.rows[0], replay: true } : null;
          const inserted = await client.query(
            `INSERT INTO finance_market_events
              (tenant_id,id,provider,provider_contract_ref,external_event_id,symbol,price,volume,
               source_timestamp,payload_hash,provenance)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [identity.tenant, crypto.randomUUID(), body.provider, provider.contractRef,
              body.externalEventId, normalized.symbol, price, volume, normalized.sourceTimestamp, hash, body.provenance],
          );
          return { ...inserted.rows[0], replay: false };
        });
        return result ? res.status(result.replay ? 200 : 201).json(result) : res.status(409).json({ error: 'market event idempotency conflict' });
      }

      if (body.action === 'risk-snapshot-ingest') {
        const provider = providerFor(providerContracts, body.provider, 'custody-snapshot');
        if (!identity.permissions.includes('custody:ingest') || !provider
          || !hasAccount(identity, body.accountRef) || !KEY.test(String(body.externalEventId || ''))
          || !KEY.test(String(body.custodyAccountRef || ''))) {
          return res.status(403).json({ error: 'configured custody scope and stable identifiers required' });
        }
        const values = [body.grossExposure, body.netExposure, body.dailyPnl, body.availableCash].map(Number);
        if (!values.every(Number.isFinite) || values[0] < 0 || values[3] < 0
          || !validSourceTimestamp(body.sourceTimestamp)
          || !body.provenance?.sourceRef || !/^[a-f0-9]{64}$/i.test(String(body.provenance?.sha256 || ''))) {
          return res.status(422).json({ error: 'valid custody risk snapshot and hashed provenance required' });
        }
        const normalized = { accountRef: body.accountRef, custodyAccountRef: body.custodyAccountRef,
          grossExposure: values[0], netExposure: values[1], dailyPnl: values[2],
          availableCash: values[3],
          sourceTimestamp: new Date(body.sourceTimestamp).toISOString(), provenance: body.provenance,
          providerContractRef: provider.contractRef };
        const hash = digest(normalized);
        const result = await transaction(pool, async (client) => {
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',
            [`order:${identity.tenant}:${body.accountRef}`]);
          const inserted = await client.query(
            `INSERT INTO finance_risk_snapshots
              (tenant_id,id,account_ref,provider,provider_contract_ref,external_event_id,gross_exposure,
               net_exposure,daily_pnl,available_cash,custody_account_ref,source_timestamp,payload_hash,provenance)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             ON CONFLICT(tenant_id,provider,external_event_id) DO NOTHING RETURNING *`,
            [identity.tenant, crypto.randomUUID(), body.accountRef, body.provider, provider.contractRef,
              body.externalEventId, ...values, body.custodyAccountRef, normalized.sourceTimestamp, hash, body.provenance],
          );
          if (inserted.rowCount) return { ...inserted.rows[0], replay: false };
          const prior = await client.query(
            'SELECT * FROM finance_risk_snapshots WHERE tenant_id=$1 AND provider=$2 AND external_event_id=$3',
            [identity.tenant, body.provider, body.externalEventId],
          );
          return prior.rows[0]?.payload_hash === hash ? { ...prior.rows[0], replay: true } : null;
        });
        return result ? res.status(result.replay ? 200 : 201).json(result)
          : res.status(409).json({ error: 'risk snapshot idempotency conflict' });
      }

      if (body.action === 'limit-create') {
        if (!identity.permissions.includes('risk:configure') || !hasAccount(identity, body.accountRef)) {
          return res.status(403).json({ error: 'risk:configure and account scope required' });
        }
        const failures = validateLimits(body.limits);
        if (failures.length || !Number.isInteger(body.version) || body.version < 1 || !String(body.reason || '').trim()) {
          return res.status(422).json({ error: 'valid versioned deterministic limits required', failures });
        }
        const reason = String(body.reason).trim().slice(0, 1000);
        const hash = digest({ accountRef: body.accountRef, version: body.version, limits: body.limits, reason });
        const result = await transaction(pool, async (client) => {
          const inserted = await client.query(
            `INSERT INTO finance_limit_policies
              (tenant_id,id,account_ref,version,max_order_notional,max_gross_exposure,max_net_exposure,
               max_daily_loss,min_liquidity,max_staleness_seconds,max_risk_snapshot_staleness_seconds,
               min_cash_reserve,payload_hash,idempotency_key,created_by,reason)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
             ON CONFLICT DO NOTHING RETURNING *`,
            [identity.tenant, crypto.randomUUID(), body.accountRef, body.version,
              body.limits.maxOrderNotional, body.limits.maxGrossExposure, body.limits.maxNetExposure,
              body.limits.maxDailyLoss, body.limits.minLiquidity, body.limits.maxStalenessSeconds,
              body.limits.maxRiskSnapshotStalenessSeconds, body.limits.minCashReserve,
              hash, req.idempotencyKey, identity.actor, reason],
          );
          if (inserted.rowCount) {
            await client.query(
              `INSERT INTO finance_limit_policy_events(tenant_id,policy_id,actor_id,event_type,details)
               VALUES($1,$2,$3,'created',$4)`,
              [identity.tenant, inserted.rows[0].id, identity.actor, { reason }],
            );
            return { ...inserted.rows[0], replay: false };
          }
          const prior = await client.query(
            `SELECT * FROM finance_limit_policies
             WHERE tenant_id=$1 AND account_ref=$2 AND (version=$3 OR idempotency_key=$4)`,
            [identity.tenant, body.accountRef, body.version, req.idempotencyKey],
          );
          return prior.rowCount === 1 && prior.rows[0].payload_hash === hash
            ? { ...prior.rows[0], replay: true } : null;
        });
        return result ? res.status(result.replay ? 200 : 201).json(result)
          : res.status(409).json({ error: 'limit version conflict' });
      }

      if (body.action === 'limit-approve') {
        if (!identity.permissions.includes('risk:approve') || !RISK_ROLES.has(identity.role)) {
          return res.status(403).json({ error: 'independent risk approval required' });
        }
        const result = await transaction(pool, async (client) => {
          const selected = await client.query(
            'SELECT * FROM finance_limit_policies WHERE tenant_id=$1 AND id=$2',
            [identity.tenant, body.id],
          );
          if (!selected.rows[0] || !hasAccount(identity, selected.rows[0].account_ref)) return null;
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',
            [`order:${identity.tenant}:${selected.rows[0].account_ref}`]);
          const locked = await client.query(
            'SELECT * FROM finance_limit_policies WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
            [identity.tenant, body.id],
          );
          const policy = locked.rows[0];
          if (policy.state === 'active' && policy.approved_by === identity.actor) return { ...policy, replay: true };
          if (policy.state !== 'pending' || policy.created_by === identity.actor) return null;
          const retired = await client.query(
            `UPDATE finance_limit_policies SET state='retired'
             WHERE tenant_id=$1 AND account_ref=$2 AND state='active' RETURNING id`,
            [identity.tenant, policy.account_ref],
          );
          for (const row of retired.rows) {
            await client.query(
              `INSERT INTO finance_limit_policy_events(tenant_id,policy_id,actor_id,event_type,details)
               VALUES($1,$2,$3,'retired',$4)`,
              [identity.tenant, row.id, identity.actor, { supersededBy: policy.id }],
            );
          }
          const approved = await client.query(
            `UPDATE finance_limit_policies SET state='active',approved_by=$1,approved_at=NOW()
             WHERE tenant_id=$2 AND id=$3 RETURNING *`,
            [identity.actor, identity.tenant, policy.id],
          );
          await client.query(
            `INSERT INTO finance_limit_policy_events(tenant_id,policy_id,actor_id,event_type,details)
             VALUES($1,$2,$3,'approved',$4)`,
            [identity.tenant, policy.id, identity.actor, { creator: policy.created_by }],
          );
          return { ...approved.rows[0], replay: false };
        });
        return result ? res.json(result) : res.status(409).json({ error: 'missing or self-approved limit policy' });
      }

      if (body.action === 'kill-switch') {
        if (!identity.permissions.includes('risk:kill') || !RISK_ROLES.has(identity.role)
          || !hasAccount(identity, body.accountRef) || typeof body.enabled !== 'boolean'
          || !String(body.reason || '').trim()) {
          return res.status(403).json({ error: 'authorized kill-switch reason required' });
        }
        const reason = String(body.reason).trim().slice(0, 1000);
        const hash = digest({ accountRef: body.accountRef, enabled: body.enabled, reason });
        const result = await transaction(pool, async (client) => {
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',
            [`order:${identity.tenant}:${body.accountRef}`]);
          const prior = await client.query(
            `SELECT * FROM finance_kill_switch_events
             WHERE tenant_id=$1 AND account_ref=$2 AND idempotency_key=$3`,
            [identity.tenant, body.accountRef, req.idempotencyKey],
          );
          if (prior.rowCount) return prior.rows[0].request_hash === hash ? { ...prior.rows[0], replay: true } : null;
          const inserted = await client.query(
            `INSERT INTO finance_kill_switch_events
              (tenant_id,account_ref,enabled,actor_id,reason,idempotency_key,request_hash)
             VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [identity.tenant, body.accountRef, body.enabled, identity.actor, reason, req.idempotencyKey, hash],
          );
          return { ...inserted.rows[0], replay: false };
        });
        return result ? res.status(result.replay ? 200 : 201).json(result)
          : res.status(409).json({ error: 'kill-switch idempotency conflict' });
      }

      if (body.action === 'paper-order') {
        if (!identity.permissions.includes('trade:paper') || !hasAccount(identity, body.accountRef)
          || !KEY.test(String(body.clientOrderId || ''))) {
          return res.status(403).json({ error: 'paper-trading account scope and client order ID required' });
        }
        const order = { ...body.order, symbol: String(body.order?.symbol || '').toUpperCase(), mode: body.order?.mode };
        if (!SYMBOL.test(order.symbol) || !['buy', 'sell'].includes(order.side)
          || !(Number(order.quantity) > 0) || (order.limitPrice != null && !(Number(order.limitPrice) > 0))) {
          return res.status(422).json({ error: 'valid symbol, side, quantity, and optional limit price required' });
        }
        const result = await transaction(pool, async (client) => {
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`order:${identity.tenant}:${body.accountRef}`]);
          const prior = await client.query(
            `SELECT * FROM finance_paper_orders
             WHERE tenant_id=$1 AND account_ref=$2 AND (idempotency_key=$3 OR client_order_id=$4)`,
            [identity.tenant, body.accountRef, req.idempotencyKey, body.clientOrderId],
          );
          const requestHash = digest({ accountRef: body.accountRef, clientOrderId: body.clientOrderId, order });
          if (prior.rowCount) return prior.rowCount === 1 && prior.rows[0].request_hash === requestHash
            ? { ...prior.rows[0], replay: true } : null;
          const priorRejection = await client.query(
            `SELECT * FROM finance_operation_rejections
             WHERE tenant_id=$1 AND account_ref=$2 AND idempotency_key=$3`,
            [identity.tenant, body.accountRef, req.idempotencyKey],
          );
          if (priorRejection.rowCount) return priorRejection.rows[0].request_hash === requestHash
            ? { missingControls: true, replay: true, rejection: priorRejection.rows[0] } : null;
          const [market, limits, snapshot, kill] = await Promise.all([
            client.query('SELECT * FROM finance_market_events WHERE tenant_id=$1 AND symbol=$2 ORDER BY source_timestamp DESC LIMIT 1', [identity.tenant, order.symbol]),
            client.query("SELECT * FROM finance_limit_policies WHERE tenant_id=$1 AND account_ref=$2 AND state='active'", [identity.tenant, body.accountRef]),
            client.query('SELECT * FROM finance_risk_snapshots WHERE tenant_id=$1 AND account_ref=$2 ORDER BY source_timestamp DESC LIMIT 1', [identity.tenant, body.accountRef]),
            client.query('SELECT enabled FROM finance_kill_switch_events WHERE tenant_id=$1 AND account_ref=$2 ORDER BY seq DESC LIMIT 1', [identity.tenant, body.accountRef]),
          ]);
          if (!market.rowCount || !limits.rowCount || !snapshot.rowCount) {
            const failures = [!market.rowCount && 'market_data_missing', !limits.rowCount && 'active_limits_missing',
              !snapshot.rowCount && 'risk_snapshot_missing'].filter(Boolean);
            const rejection = await client.query(
              `INSERT INTO finance_operation_rejections
                (tenant_id,id,account_ref,action,idempotency_key,request_hash,failures,actor_id)
               VALUES($1,$2,$3,'paper-order',$4,$5,$6,$7) RETURNING *`,
              [identity.tenant, crypto.randomUUID(), body.accountRef, req.idempotencyKey,
                requestHash, JSON.stringify(failures), identity.actor],
            );
            return { missingControls: true, replay: false, rejection: rejection.rows[0] };
          }
          const quote = { price: market.rows[0].price, volume: market.rows[0].volume, sourceTimestamp: market.rows[0].source_timestamp };
          const policy = limits.rows[0];
          const currentRisk = snapshot.rows[0];
          const reservations = await client.query(
            `SELECT COALESCE(SUM(quantity*limit_price),0) gross,
               COALESCE(SUM(CASE WHEN side='buy' THEN quantity*limit_price ELSE -quantity*limit_price END),0) net,
               COALESCE(SUM(CASE WHEN side='buy' THEN quantity*limit_price ELSE 0 END),0) cash
             FROM finance_paper_orders
             WHERE tenant_id=$1 AND account_ref=$2 AND state IN('paper_approved','partially_filled','filled')
               AND created_at > $3`,
            [identity.tenant, body.accountRef, currentRisk.source_timestamp],
          );
          const assessment = evaluatePaperOrder(order, quote, {
            maxOrderNotional: policy.max_order_notional, maxGrossExposure: policy.max_gross_exposure,
            maxNetExposure: policy.max_net_exposure, maxDailyLoss: policy.max_daily_loss,
            minLiquidity: policy.min_liquidity, maxStalenessSeconds: policy.max_staleness_seconds,
            maxRiskSnapshotStalenessSeconds: policy.max_risk_snapshot_staleness_seconds,
            minCashReserve: policy.min_cash_reserve,
            killSwitch: kill.rows[0]?.enabled === true,
          }, { grossExposure: currentRisk.gross_exposure, netExposure: currentRisk.net_exposure,
            dailyPnl: currentRisk.daily_pnl, availableCash: currentRisk.available_cash,
            sourceTimestamp: currentRisk.source_timestamp, reservedGrossExposure: reservations.rows[0].gross,
            reservedNetExposure: reservations.rows[0].net, reservedCash: reservations.rows[0].cash });
          const state = assessment.passed ? 'paper_approved' : 'risk_rejected';
          const inserted = await client.query(
            `INSERT INTO finance_paper_orders
              (tenant_id,id,account_ref,custody_account_ref,client_order_id,symbol,side,quantity,
               limit_price,state,risk_result,market_event_id,limit_policy_id,risk_snapshot_id,
               request_hash,idempotency_key,created_by)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
            [identity.tenant, crypto.randomUUID(), body.accountRef, currentRisk.custody_account_ref,
              body.clientOrderId, order.symbol, order.side, order.quantity,
              order.limitPrice ?? market.rows[0].price, state, assessment, market.rows[0].id,
              policy.id, currentRisk.id, requestHash, req.idempotencyKey, identity.actor],
          );
          await client.query(
            `INSERT INTO finance_order_events(tenant_id,order_id,actor_id,event_type,details)
             VALUES($1,$2,$3,$4,$5)`,
            [identity.tenant, inserted.rows[0].id, identity.actor, state, { assessment }],
          );
          return { ...inserted.rows[0], replay: false };
        });
        if (!result) return res.status(409).json({ error: 'order idempotency conflict' });
        if (result.missingControls) return res.status(422).json({
          error: 'fresh market, active limits, and custody risk snapshot required',
          replay: result.replay, rejectionId: result.rejection.id, failures: result.rejection.failures,
        });
        return res.status(result.replay ? 200 : result.state === 'paper_approved' ? 201 : 422).json(result);
      }

      if (body.action === 'fill-ingest') {
        const provider = providerFor(providerContracts, body.provider, 'paper-fill');
        if (!identity.permissions.includes('fill:ingest') || !provider
          || !KEY.test(String(body.externalFillId || ''))) return res.status(403).json({ error: 'paper-broker fill permission required' });
        const quantity = Number(body.quantity); const price = Number(body.price);
        const feeAmount = Number(body.feeAmount || 0);
        if (!(quantity > 0) || !(price > 0) || !(feeAmount >= 0) || !validSourceTimestamp(body.sourceTimestamp)
          || !body.provenance?.sourceRef || !/^[a-f0-9]{64}$/i.test(String(body.provenance?.sha256 || ''))) {
          return res.status(422).json({ error: 'positive typed fill and source timestamp required' });
        }
        const normalized = { orderId: body.orderId, quantity, price, feeAmount,
          sourceTimestamp: new Date(body.sourceTimestamp).toISOString(), provenance: body.provenance,
          providerContractRef: provider.contractRef };
        const hash = digest(normalized);
        const filled = await transaction(pool, async (client) => {
          const selected = await client.query('SELECT * FROM finance_paper_orders WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [identity.tenant, body.orderId]);
          const order = selected.rows[0];
          if (!order || !hasAccount(identity, order.account_ref)) return null;
          const prior = await client.query('SELECT * FROM finance_fills WHERE tenant_id=$1 AND provider=$2 AND external_fill_id=$3', [identity.tenant, body.provider, body.externalFillId]);
          if (prior.rowCount) return prior.rows[0].payload_hash === hash ? { ...prior.rows[0], replay: true } : { conflict: true };
          if (!['paper_approved', 'partially_filled'].includes(order.state)
            || Date.parse(normalized.sourceTimestamp) < Date.parse(order.created_at) - 60_000) return null;
          const remaining = Number(order.quantity) - Number(order.filled_quantity);
          if (quantity - remaining > 1e-8) return { overfill: true };
          const fillId = crypto.randomUUID(); const journalId = crypto.randomUUID();
          const insert = await client.query(
            `INSERT INTO finance_fills
              (tenant_id,id,order_id,provider,provider_contract_ref,external_fill_id,quantity,price,
               fee_amount,source_timestamp,payload_hash,provenance,recorded_by)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
            [identity.tenant, fillId, order.id, body.provider, provider.contractRef, body.externalFillId,
              quantity, price, feeAmount, normalized.sourceTimestamp, hash, body.provenance, identity.actor],
          );
          const calculatedFilled = roundLedgerNumber(Number(order.filled_quantity) + quantity);
          const state = Math.abs(calculatedFilled - Number(order.quantity)) <= 1e-8 ? 'filled' : 'partially_filled';
          const nextFilled = state === 'filled' ? Number(order.quantity) : calculatedFilled;
          await client.query('UPDATE finance_paper_orders SET filled_quantity=$1,state=$2,updated_at=NOW() WHERE tenant_id=$3 AND id=$4', [nextFilled, state, identity.tenant, order.id]);
          await client.query(
            `INSERT INTO finance_journals(tenant_id,id,order_id,fill_id,journal_type,created_by)
             VALUES($1,$2,$3,$4,'paper_fill',$5)`,
            [identity.tenant, journalId, order.id, fillId, identity.actor],
          );
          const notional = quantity * price; const direction = order.side === 'buy' ? 1 : -1;
          await client.query(
            `INSERT INTO finance_ledger_entries(tenant_id,journal_id,ledger_account,signed_amount,details)
             VALUES($1,$2,$3,$4,$5),($1,$2,$6,$7,$5),($1,$2,$8,$9,$5)`,
            [identity.tenant, journalId, `POSITION:${order.custody_account_ref}:${order.symbol}`,
              direction * notional, { fillId, quantity, price, feeAmount },
              `CASH:${order.custody_account_ref}`, (-direction * notional) - feeAmount,
              `FEES:${order.custody_account_ref}`, feeAmount],
          );
          await client.query(
            `INSERT INTO finance_order_events(tenant_id,order_id,actor_id,event_type,details)
             VALUES($1,$2,$3,$4,$5)`,
            [identity.tenant, order.id, identity.actor, state, { fillId, externalFillId: body.externalFillId }],
          );
          return { ...insert.rows[0], orderState: state, replay: false };
        });
        if (!filled) return res.status(409).json({ error: 'missing, scoped, or fillable paper order required' });
        if (filled.conflict) return res.status(409).json({ error: 'fill idempotency conflict' });
        if (filled.overfill) return res.status(422).json({ error: 'fill exceeds remaining order quantity' });
        return res.status(filled.replay ? 200 : 201).json(filled);
      }

      if (body.action === 'fill-correction') {
        if (!identity.permissions.includes('ledger:correct') || !RISK_ROLES.has(identity.role)
          || !String(body.reason || '').trim()) return res.status(403).json({ error: 'independent correction authority and reason required' });
        const corrected = await transaction(pool, async (client) => {
          const selected = await client.query(
            `SELECT fill.*,fill.quantity AS fill_quantity,fill.price AS fill_price,fill.fee_amount AS fill_fee_amount,
               orders.account_ref,orders.symbol,orders.side,orders.custody_account_ref,
               orders.filled_quantity,orders.quantity AS order_quantity
             FROM finance_fills fill JOIN finance_paper_orders orders ON orders.tenant_id=fill.tenant_id AND orders.id=fill.order_id
             WHERE fill.tenant_id=$1 AND fill.id=$2 FOR UPDATE`,
            [identity.tenant, body.fillId],
          );
          const fill = selected.rows[0];
          if (!fill || !hasAccount(identity, fill.account_ref) || fill.recorded_by === identity.actor) return null;
          const reason = String(body.reason).trim().slice(0, 1000);
          const hash = digest({ fillId: fill.id, reason });
          const existing = await client.query('SELECT * FROM finance_fills WHERE tenant_id=$1 AND correction_of=$2', [identity.tenant, fill.id]);
          if (existing.rowCount) return existing.rows[0].payload_hash === hash
            ? { correctionId: existing.rows[0].id, replay: true } : { alreadyCorrected: true };
          const originalJournal = await client.query('SELECT id FROM finance_journals WHERE tenant_id=$1 AND fill_id=$2', [identity.tenant, fill.id]);
          if (!originalJournal.rowCount) return { missingJournal: true };
          const originalEntries = await client.query(
            `SELECT ledger_account,currency,signed_amount FROM finance_ledger_entries
             WHERE tenant_id=$1 AND journal_id=$2 ORDER BY seq`,
            [identity.tenant, originalJournal.rows[0].id],
          );
          if (originalEntries.rowCount < 2) return { missingJournal: true };
          const correctionId = crypto.randomUUID(); const journalId = crypto.randomUUID();
          await client.query(
            `INSERT INTO finance_fills
              (tenant_id,id,order_id,provider,provider_contract_ref,external_fill_id,quantity,price,
               fee_amount,source_timestamp,payload_hash,provenance,correction_of,recorded_by)
             VALUES($1,$2,$3,'internal-correction','internal:ledger',$4,$5,$6,$7,NOW(),$8,$9,$10,$11)`,
            [identity.tenant, correctionId, fill.order_id, `correction:${fill.id}`,
              -Number(fill.fill_quantity), fill.fill_price, -Number(fill.fill_fee_amount), hash,
              { reason }, fill.id, identity.actor],
          );
          await client.query(
            `INSERT INTO finance_journals(tenant_id,id,order_id,fill_id,journal_type,reversal_of,created_by)
             VALUES($1,$2,$3,$4,'fill_correction',$5,$6)`,
            [identity.tenant, journalId, fill.order_id, correctionId, originalJournal.rows[0].id, identity.actor],
          );
          for (const entry of originalEntries.rows) {
            await client.query(
              `INSERT INTO finance_ledger_entries
                (tenant_id,journal_id,ledger_account,signed_amount,currency,details)
               VALUES($1,$2,$3,$4,$5,$6)`,
              [identity.tenant, journalId, entry.ledger_account, -Number(entry.signed_amount), entry.currency,
                { correctionOf: fill.id, reason }],
            );
          }
          const nextFilled = roundLedgerNumber(Number(fill.filled_quantity) - Number(fill.fill_quantity));
          const state = nextFilled <= 0 ? 'corrected' : 'partially_filled';
          await client.query('UPDATE finance_paper_orders SET filled_quantity=$1,state=$2,updated_at=NOW() WHERE tenant_id=$3 AND id=$4', [Math.max(0, nextFilled), state, identity.tenant, fill.order_id]);
          await client.query(
            `INSERT INTO finance_order_events(tenant_id,order_id,actor_id,event_type,reason,details)
             VALUES($1,$2,$3,'fill_corrected',$4,$5)`,
            [identity.tenant, fill.order_id, identity.actor, reason, { fillId: fill.id, correctionId }],
          );
          return { correctionId, orderState: state, replay: false };
        });
        if (!corrected) return res.status(409).json({ error: 'missing or self-corrected fill' });
        if (corrected.missingJournal) return res.status(409).json({ error: 'fill has incomplete journal evidence' });
        if (corrected.alreadyCorrected) return res.status(409).json({ error: 'fill already corrected' });
        return res.status(corrected.replay ? 200 : 201).json(corrected);
      }

      if (body.action === 'corporate-action-ingest') {
        const provider = providerFor(providerContracts, body.provider, 'corporate-action');
        if (!identity.permissions.includes('corporate:ingest') || !provider
          || !KEY.test(String(body.externalActionId || '')) || !SYMBOL.test(String(body.symbol || '').toUpperCase())
          || !['split', 'dividend', 'merger', 'symbol_change'].includes(body.actionType)
          || Number.isNaN(Date.parse(body.effectiveAt))) {
          return res.status(403).json({ error: 'configured, typed corporate action required' });
        }
        if (!validSourceTimestamp(body.sourceTimestamp) || !body.provenance?.sourceRef
          || !/^[a-f0-9]{64}$/i.test(String(body.provenance?.sha256 || ''))) {
          return res.status(422).json({ error: 'corporate-action source timestamp and hashed provenance required' });
        }
        const normalized = { symbol: String(body.symbol).toUpperCase(), actionType: body.actionType,
          effectiveAt: new Date(body.effectiveAt).toISOString(), terms: body.terms || {},
          sourceTimestamp: new Date(body.sourceTimestamp).toISOString(), provenance: body.provenance,
          providerContractRef: provider.contractRef };
        const hash = digest(normalized);
        const inserted = await pool.query(
          `INSERT INTO finance_corporate_actions
            (tenant_id,id,provider,provider_contract_ref,external_action_id,symbol,action_type,effective_at,
             source_timestamp,terms,provenance,payload_hash,recorded_by)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT(tenant_id,provider,external_action_id) DO NOTHING RETURNING *`,
          [identity.tenant, crypto.randomUUID(), body.provider, provider.contractRef, body.externalActionId,
            normalized.symbol, body.actionType, normalized.effectiveAt, normalized.sourceTimestamp,
            normalized.terms, body.provenance, hash, identity.actor],
        );
        if (inserted.rowCount) return res.status(201).json(inserted.rows[0]);
        const prior = await pool.query(
          'SELECT * FROM finance_corporate_actions WHERE tenant_id=$1 AND provider=$2 AND external_action_id=$3',
          [identity.tenant, body.provider, body.externalActionId],
        );
        return prior.rows[0]?.payload_hash === hash ? res.json({ ...prior.rows[0], replay: true })
          : res.status(409).json({ error: 'corporate-action idempotency conflict' });
      }

      if (body.action === 'reconcile') {
        const provider = providerFor(providerContracts, body.provider, 'custody-reconciliation');
        if (!identity.permissions.includes('custody:reconcile') || !provider
          || !hasAccount(identity, body.accountRef) || !KEY.test(String(body.externalEventId || ''))) {
          return res.status(403).json({ error: 'custody reconciliation scope required' });
        }
        const providerNotional = Number(body.providerNotional);
        const tolerance = Number(body.tolerance ?? 0.01);
        if (!Number.isFinite(providerNotional) || !(tolerance >= 0) || !validSourceTimestamp(body.sourceTimestamp)
          || !body.provenance?.sourceRef || !/^[a-f0-9]{64}$/i.test(String(body.provenance?.sha256 || ''))) {
          return res.status(422).json({ error: 'valid custody statement, tolerance, timestamp, and provenance required' });
        }
        const normalized = { accountRef: body.accountRef, providerNotional, tolerance,
          sourceTimestamp: new Date(body.sourceTimestamp).toISOString(),
          provenance: body.provenance, providerContractRef: provider.contractRef };
        const hash = digest(normalized);
        const result = await transaction(pool, async (client) => {
          await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',
            [`reconcile:${identity.tenant}:${body.provider}:${body.externalEventId}`]);
          const prior = await client.query(
            'SELECT * FROM finance_reconciliations WHERE tenant_id=$1 AND provider=$2 AND external_event_id=$3',
            [identity.tenant, body.provider, body.externalEventId],
          );
          if (prior.rowCount) return prior.rows[0].payload_hash === hash
            ? { ...prior.rows[0], replay: true } : null;
          const internal = await client.query(
            `SELECT COALESCE(SUM(CASE WHEN orders.side='buy' THEN fills.quantity*fills.price ELSE -fills.quantity*fills.price END),0) total
             FROM finance_fills fills JOIN finance_paper_orders orders
               ON orders.tenant_id=fills.tenant_id AND orders.id=fills.order_id
             WHERE orders.tenant_id=$1 AND orders.account_ref=$2 AND fills.source_timestamp<=$3`,
            [identity.tenant, body.accountRef, normalized.sourceTimestamp],
          );
          const internalNotional = Number(internal.rows[0].total);
          const outcome = reconciliation(internalNotional, providerNotional, tolerance);
          const inserted = await client.query(
            `INSERT INTO finance_reconciliations
              (tenant_id,id,account_ref,provider,provider_contract_ref,external_event_id,source_timestamp,
               internal_notional,provider_notional,difference,status,evidence,payload_hash,created_by)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [identity.tenant, crypto.randomUUID(), body.accountRef, body.provider, provider.contractRef,
              body.externalEventId, normalized.sourceTimestamp, internalNotional, providerNotional,
              outcome.difference, outcome.status, body.provenance, hash, identity.actor],
          );
          return { ...inserted.rows[0], replay: false };
        });
        if (!result) return res.status(409).json({ error: 'reconciliation idempotency conflict' });
        return res.status(result.replay ? (result.status === 'matched' ? 200 : 422)
          : (result.status === 'matched' ? 201 : 422)).json(result);
      }

      return res.status(422).json({ error: 'unsupported governed trading action' });
    } catch (error) {
      console.error('governed trading operation failed', { code: error.code, constraint: error.constraint });
      if (['40001', '40P01'].includes(error.code)) {
        res.set('Retry-After', '1');
        return res.status(503).json({ error: 'temporary transaction conflict; retry with the same idempotency key' });
      }
      return res.status(500).json({ error: 'governed trading operation failed' });
    }
  });

  return router;
}

module.exports = { createGovernedTradingRouter };
