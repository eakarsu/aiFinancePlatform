const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const investmentEngine = require('../utils/investmentEngine');

// OpenRouter AI helper
async function callOpenRouter(prompt, systemPrompt = '') {
  console.log('=== OpenRouter API Call ===');
  console.log('Model:', process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku');
  console.log('API Key (first 20 chars):', process.env.OPENROUTER_API_KEY?.substring(0, 20));
  console.log('Prompt length:', prompt.length);

  const startTime = Date.now();

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku',
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000,
      temperature: 0.3
    })
  });

  const elapsed = Date.now() - startTime;
  console.log('Response status:', response.status);
  console.log('Response time:', elapsed, 'ms');

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenRouter error response:', errorText);
    throw new Error(`OpenRouter API error: ${errorText}`);
  }

  const data = await response.json();
  console.log('OpenRouter success, response length:', data.choices[0].message.content.length);
  console.log('=== End OpenRouter Call ===');

  return data.choices[0].message.content;
}

// Create/Update Risk Profile
router.post('/risk-profile', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { riskTolerance, investmentGoal, timeHorizon, monthlyIncome, monthlyExpenses, emergencyFund } = req.body;

    const riskProfile = await prisma.riskProfile.upsert({
      where: { userId: req.user.id },
      update: { riskTolerance, investmentGoal, timeHorizon, monthlyIncome, monthlyExpenses, emergencyFund },
      create: {
        userId: req.user.id,
        riskTolerance: riskTolerance || 'MODERATE',
        investmentGoal: investmentGoal || 'growth',
        timeHorizon: timeHorizon || 10,
        monthlyIncome,
        monthlyExpenses,
        emergencyFund
      }
    });

    res.json(riskProfile);
  } catch (error) {
    console.error('Risk profile error:', error);
    res.status(500).json({ error: 'Failed to save risk profile' });
  }
});

// Get Risk Profile
router.get('/risk-profile', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const riskProfile = await prisma.riskProfile.findUnique({
      where: { userId: req.user.id }
    });
    res.json(riskProfile || null);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get risk profile' });
  }
});

// Portfolio Recommendation (uses OpenRouter AI)
router.post('/recommend-portfolio', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { investmentAmount } = req.body;
    const amount = investmentAmount || 10000;

    const riskProfile = await prisma.riskProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!riskProfile) {
      return res.status(400).json({ error: 'Please complete your risk profile first' });
    }

    // Build AI prompt for portfolio recommendation
    const prompt = `You are an expert financial advisor. Create a detailed portfolio recommendation.

INVESTOR PROFILE:
- Risk Tolerance: ${riskProfile.riskTolerance}
- Investment Goal: ${riskProfile.investmentGoal}
- Time Horizon: ${riskProfile.timeHorizon} years
- Monthly Income: $${riskProfile.monthlyIncome || 'Not specified'}
- Monthly Expenses: $${riskProfile.monthlyExpenses || 'Not specified'}
- Emergency Fund: $${riskProfile.emergencyFund || 'Not specified'}
- Investment Amount: $${amount}

Provide a complete portfolio recommendation in this exact JSON format:
{
  "portfolioType": "CONSERVATIVE|BALANCED|GROWTH",
  "description": "Brief description of the portfolio strategy",
  "allocation": [
    {"asset": "US Stocks", "percentage": 40, "amount": 4000, "etf": "VTI", "etfName": "Vanguard Total Stock Market ETF", "expenseRatio": 0.03},
    {"asset": "International Stocks", "percentage": 20, "amount": 2000, "etf": "VXUS", "etfName": "Vanguard Total International Stock ETF", "expenseRatio": 0.07},
    {"asset": "Bonds", "percentage": 30, "amount": 3000, "etf": "BND", "etfName": "Vanguard Total Bond Market ETF", "expenseRatio": 0.03},
    {"asset": "Cash/Money Market", "percentage": 10, "amount": 1000, "etf": "VMFXX", "etfName": "Vanguard Federal Money Market Fund", "expenseRatio": 0.11}
  ],
  "expectedReturn": {"low": 5, "high": 8},
  "volatility": "Low|Medium|High",
  "rebalanceFrequency": "Quarterly|Semi-Annually|Annually",
  "weightedExpenseRatio": "0.05",
  "reasoning": "Detailed explanation of why this allocation suits the investor"
}

IMPORTANT:
- Percentages must add up to 100
- Amount for each asset = percentage * ${amount} / 100
- Use real ETF symbols and names
- Respond ONLY with valid JSON, no other text`;

    let recommendation;
    let modelUsed = 'openrouter';

    try {
      console.log('Calling OpenRouter API...');
      console.log('API Key exists:', !!process.env.OPENROUTER_API_KEY);
      console.log('Model:', process.env.OPENROUTER_MODEL);

      const aiResponse = await callOpenRouter(prompt, 'You are an expert financial advisor. Respond only with valid JSON.');
      console.log('OpenRouter response received, length:', aiResponse?.length);

      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        recommendation = JSON.parse(jsonMatch[0]);
        recommendation.suitability = {
          riskTolerance: riskProfile.riskTolerance,
          investmentGoal: riskProfile.investmentGoal,
          timeHorizon: riskProfile.timeHorizon + ' years'
        };
        console.log('OpenRouter recommendation parsed successfully');
      } else {
        console.log('No JSON found in response:', aiResponse?.substring(0, 200));
        throw new Error('Invalid AI response format');
      }
    } catch (aiError) {
      console.error('OpenRouter failed:', aiError.message);
      console.error('Full error:', aiError);
      // Fallback to local engine if AI fails
      recommendation = investmentEngine.generatePortfolioRecommendation(riskProfile, amount);
      modelUsed = 'local_fallback';
    }

    // Log the analysis
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'robo_advisor',
        userId: req.user.id,
        inputData: { riskProfile, investmentAmount: amount },
        outputData: { recommendation },
        modelUsed: modelUsed,
        confidence: modelUsed === 'openrouter' ? 95 : 85
      }
    });

    res.json({
      recommendation,
      investmentAmount: amount,
      riskProfile: {
        riskTolerance: riskProfile.riskTolerance,
        investmentGoal: riskProfile.investmentGoal,
        timeHorizon: riskProfile.timeHorizon
      },
      poweredBy: modelUsed === 'openrouter' ? 'OpenRouter AI' : 'Local Algorithm'
    });
  } catch (error) {
    console.error('Portfolio recommendation error:', error);
    res.status(500).json({ error: 'Failed to generate recommendation' });
  }
});

