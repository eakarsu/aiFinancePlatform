const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { callOpenRouter } = require('../services/openrouter');
const { parseAIJson } = require('../utils/parseAIJson');
const { calculateRiskScore, getRiskTolerance, generatePortfolioRecommendation } = require('../utils/investmentEngine');
const { handleExport } = require('../utils/queryHelpers');


// Get risk questionnaire
router.get('/questionnaire', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    const questionnaire = await prisma.riskQuestionnaire.findUnique({
      where: { userId: req.user.id }
    });

    res.json(questionnaire);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get questionnaire' });
  }
});

// Save/Update risk questionnaire
router.post('/questionnaire', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const {
      age, dependents,
      annualIncome, netWorth, liquidAssets, monthlyExpenses,
      debtLevel, hasEmergencyFund, emergencyFundMonths,
      riskAttitude, lossTolerance, investmentExperience,
      primaryGoal, timeHorizon, incomeStability,
      marketDropReaction, preferredApproach
    } = req.body;

    // Calculate risk score
    const riskScore = calculateRiskScore({
      age,
      timeHorizon,
      incomeStability,
      riskAttitude,
      lossTolerance,
      hasEmergencyFund,
      debtLevel
    });

    const riskTolerance = getRiskTolerance(riskScore);

    const questionnaire = await prisma.riskQuestionnaire.upsert({
      where: { userId: req.user.id },
      update: {
        age, dependents,
        annualIncome, netWorth, liquidAssets, monthlyExpenses,
        debtLevel, hasEmergencyFund, emergencyFundMonths,
        riskAttitude, lossTolerance, investmentExperience,
        primaryGoal, timeHorizon, incomeStability,
        marketDropReaction, preferredApproach,
        riskScore,
        riskTolerance
      },
      create: {
        userId: req.user.id,
        age, dependents,
        annualIncome, netWorth, liquidAssets, monthlyExpenses,
        debtLevel, hasEmergencyFund, emergencyFundMonths,
        riskAttitude, lossTolerance, investmentExperience,
        primaryGoal, timeHorizon, incomeStability,
        marketDropReaction, preferredApproach,
        riskScore,
        riskTolerance
      }
    });

    // Also update/create the risk profile for robo-advisor
    await prisma.riskProfile.upsert({
      where: { userId: req.user.id },
      update: {
        riskTolerance: riskTolerance,
        investmentGoal: primaryGoal || 'growth',
        timeHorizon: timeHorizon || 10,
        monthlyIncome: annualIncome ? annualIncome / 12 : null,
        monthlyExpenses: monthlyExpenses,
        emergencyFund: liquidAssets
      },
      create: {
        userId: req.user.id,
        riskTolerance: riskTolerance,
        investmentGoal: primaryGoal || 'growth',
        timeHorizon: timeHorizon || 10,
        monthlyIncome: annualIncome ? annualIncome / 12 : null,
        monthlyExpenses: monthlyExpenses,
        emergencyFund: liquidAssets
      }
    });

    res.json({
      questionnaire,
      riskScore,
      riskTolerance,
      message: 'Risk assessment completed successfully'
    });
  } catch (error) {
    console.error('Save questionnaire error:', error);
    res.status(500).json({ error: 'Failed to save questionnaire' });
  }
});

// Calculate risk score from questionnaire data
router.post('/calculate', authenticateToken, async (req, res) => {
  try {
    const riskScore = calculateRiskScore(req.body);
    const riskTolerance = getRiskTolerance(riskScore);

    res.json({
      riskScore,
      riskTolerance,
      interpretation: getScoreInterpretation(riskScore, riskTolerance)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate risk score' });
  }
});

// Get full risk assessment with recommendations (AI-enhanced)
router.get('/assessment', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    const questionnaire = await prisma.riskQuestionnaire.findUnique({
      where: { userId: req.user.id }
    });

    if (!questionnaire) {
      return res.status(400).json({
        error: 'Please complete the risk assessment questionnaire first'
      });
    }

    const riskProfile = {
      riskTolerance: questionnaire.riskTolerance,
      investmentGoal: questionnaire.primaryGoal || 'growth',
      timeHorizon: questionnaire.timeHorizon || 10
    };

    // Base algorithmic portfolio recommendation
    const portfolioRecommendation = generatePortfolioRecommendation(
      riskProfile,
      questionnaire.liquidAssets || 10000
    );

    res.json({
      questionnaire,
      riskScore: questionnaire.riskScore,
      riskTolerance: questionnaire.riskTolerance,
      interpretation: getScoreInterpretation(questionnaire.riskScore, questionnaire.riskTolerance),
      portfolioRecommendation,
      insights: generateInsights(questionnaire)
    });
  } catch (error) {
    console.error('Get assessment error:', error);
    res.status(500).json({ error: 'Failed to get assessment' });
  }
});

