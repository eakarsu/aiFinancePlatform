const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { callOpenRouter } = require('../services/openrouter');
const { parseAIJson } = require('../utils/parseAIJson');
const { calculateCreditScore } = require('../utils/creditScoringEngine');
const { paginatedQuery, bulkDelete, handleExport, buildSearchWhere, parsePagination, parseSort } = require('../utils/queryHelpers');


// Create/Update Credit Profile
router.post('/profile', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const {
      annualIncome, employmentStatus, employmentYears, housingStatus, monthlyRent,
      rentPaymentHistory, utilityPaymentHistory, phonePaymentHistory,
      bankAccountAge, averageBalance, overdraftCount, traditionalScore
    } = req.body;

    const creditProfile = await prisma.creditProfile.upsert({
      where: { userId: req.user.id },
      update: {
        annualIncome, employmentStatus, employmentYears, housingStatus, monthlyRent,
        rentPaymentHistory, utilityPaymentHistory, phonePaymentHistory,
        bankAccountAge, averageBalance, overdraftCount, traditionalScore
      },
      create: {
        userId: req.user.id,
        annualIncome, employmentStatus, employmentYears, housingStatus, monthlyRent,
        rentPaymentHistory, utilityPaymentHistory, phonePaymentHistory,
        bankAccountAge, averageBalance, overdraftCount, traditionalScore
      }
    });

    res.json(creditProfile);
  } catch (error) {
    console.error('Credit profile error:', error);
    res.status(500).json({ error: 'Failed to save credit profile' });
  }
});

// Get Credit Profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const creditProfile = await prisma.creditProfile.findUnique({
      where: { userId: req.user.id },
      include: { creditHistories: true }
    });
    res.json(creditProfile || null);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get credit profile' });
  }
});

// Add Credit History (rent, utility, phone payments)
router.post('/history', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { type, provider, monthlyAmount, onTimePayments, latePayments, missedPayments, startDate, endDate } = req.body;

    let creditProfile = await prisma.creditProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!creditProfile) {
      creditProfile = await prisma.creditProfile.create({
        data: { userId: req.user.id }
      });
    }

    const history = await prisma.creditHistory.create({
      data: {
        creditProfileId: creditProfile.id,
        type, provider, monthlyAmount,
        onTimePayments: onTimePayments || 0,
        latePayments: latePayments || 0,
        missedPayments: missedPayments || 0,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null
      }
    });

    res.json(history);
  } catch (error) {
    console.error('Credit history error:', error);
    res.status(500).json({ error: 'Failed to add credit history' });
  }
});

// Get Credit Histories (paginated, searchable)
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const creditProfile = await prisma.creditProfile.findUnique({
      where: { userId: req.user.id }
    });
    if (!creditProfile) {
      return res.json({ data: [], total: 0, offset: 0, limit: 50 });
    }

    const { search } = req.query;
    const searchFields = ['type', 'provider'];
    const baseWhere = { creditProfileId: creditProfile.id };
    const where = search
      ? { ...baseWhere, OR: searchFields.map(f => ({ [f]: { contains: search, mode: 'insensitive' } })) }
      : baseWhere;
    const { limit, offset } = parsePagination(req.query);
    const orderBy = parseSort(req.query);

    const [data, total] = await Promise.all([
      prisma.creditHistory.findMany({ where, orderBy, take: limit, skip: offset }),
      prisma.creditHistory.count({ where })
    ]);

    res.json({ data, total, offset, limit });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get credit histories' });
  }
});

