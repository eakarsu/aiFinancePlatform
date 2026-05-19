const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { callOpenRouter } = require('../services/openrouter');
const { parseAIJson } = require('../utils/parseAIJson');
const { aiRateLimiter } = require('../middleware/rateLimiter');


// POST /api/portfolio/behavioral-analysis — behavioral finance nudges
router.post('/behavioral-analysis', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    // Fetch user's transaction history for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [transactions, riskProfile, portfolios] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId: req.user.id,
          createdAt: { gte: thirtyDaysAgo },
          type: { in: ['BUY', 'SELL', 'PURCHASE', 'DEPOSIT', 'WITHDRAWAL'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.riskProfile.findUnique({ where: { userId: req.user.id } }),
      prisma.portfolio.findMany({
        where: { userId: req.user.id },
        include: { holdings: true },
      }),
    ]);

    if (!transactions.length) {
      return res.status(400).json({
        error: 'No recent transactions found. Make some trades first to enable behavioral analysis.',
      });
    }

    // Summarize trading patterns
    const buys = transactions.filter(t => ['BUY', 'DEPOSIT'].includes(t.type));
    const sells = transactions.filter(t => ['SELL', 'WITHDRAWAL'].includes(t.type));
    const totalVolume = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Compute concentration: check if any single holding > 30% of total portfolio value
    const totalPortfolioValue = portfolios.reduce((sum, p) => sum + (p.totalValue || 0), 0);
    const allHoldings = portfolios.flatMap(p => p.holdings);
    const maxHoldingValue = allHoldings.reduce((max, h) => {
      const val = h.shares * (h.currentPrice || h.avgCost);
      return val > max ? val : max;
    }, 0);
    const concentrationPct = totalPortfolioValue > 0 ? (maxHoldingValue / totalPortfolioValue) * 100 : 0;

    const prompt = `Analyze this trading pattern for behavioral finance red flags and provide personalized coaching.

TRADING ACTIVITY (Last 30 Days):
- Total transactions: ${transactions.length}
- Buy transactions: ${buys.length}
- Sell transactions: ${sells.length}
- Total trading volume: $${totalVolume.toFixed(2)}
- Buy/Sell ratio: ${sells.length > 0 ? (buys.length / sells.length).toFixed(2) : 'No sells'}
- Average transaction frequency: ${(transactions.length / 30).toFixed(2)} trades/day

PORTFOLIO CONTEXT:
- Total portfolio value: $${totalPortfolioValue.toFixed(2)}
- Number of portfolios: ${portfolios.length}
- Total holdings: ${allHoldings.length}
- Largest single position: ${concentrationPct.toFixed(1)}% of portfolio
- Risk tolerance: ${riskProfile?.riskTolerance || 'Unknown'}
- Investment goal: ${riskProfile?.investmentGoal || 'Unknown'}
- Time horizon: ${riskProfile?.timeHorizon || 'Unknown'} years

RECENT TRANSACTION SAMPLE (up to 20):
${JSON.stringify(
  transactions.slice(0, 20).map(t => ({
    type: t.type,
    amount: t.amount,
    merchant: t.merchant,
    category: t.category,
    date: t.createdAt,
  })),
  null,
  2
)}

Analyze for these behavioral finance red flags:
1. Panic selling (many sells during market turbulence)
2. Over-trading (excessive transaction frequency)
3. Recency bias (over-reacting to recent performance)
4. Over-concentration (>30% in one position)
5. Herd mentality
6. Disposition effect (selling winners too early, holding losers too long)

Respond ONLY with valid JSON:
{
  "behavioralScore": <integer 1-10, where 10 is excellent discipline>,
  "scoreExplanation": "1-2 sentence explanation of the score",
  "redFlagsDetected": ["flag1", "flag2"],
  "coachingMessage": "personalized 3-4 sentence coaching message addressing the user's specific patterns",
  "nudges": [
    {
      "type": "warning|suggestion|encouragement",
      "title": "nudge title",
      "message": "specific actionable advice",
      "priority": "HIGH|MEDIUM|LOW"
    }
  ],
  "strengths": ["positive behavior 1", "positive behavior 2"],
  "actionPlan": ["concrete step 1", "concrete step 2", "concrete step 3"],
  "nextReviewDate": "suggested date for next behavioral review (30 days from now)"
}`;

    const aiResponse = await callOpenRouter(
      prompt,
      'You are a behavioral finance coach. Analyze trading patterns for psychological biases and provide warm, constructive coaching. Respond only with valid JSON.'
    );

    const analysis = parseAIJson(aiResponse) || { raw: aiResponse };

    // Persist to AIAnalysisLog
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'behavioral_analysis',
        userId: req.user.id,
        inputData: {
          transactionCount: transactions.length,
          buys: buys.length,
          sells: sells.length,
          totalVolume,
          concentrationPct,
          portfolioValue: totalPortfolioValue,
        },
        outputData: analysis,
        modelUsed: 'anthropic/claude-3-5-sonnet-20241022',
        confidence: 80,
      },
    });

    res.json({
      period: { from: thirtyDaysAgo, to: new Date() },
      tradingStats: {
        totalTransactions: transactions.length,
        buys: buys.length,
        sells: sells.length,
        totalVolume,
        concentrationPct: parseFloat(concentrationPct.toFixed(1)),
      },
      analysis,
      poweredBy: 'OpenRouter AI',
    });
  } catch (error) {
    console.error('Behavioral analysis error:', error);
    res.status(500).json({ error: 'Failed to generate behavioral analysis' });
  }
});

module.exports = router;