// AI-powered risk analysis (on-demand, triggered by button click)
router.post('/ai-analyze', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(400).json({ error: 'AI analysis requires OPENROUTER_API_KEY' });
    }

    const questionnaire = await prisma.riskQuestionnaire.findUnique({
      where: { userId: req.user.id }
    });

    if (!questionnaire || !questionnaire.riskScore) {
      return res.status(400).json({ error: 'Please complete the risk assessment questionnaire first' });
    }

    const prompt = `Analyze this investor's risk assessment questionnaire and provide personalized advice.

Investor Profile:
- Age: ${questionnaire.age}, Dependents: ${questionnaire.dependents || 0}
- Annual Income: $${questionnaire.annualIncome?.toLocaleString() || 'N/A'}
- Net Worth: $${questionnaire.netWorth?.toLocaleString() || 'N/A'}
- Liquid Assets: $${questionnaire.liquidAssets?.toLocaleString() || 'N/A'}
- Monthly Expenses: $${questionnaire.monthlyExpenses?.toLocaleString() || 'N/A'}
- Debt Level: ${questionnaire.debtLevel || 'N/A'}
- Emergency Fund: ${questionnaire.hasEmergencyFund ? `Yes (${questionnaire.emergencyFundMonths} months)` : 'No'}
- Risk Attitude: ${questionnaire.riskAttitude}/10
- Loss Tolerance: ${questionnaire.lossTolerance}
- Investment Experience: ${questionnaire.investmentExperience || 'N/A'}
- Primary Goal: ${questionnaire.primaryGoal || 'N/A'}
- Time Horizon: ${questionnaire.timeHorizon} years
- Income Stability: ${questionnaire.incomeStability || 'N/A'}
- Market Drop Reaction: ${questionnaire.marketDropReaction || 'N/A'}
- Preferred Approach: ${questionnaire.preferredApproach || 'N/A'}

Algorithm Risk Score: ${questionnaire.riskScore}/100 (${questionnaire.riskTolerance})

Respond in JSON:
{
  "interpretation": {
    "title": "personalized investor profile title",
    "description": "2-3 sentence personalized description of their risk profile based on ALL their answers",
    "suitable": "specific investment types suitable for this exact person",
    "caution": "personalized warning based on their specific situation"
  },
  "insights": [
    { "type": "success|warning|caution|info", "title": "short title", "message": "personalized insight" }
  ],
  "actionPlan": [
    { "priority": "high|medium|low", "action": "specific action step", "reason": "why this matters for them" }
  ],
  "portfolioTips": "2-3 sentences of personalized portfolio allocation advice"
}

Provide 4-6 insights covering emergency fund, debt, diversification, tax optimization, and goal-specific advice. Make action plan 3-5 items.`;

    const aiResponse = await callOpenRouter(prompt, 'You are an expert financial advisor specializing in risk assessment and portfolio management. Provide personalized, actionable advice. Always respond in valid JSON.');
    const parsed = JSON.parse(aiResponse.replace(/```json\n?|```\n?/g, '').trim());

    res.json({
      interpretation: parsed.interpretation,
      insights: parsed.insights,
      actionPlan: parsed.actionPlan,
      portfolioTips: parsed.portfolioTips
    });
  } catch (error) {
    console.error('AI risk analysis error:', error);
    res.status(500).json({ error: 'Failed to generate AI analysis' });
  }
});

// Export risk assessment data
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const exportFields = ['age', 'dependents', 'annualIncome', 'netWorth', 'liquidAssets', 'monthlyExpenses', 'debtLevel', 'riskAttitude', 'lossTolerance', 'investmentExperience', 'primaryGoal', 'timeHorizon', 'riskScore', 'riskTolerance'];
    await handleExport(res, prisma, 'riskQuestionnaire', req.user.id, req.query, 'Risk Assessment', exportFields);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get questionnaire questions (for frontend)
