// Behavioural coaching: nudges against emotional trades.
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// POST /api/behavioral-coaching/check { signal: { recent_trades:N, market_change_24h_pct, mood?:'fear'|'greed' } }
router.post('/check', authenticateToken, (req, res) => {
  const s = req.body?.signal || {};
  const nudges = [];
  if (Number(s.recent_trades) > 5 && Math.abs(Number(s.market_change_24h_pct)) > 3) {
    nudges.push({ severity: 'high', message: 'High trading activity during volatile session — pause for 24h before further changes.' });
  }
  if (s.mood === 'fear' && Number(s.market_change_24h_pct) < -2) {
    nudges.push({ severity: 'medium', message: 'Selling during a downturn locks in losses. Review long-term plan first.' });
  }
  if (s.mood === 'greed' && Number(s.market_change_24h_pct) > 5) {
    nudges.push({ severity: 'medium', message: 'Chasing returns increases risk. Stick to allocation targets.' });
  }
  return res.json({ signal: s, nudges });
});

module.exports = router;
