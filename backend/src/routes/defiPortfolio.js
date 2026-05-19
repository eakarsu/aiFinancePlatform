// DeFi portfolio: yield-farming + on-chain holdings.
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// GET /api/defi-portfolio/wallet?address=0x...
router.get('/wallet', authenticateToken, async (req, res) => {
  try {
    const address = req.query.address;
    if (!address) return res.status(400).json({ error: 'address required' });
    // TODO: configure credentials — DEBANK_API_KEY or ZAPPER_API_KEY
    const key = process.env.DEBANK_API_KEY || process.env.ZAPPER_API_KEY;
    if (!key) return res.status(503).json({ error: 'DEBANK_API_KEY/ZAPPER_API_KEY missing' });
    if (process.env.DEBANK_API_KEY) {
      const r = await fetch(`https://pro-openapi.debank.com/v1/user/all_token_list?id=${address}`, {
        headers: { AccessKey: process.env.DEBANK_API_KEY },
      });
      if (!r.ok) return res.status(502).json({ error: 'DeBank fetch failed', status: r.status });
      const data = await r.json();
      return res.json({ address, tokens: data });
    }
    return res.json({ address, note: 'Zapper integration stub' });
  } catch (e) {
    return res.status(500).json({ error: 'wallet failed' });
  }
});

module.exports = router;
