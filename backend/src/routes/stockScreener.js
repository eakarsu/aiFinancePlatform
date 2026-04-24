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

// Get all screened stocks
router.get('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { search } = req.query;
    const result = await paginatedQuery(prisma, 'stockScreener', {
      baseWhere: { userId: req.user.id },
      search,
      searchFields: ['symbol', 'companyName', 'sector', 'industry', 'analystRating'],
      query: req.query
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stocks' });
  }
});

// Bulk delete
router.post('/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkDelete(prisma, 'stockScreener', req.user.id, req.body.ids);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

// Bulk update
router.patch('/bulk-update', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkUpdate(prisma, 'stockScreener', req.user.id, req.body.ids, req.body.data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

// Export
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await handleExport(res, prisma, 'stockScreener', req.user.id, req.query, 'Stock Screener', ['symbol', 'companyName', 'sector', 'industry', 'currentPrice', 'targetPrice', 'peRatio', 'eps', 'aiScore', 'aiRecommendation']);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get single stock
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const stock = await prisma.stockScreener.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!stock) return res.status(404).json({ error: 'Stock not found' });
    res.json(stock);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stock' });
  }
});

// Add new stock to screener
router.post('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { symbol, companyName, sector, industry, marketCap, peRatio, pbRatio,
            dividendYield, eps, revenueGrowth, profitMargin, debtToEquity,
            currentPrice, targetPrice, analystRating } = req.body;

    const stock = await prisma.stockScreener.create({
      data: {
        userId: req.user.id,
        symbol: symbol.toUpperCase(),
        companyName,
        sector,
        industry,
        marketCap,
        peRatio,
        pbRatio,
        dividendYield,
        eps,
        revenueGrowth,
        profitMargin,
        debtToEquity,
        currentPrice,
        targetPrice,
        analystRating
      }
    });

    res.json(stock);
  } catch (error) {
    console.error('Add stock error:', error);
    res.status(500).json({ error: 'Failed to add stock' });
  }
});

// Update stock
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const stock = await prisma.stockScreener.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: req.body
    });
    if (stock.count === 0) return res.status(404).json({ error: 'Stock not found' });

    const updated = await prisma.stockScreener.findFirst({
      where: { id: req.params.id }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// Delete stock
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await prisma.stockScreener.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete stock' });
  }
});

