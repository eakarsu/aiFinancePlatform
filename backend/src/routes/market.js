const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getQuote, getBatchQuotes } = require('../services/marketData');

// GET /api/market/quote/:symbol — real-time price, change, volume
router.get('/quote/:symbol', authenticateToken, async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase().replace(/[^A-Z0-9.]/g, '');
    if (!symbol) return res.status(400).json({ error: 'Invalid symbol' });

    const quote = await getQuote(symbol);
    res.json(quote);
  } catch (error) {
    console.error('Market quote error:', error.message);
    res.status(502).json({ error: `Failed to fetch quote: ${error.message}` });
  }
});

// POST /api/market/quotes — batch quote fetch for multiple symbols
router.post('/quotes', authenticateToken, async (req, res) => {
  try {
    const { symbols } = req.body;
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'symbols array is required' });
    }
    if (symbols.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 symbols per request' });
    }

    const cleanSymbols = symbols.map(s => String(s).toUpperCase().replace(/[^A-Z0-9.]/g, '')).filter(Boolean);
    const quotes = await getBatchQuotes(cleanSymbols);
    res.json({ quotes, count: quotes.length });
  } catch (error) {
    console.error('Batch quotes error:', error.message);
    res.status(502).json({ error: `Failed to fetch quotes: ${error.message}` });
  }
});

module.exports = router;
