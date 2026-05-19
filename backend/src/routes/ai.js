const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { callOpenRouter } = require('../services/openrouter');
const { parseAIJson } = require('../utils/parseAIJson');

// ============================================================
// POST /api/ai/tax-loss-harvest
// ============================================================
// Fetches user holdings, identifies unrealized losses, calls AI
// to generate wash-sale-safe trade recommendations, persists to
// AIAnalysisLog, returns structured recommendations.
// ============================================================
router.post('/tax-loss-harvest', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const prisma = req.app.get('prisma');

    // Fetch all portfolios with holdings
    const portfolios = await prisma.portfolio.findMany({
      where: { userId: req.user.id },
      include: {
        holdings: true,
      },
    });

    if (!portfolios.length) {
      return res.status(400).json({ error: 'No portfolios found. Please create a portfolio first.' });
    }

    // Collect all holdings across portfolios and compute P&L
    const allHoldings = [];
    for (const portfolio of portfolios) {
      for (const holding of portfolio.holdings) {
        const currentPrice = holding.currentPrice ?? holding.avgCost;
        const currentValue = holding.shares * currentPrice;
        const costBasis = holding.shares * holding.avgCost;
        const unrealizedGain = currentValue - costBasis;
        const unrealizedGainPercent = costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0;

        allHoldings.push({
          portfolioId: portfolio.id,
          portfolioName: portfolio.name,
          holdingId: holding.id,
          symbol: holding.symbol,
          name: holding.name,
          assetType: holding.assetType,
          shares: holding.shares,
          avgCost: holding.avgCost,
          currentPrice,
          currentValue,
          costBasis,
          unrealizedGain,
          unrealizedGainPercent: parseFloat(unrealizedGainPercent.toFixed(2)),
        });
      }
    }

    if (!allHoldings.length) {
      return res.status(400).json({ error: 'No holdings found in your portfolios.' });
    }

    // Identify loss positions (unrealized gain < 0)
    const lossPositions = allHoldings.filter(h => h.unrealizedGain < 0);
    const gainPositions = allHoldings.filter(h => h.unrealizedGain > 0);
    const totalUnrealizedLoss = lossPositions.reduce((sum, h) => sum + h.unrealizedGain, 0);
    const totalUnrealizedGain = gainPositions.reduce((sum, h) => sum + h.unrealizedGain, 0);

    let recommendations;
    let modelUsed = 'openrouter';

    if (lossPositions.length === 0) {
      // No losses to harvest — still call AI for strategic advice
      recommendations = {
        summary: 'No unrealized losses detected in your portfolio.',
        lossPositions: [],
        recommendations: [],
        taxSavingsEstimate: 0,
        strategyNote: 'Your portfolio currently has no positions with unrealized losses. Consider reviewing your positions quarterly for future tax-loss harvesting opportunities.',
      };
      modelUsed = 'local_fallback';
    } else {
      const prompt = `You are a certified tax advisor and investment strategist specializing in tax-loss harvesting.

PORTFOLIO SUMMARY:
- Total holdings: ${allHoldings.length}
- Holdings with unrealized LOSSES: ${lossPositions.length}
- Holdings with unrealized GAINS: ${gainPositions.length}
- Total unrealized loss: $${Math.abs(totalUnrealizedLoss).toFixed(2)}
- Total unrealized gain: $${totalUnrealizedGain.toFixed(2)}

LOSS POSITIONS (candidates for harvesting):
${JSON.stringify(lossPositions.map(h => ({
  symbol: h.symbol,
  name: h.name,
  type: h.assetType,
  shares: h.shares,
  avgCost: h.avgCost,
  currentPrice: h.currentPrice,
  unrealizedLoss: h.unrealizedGain,
  lossPercent: h.unrealizedGainPercent,
})), null, 2)}

GAIN POSITIONS (for context on potential offsets):
${JSON.stringify(gainPositions.map(h => ({
  symbol: h.symbol,
  name: h.name,
  unrealizedGain: h.unrealizedGain,
})), null, 2)}

Generate a tax-loss harvesting analysis with specific trade recommendations. For each recommendation:
1. Identify which positions to sell to realize losses
2. Suggest wash-sale-safe replacement securities (must be NOT substantially identical per IRS rules — wait 31 days or buy a similar-but-different ETF/stock)
3. Calculate estimated tax savings (assume 20% capital gains tax rate for losses > $3,000 threshold)
4. Warn about any wash-sale risks

Respond ONLY with valid JSON in this exact structure:
{
  "summary": "2-3 sentence executive summary of the tax-loss harvesting opportunity",
  "totalHarvestableLoss": -XXXX,
  "estimatedTaxSavings": XXXX,
  "taxRate": 0.20,
  "recommendations": [
    {
      "action": "SELL",
      "symbol": "XXX",
      "name": "Security Name",
      "shares": 10,
      "currentPrice": 45.00,
      "realizedLoss": -500.00,
      "rationale": "Reason to harvest this loss",
      "replacement": {
        "symbol": "YYY",
        "name": "Replacement Security Name",
        "rationale": "Why this is wash-sale safe",
        "waitDays": 0
      },
      "washSaleRisk": "low/medium/high",
      "washSaleWarning": "Any specific wash-sale caution"
    }
  ],
  "gainsToOffset": [
    {
      "symbol": "XXX",
      "gain": 1000.00,
      "canBeOffset": true
    }
  ],
  "strategyNote": "Overall strategic note about timing and execution",
  "irsReminder": "Brief reminder about wash-sale rule (30 days before/after)",
  "disclaimer": "This is AI-generated analysis and not professional tax advice. Consult a CPA."
}`;

      try {
        const aiResponse = await callOpenRouter(prompt, 'You are an expert tax advisor. Respond only with valid JSON. Be specific and actionable.', { temperature: 0.2 });
        const parsed = parseAIJson(aiResponse);
        if (!parsed) throw new Error('No JSON in AI response');
        recommendations = parsed;
      } catch (aiErr) {
        console.error('Tax-loss harvest AI call failed:', aiErr.message);
        // Local fallback: generate basic recommendations
        modelUsed = 'local_fallback';
        const estimatedTaxSavings = Math.abs(totalUnrealizedLoss) * 0.20;
        recommendations = {
          summary: `Your portfolio has ${lossPositions.length} position(s) with a total unrealized loss of $${Math.abs(totalUnrealizedLoss).toFixed(2)}. Selling these positions could generate approximately $${estimatedTaxSavings.toFixed(2)} in tax savings at a 20% rate.`,
          totalHarvestableLoss: totalUnrealizedLoss,
          estimatedTaxSavings,
          taxRate: 0.20,
          recommendations: lossPositions.map(h => ({
            action: 'SELL',
            symbol: h.symbol,
            name: h.name,
            shares: h.shares,
            currentPrice: h.currentPrice,
            realizedLoss: h.unrealizedGain,
            rationale: `Position is down ${Math.abs(h.unrealizedGainPercent).toFixed(1)}% from cost basis.`,
            replacement: {
              symbol: 'CONSULT_ADVISOR',
              name: 'Consult your advisor for a wash-sale-safe replacement',
              rationale: 'AI fallback: advisor consultation recommended for replacement security',
              waitDays: 31,
            },
            washSaleRisk: 'unknown',
            washSaleWarning: 'Do not repurchase the same or substantially identical security within 30 days before or after the sale.',
          })),
          gainsToOffset: gainPositions.map(h => ({ symbol: h.symbol, gain: h.unrealizedGain, canBeOffset: true })),
          strategyNote: 'Consider executing these sales before year-end to maximize tax benefit. Coordinate with your CPA.',
          irsReminder: 'IRS Wash-Sale Rule: You cannot claim a loss if you buy the same or substantially identical security 30 days before or after the sale.',
          disclaimer: 'This is AI-generated analysis and not professional tax advice. Consult a CPA or tax professional.',
        };
      }
    }

    const processingTime = Date.now() - startTime;

    // Persist to AIAnalysisLog
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'tax_loss_harvest',
        userId: req.user.id,
        inputData: {
          totalHoldings: allHoldings.length,
          lossPositions: lossPositions.length,
          gainPositions: gainPositions.length,
          totalUnrealizedLoss,
          totalUnrealizedGain,
        },
        outputData: recommendations,
        modelUsed,
        confidence: modelUsed === 'openrouter' ? 88 : 70,
        processingTime,
      },
    });

    res.json({
      analysis: recommendations,
      portfolio: {
        totalHoldings: allHoldings.length,
        lossPositions: lossPositions.length,
        gainPositions: gainPositions.length,
        totalUnrealizedLoss,
        totalUnrealizedGain,
        netUnrealized: totalUnrealizedGain + totalUnrealizedLoss,
      },
      lossDetails: lossPositions,
      gainDetails: gainPositions,
      poweredBy: modelUsed === 'openrouter' ? 'OpenRouter AI' : 'Local Algorithm',
      processingTime,
    });
  } catch (error) {
    console.error('Tax-loss harvest error:', error);
    res.status(500).json({ error: 'Failed to generate tax-loss harvesting analysis' });
  }
});

