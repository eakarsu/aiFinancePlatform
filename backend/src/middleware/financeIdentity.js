'use strict';

const { verifyIdentity } = require('../services/tradingControls');

function financeIdentity(req, res, next) {
  const identity = verifyIdentity(req.headers, process.env.FINANCE_GATEWAY_SECRET || '');
  if (!identity) return res.status(401).json({ error: 'signed finance identity required' });
  req.finance = identity;
  return next();
}

module.exports = { financeIdentity };
