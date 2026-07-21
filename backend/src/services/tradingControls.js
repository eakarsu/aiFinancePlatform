'use strict';

const crypto = require('node:crypto');
const KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SCOPE = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/;
const SYMBOL = /^[A-Z][A-Z0-9.-]{0,14}$/;

function canonical(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('non-finite number');
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash('sha256').update(canonical(value)).digest('hex');
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function verifyIdentity(headers, secret, now = Math.floor(Date.now() / 1000)) {
  if (!secret || secret.length < 32) return null;
  const encoded = headers['x-finance-identity'] || '';
  const supplied = headers['x-finance-signature'] || '';
  const expected = sign(encoded, secret);
  if (!/^[a-f0-9]{64}$/i.test(supplied)
    || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
  try {
    const claims = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (claims.aud !== 'finance-trading' || !SCOPE.test(String(claims.sub || ''))
      || !SCOPE.test(String(claims.tenantId || '')) || !SCOPE.test(String(claims.role || ''))
      || !Array.isArray(claims.permissions) || !Array.isArray(claims.accounts)
      || !claims.permissions.every((permission) => SCOPE.test(String(permission)))
      || !claims.accounts.every((account) => SCOPE.test(String(account)))
      || !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp)
      || claims.iat > now + 60 || claims.exp < now || claims.exp - claims.iat > 900) return null;
    return {
      actor: String(claims.sub), tenant: String(claims.tenantId), role: String(claims.role),
      permissions: claims.permissions.map(String), accounts: claims.accounts.map(String),
    };
  } catch (_) {
    return null;
  }
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function metric(value) {
  return Number.isFinite(value) ? value : null;
}

function validateLimits(input = {}) {
  const fields = ['maxOrderNotional', 'maxGrossExposure', 'maxNetExposure', 'maxDailyLoss',
    'minLiquidity', 'maxStalenessSeconds', 'maxRiskSnapshotStalenessSeconds'];
  const errors = fields.filter((field) => !(number(input[field]) > 0)).map((field) => `${field} must be positive`);
  if (!(number(input.minCashReserve) >= 0)) errors.push('minCashReserve must be non-negative');
  if (number(input.maxOrderNotional) > number(input.maxGrossExposure)) errors.push('order limit exceeds gross limit');
  if (number(input.maxOrderNotional) > number(input.maxNetExposure)) errors.push('order limit exceeds net limit');
  return errors;
}

function evaluatePaperOrder(order = {}, quote = {}, limits = {}, snapshot = {}, now = Date.now()) {
  const failures = [];
  const quantity = number(order.quantity);
  const price = number(order.limitPrice ?? quote.price);
  const quotePrice = number(quote.price);
  const quoteVolume = number(quote.volume);
  const notional = quantity * price;
  const signedNotional = order.side === 'buy' ? notional : -notional;
  const ageSeconds = (now - Date.parse(quote.sourceTimestamp)) / 1000;
  const riskAgeSeconds = (now - Date.parse(snapshot.sourceTimestamp)) / 1000;
  const reservedGross = number(snapshot.reservedGrossExposure || 0);
  const reservedNet = number(snapshot.reservedNetExposure || 0);
  const reservedCash = number(snapshot.reservedCash || 0);
  if (order.mode !== 'paper') failures.push('paper_mode_required');
  if (!SYMBOL.test(String(order.symbol || '').toUpperCase())) failures.push('symbol');
  if (!['buy', 'sell'].includes(order.side)) failures.push('side');
  if (!(quantity > 0) || !(price > 0) || !(quotePrice > 0)) failures.push('quantity_or_price');
  if (!Number.isFinite(ageSeconds) || ageSeconds < -60 || ageSeconds > number(limits.maxStalenessSeconds)) failures.push('stale_market_data');
  if (!Number.isFinite(riskAgeSeconds) || riskAgeSeconds < -60
    || riskAgeSeconds > number(limits.maxRiskSnapshotStalenessSeconds)) failures.push('stale_risk_snapshot');
  if (limits.killSwitch === true) failures.push('kill_switch');
  if (notional > number(limits.maxOrderNotional)) failures.push('order_notional');
  if (number(snapshot.grossExposure) + reservedGross + notional > number(limits.maxGrossExposure)) failures.push('gross_exposure');
  if (Math.abs(number(snapshot.netExposure) + reservedNet + signedNotional) > number(limits.maxNetExposure)) failures.push('net_exposure');
  if (-number(snapshot.dailyPnl) > number(limits.maxDailyLoss)) failures.push('daily_loss');
  if (quoteVolume < number(limits.minLiquidity) || quantity > quoteVolume * 0.01) failures.push('liquidity');
  const projectedAvailableCash = number(snapshot.availableCash) - reservedCash
    - (order.side === 'buy' ? notional : 0);
  if (projectedAvailableCash < number(limits.minCashReserve)) failures.push('cash_liquidity');
  return {
    passed: failures.length === 0,
    failures,
    metrics: { quantity: metric(quantity), price: metric(price), notional: metric(notional),
      signedNotional: metric(signedNotional), quoteAgeSeconds: metric(ageSeconds),
      projectedGrossExposure: metric(number(snapshot.grossExposure) + reservedGross + notional),
      projectedNetExposure: metric(number(snapshot.netExposure) + reservedNet + signedNotional),
      reservedGrossExposure: metric(reservedGross), reservedNetExposure: metric(reservedNet),
      reservedCash: metric(reservedCash), projectedAvailableCash: metric(projectedAvailableCash),
      riskSnapshotAgeSeconds: metric(riskAgeSeconds) },
  };
}

function reconciliation(internalNotional, providerNotional, tolerance = 0.01) {
  const difference = Number(providerNotional) - Number(internalNotional);
  return { difference, status: Math.abs(difference) <= Number(tolerance) ? 'matched' : 'exception' };
}

module.exports = { KEY, SCOPE, SYMBOL, canonical, digest, sign, verifyIdentity, validateLimits, evaluatePaperOrder, reconciliation };