// ============================================================
// POST /api/ai/asset-allocation
// ============================================================
// Recommends an asset allocation based on user's risk tolerance,
// time horizon, and financial goals. Returns AI-generated
// allocation percentages plus a fallback model-portfolio.
// ============================================================
router.post('/asset-allocation', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const prisma = req.app.get('prisma');
    const {
      riskTolerance = 'moderate',
      timeHorizonYears = 10,
      annualIncome = null,
      investableAssets = null,
      goals = [],
      ageBracket = null,
    } = req.body || {};

    const validRisks = ['conservative', 'moderate', 'aggressive'];
    const risk = validRisks.includes(String(riskTolerance).toLowerCase())
      ? String(riskTolerance).toLowerCase()
      : 'moderate';

    // Local fallback allocation table (basic age/risk model)
    const fallbackTable = {
      conservative: { stocks: 30, bonds: 55, cash: 10, alternatives: 5 },
      moderate: { stocks: 60, bonds: 30, cash: 5, alternatives: 5 },
      aggressive: { stocks: 80, bonds: 10, cash: 2, alternatives: 8 },
    };

    let allocation;
    let modelUsed = 'openrouter';

    const prompt = `You are a fiduciary investment advisor. Recommend an asset allocation.

INPUTS:
- Risk tolerance: ${risk}
- Time horizon (years): ${timeHorizonYears}
- Annual income: ${annualIncome ?? 'unspecified'}
- Investable assets: ${investableAssets ?? 'unspecified'}
- Age bracket: ${ageBracket ?? 'unspecified'}
- Goals: ${JSON.stringify(goals)}

Respond ONLY with valid JSON in this exact structure:
{
  "summary": "2-3 sentence rationale",
  "allocation": {
    "stocks": 0,
    "bonds": 0,
    "cash": 0,
    "alternatives": 0
  },
  "stockSubAllocation": {
    "usLargeCap": 0,
    "usMidSmallCap": 0,
    "international": 0,
    "emergingMarkets": 0
  },
  "bondSubAllocation": {
    "treasuries": 0,
    "corporateInvestmentGrade": 0,
    "highYield": 0,
    "international": 0
  },
  "rationale": "explanation tied to inputs",
  "rebalancingFrequency": "quarterly|semi-annual|annual",
  "disclaimer": "Not personalized financial advice."
}
All percentages MUST be integers and the four top-level allocation values MUST sum to 100.`;

    try {
      const aiResponse = await callOpenRouter(prompt, 'You are an expert fiduciary advisor. Return only valid JSON.', { temperature: 0.2 });
      const parsed = parseAIJson(aiResponse);
      if (!parsed || !parsed.allocation) throw new Error('No JSON allocation in AI response');
      allocation = parsed;
    } catch (aiErr) {
      console.error('Asset-allocation AI call failed:', aiErr.message);
      modelUsed = 'local_fallback';
      allocation = {
        summary: `Default ${risk} allocation for a ${timeHorizonYears}-year horizon.`,
        allocation: fallbackTable[risk],
        stockSubAllocation: { usLargeCap: 60, usMidSmallCap: 15, international: 20, emergingMarkets: 5 },
        bondSubAllocation: { treasuries: 40, corporateInvestmentGrade: 40, highYield: 10, international: 10 },
        rationale: `Standard ${risk} allocation based on a static lookup; AI service was unavailable.`,
        rebalancingFrequency: 'quarterly',
        disclaimer: 'Not personalized financial advice. Consult a registered investment advisor.',
      };
    }

    const processingTime = Date.now() - startTime;

    await prisma.aIAnalysisLog.create({
      data: {
        module: 'asset_allocation',
        userId: req.user.id,
        inputData: { riskTolerance: risk, timeHorizonYears, annualIncome, investableAssets, goals, ageBracket },
        outputData: allocation,
        modelUsed,
        confidence: modelUsed === 'openrouter' ? 85 : 65,
        processingTime,
      },
    });

    res.json({
      analysis: allocation,
      poweredBy: modelUsed === 'openrouter' ? 'OpenRouter AI' : 'Local Algorithm',
      processingTime,
    });
  } catch (error) {
    console.error('Asset-allocation error:', error);
    res.status(500).json({ error: 'Failed to generate asset allocation' });
  }
});

