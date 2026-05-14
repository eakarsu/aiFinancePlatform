const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { callOpenRouter } = require('../services/openrouter');
const { parseAIJson } = require('../utils/parseAIJson');
const { aiRateLimiter } = require('../middleware/rateLimiter');


// GET /api/holdings — list user's holdings across all portfolios
router.get('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [holdings, total] = await Promise.all([
      prisma.holding.findMany({
        where: { portfolio: { userId: req.user.id } },
        include: { portfolio: { select: { id: true, name: true } } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.holding.count({ where: { portfolio: { userId: req.user.id } } }),
    ]);

    res.json({
      data: holdings,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Holdings list error:', error);
    res.status(500).json({ error: 'Failed to fetch holdings' });
  }
});

// POST /api/holdings/tax-loss-harvest — AI tax-loss harvesting recommendations
router.post('/tax-loss-harvest', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    // Fetch all user holdings with portfolio info
    const holdings = await prisma.holding.findMany({
      where: { portfolio: { userId: req.user.id } },
      include: { portfolio: { select: { id: true, name: true } } },
    });

    if (!holdings.length) {
      return res.status(400).json({ error: 'No holdings found. Please add holdings to your portfolios first.' });
    }

    // Identify unrealized losses (currentPrice < avgCost)
    const holdingsWithLosses = holdings.map(h => {
      const currentPrice = h.currentPrice || h.avgCost;
      const currentValue = h.shares * currentPrice;
      const costBasis = h.shares * h.avgCost;
      const unrealizedGainLoss = currentValue - costBasis;
      const unrealizedGainLossPct = costBasis > 0 ? (unrealizedGainLoss / costBasis) * 100 : 0;
      return {
        id: h.id,
        symbol: h.symbol,
        name: h.name,
        assetType: h.assetType,
        shares: h.shares,
        avgCost: h.avgCost,
        currentPrice,
        costBasis: parseFloat(costBasis.toFixed(2)),
        currentValue: parseFloat(currentValue.toFixed(2)),
        unrealizedGainLoss: parseFloat(unrealizedGainLoss.toFixed(2)),
        unrealizedGainLossPct: parseFloat(unrealizedGainLossPct.toFixed(2)),
        portfolioName: h.portfolio.name,
        hasLoss: unrealizedGainLoss < 0,
      };
    });

    const losingPositions = holdingsWithLosses.filter(h => h.hasLoss);
    const totalUnrealizedLoss = losingPositions.reduce((sum, h) => sum + h.unrealizedGainLoss, 0);

    // Call AI for recommendations
    const prompt = `You are a tax optimization expert. Analyze these investment holdings and identify wash-sale-safe tax-loss harvesting opportunities.

ALL HOLDINGS:
${JSON.stringify(holdingsWithLosses, null, 2)}

POSITIONS WITH UNREALIZED LOSSES (${losingPositions.length} positions, total loss: $${Math.abs(totalUnrealizedLoss).toFixed(2)}):
${JSON.stringify(losingPositions, null, 2)}

Respond ONLY with valid JSON in this format:
{
  "summary": {
    "totalUnrealizedLoss": ${parseFloat(Math.abs(totalUnrealizedLoss).toFixed(2))},
    "harvestablePositions": <number>,
    "estimatedTaxSavings": <number assuming 20% capital gains rate>,
    "recommendation": "brief overall recommendation"
  },
  "recommendations": [
    {
      "symbol": "ticker",
      "action": "SELL",
      "shares": <number>,
      "estimatedLoss": <dollar amount>,
      "replacementSecurity": "suggested ETF or similar security to maintain market exposure",
      "replacementReason": "why this replacement avoids wash sale rule",
      "washSaleSafeDate": "date after which original can be repurchased (30 days)",
      "priority": "HIGH|MEDIUM|LOW",
      "notes": "any specific caution or notes"
    }
  ],
  "taxStrategy": "overall multi-paragraph tax strategy narrative",
  "warnings": ["wash sale warnings or other cautions"],
  "disclaimer": "standard tax disclaimer"
}`;

    const aiResponse = await callOpenRouter(
      prompt,
      'You are a tax optimization expert specializing in tax-loss harvesting. Identify wash-sale-safe pairs from holdings and recommend trades to offset capital gains. Respond only with valid JSON.'
    );

    const recommendations = parseAIJson(aiResponse) || { raw: aiResponse };

    // Persist to AIAnalysisLog
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'tax_loss_harvest',
        userId: req.user.id,
        inputData: {
          totalHoldings: holdings.length,
          losingPositions: losingPositions.length,
          totalUnrealizedLoss,
        },
        outputData: recommendations,
        modelUsed: 'anthropic/claude-3-5-sonnet-20241022',
        confidence: 85,
      },
    });

    res.json({
      holdings: holdingsWithLosses,
      losingPositions,
      recommendations,
      poweredBy: 'OpenRouter AI',
    });
  } catch (error) {
    console.error('Tax-loss harvest error:', error);
    res.status(500).json({ error: 'Failed to generate tax-loss harvesting recommendations' });
  }
});

module.exports = router;
