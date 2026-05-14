// ESPP/RSU optimiser: employer stock plan helper.
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// POST /api/espp-rsu/optimise
// body: { plan_type: 'ESPP'|'RSU', salary, discount_pct?, lookback?, current_price, grant_price?, vesting_schedule? }
router.post('/optimise', authenticateToken, (req, res) => {
  const b = req.body || {};
  if (!b.plan_type) return res.status(400).json({ error: 'plan_type required' });

  if (b.plan_type === 'ESPP') {
    const discount = Number(b.discount_pct || 0.15);
    const cp = Number(b.current_price);
    const lookback = b.lookback ? Number(b.lookback) : cp;
    const purchase_price = Math.min(cp, lookback) * (1 - discount);
    const immediate_return = ((cp - purchase_price) / purchase_price) * 100;
    return res.json({
      plan_type: 'ESPP',
      purchase_price: Math.round(purchase_price * 100) / 100,
      immediate_return_pct: Math.round(immediate_return * 100) / 100,
      recommendation: 'Max ESPP contribution; sell immediately to capture spread (subject to short-term tax).',
    });
  }
  if (b.plan_type === 'RSU') {
    // Simple vesting cliff handling
    const vest = b.vesting_schedule || { years: 4, cliff_years: 1 };
    const grant_value = Number(b.salary || 0) * 0.3;
    return res.json({
      plan_type: 'RSU',
      grant_value_estimate_usd: Math.round(grant_value),
      vesting: vest,
      recommendation: 'Diversify upon vesting; concentration in employer stock increases risk.',
    });
  }
  return res.status(400).json({ error: 'plan_type must be ESPP or RSU' });
});

module.exports = router;