router.get('/questions', (req, res) => {
  res.json({
    sections: [
      {
        id: 'demographics',
        title: 'About You',
        questions: [
          {
            id: 'age',
            type: 'number',
            label: 'What is your age?',
            min: 18,
            max: 100,
            required: true
          },
          {
            id: 'dependents',
            type: 'number',
            label: 'How many dependents do you have?',
            min: 0,
            max: 20
          }
        ]
      },
      {
        id: 'financial',
        title: 'Financial Situation',
        questions: [
          {
            id: 'annualIncome',
            type: 'number',
            label: 'What is your annual income?',
            prefix: '$',
            required: true
          },
          {
            id: 'netWorth',
            type: 'number',
            label: 'What is your estimated net worth?',
            prefix: '$'
          },
          {
            id: 'liquidAssets',
            type: 'number',
            label: 'How much do you have in liquid assets (cash, savings)?',
            prefix: '$'
          },
          {
            id: 'monthlyExpenses',
            type: 'number',
            label: 'What are your monthly expenses?',
            prefix: '$'
          },
          {
            id: 'debtLevel',
            type: 'select',
            label: 'How would you describe your current debt level?',
            options: [
              { value: 'none', label: 'No debt' },
              { value: 'low', label: 'Low (less than 20% of income)' },
              { value: 'moderate', label: 'Moderate (20-40% of income)' },
              { value: 'high', label: 'High (more than 40% of income)' }
            ]
          },
          {
            id: 'hasEmergencyFund',
            type: 'boolean',
            label: 'Do you have an emergency fund?'
          },
          {
            id: 'emergencyFundMonths',
            type: 'number',
            label: 'If yes, how many months of expenses does it cover?',
            min: 0,
            max: 24,
            condition: { field: 'hasEmergencyFund', value: true }
          }
        ]
      },
      {
        id: 'risk',
        title: 'Risk Tolerance',
        questions: [
          {
            id: 'riskAttitude',
            type: 'slider',
            label: 'On a scale of 1-10, how comfortable are you with investment risk?',
            min: 1,
            max: 10,
            labels: { 1: 'Very Conservative', 10: 'Very Aggressive' },
            required: true
          },
          {
            id: 'lossTolerance',
            type: 'select',
            label: 'How much portfolio loss could you tolerate in a bad year?',
            options: [
              { value: 'none', label: 'None - I cannot tolerate any loss' },
              { value: 'small', label: 'Small loss (up to 10%)' },
              { value: 'moderate', label: 'Moderate loss (10-20%)' },
              { value: 'large', label: 'Significant loss (20%+) for potential higher returns' }
            ],
            required: true
          },
          {
            id: 'investmentExperience',
            type: 'select',
            label: 'What is your investment experience level?',
            options: [
              { value: 'none', label: 'None - I\'m new to investing' },
              { value: 'beginner', label: 'Beginner - Some basic knowledge' },
              { value: 'intermediate', label: 'Intermediate - Comfortable with most investments' },
              { value: 'advanced', label: 'Advanced - Extensive experience' }
            ]
          },
          {
            id: 'marketDropReaction',
            type: 'select',
            label: 'If your investments dropped 20% in value, what would you do?',
            options: [
              { value: 'sell_all', label: 'Sell everything immediately' },
              { value: 'sell_some', label: 'Sell some to reduce risk' },
              { value: 'hold', label: 'Hold and wait for recovery' },
              { value: 'buy_more', label: 'Buy more while prices are low' }
            ],
            required: true
          }
        ]
      },
      {
        id: 'goals',
        title: 'Investment Goals',
        questions: [
          {
            id: 'primaryGoal',
            type: 'select',
            label: 'What is your primary investment goal?',
            options: [
              { value: 'retirement', label: 'Retirement savings' },
              { value: 'growth', label: 'Long-term wealth growth' },
              { value: 'income', label: 'Generate regular income' },
              { value: 'preservation', label: 'Preserve capital' },
              { value: 'education', label: 'Education funding' }
            ],
            required: true
          },
          {
            id: 'timeHorizon',
            type: 'number',
            label: 'Investment time horizon (years)',
            min: 1,
            max: 50,
            required: true
          },
          {
            id: 'incomeStability',
            type: 'select',
            label: 'How stable is your income?',
            options: [
              { value: 'very_stable', label: 'Very stable (government, tenured, etc.)' },
              { value: 'stable', label: 'Stable (regular employment)' },
              { value: 'variable', label: 'Variable (commission, seasonal)' },
              { value: 'unstable', label: 'Unstable (freelance, new job)' }
            ]
          },
          {
            id: 'preferredApproach',
            type: 'select',
            label: 'Which investment approach do you prefer?',
            options: [
              { value: 'guaranteed_low', label: 'Guaranteed low returns with no risk' },
              { value: 'moderate_growth', label: 'Moderate growth with some risk' },
              { value: 'high_growth', label: 'High growth potential with significant risk' }
            ]
          }
        ]
      }
    ]
  });
});

