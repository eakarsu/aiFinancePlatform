const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { callOpenRouter } = require('../services/openrouter');
const { parseAIJson } = require('../utils/parseAIJson');
const { paginatedQuery, bulkDelete, bulkUpdate, handleExport } = require('../utils/queryHelpers');



// Get all retirement plans
router.get('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { search } = req.query;
    const baseWhere = { userId: req.user.id };
    const result = await paginatedQuery(prisma, 'retirementPlan', {
      baseWhere,
      search,
      searchFields: [],
      query: req.query
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get retirement plans' });
  }
});

// Bulk delete retirement plans
router.post('/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkDelete(prisma, 'retirementPlan', req.user.id, req.body.ids);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

// Bulk update retirement plans
router.patch('/bulk-update', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkUpdate(prisma, 'retirementPlan', req.user.id, req.body.ids, req.body.data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

// Export retirement plans
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await handleExport(res, prisma, 'retirementPlan', req.user.id, req.query, 'Retirement Plans', ['currentAge', 'retirementAge', 'currentSavings', 'monthlyContribution', 'expectedReturn', 'aiReadinessScore', 'aiProjectedSavings']);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get single plan
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const plan = await prisma.retirementPlan.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get plan' });
  }
});

// Create retirement plan
router.post('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { currentAge, retirementAge, lifeExpectancy, currentSavings, monthlyContribution,
            expectedReturn, inflationRate, socialSecurityAge, socialSecurityAmount,
            pensionAmount, otherIncome, currentExpenses, retirementExpenses,
            healthcareCosts, desiredRetirementIncome, legacyGoal } = req.body;

    const plan = await prisma.retirementPlan.create({
      data: {
        userId: req.user.id,
        currentAge,
        retirementAge: retirementAge || 65,
        lifeExpectancy: lifeExpectancy || 90,
        currentSavings: currentSavings || 0,
        monthlyContribution,
        expectedReturn,
        inflationRate: inflationRate || 3,
        socialSecurityAge,
        socialSecurityAmount,
        pensionAmount,
        otherIncome,
        currentExpenses,
        retirementExpenses,
        healthcareCosts,
        desiredRetirementIncome,
        legacyGoal
      }
    });

    res.json(plan);
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Failed to create retirement plan' });
  }
});

