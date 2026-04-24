const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { paginatedQuery, bulkDelete, bulkUpdate, handleExport } = require('../utils/queryHelpers');

// Repair truncated JSON by closing open brackets/braces
function repairJSON(str) {
  try {
    JSON.parse(str);
    return str;
  } catch (e) {
    let fixed = str.replace(/,\s*$/, '');
    const opens = { '{': 0, '[': 0 };
    const closes = { '}': '{', ']': '[' };
    let inString = false;
    let escape = false;
    for (const ch of fixed) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{' || ch === '[') opens[ch]++;
      if (ch === '}' || ch === ']') opens[closes[ch]]--;
    }
    if (inString) fixed += '"';
    for (let i = 0; i < opens['[']; i++) fixed += ']';
    for (let i = 0; i < opens['{']; i++) fixed += '}';
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');
    return fixed;
  }
}

// OpenRouter AI helper
async function callOpenRouter(prompt, systemPrompt = '') {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      max_tokens: 16000,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Get all crypto analyses
router.get('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { search } = req.query;
    const result = await paginatedQuery(prisma, 'cryptoAnalysis', {
      baseWhere: { userId: req.user.id },
      search,
      searchFields: ['symbol', 'name', 'aiRiskLevel', 'aiTrend'],
      query: req.query
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get crypto analyses' });
  }
});

// Bulk delete
router.post('/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkDelete(prisma, 'cryptoAnalysis', req.user.id, req.body.ids);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

// Bulk update
router.patch('/bulk-update', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkUpdate(prisma, 'cryptoAnalysis', req.user.id, req.body.ids, req.body.data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

// Export
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await handleExport(res, prisma, 'cryptoAnalysis', req.user.id, req.query, 'Crypto Analysis', ['symbol', 'name', 'currentPrice', 'priceChange24h', 'priceChange7d', 'marketCap', 'aiScore', 'aiRiskLevel', 'aiTrend']);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get single crypto
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const crypto = await prisma.cryptoAnalysis.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!crypto) return res.status(404).json({ error: 'Crypto not found' });
    res.json(crypto);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get crypto' });
  }
});

// Add crypto to track
router.post('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { symbol, name, currentPrice, priceChange24h, priceChange7d, marketCap,
            volume24h, circulatingSupply, totalSupply, allTimeHigh, allTimeLow } = req.body;

    const crypto = await prisma.cryptoAnalysis.create({
      data: {
        userId: req.user.id,
        symbol: symbol.toUpperCase(),
        name,
        currentPrice,
        priceChange24h,
        priceChange7d,
        marketCap,
        volume24h,
        circulatingSupply,
        totalSupply,
        allTimeHigh,
        allTimeLow
      }
    });

    res.json(crypto);
  } catch (error) {
    console.error('Add crypto error:', error);
    res.status(500).json({ error: 'Failed to add crypto' });
  }
});

// Update crypto
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const crypto = await prisma.cryptoAnalysis.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: req.body
    });
    if (crypto.count === 0) return res.status(404).json({ error: 'Crypto not found' });

    const updated = await prisma.cryptoAnalysis.findFirst({
      where: { id: req.params.id }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update crypto' });
  }
});

// Delete crypto
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await prisma.cryptoAnalysis.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete crypto' });
  }
});

// AI Analyze crypto
router.post('/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const crypto = await prisma.cryptoAnalysis.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!crypto) return res.status(404).json({ error: 'Crypto not found' });

    const prompt = `Analyze this cryptocurrency and provide investment insights:

CRYPTO DATA:
- Symbol: ${crypto.symbol}
- Name: ${crypto.name}
- Current Price: $${crypto.currentPrice || 'N/A'}
- 24h Change: ${crypto.priceChange24h ? crypto.priceChange24h + '%' : 'N/A'}
- 7d Change: ${crypto.priceChange7d ? crypto.priceChange7d + '%' : 'N/A'}
- Market Cap: $${crypto.marketCap?.toLocaleString() || 'N/A'}
- 24h Volume: $${crypto.volume24h?.toLocaleString() || 'N/A'}
- Circulating Supply: ${crypto.circulatingSupply?.toLocaleString() || 'N/A'}
- Total Supply: ${crypto.totalSupply?.toLocaleString() || 'N/A'}
- All Time High: $${crypto.allTimeHigh || 'N/A'}
- All Time Low: $${crypto.allTimeLow || 'N/A'}

Provide analysis in this JSON format:
{
  "aiScore": 65,
  "aiRiskLevel": "low|medium|high|very_high",
  "aiTrend": "bullish|bearish|neutral|volatile",
  "analysis": {
    "summary": "Brief 2-3 sentence summary",
    "marketPosition": "Assessment of market position",
    "fundamentals": {
      "technology": "Technology assessment",
      "adoption": "Adoption and use cases",
      "team": "Team and development activity",
      "tokenomics": "Token economics assessment"
    },
    "technicalIndicators": {
      "trend": "Current trend direction",
      "support": "Key support levels",
      "resistance": "Key resistance levels",
      "volumeAnalysis": "Volume trend assessment"
    },
    "risks": ["risk 1", "risk 2", "risk 3"],
    "opportunities": ["opportunity 1", "opportunity 2"]
  },
  "pricePrediction": {
    "shortTerm": {"low": 45000, "high": 55000, "timeframe": "1 month"},
    "mediumTerm": {"low": 40000, "high": 70000, "timeframe": "6 months"},
    "longTerm": {"low": 35000, "high": 100000, "timeframe": "1 year"}
  }
}`;

    const aiResponse = await callOpenRouter(prompt, 'You are an expert cryptocurrency analyst. Respond only with valid JSON.');
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let analysis = null;
    if (jsonMatch) {
      try {
        analysis = JSON.parse(repairJSON(jsonMatch[0]));
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }

      await prisma.cryptoAnalysis.update({
        where: { id: crypto.id },
        data: {
          aiScore: analysis.aiScore,
          aiRiskLevel: analysis.aiRiskLevel,
          aiTrend: analysis.aiTrend,
          aiAnalysis: analysis.analysis,
          aiPricePrediction: analysis.pricePrediction
        }
      });
    }

    // Log the analysis
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'crypto_analyzer',
        userId: req.user.id,
        inputData: { crypto },
        outputData: { analysis },
        modelUsed: process.env.OPENROUTER_MODEL || 'openrouter',
        confidence: analysis?.aiScore || 0
      }
    });

    res.json({ crypto, analysis, poweredBy: 'OpenRouter AI' });
  } catch (error) {
    console.error('Crypto analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze crypto: ' + error.message });
  }
});

