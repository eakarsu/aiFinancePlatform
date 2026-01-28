const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { calculateCreditScore } = require('../utils/creditScoringEngine');

// OpenRouter AI helper with logging
async function callOpenRouter(prompt, systemPrompt = '') {
  console.log('=== Credit Scoring OpenRouter API Call ===');
  console.log('Model:', process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku');
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
      temperature: 0.2
    })
  });

  const elapsed = Date.now() - startTime;
  console.log('Response status:', response.status);
  console.log('Response time:', elapsed, 'ms');

  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenRouter error:', errorText);
    throw new Error(`OpenRouter API error: ${errorText}`);
  }

  const data = await response.json();
  console.log('=== OpenRouter call successful ===');
  return data.choices[0].message.content;
}

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

    let finalResult = {
      score: algorithmResult.score,
      confidence: algorithmResult.confidence,
      riskLevel: algorithmResult.riskLevel,
      factors: algorithmResult.factors,
      recommendations: algorithmResult.recommendations,
      loanApprovalLikelihood: algorithmResult.loanApprovalLikelihood,
      components: algorithmResult.components,
      method: 'algorithm'
    };

    // Enhance with AI analysis via OpenRouter
    if (useAI && process.env.OPENROUTER_API_KEY) {
      console.log('Calling OpenRouter for AI-enhanced credit scoring...');
      try {
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

Provide additional insights and personalized recommendations in JSON:
{
  "aiInsights": ["insight1", "insight2"],
  "personalizedRecommendations": ["rec1", "rec2", "rec3"],
  "improvementPotential": "X points in Y months",
  "confidenceAdjustment": 0
}`;

        const aiResponse = await callOpenRouter(prompt, 'You are a helpful credit advisor. Respond only in valid JSON.');
        let jsonStr = aiResponse.match(/\{[\s\S]*\}/)?.[0] || '{}';
        const aiEnhancement = JSON.parse(jsonStr);

        finalResult.aiInsights = aiEnhancement.aiInsights;
        finalResult.personalizedRecommendations = aiEnhancement.personalizedRecommendations;
        finalResult.improvementPotential = aiEnhancement.improvementPotential;
        finalResult.method = 'algorithm+ai';
      } catch (aiError) {
        console.log('AI enhancement failed, using algorithm only:', aiError.message);
      }
    }

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
