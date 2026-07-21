'use strict';

const { digest, evaluatePaperOrder, validateLimits, SYMBOL, KEY } = require('./tradingControls');

function scenarioError(message) {
  const error = new Error(message);
  error.statusCode = 422;
  return error;
}

function roundLedgerNumber(value) {
  return Number(Number(value).toFixed(8));
}

function evaluatePaperScenario(input = {}) {
  const failures = validateLimits(input.limits);
  if (failures.length) throw scenarioError(`invalid limits: ${failures.join(', ')}`);
  if (!Array.isArray(input.events) || input.events.length < 1 || input.events.length > 10000) {
    throw scenarioError('scenario must contain between 1 and 10000 events');
  }

  let quote = null;
  let snapshot = null;
  let killSwitch = false;
  let priorTimestamp = -Infinity;
  const orders = new Map();
  const decisions = [];
  let accepted = 0;
  let rejected = 0;
  let fills = 0;
  let partialFills = 0;

  for (const [index, event] of input.events.entries()) {
    const timestamp = Date.parse(event.at);
    if (!Number.isFinite(timestamp) || timestamp < priorTimestamp) {
      throw scenarioError(`event ${index} has an invalid or non-monotonic timestamp`);
    }
    priorTimestamp = timestamp;

    if (event.type === 'quote') {
      if (!SYMBOL.test(String(event.symbol || '').toUpperCase()) || !(Number(event.price) > 0)
        || !(Number(event.volume) >= 0)) throw scenarioError(`event ${index} has an invalid quote`);
      quote = { symbol: String(event.symbol).toUpperCase(), price: Number(event.price),
        volume: Number(event.volume), sourceTimestamp: event.at };
      continue;
    }
    if (event.type === 'risk-snapshot') {
      const risk = [event.grossExposure, event.netExposure, event.dailyPnl, event.availableCash].map(Number);
      if (!risk.every(Number.isFinite) || risk[0] < 0 || risk[3] < 0) throw scenarioError(`event ${index} has an invalid risk snapshot`);
      snapshot = { grossExposure: risk[0], netExposure: risk[1], dailyPnl: risk[2],
        availableCash: risk[3], sourceTimestamp: event.at, reservedGrossExposure: 0,
        reservedNetExposure: 0, reservedCash: 0 };
      continue;
    }
    if (event.type === 'kill-switch') {
      if (typeof event.enabled !== 'boolean') throw scenarioError(`event ${index} has an invalid kill-switch state`);
      killSwitch = event.enabled;
      continue;
    }
    if (event.type === 'provider-outage') {
      if (event.providerType === 'market') quote = null;
      else if (event.providerType === 'custody') snapshot = null;
      else throw scenarioError(`event ${index} has an invalid provider outage type`);
      decisions.push({ eventIndex: index, state: 'provider_unavailable', providerType: event.providerType });
      continue;
    }
    if (event.type === 'order') {
      if (!KEY.test(String(event.clientOrderId || ''))) throw scenarioError(`event ${index} has an invalid client order ID`);
      const normalized = { mode: event.mode, symbol: String(event.symbol || '').toUpperCase(),
        side: event.side, quantity: Number(event.quantity), limitPrice: Number(event.limitPrice) };
      const requestHash = digest(normalized);
      const prior = orders.get(event.clientOrderId);
      if (prior) {
        decisions.push({ eventIndex: index, clientOrderId: event.clientOrderId,
          state: prior.requestHash === requestHash ? 'duplicate_replay' : 'duplicate_conflict' });
        if (prior.requestHash !== requestHash) rejected += 1;
        continue;
      }
      const currentQuote = quote?.symbol === normalized.symbol ? quote : {};
      const assessment = evaluatePaperOrder(normalized, currentQuote, { ...input.limits, killSwitch }, snapshot || {}, timestamp);
      const state = assessment.passed ? 'paper_approved' : 'risk_rejected';
      const record = { requestHash, order: normalized, state, filledQuantity: 0, assessment };
      orders.set(event.clientOrderId, record);
      decisions.push({ eventIndex: index, clientOrderId: event.clientOrderId, state, assessment });
      if (assessment.passed) {
        accepted += 1;
        snapshot.reservedGrossExposure += assessment.metrics.notional;
        snapshot.reservedNetExposure += assessment.metrics.signedNotional;
        if (normalized.side === 'buy') snapshot.reservedCash += assessment.metrics.notional;
      } else rejected += 1;
      continue;
    }
    if (event.type === 'fill') {
      const order = orders.get(event.clientOrderId);
      const quantity = Number(event.quantity);
      if (!order || !['paper_approved', 'partially_filled'].includes(order.state) || !(quantity > 0)) {
        decisions.push({ eventIndex: index, clientOrderId: event.clientOrderId, state: 'fill_rejected' });
        rejected += 1;
        continue;
      }
      const calculated = roundLedgerNumber(order.filledQuantity + quantity);
      if (calculated - order.order.quantity > 1e-8) {
        decisions.push({ eventIndex: index, clientOrderId: event.clientOrderId, state: 'overfill_rejected' });
        rejected += 1;
        continue;
      }
      order.state = Math.abs(calculated - order.order.quantity) <= 1e-8 ? 'filled' : 'partially_filled';
      const next = order.state === 'filled' ? order.order.quantity : calculated;
      order.filledQuantity = next;
      fills += 1;
      if (order.state === 'partially_filled') partialFills += 1;
      decisions.push({ eventIndex: index, clientOrderId: event.clientOrderId, state: order.state,
        filledQuantity: next });
      continue;
    }
    throw scenarioError(`event ${index} has an unsupported type`);
  }

  const result = { schemaVersion: 1, accepted, rejected, fills, partialFills, decisions };
  return { ...result, resultHash: digest(result) };
}

module.exports = { evaluatePaperScenario };