// Create Portfolio
router.post('/portfolios', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { name, type, initialDeposit } = req.body;

    const portfolio = await prisma.portfolio.create({
      data: {
        userId: req.user.id,
        name: name || 'My Portfolio',
        type: type || 'BALANCED',
        cashBalance: initialDeposit || 0,
        totalValue: initialDeposit || 0
      }
    });

    // Record the deposit
    if (initialDeposit > 0) {
      await prisma.investment.create({
        data: {
          userId: req.user.id,
          portfolioId: portfolio.id,
          type: 'DEPOSIT',
          amount: initialDeposit
        }
      });
    }

    res.json(portfolio);
  } catch (error) {
    console.error('Create portfolio error:', error);
    res.status(500).json({ error: 'Failed to create portfolio' });
  }
});

// Get Portfolios
router.get('/portfolios', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const portfolios = await prisma.portfolio.findMany({
      where: { userId: req.user.id },
      include: {
        holdings: true,
        investments: { take: 10, orderBy: { createdAt: 'desc' } }
      }
    });
    res.json(portfolios);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get portfolios' });
  }
});

// AI Rebalance Suggestion
router.post('/portfolios/:id/rebalance', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const portfolio = await prisma.portfolio.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { holdings: true }
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const riskProfile = await prisma.riskProfile.findUnique({
      where: { userId: req.user.id }
    });

    const currentHoldings = portfolio.holdings.map(h => ({
      symbol: h.symbol,
      name: h.name,
      value: h.shares * (h.currentPrice || h.avgCost),
      percentage: ((h.shares * (h.currentPrice || h.avgCost)) / portfolio.totalValue * 100).toFixed(1)
    }));

    const prompt = `Analyze this portfolio and suggest rebalancing actions.

CURRENT PORTFOLIO:
- Total Value: $${portfolio.totalValue}
- Cash: $${portfolio.cashBalance}
- Holdings: ${JSON.stringify(currentHoldings)}

INVESTOR PROFILE:
- Risk Tolerance: ${riskProfile?.riskTolerance || 'MODERATE'}
- Investment Goal: ${riskProfile?.investmentGoal || 'growth'}
- Time Horizon: ${riskProfile?.timeHorizon || 10} years

Analyze and provide rebalancing recommendations in JSON:
{
  "needsRebalancing": true/false,
  "currentAllocation": {"stocks": 60, "bonds": 30, "cash": 10},
  "targetAllocation": {"stocks": 60, "bonds": 30, "cash": 10},
  "actions": [
    {"action": "BUY|SELL", "symbol": "VTI", "shares": 5, "reason": "explanation"}
  ],
  "reasoning": "Overall explanation"
}`;

    console.log('Calling OpenRouter for rebalance analysis...');
    console.log('API Key exists:', !!process.env.OPENROUTER_API_KEY);

    const aiResponse = await callOpenRouter(prompt, 'You are a portfolio rebalancing expert. Respond only in valid JSON.');
    console.log('OpenRouter rebalance response received, length:', aiResponse?.length);

    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    let rebalanceAdvice = null;

    if (jsonMatch) {
      rebalanceAdvice = JSON.parse(jsonMatch[0]);
      console.log('Rebalance advice parsed successfully');
    } else {
      console.log('No JSON found in rebalance response');
    }

    res.json({
      portfolio: { id: portfolio.id, name: portfolio.name, totalValue: portfolio.totalValue },
      currentHoldings,
      rebalanceAdvice,
      poweredBy: 'OpenRouter AI'
    });
  } catch (error) {
    console.error('Rebalance error:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ error: 'Failed to analyze portfolio: ' + error.message });
  }
});

module.exports = router;
