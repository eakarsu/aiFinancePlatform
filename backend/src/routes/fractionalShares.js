// Fractional shares: lower diversification barrier.
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// POST /api/fractional-shares/quote { ticker, dollars }
router.post('/quote', authenticateToken, async (req, res) => {
  try {
    const { ticker, dollars } = req.body || {};
    if (!ticker || !dollars) return res.status(400).json({ error: 'ticker + dollars required' });
    // TODO: configure credentials — ALPACA_API_KEY / FINNHUB_API_KEY
    const finnhubKey = process.env.FINNHUB_API_KEY;
    let price = null;
    if (finnhubKey) {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${finnhubKey}`);
      if (r.ok) { const j = await r.json(); price = j.c; }
    }
    if (!price) return res.status(503).json({ error: 'FINNHUB_API_KEY missing' });
    const shares = Number(dollars) / price;
    return res.json({ ticker, dollars: Number(dollars), price, fractional_shares: Math.round(shares * 1000000) / 1000000 });
  } catch (e) {
    return res.status(500).json({ error: 'quote failed' });
  }
});

// POST /api/fractional-shares/order { ticker, dollars, side: 'buy'|'sell' }
router.post('/order', authenticateToken, async (req, res) => {
  // TODO: configure credentials — ALPACA_API_KEY for live orders
  return res.json({ accepted: false, note: 'ALPACA_API_KEY missing — order not routed', request: req.body });
});

module.exports = router;