// ============================================================
// POST /api/ai/rebalancing-suggest
// ============================================================
// Compares current portfolio holdings to a target allocation
// (provided by client or default 60/40) and returns specific
// trade recommendations to bring allocation back in line.
// ============================================================
router.post('/rebalancing-suggest', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const prisma = req.app.get('prisma');
    const {
      targetAllocation = { stocks: 60, bonds: 30, cash: 5, alternatives: 5 },
      driftThresholdPct = 5,
    } = req.body || {};

    const portfolios = await prisma.portfolio.findMany({
      where: { userId: req.user.id },
      include: { holdings: true },
    });

    if (!portfolios.length) {
      return res.status(400).json({ error: 'No portfolios found.' });
    }

    // Sum current value by asset type
    const buckets = { stocks: 0, bonds: 0, cash: 0, alternatives: 0 };
    let totalValue = 0;
    const flatHoldings = [];
    for (const p of portfolios) {
      for (const h of p.holdings) {
        const price = h.currentPrice ?? h.avgCost;
        const value = h.shares * price;
        totalValue += value;
        const t = String(h.assetType || '').toLowerCase();
        const bucket =
          t.includes('bond') || t === 'fixed_income' ? 'bonds' :
          t.includes('cash') || t === 'money_market' ? 'cash' :
          t.includes('crypto') || t.includes('reit') || t.includes('commodity') || t.includes('alt') ? 'alternatives' :
          'stocks';
        buckets[bucket] += value;
        flatHoldings.push({ symbol: h.symbol, name: h.name, assetType: h.assetType, shares: h.shares, value, bucket });
      }
    }

    if (totalValue <= 0) {
      return res.status(400).json({ error: 'Portfolio has no priced holdings.' });
    }

    const currentAllocationPct = {};
    const driftPct = {};
    let maxDrift = 0;
    for (const k of Object.keys(buckets)) {
      const pct = (buckets[k] / totalValue) * 100;
      currentAllocationPct[k] = parseFloat(pct.toFixed(2));
      const target = Number(targetAllocation[k] || 0);
      driftPct[k] = parseFloat((pct - target).toFixed(2));
      maxDrift = Math.max(maxDrift, Math.abs(driftPct[k]));
    }

    const needsRebalance = maxDrift > Number(driftThresholdPct);

    let recommendations;
    let modelUsed = 'openrouter';

    if (!needsRebalance) {
      recommendations = {
        summary: `Portfolio is within ${driftThresholdPct}% drift threshold; no rebalancing needed.`,
        needsRebalance: false,
        trades: [],
        currentAllocationPct,
        driftPct,
        targetAllocation,
        rationale: `Maximum drift is ${maxDrift.toFixed(2)}%, below the ${driftThresholdPct}% threshold.`,
      };
      modelUsed = 'local_fallback';
    } else {
      const prompt = `You are an investment advisor recommending portfolio rebalancing trades.

PORTFOLIO VALUE: $${totalValue.toFixed(2)}

CURRENT ALLOCATION (% of total):
${JSON.stringify(currentAllocationPct, null, 2)}

TARGET ALLOCATION (%):
${JSON.stringify(targetAllocation, null, 2)}

DRIFT (current - target, %):
${JSON.stringify(driftPct, null, 2)}

CURRENT HOLDINGS:
${JSON.stringify(flatHoldings, null, 2)}

Suggest concrete BUY/SELL trades to restore the target allocation. Prefer minimal trades.
Respond ONLY with valid JSON:
{
  "summary": "2-3 sentence summary",
  "needsRebalance": true,
  "trades": [
    { "action": "SELL"|"BUY", "symbol": "X", "approximateDollars": 0, "rationale": "..." }
  ],
  "currentAllocationPct": ${JSON.stringify(currentAllocationPct)},
  "targetAllocation": ${JSON.stringify(targetAllocation)},
  "driftPct": ${JSON.stringify(driftPct)},
  "taxConsiderations": "brief note on tax-aware execution",
  "disclaimer": "Not personalized financial advice."
}`;

      try {
        const aiResponse = await callOpenRouter(prompt, 'You are an expert investment advisor. Return only valid JSON.', { temperature: 0.2 });
        const parsed = parseAIJson(aiResponse);
        if (!parsed) throw new Error('No JSON in AI response');
        recommendations = parsed;
      } catch (aiErr) {
        console.error('Rebalancing AI call failed:', aiErr.message);
        modelUsed = 'local_fallback';
        const trades = [];
        for (const k of Object.keys(buckets)) {
          const target = Number(targetAllocation[k] || 0);
          const targetDollars = (target / 100) * totalValue;
          const delta = targetDollars - buckets[k];
          if (Math.abs(delta) > totalValue * 0.01) {
            trades.push({
              action: delta > 0 ? 'BUY' : 'SELL',
              symbol: k.toUpperCase(),
              approximateDollars: parseFloat(Math.abs(delta).toFixed(2)),
              rationale: `Bucket "${k}" is ${driftPct[k]}% off target.`,
            });
          }
        }
        recommendations = {
          summary: `Rebalancing required; max drift ${maxDrift.toFixed(2)}%.`,
          needsRebalance: true,
          trades,
          currentAllocationPct,
          targetAllocation,
          driftPct,
          taxConsiderations: 'Prefer tax-advantaged accounts for trades; in taxable accounts, harvest losses first.',
          disclaimer: 'AI-generated suggestion. Consult an advisor.',
        };
      }
    }

    const processingTime = Date.now() - startTime;
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'rebalancing_suggest',
        userId: req.user.id,
        inputData: { totalValue, currentAllocationPct, targetAllocation, driftPct },
        outputData: recommendations,
        modelUsed,
        confidence: modelUsed === 'openrouter' ? 86 : 70,
        processingTime,
      },
    });

    res.json({
      analysis: recommendations,
      portfolio: { totalValue, currentAllocationPct, driftPct, maxDrift },
      poweredBy: modelUsed === 'openrouter' ? 'OpenRouter AI' : 'Local Algorithm',
      processingTime,
    });
  } catch (error) {
    console.error('Rebalancing-suggest error:', error);
    res.status(500).json({ error: 'Failed to generate rebalancing suggestions' });
  }
});

