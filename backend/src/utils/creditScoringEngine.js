/**
 * Real Credit Scoring Algorithm
 * Calculates credit scores using FICO-like methodology with alternative data
 */

// Weight factors for different scoring components
const SCORING_WEIGHTS = {
  paymentHistory: 0.35,      // 35% - Most important factor
  creditUtilization: 0.30,   // 30% - Amount owed relative to credit
  creditHistory: 0.15,       // 15% - Length of credit history
  creditMix: 0.10,           // 10% - Types of credit
  newCredit: 0.10            // 10% - Recent credit inquiries/accounts
};

// Score ranges
const SCORE_RANGE = { min: 300, max: 850 };

/**
 * Calculate payment history score (0-100)
 * Based on on-time payments, late payments, and missed payments
 */
function calculatePaymentHistoryScore(profile, histories) {
  let totalPayments = 0;
  let onTimePayments = 0;
  let latePayments = 0;
  let missedPayments = 0;

  // Aggregate from credit histories
  histories.forEach(h => {
    totalPayments += h.onTimePayments + h.latePayments + h.missedPayments;
    onTimePayments += h.onTimePayments;
    latePayments += h.latePayments;
    missedPayments += h.missedPayments;
  });

  // Add profile data if available
  if (profile.rentPaymentHistory) onTimePayments += profile.rentPaymentHistory;
  if (profile.utilityPaymentHistory) onTimePayments += profile.utilityPaymentHistory;
  if (profile.phonePaymentHistory) onTimePayments += profile.phonePaymentHistory;

  totalPayments += (profile.rentPaymentHistory || 0) +
                   (profile.utilityPaymentHistory || 0) +
                   (profile.phonePaymentHistory || 0);

  if (totalPayments === 0) return 50; // Neutral score for no history

  // Calculate score
  const onTimeRatio = onTimePayments / totalPayments;
  const latePenalty = (latePayments / totalPayments) * 20;
  const missedPenalty = (missedPayments / totalPayments) * 40;

  let score = onTimeRatio * 100 - latePenalty - missedPenalty;
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate credit utilization score (0-100)
 * Based on debt-to-income ratio and bank balance management
 */
function calculateUtilizationScore(profile) {
  let score = 70; // Base score

  // Debt-to-income consideration
  if (profile.annualIncome && profile.monthlyRent) {
    const monthlyIncome = profile.annualIncome / 12;
    const rentRatio = profile.monthlyRent / monthlyIncome;

    if (rentRatio <= 0.28) score += 15;      // Excellent - below 28%
    else if (rentRatio <= 0.36) score += 5;   // Good - 28-36%
    else if (rentRatio <= 0.43) score -= 10;  // Fair - 36-43%
    else score -= 25;                          // Poor - above 43%
  }

  // Bank balance consideration
  if (profile.averageBalance !== null && profile.averageBalance !== undefined) {
    if (profile.averageBalance >= 10000) score += 10;
    else if (profile.averageBalance >= 5000) score += 5;
    else if (profile.averageBalance >= 1000) score += 0;
    else if (profile.averageBalance >= 0) score -= 10;
    else score -= 20; // Negative balance
  }

  // Overdraft penalty
  if (profile.overdraftCount) {
    score -= Math.min(profile.overdraftCount * 5, 30);
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate credit history length score (0-100)
 * Based on account ages and length of credit history
 */
function calculateCreditHistoryScore(profile, histories) {
  let score = 50; // Base score

  // Bank account age
  const bankAge = profile.bankAccountAge || 0;
  if (bankAge >= 120) score += 30;       // 10+ years
  else if (bankAge >= 84) score += 25;   // 7+ years
  else if (bankAge >= 60) score += 20;   // 5+ years
  else if (bankAge >= 36) score += 15;   // 3+ years
  else if (bankAge >= 24) score += 10;   // 2+ years
  else if (bankAge >= 12) score += 5;    // 1+ year
  else score -= 10;                       // Less than 1 year

  // Credit histories length
  if (histories.length > 0) {
    const avgHistoryLength = histories.reduce((sum, h) => {
      const startDate = new Date(h.startDate);
      const endDate = h.endDate ? new Date(h.endDate) : new Date();
      const months = (endDate - startDate) / (1000 * 60 * 60 * 24 * 30);
      return sum + months;
    }, 0) / histories.length;

    if (avgHistoryLength >= 60) score += 15;
    else if (avgHistoryLength >= 36) score += 10;
    else if (avgHistoryLength >= 12) score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate credit mix score (0-100)
 * Based on variety of credit types
 */
function calculateCreditMixScore(histories) {
  const types = new Set(histories.map(h => h.type));
  const uniqueTypes = types.size;

  // More diverse credit mix = better score
  if (uniqueTypes >= 4) return 90;
  if (uniqueTypes >= 3) return 75;
  if (uniqueTypes >= 2) return 60;
  if (uniqueTypes >= 1) return 45;
  return 30; // No credit history
}

/**
 * Calculate new credit score (0-100)
 * Based on recent credit activity
 */
function calculateNewCreditScore(histories) {
  const now = new Date();
  const sixMonthsAgo = new Date(now.setMonth(now.getMonth() - 6));

  // Count recent accounts
  const recentAccounts = histories.filter(h => new Date(h.startDate) > sixMonthsAgo).length;

  // Too many recent accounts is negative
  if (recentAccounts === 0) return 85;
  if (recentAccounts === 1) return 80;
  if (recentAccounts === 2) return 70;
  if (recentAccounts === 3) return 55;
  return 40; // 4+ recent accounts
}

/**
 * Calculate employment stability score (bonus factor)
 */
function calculateEmploymentScore(profile) {
  let score = 0;

  // Employment status
  if (profile.employmentStatus === 'employed_full_time') score += 20;
  else if (profile.employmentStatus === 'employed_part_time') score += 10;
  else if (profile.employmentStatus === 'self_employed') score += 15;
  else if (profile.employmentStatus === 'retired') score += 15;
  else score -= 10; // Unemployed or other

  // Employment tenure
  const years = profile.employmentYears || 0;
  if (years >= 10) score += 15;
  else if (years >= 5) score += 10;
  else if (years >= 2) score += 5;
  else if (years < 1) score -= 5;

  return score;
}

/**
 * Main credit score calculation function
 */
function calculateCreditScore(profile, histories = []) {
  // Calculate component scores
  const paymentHistoryScore = calculatePaymentHistoryScore(profile, histories);
  const utilizationScore = calculateUtilizationScore(profile);
  const creditHistoryScore = calculateCreditHistoryScore(profile, histories);
  const creditMixScore = calculateCreditMixScore(histories);
  const newCreditScore = calculateNewCreditScore(histories);

  // Calculate weighted average
  const weightedScore =
    paymentHistoryScore * SCORING_WEIGHTS.paymentHistory +
    utilizationScore * SCORING_WEIGHTS.creditUtilization +
    creditHistoryScore * SCORING_WEIGHTS.creditHistory +
    creditMixScore * SCORING_WEIGHTS.creditMix +
    newCreditScore * SCORING_WEIGHTS.newCredit;

  // Add employment bonus (up to 35 points)
  const employmentBonus = calculateEmploymentScore(profile) * 0.5;

  // Convert to 300-850 scale
  const scoreRange = SCORE_RANGE.max - SCORE_RANGE.min;
  let finalScore = SCORE_RANGE.min + (weightedScore / 100) * scoreRange + employmentBonus;

  // If traditional score exists, blend it (60% alternative, 40% traditional)
  if (profile.traditionalScore) {
    finalScore = finalScore * 0.6 + profile.traditionalScore * 0.4;
  }

  finalScore = Math.round(Math.max(SCORE_RANGE.min, Math.min(SCORE_RANGE.max, finalScore)));

  // Determine risk level
  let riskLevel;
  if (finalScore >= 750) riskLevel = 'Excellent';
  else if (finalScore >= 700) riskLevel = 'Good';
  else if (finalScore >= 650) riskLevel = 'Fair';
  else if (finalScore >= 600) riskLevel = 'Poor';
  else riskLevel = 'Very Poor';

  // Calculate confidence based on data completeness
  let dataPoints = 0;
  let maxDataPoints = 15;

  if (profile.annualIncome) dataPoints++;
  if (profile.employmentStatus) dataPoints++;
  if (profile.employmentYears) dataPoints++;
  if (profile.housingStatus) dataPoints++;
  if (profile.monthlyRent) dataPoints++;
  if (profile.rentPaymentHistory) dataPoints++;
  if (profile.utilityPaymentHistory) dataPoints++;
  if (profile.phonePaymentHistory) dataPoints++;
  if (profile.bankAccountAge) dataPoints++;
  if (profile.averageBalance !== null) dataPoints++;
  if (profile.overdraftCount !== null) dataPoints++;
  if (histories.length > 0) dataPoints += Math.min(histories.length, 4);

  const confidence = Math.round((dataPoints / maxDataPoints) * 100);

  // Generate factors
  const factors = {
    positive: [],
    negative: [],
    neutral: []
  };

  // Payment history factors
  if (paymentHistoryScore >= 80) factors.positive.push('Excellent payment history');
  else if (paymentHistoryScore >= 60) factors.neutral.push('Good payment history');
  else factors.negative.push('Payment history needs improvement');

  // Utilization factors
  if (utilizationScore >= 75) factors.positive.push('Low debt-to-income ratio');
  else if (utilizationScore >= 50) factors.neutral.push('Moderate debt levels');
  else factors.negative.push('High debt-to-income ratio');

  // Credit history factors
  if (creditHistoryScore >= 70) factors.positive.push('Long credit history');
  else if (creditHistoryScore >= 50) factors.neutral.push('Average length credit history');
  else factors.negative.push('Limited credit history');

  // Bank balance factors
  if (profile.averageBalance >= 5000) factors.positive.push('Healthy bank balance');
  else if (profile.averageBalance < 500) factors.negative.push('Low average bank balance');

  // Overdraft factors
  if (profile.overdraftCount === 0) factors.positive.push('No overdrafts');
  else if (profile.overdraftCount > 3) factors.negative.push('Multiple overdrafts on record');

  // Employment factors
  if (profile.employmentStatus === 'employed_full_time' && profile.employmentYears >= 2) {
    factors.positive.push('Stable employment');
  } else if (!profile.employmentStatus) {
    factors.negative.push('Employment status unknown');
  }

  // Generate recommendations
  const recommendations = [];
  if (paymentHistoryScore < 80) recommendations.push('Continue making on-time payments');
  if (utilizationScore < 70) recommendations.push('Work on reducing debt-to-income ratio');
  if (creditHistoryScore < 60) recommendations.push('Maintain existing accounts to build history');
  if (profile.averageBalance < 1000) recommendations.push('Build up emergency savings');
  if (profile.overdraftCount > 0) recommendations.push('Avoid overdrafts in the future');
  if (!profile.traditionalScore) recommendations.push('Consider building traditional credit history');

  // Loan approval likelihood
  const loanApprovalLikelihood = {
    personalLoan: finalScore >= 650 ? (finalScore >= 720 ? 'Excellent' : 'Good') : (finalScore >= 580 ? 'Fair' : 'Poor'),
    autoLoan: finalScore >= 620 ? (finalScore >= 700 ? 'Excellent' : 'Good') : (finalScore >= 560 ? 'Fair' : 'Poor'),
    mortgage: finalScore >= 700 ? (finalScore >= 760 ? 'Excellent' : 'Good') : (finalScore >= 620 ? 'Fair' : 'Needs Improvement'),
    creditCard: finalScore >= 640 ? (finalScore >= 720 ? 'Excellent' : 'Good') : (finalScore >= 580 ? 'Fair' : 'Poor')
  };

  return {
    score: finalScore,
    riskLevel,
    confidence,
    components: {
      paymentHistory: { score: paymentHistoryScore, weight: SCORING_WEIGHTS.paymentHistory * 100 + '%' },
      creditUtilization: { score: utilizationScore, weight: SCORING_WEIGHTS.creditUtilization * 100 + '%' },
      creditHistoryLength: { score: creditHistoryScore, weight: SCORING_WEIGHTS.creditHistory * 100 + '%' },
      creditMix: { score: creditMixScore, weight: SCORING_WEIGHTS.creditMix * 100 + '%' },
      newCredit: { score: newCreditScore, weight: SCORING_WEIGHTS.newCredit * 100 + '%' }
    },
    factors,
    recommendations,
    loanApprovalLikelihood
  };
}

module.exports = { calculateCreditScore };
