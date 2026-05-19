const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { callOpenRouter } = require('../services/openrouter');
const { parseAIJson } = require('../utils/parseAIJson');
const { aiRateLimiter } = require('../middleware/rateLimiter');


// POST /api/insights/generate — weekly financial health summary
router.post('/generate', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    // Fetch all user data in parallel
    const [portfolios, goals, budgetPlans, riskProfile, recentTransactions] = await Promise.all([
      prisma.portfolio.findMany({
        where: { userId: req.user.id },
        include: { holdings: true },
      }),
      prisma.financialGoal.findMany({
        where: { userId: req.user.id },
        orderBy: { priority: 'asc' },
      }),
      prisma.budgetPlan.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      prisma.riskProfile.findUnique({ where: { userId: req.user.id } }),
      prisma.transaction.findMany({
        where: {
          userId: req.user.id,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    // Aggregate portfolio stats
    const totalPortfolioValue = portfolios.reduce((sum, p) => sum + (p.totalValue || 0), 0);
    const totalCash = portfolios.reduce((sum, p) => sum + (p.cashBalance || 0), 0);
    const holdingsCount = portfolios.reduce((sum, p) => sum + p.holdings.length, 0);

    // Goal progress
    const goalSummary = goals.map(g => ({
      name: g.name,
      category: g.category,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      progressPct: g.targetAmount > 0 ? ((g.currentAmount / g.targetAmount) * 100).toFixed(1) : 0,
      deadline: g.deadline,
      priority: g.priority,
    }));

    // Budget summary
    const latestBudget = budgetPlans[0] || null;

    // Transaction summary
    const weekSpend = recentTransactions
      .filter(t => ['PURCHASE', 'WITHDRAWAL'].includes(t.type))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const weekIncome = recentTransactions
      .filter(t => ['DEPOSIT'].includes(t.type))
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const prompt = `Generate a comprehensive weekly financial health summary for this user.

PORTFOLIO OVERVIEW:
- Total portfolio value: $${totalPortfolioValue.toFixed(2)}
- Cash balance: $${totalCash.toFixed(2)}
- Number of portfolios: ${portfolios.length}
- Total holdings: ${holdingsCount}
- Risk profile: ${riskProfile?.riskTolerance || 'Not set'} / ${riskProfile?.investmentGoal || 'Not set'}
- Time horizon: ${riskProfile?.timeHorizon || 'Not set'} years

FINANCIAL GOALS (${goals.length} total):
${JSON.stringify(goalSummary, null, 2)}

BUDGET HEALTH:
${latestBudget ? JSON.stringify({
  name: latestBudget.name,
  period: latestBudget.period,
  totalIncome: latestBudget.totalIncome,
  totalBudget: latestBudget.totalBudget,
  aiHealthScore: latestBudget.aiHealthScore,
}, null, 2) : 'No budget plans set up'}

WEEK ACTIVITY:
- Transactions this week: ${recentTransactions.length}
- Week spending: $${weekSpend.toFixed(2)}
- Week income: $${weekIncome.toFixed(2)}
- Net: $${(weekIncome - weekSpend).toFixed(2)}

Respond ONLY with valid JSON:
{
  "overallHealthScore": <integer 1-100>,
  "healthGrade": "A|B|C|D|F",
  "headline": "one sentence describing the user's financial week",
  "summary": "2-3 paragraph comprehensive financial health narrative",
  "highlights": [
    {"type": "positive|warning|neutral", "title": "...", "detail": "..."}
  ],
  "portfolioInsight": "2-3 sentences on portfolio performance and positioning",
  "goalProgress": "summary of goal progress and which goals need attention",
  "budgetInsight": "spending pattern insight for the week",
  "priorityActions": [
    {"action": "specific action", "urgency": "HIGH|MEDIUM|LOW", "impact": "expected outcome"}
  ],
  "weeklyFocus": "one specific thing to focus on this week",
  "nextWeekOutlook": "brief outlook for the coming week"
}`;

    const aiResponse = await callOpenRouter(
      prompt,
      'You are a personal financial health advisor. Provide a warm, encouraging, yet honest weekly financial health summary. Focus on actionable insights. Respond only with valid JSON.'
    );

    const summary = parseAIJson(aiResponse) || { raw: aiResponse };

    // Save to AIAnalysisLog with feature tag
    const log = await prisma.aIAnalysisLog.create({
      data: {
        module: 'weekly_health_summary',
        userId: req.user.id,
        inputData: {
          totalPortfolioValue,
          totalCash,
          portfolioCount: portfolios.length,
          holdingsCount,
          goalCount: goals.length,
          weekTransactions: recentTransactions.length,
          weekSpend,
          weekIncome,
        },
        outputData: summary,
        modelUsed: 'anthropic/claude-3-5-sonnet-20241022',
        confidence: 88,
      },
    });

    res.json({
      logId: log.id,
      generatedAt: new Date(),
      feature: 'weekly_health_summary',
      summary,
      dataSnapshot: {
        totalPortfolioValue,
        portfolios: portfolios.length,
        goals: goals.length,
        weekTransactions: recentTransactions.length,
      },
      poweredBy: 'OpenRouter AI',
    });
  } catch (error) {
    console.error('Insights generate error:', error);
    res.status(500).json({ error: 'Failed to generate financial health summary' });
  }
});

// GET /api/insights — list previous insight summaries
router.get('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.aIAnalysisLog.findMany({
        where: { userId: req.user.id, module: 'weekly_health_summary' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.aIAnalysisLog.count({
        where: { userId: req.user.id, module: 'weekly_health_summary' },
      }),
    ]);

    res.json({
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Insights list error:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

module.exports = router;