// ============================================================
// POST /api/ai/budget-optimize
// ============================================================
// Accepts a list of monthly expenses (or pulls from
// transactionImport later) and returns AI-driven recommendations
// for cuts and reallocations against an income target.
// ============================================================
router.post('/budget-optimize', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const prisma = req.app.get('prisma');
    const {
      monthlyIncome,
      monthlyExpenses = [],
      savingsGoalPct = 20,
      notes = '',
    } = req.body || {};

    if (!monthlyIncome || !Array.isArray(monthlyExpenses) || monthlyExpenses.length === 0) {
      return res.status(400).json({ error: 'monthlyIncome and a non-empty monthlyExpenses array are required.' });
    }

    const totalExpenses = monthlyExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const surplus = Number(monthlyIncome) - totalExpenses;
    const savingsTargetDollars = (Number(savingsGoalPct) / 100) * Number(monthlyIncome);
    const gap = savingsTargetDollars - surplus;

    let recommendations;
    let modelUsed = 'openrouter';

    const prompt = `You are a personal finance coach. Suggest budget optimizations.

INCOME: $${Number(monthlyIncome).toFixed(2)}/mo
TOTAL EXPENSES: $${totalExpenses.toFixed(2)}/mo
CURRENT SURPLUS: $${surplus.toFixed(2)}/mo
SAVINGS GOAL: ${savingsGoalPct}% of income ($${savingsTargetDollars.toFixed(2)})
GAP TO GOAL: $${gap.toFixed(2)} (positive means need to cut spending)

EXPENSES:
${JSON.stringify(monthlyExpenses, null, 2)}

NOTES: ${notes}

Respond ONLY with valid JSON:
{
  "summary": "2-3 sentence overview",
  "totals": { "income": ${monthlyIncome}, "expenses": ${totalExpenses.toFixed(2)}, "surplus": ${surplus.toFixed(2)}, "savingsTarget": ${savingsTargetDollars.toFixed(2)}, "gap": ${gap.toFixed(2)} },
  "cutRecommendations": [
    { "category": "X", "currentMonthly": 0, "suggestedMonthly": 0, "monthlySavings": 0, "rationale": "..." }
  ],
  "reallocationSuggestions": [
    { "fromCategory": "X", "toBucket": "savings|debt|investments", "amount": 0, "rationale": "..." }
  ],
  "habits": ["short actionable habit 1", "..."],
  "disclaimer": "AI suggestion, not professional advice."
}`;

    try {
      const aiResponse = await callOpenRouter(prompt, 'You are an expert personal finance coach. Return only valid JSON.', { temperature: 0.3 });
      const parsed = parseAIJson(aiResponse);
      if (!parsed) throw new Error('No JSON in AI response');
      recommendations = parsed;
    } catch (aiErr) {
      console.error('Budget-optimize AI call failed:', aiErr.message);
      modelUsed = 'local_fallback';
      // Heuristic: trim the largest discretionary categories by 10%
      const sorted = [...monthlyExpenses].sort((a, b) => Number(b.amount) - Number(a.amount));
      const cutRecommendations = sorted.slice(0, 3).map(e => {
        const suggested = Math.max(0, Number(e.amount) * 0.9);
        return {
          category: e.category || e.name || 'expense',
          currentMonthly: Number(e.amount),
          suggestedMonthly: parseFloat(suggested.toFixed(2)),
          monthlySavings: parseFloat((Number(e.amount) - suggested).toFixed(2)),
          rationale: 'Trim 10% from largest categories as a starting point.',
        };
      });
      recommendations = {
        summary: gap > 0
          ? `You need to free up about $${gap.toFixed(2)}/mo to hit a ${savingsGoalPct}% savings rate.`
          : `You are already meeting your ${savingsGoalPct}% savings goal.`,
        totals: {
          income: Number(monthlyIncome),
          expenses: parseFloat(totalExpenses.toFixed(2)),
          surplus: parseFloat(surplus.toFixed(2)),
          savingsTarget: parseFloat(savingsTargetDollars.toFixed(2)),
          gap: parseFloat(gap.toFixed(2)),
        },
        cutRecommendations,
        reallocationSuggestions: surplus > 0
          ? [{ fromCategory: 'surplus', toBucket: 'savings', amount: parseFloat(Math.min(surplus, savingsTargetDollars).toFixed(2)), rationale: 'Direct surplus into savings/investments first.' }]
          : [],
        habits: [
          'Review subscriptions monthly and cancel unused ones.',
          'Set up an automatic transfer to savings on payday.',
          'Use a 24-hour rule for non-essential purchases over $50.',
        ],
        disclaimer: 'AI-generated suggestion. Not professional financial advice.',
      };
    }

    const processingTime = Date.now() - startTime;
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'budget_optimize',
        userId: req.user.id,
        inputData: { monthlyIncome, totalExpenses, surplus, savingsGoalPct, expenseCount: monthlyExpenses.length },
        outputData: recommendations,
        modelUsed,
        confidence: modelUsed === 'openrouter' ? 84 : 65,
        processingTime,
      },
    });

    res.json({
      analysis: recommendations,
      poweredBy: modelUsed === 'openrouter' ? 'OpenRouter AI' : 'Local Algorithm',
      processingTime,
    });
  } catch (error) {
    console.error('Budget-optimize error:', error);
    res.status(500).json({ error: 'Failed to generate budget optimization' });
  }
});

// ============================================================
// Helper: detect missing-API-key errors and surface 503
// ============================================================
function isMissingKeyError(err) {
  const msg = (err && err.message) || '';
  return /OPENROUTER_API_KEY/i.test(msg);
}

