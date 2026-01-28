/**
 * Investment Recommendation Engine
 * Provides portfolio allocation recommendations based on user profiles
 */

// ETF/Fund recommendations by asset class
const ETF_DATABASE = {
  us_stocks: [
    { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', expense: 0.03, type: 'Total Market' },
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', expense: 0.09, type: 'Large Cap' },
    { symbol: 'VUG', name: 'Vanguard Growth ETF', expense: 0.04, type: 'Growth' },
    { symbol: 'VTV', name: 'Vanguard Value ETF', expense: 0.04, type: 'Value' },
    { symbol: 'VB', name: 'Vanguard Small-Cap ETF', expense: 0.05, type: 'Small Cap' }
  ],
  international_stocks: [
    { symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', expense: 0.07, type: 'Total Intl' },
    { symbol: 'VEA', name: 'Vanguard Developed Markets ETF', expense: 0.05, type: 'Developed' },
    { symbol: 'VWO', name: 'Vanguard Emerging Markets ETF', expense: 0.08, type: 'Emerging' }
  ],
  bonds: [
    { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', expense: 0.03, type: 'Total Bond' },
    { symbol: 'BNDX', name: 'Vanguard Total International Bond ETF', expense: 0.07, type: 'Intl Bond' },
    { symbol: 'TIP', name: 'iShares TIPS Bond ETF', expense: 0.19, type: 'Inflation Protected' },
    { symbol: 'SHY', name: 'iShares 1-3 Year Treasury Bond ETF', expense: 0.15, type: 'Short Term' }
  ],
  reit: [
    { symbol: 'VNQ', name: 'Vanguard Real Estate ETF', expense: 0.12, type: 'US REIT' },
    { symbol: 'VNQI', name: 'Vanguard Global ex-US Real Estate ETF', expense: 0.12, type: 'Intl REIT' }
  ],
  commodities: [
    { symbol: 'GLD', name: 'SPDR Gold Shares', expense: 0.40, type: 'Gold' },
    { symbol: 'PDBC', name: 'Invesco Optimum Yield Diversified Commodity ETF', expense: 0.59, type: 'Diversified' }
  ]
};

// Model portfolios based on risk tolerance
const MODEL_PORTFOLIOS = {
  CONSERVATIVE: {
    type: 'CONSERVATIVE',
    description: 'Capital preservation with stable income',
    allocation: {
      us_stocks: 20,
      international_stocks: 10,
      bonds: 55,
      reit: 5,
      cash: 10
    },
    expectedReturn: { low: 3, high: 5 },
    volatility: 'Low',
    rebalanceFrequency: 'Annually'
  },
  MODERATE: {
    type: 'BALANCED',
    description: 'Balanced growth with moderate risk',
    allocation: {
      us_stocks: 35,
      international_stocks: 15,
      bonds: 35,
      reit: 8,
      cash: 7
    },
    expectedReturn: { low: 5, high: 7 },
    volatility: 'Medium',
    rebalanceFrequency: 'Semi-Annually'
  },
  AGGRESSIVE: {
    type: 'GROWTH',
    description: 'Long-term growth with higher volatility',
    allocation: {
      us_stocks: 50,
      international_stocks: 25,
      bonds: 15,
      reit: 7,
      cash: 3
    },
    expectedReturn: { low: 7, high: 10 },
    volatility: 'High',
    rebalanceFrequency: 'Quarterly'
  }
};

// Goal-based adjustments
const GOAL_ADJUSTMENTS = {
  retirement: {
    // Adjust based on time horizon
    shortTerm: { bonds: 10, stocks: -10 },
    longTerm: { stocks: 5, bonds: -5 }
  },
  growth: {
    us_stocks: 5,
    international_stocks: 5,
    bonds: -10
  },
  income: {
    bonds: 10,
    reit: 5,
    us_stocks: -15
  },
  preservation: {
    bonds: 15,
    cash: 5,
    us_stocks: -15,
    international_stocks: -5
  }
};

/**
 * Calculate risk score from questionnaire answers
 */
function calculateRiskScore(questionnaire) {
  let score = 50; // Start at moderate

  // Age factor (younger = can take more risk)
  if (questionnaire.age) {
    if (questionnaire.age < 30) score += 15;
    else if (questionnaire.age < 40) score += 10;
    else if (questionnaire.age < 50) score += 5;
    else if (questionnaire.age < 60) score -= 5;
    else score -= 15;
  }

  // Time horizon
  if (questionnaire.timeHorizon) {
    if (questionnaire.timeHorizon >= 20) score += 15;
    else if (questionnaire.timeHorizon >= 10) score += 10;
    else if (questionnaire.timeHorizon >= 5) score += 0;
    else if (questionnaire.timeHorizon >= 3) score -= 10;
    else score -= 20;
  }

  // Income stability
  if (questionnaire.incomeStability === 'very_stable') score += 10;
  else if (questionnaire.incomeStability === 'stable') score += 5;
  else if (questionnaire.incomeStability === 'variable') score -= 5;
  else if (questionnaire.incomeStability === 'unstable') score -= 15;

  // Risk attitude (1-10 scale)
  if (questionnaire.riskAttitude) {
    score += (questionnaire.riskAttitude - 5) * 4;
  }

  // Loss tolerance
  if (questionnaire.lossTolerance === 'none') score -= 20;
  else if (questionnaire.lossTolerance === 'small') score -= 10;
  else if (questionnaire.lossTolerance === 'moderate') score += 0;
  else if (questionnaire.lossTolerance === 'large') score += 15;

  // Emergency fund status
  if (questionnaire.hasEmergencyFund) score += 10;
  else score -= 10;

  // Debt level
  if (questionnaire.debtLevel === 'none') score += 10;
  else if (questionnaire.debtLevel === 'low') score += 5;
  else if (questionnaire.debtLevel === 'moderate') score -= 5;
  else if (questionnaire.debtLevel === 'high') score -= 15;

  // Normalize to 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * Determine risk tolerance from risk score
 */
function getRiskTolerance(riskScore) {
  if (riskScore >= 70) return 'AGGRESSIVE';
  if (riskScore >= 40) return 'MODERATE';
  return 'CONSERVATIVE';
}

/**
 * Generate portfolio recommendation
 */
function generatePortfolioRecommendation(riskProfile, investmentAmount = 10000) {
  const riskTolerance = riskProfile.riskTolerance || 'MODERATE';
  const modelPortfolio = MODEL_PORTFOLIOS[riskTolerance];
  const goal = riskProfile.investmentGoal || 'growth';
  const timeHorizon = riskProfile.timeHorizon || 10;

  // Start with base allocation
  let allocation = { ...modelPortfolio.allocation };

  // Apply goal-based adjustments
  if (GOAL_ADJUSTMENTS[goal]) {
    const adjustments = GOAL_ADJUSTMENTS[goal];
    if (goal === 'retirement') {
      // Time horizon specific for retirement
      const horizonAdjust = timeHorizon < 10 ? adjustments.shortTerm : adjustments.longTerm;
      Object.keys(horizonAdjust).forEach(key => {
        if (allocation[key] !== undefined) {
          allocation[key] = Math.max(0, allocation[key] + horizonAdjust[key]);
        }
      });
    } else {
      Object.keys(adjustments).forEach(key => {
        if (allocation[key] !== undefined) {
          allocation[key] = Math.max(0, allocation[key] + adjustments[key]);
        }
      });
    }
  }

  // Normalize to 100%
  const total = Object.values(allocation).reduce((a, b) => a + b, 0);
  Object.keys(allocation).forEach(key => {
    allocation[key] = Math.round((allocation[key] / total) * 100);
  });

  // Generate specific ETF recommendations
  const recommendations = [];

  // US Stocks
  if (allocation.us_stocks > 0) {
    const etf = riskTolerance === 'AGGRESSIVE' ? ETF_DATABASE.us_stocks[2] : ETF_DATABASE.us_stocks[0];
    recommendations.push({
      asset: 'US Stocks',
      percentage: allocation.us_stocks,
      amount: Math.round(investmentAmount * allocation.us_stocks / 100),
      etf: etf.symbol,
      etfName: etf.name,
      expenseRatio: etf.expense
    });
  }

  // International Stocks
  if (allocation.international_stocks > 0) {
    const etf = ETF_DATABASE.international_stocks[0];
    recommendations.push({
      asset: 'International Stocks',
      percentage: allocation.international_stocks,
      amount: Math.round(investmentAmount * allocation.international_stocks / 100),
      etf: etf.symbol,
      etfName: etf.name,
      expenseRatio: etf.expense
    });
  }

  // Bonds
  if (allocation.bonds > 0) {
    const etf = riskTolerance === 'CONSERVATIVE' ? ETF_DATABASE.bonds[3] : ETF_DATABASE.bonds[0];
    recommendations.push({
      asset: 'Bonds',
      percentage: allocation.bonds,
      amount: Math.round(investmentAmount * allocation.bonds / 100),
      etf: etf.symbol,
      etfName: etf.name,
      expenseRatio: etf.expense
    });
  }

  // REIT
  if (allocation.reit > 0) {
    const etf = ETF_DATABASE.reit[0];
    recommendations.push({
      asset: 'Real Estate (REIT)',
      percentage: allocation.reit,
      amount: Math.round(investmentAmount * allocation.reit / 100),
      etf: etf.symbol,
      etfName: etf.name,
      expenseRatio: etf.expense
    });
  }

  // Cash
  if (allocation.cash > 0) {
    recommendations.push({
      asset: 'Cash/Money Market',
      percentage: allocation.cash,
      amount: Math.round(investmentAmount * allocation.cash / 100),
      etf: 'VMFXX',
      etfName: 'Vanguard Federal Money Market Fund',
      expenseRatio: 0.11
    });
  }

  // Calculate total expense ratio
  const weightedExpense = recommendations.reduce((sum, rec) => {
    return sum + (rec.percentage / 100) * (rec.expenseRatio || 0);
  }, 0);

  return {
    portfolioType: modelPortfolio.type,
    description: modelPortfolio.description,
    allocation: recommendations,
    totalInvestment: investmentAmount,
    expectedReturn: modelPortfolio.expectedReturn,
    volatility: modelPortfolio.volatility,
    rebalanceFrequency: modelPortfolio.rebalanceFrequency,
    weightedExpenseRatio: weightedExpense.toFixed(3),
    suitability: {
      riskTolerance,
      investmentGoal: goal,
      timeHorizon: timeHorizon + ' years'
    },
    reasoning: generateReasoning(riskTolerance, goal, timeHorizon)
  };
}

/**
 * Generate human-readable reasoning
 */
function generateReasoning(riskTolerance, goal, timeHorizon) {
  let reasoning = '';

  if (riskTolerance === 'CONSERVATIVE') {
    reasoning = 'This conservative portfolio prioritizes capital preservation and income generation. ';
    reasoning += 'The heavy bond allocation provides stability and regular income. ';
  } else if (riskTolerance === 'MODERATE') {
    reasoning = 'This balanced portfolio seeks moderate growth while managing risk. ';
    reasoning += 'The mix of stocks and bonds provides diversification and steady returns. ';
  } else {
    reasoning = 'This growth-oriented portfolio maximizes long-term wealth accumulation. ';
    reasoning += 'The equity-heavy allocation accepts higher volatility for better returns. ';
  }

  if (goal === 'retirement') {
    reasoning += `With a ${timeHorizon}-year horizon, ${timeHorizon >= 10 ? 'there is time to recover from market downturns' : 'stability becomes increasingly important'}. `;
  } else if (goal === 'income') {
    reasoning += 'Focus on dividend-paying assets and bonds for regular income. ';
  } else if (goal === 'preservation') {
    reasoning += 'Emphasis on protecting principal with lower-risk investments. ';
  }

  reasoning += 'Regular rebalancing helps maintain the target allocation and manage risk.';

  return reasoning;
}

/**
 * Analyze current portfolio and suggest rebalancing
 */
function analyzePortfolio(holdings, totalValue, targetAllocation) {
  const currentAllocation = {};
  let totalHoldingsValue = 0;

  // Calculate current allocation
  holdings.forEach(holding => {
    const value = holding.shares * (holding.currentPrice || holding.avgCost);
    totalHoldingsValue += value;

    // Categorize by asset type
    const category = categorizeAsset(holding.symbol, holding.assetType);
    currentAllocation[category] = (currentAllocation[category] || 0) + value;
  });

  // Convert to percentages
  Object.keys(currentAllocation).forEach(key => {
    currentAllocation[key] = (currentAllocation[key] / totalValue) * 100;
  });

  // Compare to target and generate rebalancing suggestions
  const suggestions = [];
  let needsRebalancing = false;

  Object.keys(targetAllocation).forEach(category => {
    const target = targetAllocation[category];
    const current = currentAllocation[category] || 0;
    const diff = current - target;

    if (Math.abs(diff) > 5) { // 5% threshold for rebalancing
      needsRebalancing = true;
      const action = diff > 0 ? 'SELL' : 'BUY';
      const amount = Math.abs(diff / 100) * totalValue;

      suggestions.push({
        category,
        action,
        currentPercent: current.toFixed(1),
        targetPercent: target,
        differencePercent: diff.toFixed(1),
        amount: Math.round(amount),
        priority: Math.abs(diff) > 10 ? 'HIGH' : 'MEDIUM'
      });
    }
  });

  return {
    needsRebalancing,
    currentAllocation,
    suggestions: suggestions.sort((a, b) => Math.abs(parseFloat(b.differencePercent)) - Math.abs(parseFloat(a.differencePercent))),
    totalValue,
    driftScore: calculateDriftScore(currentAllocation, targetAllocation)
  };
}

/**
 * Categorize asset based on symbol and type
 */
function categorizeAsset(symbol, assetType) {
  const stockSymbols = ['VTI', 'SPY', 'VUG', 'VTV', 'VB'];
  const intlSymbols = ['VXUS', 'VEA', 'VWO'];
  const bondSymbols = ['BND', 'BNDX', 'TIP', 'SHY'];
  const reitSymbols = ['VNQ', 'VNQI'];

  if (stockSymbols.includes(symbol) || assetType === 'STOCK') return 'us_stocks';
  if (intlSymbols.includes(symbol)) return 'international_stocks';
  if (bondSymbols.includes(symbol) || assetType === 'BOND') return 'bonds';
  if (reitSymbols.includes(symbol)) return 'reit';
  if (assetType === 'CASH') return 'cash';
  return 'other';
}

/**
 * Calculate portfolio drift score (0-100, lower is better)
 */
function calculateDriftScore(current, target) {
  let totalDrift = 0;
  Object.keys(target).forEach(key => {
    const diff = Math.abs((current[key] || 0) - target[key]);
    totalDrift += diff;
  });
  return Math.min(100, totalDrift);
}

module.exports = {
  calculateRiskScore,
  getRiskTolerance,
  generatePortfolioRecommendation,
  analyzePortfolio,
  ETF_DATABASE,
  MODEL_PORTFOLIOS
};