// Helper functions
function getScoreInterpretation(score, tolerance) {
  const interpretations = {
    CONSERVATIVE: {
      title: 'Conservative Investor',
      description: 'You prefer stability and capital preservation over high returns. You\'re uncomfortable with significant portfolio fluctuations and prioritize protecting your principal.',
      suitable: 'Low-risk investments like bonds, CDs, and dividend-paying stocks',
      caution: 'May not keep pace with inflation over the long term'
    },
    MODERATE: {
      title: 'Balanced Investor',
      description: 'You seek a balance between growth and stability. You can tolerate moderate market fluctuations in exchange for reasonable returns.',
      suitable: 'A diversified mix of stocks and bonds',
      caution: 'Be prepared for occasional portfolio declines'
    },
    AGGRESSIVE: {
      title: 'Growth-Oriented Investor',
      description: 'You\'re comfortable with significant market volatility in pursuit of higher long-term returns. You understand that short-term losses are part of the journey.',
      suitable: 'Growth stocks, emerging markets, and equity-heavy portfolios',
      caution: 'Ensure you can truly stomach significant declines without panic selling'
    }
  };

  return {
    score,
    tolerance,
    ...interpretations[tolerance],
    scoreRange: score < 40 ? 'low' : score < 70 ? 'moderate' : 'high'
  };
}

function generateInsights(questionnaire) {
  const insights = [];

  // Emergency fund insight
  if (!questionnaire.hasEmergencyFund) {
    insights.push({
      type: 'warning',
      title: 'Build an Emergency Fund',
      message: 'Before investing aggressively, consider building an emergency fund covering 3-6 months of expenses.'
    });
  } else if (questionnaire.emergencyFundMonths < 3) {
    insights.push({
      type: 'info',
      title: 'Strengthen Your Safety Net',
      message: 'Aim to increase your emergency fund to cover at least 3 months of expenses.'
    });
  }

  // Debt insight
  if (questionnaire.debtLevel === 'high') {
    insights.push({
      type: 'warning',
      title: 'Address High-Interest Debt',
      message: 'Consider paying down high-interest debt before investing heavily, as debt interest often exceeds investment returns.'
    });
  }

  // Time horizon insight
  if (questionnaire.timeHorizon && questionnaire.timeHorizon < 5 && questionnaire.riskTolerance === 'AGGRESSIVE') {
    insights.push({
      type: 'caution',
      title: 'Short Time Horizon',
      message: 'With a time horizon under 5 years, aggressive investments may be risky. Consider a more conservative approach.'
    });
  }

  // Age-based insight
  if (questionnaire.age && questionnaire.age > 55 && questionnaire.riskTolerance === 'AGGRESSIVE') {
    insights.push({
      type: 'info',
      title: 'Approaching Retirement',
      message: 'As you near retirement, consider gradually shifting to more conservative investments to protect your savings.'
    });
  }

  // Positive insights
  if (questionnaire.hasEmergencyFund && questionnaire.emergencyFundMonths >= 6) {
    insights.push({
      type: 'success',
      title: 'Strong Financial Foundation',
      message: 'You have a solid emergency fund, giving you flexibility to invest for the long term.'
    });
  }

  if (questionnaire.debtLevel === 'none' || questionnaire.debtLevel === 'low') {
    insights.push({
      type: 'success',
      title: 'Low Debt Level',
      message: 'Your low debt level puts you in a good position to maximize investment contributions.'
    });
  }

  return insights;
}

module.exports = router;