// ============================================================
// POST /api/ai/stock-recommend
// ============================================================
// Body: { riskProfile, sectors[], maxRecommendations, capitalUSD }
// Returns AI-generated stock recommendations.
// ============================================================
router.post('/stock-recommend', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const prisma = req.app.get('prisma');
    const {
      riskProfile = 'moderate',
      sectors = [],
      maxRecommendations = 5,
      capitalUSD = null,
      preferences = {},
    } = req.body || {};

    const prompt = `You are a CFA-certified equity analyst. Recommend up to ${maxRecommendations} publicly traded stocks for an investor with the following profile.

INVESTOR PROFILE:
- Risk profile: ${riskProfile}
- Preferred sectors: ${JSON.stringify(sectors)}
- Capital available (USD): ${capitalUSD ?? 'unspecified'}
- Preferences: ${JSON.stringify(preferences)}

Respond ONLY with valid JSON:
{
  "summary": "<text>",
  "recommendations": [
    { "ticker": "<symbol>", "company": "<name>", "sector": "<text>", "rationale": "<text>", "thesis": "<text>", "risk_factors": ["..."], "suggested_weight_pct": 0 }
  ],
  "disclaimer": "Not personalized financial advice."
}`;

    let recommendations;
    let modelUsed = 'openrouter';
    try {
      const aiResponse = await callOpenRouter(prompt, 'You are a CFA-certified equity analyst. Respond only with valid JSON.', { temperature: 0.3 });
      const parsed = parseAIJson(aiResponse);
      if (!parsed) throw new Error('No JSON in AI response');
      recommendations = parsed;
    } catch (aiErr) {
      if (isMissingKeyError(aiErr)) {
        return res.status(503).json({ error: 'AI service unavailable: OPENROUTER_API_KEY is not configured' });
      }
      console.error('Stock-recommend AI call failed:', aiErr.message);
      modelUsed = 'local_fallback';
      recommendations = {
        summary: `Default ${riskProfile} watchlist; AI service unavailable.`,
        recommendations: [
          { ticker: 'VTI', company: 'Vanguard Total Stock Market ETF', sector: 'Diversified', rationale: 'Broad US market exposure', thesis: 'Buy-and-hold core holding', risk_factors: ['Market risk'], suggested_weight_pct: 60 },
          { ticker: 'VXUS', company: 'Vanguard Total International Stock ETF', sector: 'Diversified Intl', rationale: 'International diversification', thesis: 'Hedge against US-only concentration', risk_factors: ['FX risk'], suggested_weight_pct: 25 },
          { ticker: 'BND', company: 'Vanguard Total Bond Market ETF', sector: 'Fixed Income', rationale: 'Lower volatility ballast', thesis: 'Stabilize portfolio', risk_factors: ['Interest rate risk'], suggested_weight_pct: 15 },
        ],
        disclaimer: 'Not personalized financial advice. Consult a registered investment advisor.',
      };
    }

    const processingTime = Date.now() - startTime;
    try {
      await prisma.aIAnalysisLog.create({
        data: {
          module: 'stock_recommend',
          userId: req.user.id,
          inputData: { riskProfile, sectors, maxRecommendations, capitalUSD },
          outputData: recommendations,
          modelUsed,
          confidence: modelUsed === 'openrouter' ? 80 : 55,
          processingTime,
        },
      });
    } catch (_) {}

    res.json({
      analysis: recommendations,
      poweredBy: modelUsed === 'openrouter' ? 'OpenRouter AI' : 'Local Fallback',
      processingTime,
    });
  } catch (error) {
    console.error('Stock-recommend error:', error);
    res.status(500).json({ error: 'Failed to generate stock recommendations' });
  }
});

// ============================================================
// POST /api/ai/insurance-recommend
// ============================================================
// Body: { age, dependents, annualIncome, existingPolicies[], goals[] }
// Returns AI-generated insurance product recommendations.
// ============================================================
router.post('/insurance-recommend', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const prisma = req.app.get('prisma');
    const {
      age = null,
      dependents = 0,
      annualIncome = null,
      existingPolicies = [],
      goals = [],
      healthStatus = 'unspecified',
    } = req.body || {};

    const prompt = `You are a licensed insurance advisor. Recommend insurance products tailored to the user's life situation.

INPUTS:
- Age: ${age ?? 'unspecified'}
- Number of dependents: ${dependents}
- Annual income: ${annualIncome ?? 'unspecified'}
- Existing policies: ${JSON.stringify(existingPolicies)}
- Goals: ${JSON.stringify(goals)}
- Health status: ${healthStatus}

Respond ONLY with valid JSON:
{
  "summary": "<text>",
  "recommendations": [
    { "product": "term-life|whole-life|disability|umbrella|long-term-care|health|auto|home|renters", "priority": "high|medium|low", "suggested_coverage_usd": 0, "rationale": "<text>", "providers_to_quote": ["..."] }
  ],
  "coverage_gaps": ["..."],
  "disclaimer": "Not personalized insurance advice."
}`;

    let recommendations;
    let modelUsed = 'openrouter';
    try {
      const aiResponse = await callOpenRouter(prompt, 'You are a licensed insurance advisor. Respond only with valid JSON.', { temperature: 0.2 });
      const parsed = parseAIJson(aiResponse);
      if (!parsed) throw new Error('No JSON in AI response');
      recommendations = parsed;
    } catch (aiErr) {
      if (isMissingKeyError(aiErr)) {
        return res.status(503).json({ error: 'AI service unavailable: OPENROUTER_API_KEY is not configured' });
      }
      console.error('Insurance-recommend AI call failed:', aiErr.message);
      modelUsed = 'local_fallback';
      const incomeMult = (annualIncome || 0) * 10;
      recommendations = {
        summary: 'Heuristic baseline recommendations; AI unavailable.',
        recommendations: [
          { product: 'term-life', priority: dependents > 0 ? 'high' : 'low', suggested_coverage_usd: incomeMult || 500000, rationale: '10x income rule of thumb for income replacement.', providers_to_quote: ['Haven Life', 'Bestow', 'Policygenius'] },
          { product: 'disability', priority: 'high', suggested_coverage_usd: Math.round((annualIncome || 60000) * 0.6), rationale: 'Replace ~60% of income if you cannot work.', providers_to_quote: ['Guardian', 'Principal'] },
        ],
        coverage_gaps: existingPolicies.length === 0 ? ['No existing coverage detected'] : [],
        disclaimer: 'Not personalized insurance advice. Consult a licensed broker.',
      };
    }

    const processingTime = Date.now() - startTime;
    try {
      await prisma.aIAnalysisLog.create({
        data: {
          module: 'insurance_recommend',
          userId: req.user.id,
          inputData: { age, dependents, annualIncome, existingPolicies, goals, healthStatus },
          outputData: recommendations,
          modelUsed,
          confidence: modelUsed === 'openrouter' ? 82 : 60,
          processingTime,
        },
      });
    } catch (_) {}

    res.json({
      analysis: recommendations,
      poweredBy: modelUsed === 'openrouter' ? 'OpenRouter AI' : 'Local Fallback',
      processingTime,
    });
  } catch (error) {
    console.error('Insurance-recommend error:', error);
    res.status(500).json({ error: 'Failed to generate insurance recommendations' });
  }
});

