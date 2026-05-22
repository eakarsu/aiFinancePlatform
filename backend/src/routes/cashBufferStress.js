const router = require('express').Router();

router.post('/score', (req, res) => {
  const { cashBalance = 0, monthlyBurn = 1, incomeVolatilityPct = 0, emergencyExpenses = 0 } = req.body || {};
  const months = Number(cashBalance) / Math.max(1, Number(monthlyBurn) + Number(emergencyExpenses) / 6);
  const score = Math.max(0, Math.min(100, Math.round(100 - months * 12 + Number(incomeVolatilityPct) * 0.4)));
  res.json({
    feature: 'cash_buffer_stress',
    score,
    months: Math.round(months * 10) / 10,
    level: score >= 70 ? 'underfunded' : score >= 35 ? 'watch' : 'resilient',
    actions: [
      months < 3 && 'Prioritize cash reserve before discretionary investing.',
      Number(incomeVolatilityPct) > 30 && 'Use larger reserve target due to income volatility.',
      Number(emergencyExpenses) > 0 && 'Model emergency expense reserve separately from monthly burn.',
    ].filter(Boolean),
  });
});

module.exports = router;