// Bulk delete credit histories
router.post('/history/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const creditProfile = await prisma.creditProfile.findUnique({
      where: { userId: req.user.id }
    });
    if (!creditProfile) {
      return res.status(404).json({ error: 'No credit profile found' });
    }
    const { ids } = req.body;
    if (!ids?.length) {
      return res.status(400).json({ error: 'No IDs provided' });
    }
    const result = await prisma.creditHistory.deleteMany({
      where: { id: { in: ids }, creditProfileId: creditProfile.id }
    });
    res.json({ deleted: result.count });
  } catch (error) {
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

// Export credit histories
router.get('/history/export', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const creditProfile = await prisma.creditProfile.findUnique({
      where: { userId: req.user.id }
    });
    if (!creditProfile) {
      return res.json({ data: [], total: 0 });
    }
    const exportFields = ['type', 'provider', 'monthlyAmount', 'onTimePayments', 'latePayments', 'missedPayments', 'startDate'];
    const format = (req.query.format || 'json').toLowerCase();
    const where = { creditProfileId: creditProfile.id };
    const data = await prisma.creditHistory.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 });

    if (format === 'csv') {
      const { exportCSV } = require('../utils/queryHelpers');
      const csv = exportCSV(data, exportFields);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="Credit_History.csv"');
      return res.send(csv);
    }
    if (format === 'pdf') {
      const { exportPDF } = require('../utils/queryHelpers');
      return exportPDF(res, data, 'Credit History', exportFields);
    }
    res.json({ data, total: data.length });
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Credit Score Calculation - Uses real algorithm + optional AI enhancement
router.post('/calculate-score', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const useAI = true; // Always use OpenRouter for AI-enhanced scoring

    const creditProfile = await prisma.creditProfile.findUnique({
      where: { userId: req.user.id },
      include: { creditHistories: true }
    });

    if (!creditProfile) {
      return res.status(400).json({ error: 'Please complete your credit profile first' });
    }

    // Calculate payment history stats
    const totalOnTime = creditProfile.creditHistories.reduce((sum, h) => sum + h.onTimePayments, 0);
    const totalLate = creditProfile.creditHistories.reduce((sum, h) => sum + h.latePayments, 0);
    const totalMissed = creditProfile.creditHistories.reduce((sum, h) => sum + h.missedPayments, 0);
    const totalPayments = totalOnTime + totalLate + totalMissed;
    const onTimePercentage = totalPayments > 0 ? ((totalOnTime / totalPayments) * 100).toFixed(1) : 0;

    // Use the real credit scoring engine
    const algorithmResult = calculateCreditScore(creditProfile, creditProfile.creditHistories);

    const finalResult = {
      score: algorithmResult.score,
      confidence: algorithmResult.confidence,
      riskLevel: algorithmResult.riskLevel,
      factors: algorithmResult.factors,
      recommendations: algorithmResult.recommendations,
      loanApprovalLikelihood: algorithmResult.loanApprovalLikelihood,
      components: algorithmResult.components,
      method: 'algorithm'
    };

    // Update credit profile with score
    await prisma.creditProfile.update({
      where: { userId: req.user.id },
      data: {
        aiCreditScore: finalResult.score,
        aiScoreDate: new Date(),
        aiConfidence: finalResult.confidence,
        aiFactors: finalResult.factors
      }
    });

    // Log the analysis (simplify inputData to avoid circular reference issues)
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'credit_score',
        userId: req.user.id,
        inputData: {
          profileId: creditProfile.id,
          annualIncome: creditProfile.annualIncome,
          employmentStatus: creditProfile.employmentStatus,
          creditHistoriesCount: creditProfile.creditHistories?.length || 0,
          paymentStats: { totalOnTime, totalLate, totalMissed }
        },
        outputData: finalResult,
        modelUsed: finalResult.method === 'algorithm+ai' ? 'algorithm+ai' : 'algorithm',
        confidence: finalResult.confidence
      }
    });

    res.json({
      ...finalResult,
      paymentStats: {
        totalPayments,
        onTimePercentage: parseFloat(onTimePercentage),
        onTime: totalOnTime,
        late: totalLate,
        missed: totalMissed
      }
    });
  } catch (error) {
    console.error('Credit score calculation error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to calculate credit score', details: error.message });
  }
});

// AI-powered credit analysis (on-demand, triggered by button click)
router.post('/ai-analyze', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(400).json({ error: 'AI analysis requires OPENROUTER_API_KEY' });
    }

    const creditProfile = await prisma.creditProfile.findUnique({
      where: { userId: req.user.id },
      include: { creditHistories: true }
    });

    if (!creditProfile || !creditProfile.aiCreditScore) {
      return res.status(400).json({ error: 'Please calculate your credit score first' });
    }

    const algorithmResult = calculateCreditScore(creditProfile, creditProfile.creditHistories);

    const prompt = `You are an AI credit scoring assistant. A user has been assigned a credit score of ${algorithmResult.score} (${algorithmResult.riskLevel} risk) based on their alternative credit data.

ALGORITHM SCORE COMPONENTS:
${JSON.stringify(algorithmResult.components, null, 2)}

FACTORS IDENTIFIED:
Positive: ${algorithmResult.factors.positive.join(', ') || 'None'}
Negative: ${algorithmResult.factors.negative.join(', ') || 'None'}

USER PROFILE:
- Annual Income: $${creditProfile.annualIncome || 'Unknown'}
- Employment: ${creditProfile.employmentStatus || 'Unknown'} (${creditProfile.employmentYears || 0} years)
- Bank Account Age: ${creditProfile.bankAccountAge || 0} months
- Average Balance: $${creditProfile.averageBalance || 0}
- Overdrafts: ${creditProfile.overdraftCount || 0}

PAYMENT HISTORIES:
${creditProfile.creditHistories.map(h => `- ${h.provider} (${h.type}): ${h.onTimePayments} on-time, ${h.latePayments} late, ${h.missedPayments} missed`).join('\n') || 'None'}

Provide detailed AI analysis in JSON:
{
  "aiInsights": ["insight1", "insight2", "insight3"],
  "personalizedRecommendations": ["rec1", "rec2", "rec3", "rec4"],
  "improvementPotential": "X points in Y months",
  "scoreBreakdown": "2-3 sentence explanation of how the score was derived",
  "actionPlan": [
    { "priority": "high|medium|low", "action": "specific step", "impact": "expected improvement" }
  ]
}

Provide 3-4 insights, 4-5 recommendations, and 3-4 action plan items.`;

    const aiResponse = await callOpenRouter(prompt, 'You are an expert credit advisor specializing in alternative credit scoring for thin-file consumers. Provide actionable, personalized advice. Respond only in valid JSON.');
    let jsonStr = aiResponse.match(/\{[\s\S]*\}/)?.[0] || '{}';
    const analysis = JSON.parse(jsonStr);

    res.json(analysis);
  } catch (error) {
    console.error('AI credit analysis error:', error);
    res.status(500).json({ error: 'Failed to generate AI analysis' });
  }
});

// Get Credit Score History
router.get('/score-history', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const logs = await prisma.aIAnalysisLog.findMany({
      where: { userId: req.user.id, module: 'credit_score' },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get score history' });
  }
});

module.exports = router;