// ============================================================
// POST /api/ai/retirement-project
// ============================================================
// Body: { currentAge, retirementAge, currentSavings, monthlyContribution, expectedReturn, targetIncome }
// Returns AI projection of retirement readiness with scenario analysis.
// ============================================================
router.post('/retirement-project', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const prisma = req.app.get('prisma');
    const {
      currentAge = 35,
      retirementAge = 65,
      currentSavings = 0,
      monthlyContribution = 0,
      expectedReturnPct = 7,
      targetAnnualIncome = null,
      lifeExpectancy = 90,
    } = req.body || {};

    // Deterministic baseline projection (compound growth)
    const yearsToRetire = Math.max(0, retirementAge - currentAge);
    const r = expectedReturnPct / 100;
    const monthlyRate = r / 12;
    const months = yearsToRetire * 12;
    const fvCurrent = currentSavings * Math.pow(1 + r, yearsToRetire);
    const fvContribs = monthlyRate > 0
      ? monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
      : monthlyContribution * months;
    const projectedNestEgg = Math.round(fvCurrent + fvContribs);

    const prompt = `You are a CFP-certified retirement planner. Project retirement readiness.

INPUTS:
- Current age: ${currentAge}
- Retirement age: ${retirementAge}
- Current savings: ${currentSavings}
- Monthly contribution: ${monthlyContribution}
- Expected annual return: ${expectedReturnPct}%
- Target annual retirement income: ${targetAnnualIncome ?? 'unspecified'}
- Life expectancy: ${lifeExpectancy}
- Deterministic projected nest egg at retirement: ${projectedNestEgg}

Respond ONLY with valid JSON:
{
  "readiness": "on-track|behind|critical|ahead",
  "summary": "<text>",
  "projections": {
    "nest_egg_usd": 0,
    "annual_income_4pct_rule_usd": 0,
    "shortfall_or_surplus_usd": 0
  },
  "scenarios": [
    { "name": "<text>", "delta": "<text>", "outcome": "<text>" }
  ],
  "recommendations": ["..."],
  "disclaimer": "Educational only — not personalized financial advice."
}`;

    let projection;
    let modelUsed = 'openrouter';
    try {
      const aiResponse = await callOpenRouter(prompt, 'You are a CFP-certified retirement planner. Respond only with valid JSON.', { temperature: 0.2 });
      const parsed = parseAIJson(aiResponse);
      if (!parsed) throw new Error('No JSON in AI response');
      projection = parsed;
    } catch (aiErr) {
      if (isMissingKeyError(aiErr)) {
        return res.status(503).json({ error: 'AI service unavailable: OPENROUTER_API_KEY is not configured' });
      }
      console.error('Retirement-project AI call failed:', aiErr.message);
      modelUsed = 'local_fallback';
      const annualIncome4pct = Math.round(projectedNestEgg * 0.04);
      const shortfall = targetAnnualIncome ? annualIncome4pct - targetAnnualIncome : null;
      projection = {
        readiness: targetAnnualIncome
          ? (annualIncome4pct >= targetAnnualIncome ? 'on-track' : 'behind')
          : 'on-track',
        summary: `Deterministic projection: nest egg ~$${projectedNestEgg.toLocaleString()} by age ${retirementAge}.`,
        projections: {
          nest_egg_usd: projectedNestEgg,
          annual_income_4pct_rule_usd: annualIncome4pct,
          shortfall_or_surplus_usd: shortfall,
        },
        scenarios: [
          { name: 'Increase contribution +20%', delta: `+$${Math.round(monthlyContribution * 0.2)}/mo`, outcome: 'Boosts nest egg materially over time.' },
          { name: 'Delay retirement 2 years', delta: `+2 years compounding`, outcome: 'Significantly increases income capacity.' },
        ],
        recommendations: ['Maximize tax-advantaged contributions (401k, IRA)', 'Review allocation annually', 'Build a 6-month emergency fund'],
        disclaimer: 'Educational only — not personalized financial advice.',
      };
    }

    const processingTime = Date.now() - startTime;
    try {
      await prisma.aIAnalysisLog.create({
        data: {
          module: 'retirement_project',
          userId: req.user.id,
          inputData: { currentAge, retirementAge, currentSavings, monthlyContribution, expectedReturnPct, targetAnnualIncome, lifeExpectancy },
          outputData: projection,
          modelUsed,
          confidence: modelUsed === 'openrouter' ? 83 : 70,
          processingTime,
        },
      });
    } catch (_) {}

    res.json({
      analysis: projection,
      poweredBy: modelUsed === 'openrouter' ? 'OpenRouter AI' : 'Deterministic Compound Model',
      processingTime,
      deterministicProjectedNestEgg: projectedNestEgg,
    });
  } catch (error) {
    console.error('Retirement-project error:', error);
    res.status(500).json({ error: 'Failed to generate retirement projection' });
  }
});

// ============================================================
// APPLY PASS 5 — backlog endpoints
// ============================================================

// ============================================================
// POST /api/ai/fraud-detect (NEEDS-PRODUCT-DECISION)
// PRODUCT-DECISION: rule-based fraudDetection.js exists; this AI version
// scores transactions on amount-vs-baseline, merchant-category novelty,
// geo/time anomalies, and velocity. We use AI to weight signals because
// labeled fraud data isn't available in this codebase. The endpoint
// expects pre-extracted features; ML training is out of scope.
// ============================================================
router.post('/fraud-detect', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const prisma = req.app.get('prisma');
    const { transactions = [], userBaseline = {} } = req.body || {};
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'transactions[] required' });
    }
    // PRODUCT-DECISION: cap transaction list at 100 to keep latency bounded
    const txs = transactions.slice(0, 100);

    const prompt = `You are a fraud-detection analyst. Score each transaction for fraud risk.

USER BASELINE: ${JSON.stringify(userBaseline)}
TRANSACTIONS (${txs.length}): ${JSON.stringify(txs)}

Respond ONLY with valid JSON:
{
  "summary": "<text>",
  "results": [
    { "id": "<tx id>", "fraud_score": 0-100, "severity": "low|medium|high|critical",
      "signals": ["amount_anomaly","geo_velocity","merchant_novelty",...],
      "reason": "<text>", "recommended_action": "alert|block|review|allow" }
  ],
  "global_recommendations": ["..."]
}`;

    let result; let modelUsed = 'openrouter';
    try {
      const ai = await callOpenRouter(prompt, 'You are a fraud detection analyst. Respond only with valid JSON.', { temperature: 0.2 });
      const parsed = parseAIJson(ai);
      if (!parsed) throw new Error('No JSON in AI response');
      result = parsed;
    } catch (aiErr) {
      if (isMissingKeyError(aiErr)) {
        return res.status(503).json({ error: 'AI service unavailable: OPENROUTER_API_KEY is not configured' });
      }
      // Deterministic fallback: flag tx > 3x avg or amount > $5000
      modelUsed = 'fallback';
      const baselineAvg = userBaseline.avgTransactionUSD || 100;
      result = {
        summary: 'Heuristic fallback used.',
        results: txs.map(t => {
          const amt = Number(t.amount || 0);
          const score = amt > 5000 ? 90 : amt > baselineAvg * 3 ? 70 : amt > baselineAvg * 1.5 ? 35 : 10;
          return {
            id: t.id || String(amt),
            fraud_score: score,
            severity: score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low',
            signals: amt > baselineAvg * 3 ? ['amount_anomaly'] : [],
            reason: amt > baselineAvg * 3 ? 'Amount > 3x baseline' : 'Within normal range',
            recommended_action: score >= 80 ? 'review' : 'allow'
          };
        }),
        global_recommendations: ['Review high-score transactions manually.']
      };
    }

    const processingTime = Date.now() - startTime;
    try {
      await prisma.aIAnalysisLog.create({
        data: {
          module: 'fraud_detect', userId: req.user.id,
          inputData: { tx_count: txs.length, userBaseline },
          outputData: result, modelUsed, confidence: modelUsed === 'openrouter' ? 80 : 50, processingTime,
        },
      });
    } catch (_) {}

    res.json({ analysis: result, poweredBy: modelUsed === 'openrouter' ? 'OpenRouter AI' : 'Heuristic Fallback', processingTime });
  } catch (error) {
    console.error('Fraud-detect error:', error);
    res.status(500).json({ error: 'Failed to run fraud detection' });
  }
});

