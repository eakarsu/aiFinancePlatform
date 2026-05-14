// ESG screening: filter by ESG scores, impact tracking.
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Rough hard-coded MSCI-style ESG ratings sample
const ESG = {
  AAPL: { e: 7.2, s: 6.5, g: 8.0, rating: 'AA' },
  MSFT: { e: 8.5, s: 7.8, g: 8.5, rating: 'AAA' },
  XOM: { e: 3.5, s: 5.2, g: 6.0, rating: 'BB' },
  TSLA: { e: 7.8, s: 4.2, g: 5.0, rating: 'A' },
};

// POST /api/esg-screening/screen { holdings:[{ticker,qty}], min_rating }
router.post('/screen', authenticateToken, (req, res) => {
  const { holdings = [], min_rating = 'A' } = req.body || {};
  const order = ['CCC', 'B', 'BB', 'BBB', 'A', 'AA', 'AAA'];
  const min = order.indexOf(min_rating);
  const screened = holdings.map(h => {
    const e = ESG[h.ticker] || null;
    return {
      ticker: h.ticker,
      qty: h.qty,
      esg: e,
      passes: e ? order.indexOf(e.rating) >= min : false,
    };
  });
  return res.json({ min_rating, count: screened.length, results: screened });
});

module.exports = router;
