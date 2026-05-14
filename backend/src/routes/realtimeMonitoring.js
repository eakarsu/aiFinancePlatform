// Real-time monitoring: stream market, auto-execute TLH and rebalance.
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
// POST /api/realtime-monitoring/tick { quotes:{ticker: price}, holdings:[{id,ticker,qty,cost_basis}] } — receives a market tick + caller holdings snapshot
router.post('/tick', authenticateToken, async (req, res) => {
  try {
    const { quotes = {}, holdings = [] } = req.body || {};
    const tickers = Object.keys(quotes);
    if (!tickers.length) return res.status(400).json({ error: 'quotes required' });

    const triggers = [];
    for (const h of holdings) {
      const px = Number(quotes[h.ticker]);
      const cost = Number(h.cost_basis);
      if (!px || !cost) continue;
      const lossPct = ((cost - px) / cost) * 100;
      if (lossPct > 5) triggers.push({ holding_id: h.id, ticker: h.ticker, action: 'tax_loss_harvest', loss_pct: Math.round(lossPct * 100) / 100 });
      if (lossPct < -15) triggers.push({ holding_id: h.id, ticker: h.ticker, action: 'rebalance_trim', gain_pct: Math.round(-lossPct * 100) / 100 });
    }
    return res.json({ tickers, triggers });
  } catch (e) {
    return res.status(500).json({ error: 'tick failed' });
  }
});

module.exports = router;