// ============================================================
// POST /api/ai/bill-negotiate (NEEDS-PRODUCT-DECISION)
// PRODUCT-DECISION: real bill-negotiation requires partner integrations
// (Truebill / Rocket Money). We provide an AI advisor that drafts a
// negotiation script + escalation path the user can execute themselves.
// ============================================================
router.post('/bill-negotiate', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const prisma = req.app.get('prisma');
    const { provider, currentBillUSD, billType, tenureMonths, competitorOffer } = req.body || {};
    if (!provider || !currentBillUSD) {
      return res.status(400).json({ error: 'provider and currentBillUSD required' });
    }
    const prompt = `You are a consumer bill-negotiation expert. Draft a negotiation plan.

PROVIDER: ${provider}
BILL TYPE: ${billType || 'unspecified'}
CURRENT BILL (USD/month): ${currentBillUSD}
TENURE (months): ${tenureMonths || 'unknown'}
COMPETITOR OFFER: ${competitorOffer || 'none'}

Respond ONLY with valid JSON:
{
  "summary": "<text>",
  "expected_savings_pct": 0-100,
  "negotiation_script": "<full phone script>",
  "talking_points": ["..."],
  "escalation_path": ["frontline","retention","supervisor"],
  "alternative_providers": ["..."],
  "tips": ["..."]
}`;
    let result; let modelUsed = 'openrouter';
    try {
      const ai = await callOpenRouter(prompt, 'Respond only with valid JSON.', { temperature: 0.4 });
      const parsed = parseAIJson(ai);
      if (!parsed) throw new Error('No JSON in AI response');
      result = parsed;
    } catch (aiErr) {
      if (isMissingKeyError(aiErr)) {
        return res.status(503).json({ error: 'AI service unavailable: OPENROUTER_API_KEY is not configured' });
      }
      modelUsed = 'fallback';
      result = {
        summary: 'Generic negotiation plan.',
        expected_savings_pct: 15,
        negotiation_script: `Hi, I've been a customer for ${tenureMonths || 12} months. I'd like a loyalty discount or to be transferred to retention.`,
        talking_points: ['Mention tenure', 'Mention competitor offer'],
        escalation_path: ['frontline', 'retention', 'supervisor'],
        alternative_providers: [],
        tips: ['Be polite but firm', 'Be ready to cancel']
      };
    }
    const processingTime = Date.now() - startTime;
    try {
      await prisma.aIAnalysisLog.create({
        data: { module: 'bill_negotiate', userId: req.user.id, inputData: { provider, currentBillUSD }, outputData: result, modelUsed, confidence: 75, processingTime }
      });
    } catch (_) {}
    res.json({ analysis: result, poweredBy: modelUsed === 'openrouter' ? 'OpenRouter AI' : 'Template', processingTime });
  } catch (error) {
    console.error('Bill-negotiate error:', error);
    res.status(500).json({ error: 'Failed to generate negotiation plan' });
  }
});

// ============================================================
// POST /api/ai/agentic-advice (custom feature: multi-step agentic advisor)
// ============================================================
router.post('/agentic-advice', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const prisma = req.app.get('prisma');
    const { goals = [], portfolio = {}, taxSituation = {}, timeline } = req.body || {};
    const prompt = `You are a multi-step financial planning agent. Sequence reasoning over goals, portfolio, taxes, and timeline.

GOALS: ${JSON.stringify(goals)}
PORTFOLIO: ${JSON.stringify(portfolio)}
TAX: ${JSON.stringify(taxSituation)}
TIMELINE: ${timeline || 'unspecified'}

Plan in steps. Respond ONLY with valid JSON:
{
  "summary": "<text>",
  "plan": [ { "step": 1, "topic": "...", "action": "...", "expected_outcome": "...", "rationale": "..." } ],
  "risks": ["..."],
  "next_review": "<text>"
}`;
    let result; let modelUsed = 'openrouter';
    try {
      const ai = await callOpenRouter(prompt, 'Respond only with valid JSON.', { temperature: 0.3 });
      const parsed = parseAIJson(ai);
      if (!parsed) throw new Error('No JSON');
      result = parsed;
    } catch (aiErr) {
      if (isMissingKeyError(aiErr)) {
        return res.status(503).json({ error: 'AI service unavailable: OPENROUTER_API_KEY is not configured' });
      }
      modelUsed = 'fallback';
      result = { summary: 'Heuristic plan', plan: goals.map((g, i) => ({ step: i + 1, topic: g.name || `Goal ${i+1}`, action: 'Set monthly automation', expected_outcome: 'Steady progress', rationale: 'Dollar-cost averaging' })), risks: [], next_review: '6 months' };
    }
    const processingTime = Date.now() - startTime;
    try {
      await prisma.aIAnalysisLog.create({
        data: { module: 'agentic_advice', userId: req.user.id, inputData: { goal_count: goals.length }, outputData: result, modelUsed, confidence: 78, processingTime }
      });
    } catch (_) {}
    res.json({ analysis: result, poweredBy: modelUsed === 'openrouter' ? 'OpenRouter AI' : 'Heuristic', processingTime });
  } catch (error) {
    console.error('Agentic-advice error:', error);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// ============================================================
// POST /api/ai/behavioral-nudge (custom feature)
// ============================================================
router.post('/behavioral-nudge', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const prisma = req.app.get('prisma');
    const { recentBehavior = {}, goals = [], emotionalContext = '' } = req.body || {};
    const prompt = `You are a behavioral finance coach. Suggest 3-5 specific nudges.

BEHAVIOR: ${JSON.stringify(recentBehavior)}
GOALS: ${JSON.stringify(goals)}
EMOTIONAL CONTEXT: ${emotionalContext}

Respond ONLY with valid JSON:
{
  "summary": "<text>",
  "nudges": [
    { "type": "save|spend|invest|review", "headline": "<text>", "body": "<text>", "urgency": "low|medium|high", "action_cta": "<text>" }
  ]
}`;
    let result; let modelUsed = 'openrouter';
    try {
      const ai = await callOpenRouter(prompt, 'Respond only with valid JSON.', { temperature: 0.5 });
      const parsed = parseAIJson(ai);
      if (!parsed) throw new Error('No JSON');
      result = parsed;
    } catch (aiErr) {
      if (isMissingKeyError(aiErr)) {
        return res.status(503).json({ error: 'AI service unavailable: OPENROUTER_API_KEY is not configured' });
      }
      modelUsed = 'fallback';
      result = { summary: 'Static nudges', nudges: [
        { type: 'save', headline: 'Auto-save 20%', body: 'Move 20% of next paycheck to savings.', urgency: 'medium', action_cta: 'Set up auto-save' },
        { type: 'review', headline: 'Weekly check-in', body: 'Review your spending every Sunday.', urgency: 'low', action_cta: 'Schedule reminder' }
      ]};
    }
    const processingTime = Date.now() - startTime;
    try {
      await prisma.aIAnalysisLog.create({
        data: { module: 'behavioral_nudge', userId: req.user.id, inputData: { has_emotional: !!emotionalContext }, outputData: result, modelUsed, confidence: 70, processingTime }
      });
    } catch (_) {}
    res.json({ analysis: result, poweredBy: modelUsed === 'openrouter' ? 'OpenRouter AI' : 'Static', processingTime });
  } catch (error) {
    console.error('Behavioral-nudge error:', error);
    res.status(500).json({ error: 'Failed to generate nudges' });
  }
});