// Update plan
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const plan = await prisma.retirementPlan.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: req.body
    });
    if (plan.count === 0) return res.status(404).json({ error: 'Plan not found' });

    const updated = await prisma.retirementPlan.findFirst({
      where: { id: req.params.id }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// Delete plan
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await prisma.retirementPlan.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

// AI Analyze retirement plan
router.post('/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const plan = await prisma.retirementPlan.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const yearsToRetirement = plan.retirementAge - plan.currentAge;
    const retirementYears = plan.lifeExpectancy - plan.retirementAge;

    const prompt = `Analyze this retirement plan and provide comprehensive guidance:

CURRENT SITUATION:
- Current Age: ${plan.currentAge}
- Retirement Age: ${plan.retirementAge}
- Life Expectancy: ${plan.lifeExpectancy}
- Years to Retirement: ${yearsToRetirement}
- Retirement Duration: ${retirementYears} years

SAVINGS & CONTRIBUTIONS:
- Current Savings: $${plan.currentSavings?.toLocaleString()}
- Monthly Contribution: $${plan.monthlyContribution?.toLocaleString() || 0}
- Expected Return: ${plan.expectedReturn || 7}% annually
- Inflation Rate: ${plan.inflationRate}%

EXPECTED INCOME IN RETIREMENT:
- Social Security: $${plan.socialSecurityAmount?.toLocaleString() || 0}/month (age ${plan.socialSecurityAge || 67})
- Pension: $${plan.pensionAmount?.toLocaleString() || 0}/month
- Other Income: $${plan.otherIncome?.toLocaleString() || 0}/month

EXPENSES:
- Current Monthly Expenses: $${plan.currentExpenses?.toLocaleString() || 'N/A'}
- Expected Retirement Expenses: $${plan.retirementExpenses?.toLocaleString() || 'N/A'}
- Healthcare Budget: $${plan.healthcareCosts?.toLocaleString() || 'N/A'}/month

GOALS:
- Desired Retirement Income: $${plan.desiredRetirementIncome?.toLocaleString() || 'N/A'}/month
- Legacy Goal: $${plan.legacyGoal?.toLocaleString() || 0}

Perform detailed financial calculations and provide analysis in this JSON format:
{
  "aiReadinessScore": 65,
  "aiProjectedSavings": 1500000,
  "aiIncomeGap": 1000,
  "analysis": {
    "summary": "Overall retirement readiness assessment",
    "savingsTrajectory": "Are you on track with savings?",
    "incomeAnalysis": "Will your retirement income meet your needs?",
    "riskAssessment": "Key risks to your retirement plan",
    "taxStrategy": "Tax considerations for retirement"
  },
  "projections": {
    "atRetirement": {"savings": 1000000, "monthlyIncome": 5000},
    "at75": {"savings": 800000, "monthlyIncome": 4500},
    "at85": {"savings": 400000, "monthlyIncome": 4000}
  },
  "recommendations": [
    {"title": "Increase Savings", "description": "Detailed recommendation", "impact": "high|medium|low", "timeframe": "immediate|short-term|long-term"}
  ],
  "milestones": [
    {"age": 35, "target": 100000, "description": "1x salary saved"},
    {"age": 45, "target": 300000, "description": "3x salary saved"},
    {"age": 55, "target": 600000, "description": "6x salary saved"},
    {"age": 65, "target": 1000000, "description": "10x salary saved"}
  ],
  "riskAssessment": {
    "marketRisk": "Assessment of investment risk",
    "longevityRisk": "Risk of outliving savings",
    "inflationRisk": "Impact of inflation",
    "healthcareRisk": "Healthcare cost uncertainty"
  },
  "actionItems": [
    {"action": "Action item 1", "priority": "high|medium|low", "deadline": "When to complete"}
  ],
  "scenarios": {
    "pessimistic": {"projectedSavings": 800000, "monthlyIncome": 3500},
    "baseline": {"projectedSavings": 1200000, "monthlyIncome": 5000},
    "optimistic": {"projectedSavings": 1800000, "monthlyIncome": 7000}
  }
}`;

    const aiResponse = await callOpenRouter(prompt, 'You are an expert retirement financial planner. Respond only with valid JSON.');
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let analysis = null;
    if (jsonMatch) {
      try {
        analysis = parseAIJson(jsonMatch[0]);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }

      await prisma.retirementPlan.update({
        where: { id: plan.id },
        data: {
          aiReadinessScore: analysis.aiReadinessScore,
          aiProjectedSavings: analysis.aiProjectedSavings,
          aiIncomeGap: analysis.aiIncomeGap,
          aiRecommendations: analysis.recommendations,
          aiMilestones: analysis.milestones,
          aiRiskAssessment: analysis.riskAssessment,
          aiActionItems: analysis.actionItems
        }
      });
    }

    // Log the analysis
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'retirement_planner',
        userId: req.user.id,
        inputData: { plan },
        outputData: { analysis },
        modelUsed: process.env.OPENROUTER_MODEL || 'openrouter',
        confidence: analysis?.aiReadinessScore || 0
      }
    });

    res.json({ plan, analysis, poweredBy: 'OpenRouter AI' });
  } catch (error) {
    console.error('Retirement analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze plan: ' + error.message });
  }
});

// Calculate basic projections (without AI)
router.post('/calculate', authenticateToken, async (req, res) => {
  try {
    const { currentAge, retirementAge, currentSavings, monthlyContribution, expectedReturn, inflationRate } = req.body;

    const yearsToRetirement = retirementAge - currentAge;
    const monthsToRetirement = yearsToRetirement * 12;
    const monthlyReturn = (expectedReturn || 7) / 100 / 12;
    const realReturn = (expectedReturn || 7) - (inflationRate || 3);

    // Future Value calculation with monthly contributions
    let futureValue = currentSavings || 0;
    for (let i = 0; i < monthsToRetirement; i++) {
      futureValue = futureValue * (1 + monthlyReturn) + (monthlyContribution || 0);
    }

    // 4% safe withdrawal rule
    const annualWithdrawal = futureValue * 0.04;
    const monthlyIncome = annualWithdrawal / 12;

    // Inflation-adjusted values
    const inflationFactor = Math.pow(1 + (inflationRate || 3) / 100, yearsToRetirement);
    const realFutureValue = futureValue / inflationFactor;
    const realMonthlyIncome = monthlyIncome / inflationFactor;

    res.json({
      yearsToRetirement,
      projectedSavings: Math.round(futureValue),
      realProjectedSavings: Math.round(realFutureValue),
      monthlyRetirementIncome: Math.round(monthlyIncome),
      realMonthlyIncome: Math.round(realMonthlyIncome),
      annualWithdrawal: Math.round(annualWithdrawal),
      inflationImpact: Math.round(futureValue - realFutureValue)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate projections' });
  }
});

module.exports = router;