// AI Analyze stock
router.post('/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const stock = await prisma.stockScreener.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    const prompt = `Analyze this stock and provide investment insights:

STOCK DATA:
- Symbol: ${stock.symbol}
- Company: ${stock.companyName}
- Sector: ${stock.sector || 'N/A'}
- Industry: ${stock.industry || 'N/A'}
- Market Cap: $${stock.marketCap?.toLocaleString() || 'N/A'}
- Current Price: $${stock.currentPrice || 'N/A'}
- Target Price: $${stock.targetPrice || 'N/A'}
- P/E Ratio: ${stock.peRatio || 'N/A'}
- P/B Ratio: ${stock.pbRatio || 'N/A'}
- Dividend Yield: ${stock.dividendYield ? stock.dividendYield + '%' : 'N/A'}
- EPS: $${stock.eps || 'N/A'}
- Revenue Growth: ${stock.revenueGrowth ? stock.revenueGrowth + '%' : 'N/A'}
- Profit Margin: ${stock.profitMargin ? stock.profitMargin + '%' : 'N/A'}
- Debt to Equity: ${stock.debtToEquity || 'N/A'}
- Analyst Rating: ${stock.analystRating || 'N/A'}

Provide analysis in this JSON format:
{
  "aiScore": 75,
  "aiSentiment": "bullish|bearish|neutral",
  "aiRecommendation": "strong_buy|buy|hold|sell|strong_sell",
  "analysis": {
    "summary": "Brief 2-3 sentence summary",
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "weaknesses": ["weakness 1", "weakness 2"],
    "technicalAnalysis": "Technical outlook assessment",
    "fundamentalAnalysis": "Fundamental outlook assessment",
    "riskLevel": "low|medium|high",
    "catalysts": ["potential catalyst 1", "potential catalyst 2"],
    "priceTarget": {
      "bearCase": 100,
      "baseCase": 120,
      "bullCase": 150
    },
    "timeframe": "Short-term or long-term outlook",
    "sectorOutlook": "Industry/sector assessment"
  }
}`;

    const aiResponse = await callOpenRouter(prompt, 'You are an expert stock analyst. Respond only with valid JSON.');
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let analysis = null;
    if (jsonMatch) {
      try {
        const repaired = repairJSON(jsonMatch[0]);
        analysis = JSON.parse(repaired);
      } catch (parseErr) {
        console.error('Stock analysis JSON parse error, using fallback');
        analysis = {
          aiScore: 50,
          aiSentiment: 'neutral',
          aiRecommendation: 'hold',
          analysis: { summary: aiResponse.replace(/```json?|```/g, '').trim() }
        };
      }

      await prisma.stockScreener.update({
        where: { id: stock.id },
        data: {
          aiScore: analysis.aiScore,
          aiSentiment: analysis.aiSentiment,
          aiRecommendation: analysis.aiRecommendation,
          aiAnalysis: analysis.analysis
        }
      });
    }

    // Log the analysis
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'stock_screener',
        userId: req.user.id,
        inputData: { stock },
        outputData: { analysis },
        modelUsed: process.env.OPENROUTER_MODEL || 'openrouter',
        confidence: analysis?.aiScore || 0
      }
    });

    res.json({ stock, analysis, poweredBy: 'OpenRouter AI' });
  } catch (error) {
    console.error('Stock analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze stock: ' + error.message });
  }
});

// Toggle watchlist
router.patch('/:id/watchlist', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const stock = await prisma.stockScreener.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!stock) return res.status(404).json({ error: 'Stock not found' });

    const updated = await prisma.stockScreener.update({
      where: { id: stock.id },
      data: { isWatchlisted: !stock.isWatchlisted }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update watchlist' });
  }
});

// AI Analyze all stocks - rank by profitability
router.post('/analyze-all', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const stocks = await prisma.stockScreener.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });

    if (stocks.length === 0) {
      return res.status(400).json({ error: 'No stocks to analyze' });
    }

    const stocksSummary = stocks.map(s => ({
      symbol: s.symbol,
      company: s.companyName,
      sector: s.sector,
      currentPrice: s.currentPrice,
      targetPrice: s.targetPrice,
      peRatio: s.peRatio,
      pbRatio: s.pbRatio,
      eps: s.eps,
      dividendYield: s.dividendYield,
      revenueGrowth: s.revenueGrowth,
      profitMargin: s.profitMargin,
      debtToEquity: s.debtToEquity,
      marketCap: s.marketCap
    }));

    const stockCount = stocksSummary.length;
    const prompt = `Analyze these ${stockCount} stocks using 5 strategies (each 20pts, total 100):
1. VALUE (P/E, P/B, intrinsic value)
2. GROWTH (revenue growth, EPS, PEG ratio)
3. QUALITY (profit margin, ROE)
4. HEALTH (debt-to-equity, cash flow)
5. MOMENTUM (price vs target, dividend yield)

STOCKS: ${JSON.stringify(stocksSummary)}

RULES:
- Rank ALL stocks by total score
- Keep each "reason" field under 15 words
- Be honest about missing data

Respond ONLY with this JSON (no markdown, no explanation):
{"methodology":"5-strategy scoring: Value, Growth, Quality, Health, Momentum (20pts each)","overallScore":75,"marketOutlook":"1 sentence market context","rankings":[{"rank":1,"symbol":"AAPL","company":"Apple","totalScore":82,"scoreBreakdown":{"valueScore":{"score":14,"reason":"P/E 28 above avg"},"growthScore":{"score":16,"reason":"8% rev growth, EPS $6.50"},"qualityScore":{"score":18,"reason":"25% margin excellent"},"healthScore":{"score":18,"reason":"D/E 1.5 manageable"},"momentumScore":{"score":16,"reason":"12% upside to target"}},"recommendation":"buy","upsidePotential":"15%","riskLevel":"medium","keyInsight":"Strong quality offsets high valuation"}],"sectorAnalysis":[{"sector":"Technology","outlook":"Brief outlook","bestPick":"AAPL"}],"portfolioInsights":{"diversification":"Assessment","overallRisk":"Level with reason","suggestions":["suggestion"]},"actionItems":[{"action":"Buy","symbol":"AAPL","reason":"reason","urgency":"medium"}]}`;

    const aiResponse = await callOpenRouter(prompt, 'You are a CFA-certified equity analyst. Apply rigorous financial analysis. Show your work. Respond only with valid JSON.');
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let analysis = null;
    if (jsonMatch) {
      try {
        const repaired = repairJSON(jsonMatch[0]);
        analysis = JSON.parse(repaired);
      } catch (parseErr) {
        console.error('Stock portfolio JSON parse error:', parseErr.message);
        console.error('AI response length:', aiResponse.length);
        console.error('AI response first 500 chars:', aiResponse.substring(0, 500));
        analysis = {
          overallScore: 50,
          methodology: 'Analysis could not be fully parsed. Please try again with fewer stocks.',
          marketOutlook: 'AI response was too large to parse. Try analyzing fewer stocks at once.',
          rankings: [],
          sectorAnalysis: [],
          portfolioInsights: { diversification: 'N/A', overallRisk: 'N/A', suggestions: ['Try analyzing fewer stocks for detailed results'] },
          actionItems: []
        };
      }
    }

    await prisma.aIAnalysisLog.create({
      data: {
        module: 'stock_screener_portfolio',
        userId: req.user.id,
        inputData: { stocks: stocksSummary },
        outputData: { analysis },
        modelUsed: process.env.OPENROUTER_MODEL || 'openrouter',
        confidence: analysis?.overallScore || 0
      }
    });

    res.json({
      stocks: stocksSummary,
      analysis,
      poweredBy: 'OpenRouter AI'
    });
  } catch (error) {
    console.error('Stock portfolio analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze stocks: ' + error.message });
  }
});

module.exports = router;