// ============================================================
// POST /api/ai/espp-rsu-optimize (custom feature)
// ============================================================
router.post('/espp-rsu-optimize', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  try {
    const prisma = req.app.get('prisma');
    const { esppPlan = {}, rsuGrants = [], currentSalary, taxBracketPct, marketOutlook } = req.body || {};
    const prompt = `You are an equity-comp tax optimizer. Recommend ESPP/RSU sale & hold strategy.

ESPP: ${JSON.stringify(esppPlan)}
RSU GRANTS: ${JSON.stringify(rsuGrants)}
SALARY: ${currentSalary || 'unspecified'}
TAX BRACKET %: ${taxBracketPct ?? 'unspecified'}
MARKET OUTLOOK: ${marketOutlook || 'neutral'}

Respond ONLY with valid JSON:
{
  "summary": "<text>",
  "espp_strategy": { "participation_pct": 0-100, "sell_at_purchase": true|false, "rationale": "<text>" },
  "rsu_strategy": [ { "grant_id": "<id>", "action": "sell|hold|partial_sell", "fraction": 0-1, "rationale": "<text>" } ],
  "tax_warnings": ["..."],
  "diversification_notes": ["..."]
}`;
    let result; let modelUsed = 'openrouter';
    try {
      const ai = await callOpenRouter(prompt, 'Respond only with valid JSON.', { temperature: 0.3 });
      const parsed = parseAIJson(ai);
      if (!parsed) throw new Error('No JSON');
      result = parsed;
    } catch (aiErr) {
      if (isMissingKeyError(aiErr)) {
        return res.status(503).json({ error: 'AI service unavailable: OPENROUTER_API_KEY is not configured' });
      }
      modelUsed = 'fallback';
      result = {
        summary: 'Default: max ESPP, sell RSU at vest, diversify.',
        espp_strategy: { participation_pct: 15, sell_at_purchase: true, rationale: 'Lock in discount, avoid concentration risk' },
        rsu_strategy: rsuGrants.map(g => ({ grant_id: g.id || 'unknown', action: 'sell', fraction: 1.0, rationale: 'Reduce single-stock risk' })),
        tax_warnings: ['Sale at vest is taxed as ordinary income.'],
        diversification_notes: ['Aim for <10% net worth in employer stock.']
      };
    }
    const processingTime = Date.now() - startTime;
    try {
      await prisma.aIAnalysisLog.create({
        data: { module: 'espp_rsu_optimize', userId: req.user.id, inputData: { rsu_count: rsuGrants.length }, outputData: result, modelUsed, confidence: 78, processingTime }
      });
    } catch (_) {}
    res.json({ analysis: result, poweredBy: modelUsed === 'openrouter' ? 'OpenRouter AI' : 'Heuristic', processingTime });
  } catch (error) {
    console.error('ESPP-RSU error:', error);
    res.status(500).json({ error: 'Failed to optimize equity comp' });
  }
});

// ============================================================
// POST /api/ai/yodlee-aggregate (NEEDS-CREDS — Yodlee API)
// Env: YODLEE_API_URL, YODLEE_CLIENT_ID, YODLEE_SECRET
// ============================================================
router.post('/yodlee-aggregate', authenticateToken, async (req, res) => {
  const missing = ['YODLEE_API_URL', 'YODLEE_CLIENT_ID', 'YODLEE_SECRET'].filter(k => !process.env[k]);
  if (missing.length) return res.status(503).json({ error: 'Yodlee integration unavailable', missing: missing.join(', ') });
  // Stub: real impl would use Yodlee FastLink + REST API
  res.json({ success: false, error: 'Yodlee aggregation pending implementation; creds detected.' });
});

// ============================================================
// POST /api/ai/mx-aggregate (NEEDS-CREDS — MX/Atrium API)
// Env: MX_API_URL, MX_CLIENT_ID, MX_API_KEY
// ============================================================
router.post('/mx-aggregate', authenticateToken, async (req, res) => {
  const missing = ['MX_API_URL', 'MX_CLIENT_ID', 'MX_API_KEY'].filter(k => !process.env[k]);
  if (missing.length) return res.status(503).json({ error: 'MX integration unavailable', missing: missing.join(', ') });
  res.json({ success: false, error: 'MX aggregation pending implementation; creds detected.' });
});

// ============================================================
// POST /api/ai/esg-screen (NEEDS-CREDS — MSCI / Sustainalytics)
// Env: ESG_API_URL, ESG_API_KEY
// ============================================================
router.post('/esg-screen', authenticateToken, async (req, res) => {
  const missing = ['ESG_API_URL', 'ESG_API_KEY'].filter(k => !process.env[k]);
  if (missing.length) return res.status(503).json({ error: 'ESG data feed unavailable', missing: missing.join(', ') });
  res.json({ success: false, error: 'ESG screening pending implementation; creds detected.' });
});

// ============================================================
// POST /api/ai/defi-yield (NEEDS-CREDS — on-chain provider, e.g. The Graph / DeFiLlama)
// Env: DEFI_DATA_URL, DEFI_API_KEY
// ============================================================
router.post('/defi-yield', authenticateToken, async (req, res) => {
  const missing = ['DEFI_DATA_URL', 'DEFI_API_KEY'].filter(k => !process.env[k]);
  if (missing.length) return res.status(503).json({ error: 'DeFi yield feed unavailable', missing: missing.join(', ') });
  res.json({ success: false, error: 'DeFi yield endpoint pending implementation; creds detected.' });
});

module.exports = router;