// Toggle tracking
router.patch('/:id/track', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const crypto = await prisma.cryptoAnalysis.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!crypto) return res.status(404).json({ error: 'Crypto not found' });

    const updated = await prisma.cryptoAnalysis.update({
      where: { id: crypto.id },
      data: { isTracked: !crypto.isTracked }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update tracking' });
  }
});

// AI Analyze all cryptos - rank by profit potential
router.post('/analyze-all', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const cryptos = await prisma.cryptoAnalysis.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });

    if (cryptos.length === 0) {
      return res.status(400).json({ error: 'No cryptos to analyze' });
    }

    const cryptosSummary = cryptos.map(c => ({
      symbol: c.symbol,
      name: c.name,
      currentPrice: c.currentPrice,
      priceChange24h: c.priceChange24h,
      priceChange7d: c.priceChange7d,
      marketCap: c.marketCap,
      volume24h: c.volume24h,
      allTimeHigh: c.allTimeHigh,
      allTimeLow: c.allTimeLow
    }));

    const cryptoCount = cryptosSummary.length;
    const prompt = `Analyze these ${cryptoCount} cryptos using 5 strategies (each 20pts, total 100):
1. MARKET POSITION (market cap rank, adoption, network effect)
2. MOMENTUM (24h/7d change, distance from ATH, volume)
3. TOKENOMICS (supply ratio, scarcity, inflation)
4. RISK (volatility, floor support, regulatory)
5. UPSIDE (ATH recovery room, catalysts, growth potential)

CRYPTOS: ${JSON.stringify(cryptosSummary)}

RULES:
- Rank ALL cryptos by total score
- Keep each "reason" field under 15 words
- Be honest about risks

Respond ONLY with this JSON (no markdown, no explanation):
{"methodology":"5-strategy scoring: Market Position, Momentum, Tokenomics, Risk, Upside (20pts each)","overallScore":70,"marketSentiment":"1 sentence market context","rankings":[{"rank":1,"symbol":"BTC","name":"Bitcoin","totalScore":82,"scoreBreakdown":{"marketPosition":{"score":20,"reason":"#1 market cap, strongest network"},"momentum":{"score":14,"reason":"+2.5% 24h, 30% below ATH"},"tokenomics":{"score":18,"reason":"Fixed 21M supply, halving"},"riskLevel":{"score":16,"reason":"Moderate volatility, strong floor"},"upside":{"score":14,"reason":"30% ATH recovery room"}},"recommendation":"buy","upsidePotential":"30%","riskLevel":"medium","keyInsight":"Dominant position offsets moderate upside"}],"portfolioInsights":{"diversification":"Assessment","overallRisk":"Level with reason","correlations":"BTC correlation note","suggestions":["suggestion"]},"actionItems":[{"action":"Buy","symbol":"BTC","reason":"reason","urgency":"medium"}]}`;

    const aiResponse = await callOpenRouter(prompt, 'You are a senior crypto analyst. Apply rigorous analysis. Show your work. Respond only with valid JSON.');
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let analysis = null;
    if (jsonMatch) {
      try {
        const repaired = repairJSON(jsonMatch[0]);
        analysis = JSON.parse(repaired);
      } catch (parseErr) {
        console.error('Crypto portfolio JSON parse error, using fallback');
        analysis = {
          overallScore: 50,
          methodology: 'Analysis could not be fully parsed. Please try again with fewer cryptos.',
          marketSentiment: 'AI response was too large to parse. Try analyzing fewer cryptos at once.',
          rankings: [],
          portfolioInsights: { diversification: 'N/A', overallRisk: 'N/A', suggestions: ['Try analyzing fewer cryptos for detailed results'] },
          actionItems: []
        };
      }
    }

    await prisma.aIAnalysisLog.create({
      data: {
        module: 'crypto_analyzer_portfolio',
        userId: req.user.id,
        inputData: { cryptos: cryptosSummary },
        outputData: { analysis },
        modelUsed: process.env.OPENROUTER_MODEL || 'openrouter',
        confidence: analysis?.overallScore || 0
      }
    });

    res.json({
      cryptos: cryptosSummary,
      analysis,
      poweredBy: 'OpenRouter AI'
    });
  } catch (error) {
    console.error('Crypto portfolio analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze cryptos: ' + error.message });
  }
});

module.exports = router;
