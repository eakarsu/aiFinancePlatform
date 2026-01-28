/**
 * Rules-Based Fraud Detection Engine
 * Implements multiple fraud detection rules for MVP
 */

// Risk score weights for different fraud indicators
const RISK_WEIGHTS = {
  amountAnomaly: 25,
  velocityAnomaly: 20,
  locationAnomaly: 20,
  merchantAnomaly: 15,
  timeAnomaly: 10,
  deviceAnomaly: 10
};

// Thresholds
const THRESHOLDS = {
  largeTransaction: 5000,           // Transactions above this are flagged
  unusualMultiplier: 3,             // X times average is unusual
  velocityTimeWindow: 3600000,      // 1 hour in milliseconds
  velocityMaxTransactions: 5,       // Max transactions per hour
  unusualHourStart: 1,              // 1 AM
  unusualHourEnd: 5                 // 5 AM
};

/**
 * Calculate user's transaction patterns from history
 */
function calculateUserPatterns(transactions) {
  if (!transactions || transactions.length === 0) {
    return {
      avgAmount: 0,
      maxAmount: 0,
      stdDeviation: 0,
      commonLocations: [],
      commonMerchants: [],
      commonCategories: [],
      typicalDevices: [],
      totalTransactions: 0
    };
  }

  const amounts = transactions.map(t => t.amount);
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const maxAmount = Math.max(...amounts);

  // Calculate standard deviation
  const squaredDiffs = amounts.map(a => Math.pow(a - avgAmount, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  const stdDeviation = Math.sqrt(avgSquaredDiff);

  // Extract common patterns
  const locationCounts = {};
  const merchantCounts = {};
  const categoryCounts = {};
  const deviceCounts = {};

  transactions.forEach(t => {
    if (t.location) locationCounts[t.location] = (locationCounts[t.location] || 0) + 1;
    if (t.merchant) merchantCounts[t.merchant] = (merchantCounts[t.merchant] || 0) + 1;
    if (t.category) categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    if (t.deviceId) deviceCounts[t.deviceId] = (deviceCounts[t.deviceId] || 0) + 1;
  });

  // Get top 5 most common for each
  const getTopN = (obj, n = 5) => Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key);

  return {
    avgAmount,
    maxAmount,
    stdDeviation,
    commonLocations: getTopN(locationCounts),
    commonMerchants: getTopN(merchantCounts),
    commonCategories: getTopN(categoryCounts),
    typicalDevices: getTopN(deviceCounts, 3),
    totalTransactions: transactions.length
  };
}

/**
 * Rule 1: Amount Anomaly Detection
 */
function checkAmountAnomaly(transaction, patterns) {
  const flags = [];
  let riskScore = 0;

  const amount = transaction.amount;

  // Check if amount is significantly higher than average
  if (patterns.avgAmount > 0) {
    if (amount > patterns.avgAmount * THRESHOLDS.unusualMultiplier) {
      riskScore += 15;
      flags.push({
        type: 'UNUSUAL_AMOUNT',
        severity: amount > patterns.avgAmount * 5 ? 'HIGH' : 'MEDIUM',
        message: `Amount ($${amount}) is ${(amount / patterns.avgAmount).toFixed(1)}x higher than average ($${patterns.avgAmount.toFixed(2)})`
      });
    }

    // Check if exceeds 2 standard deviations
    if (patterns.stdDeviation > 0 && amount > patterns.avgAmount + (2 * patterns.stdDeviation)) {
      riskScore += 10;
      flags.push({
        type: 'STATISTICAL_ANOMALY',
        severity: 'MEDIUM',
        message: 'Transaction amount is a statistical outlier'
      });
    }
  }

  // Large transaction threshold
  if (amount > THRESHOLDS.largeTransaction) {
    riskScore += 10;
    flags.push({
      type: 'LARGE_TRANSACTION',
      severity: amount > 10000 ? 'HIGH' : 'MEDIUM',
      message: `Large transaction amount: $${amount}`
    });
  }

  // Round number detection (potential manual entry/fraud)
  if (amount >= 100 && amount % 100 === 0) {
    riskScore += 5;
    flags.push({
      type: 'ROUND_AMOUNT',
      severity: 'LOW',
      message: 'Round dollar amount detected'
    });
  }

  return { riskScore: Math.min(riskScore, RISK_WEIGHTS.amountAnomaly), flags };
}

/**
 * Rule 2: Velocity Check - Multiple transactions in short time
 */
function checkVelocityAnomaly(transaction, recentTransactions) {
  const flags = [];
  let riskScore = 0;

  const txTime = new Date(transaction.createdAt || new Date()).getTime();
  const windowStart = txTime - THRESHOLDS.velocityTimeWindow;

  // Count transactions in the time window
  const transactionsInWindow = recentTransactions.filter(t => {
    const time = new Date(t.createdAt).getTime();
    return time >= windowStart && time <= txTime;
  });

  if (transactionsInWindow.length >= THRESHOLDS.velocityMaxTransactions) {
    riskScore += 15;
    flags.push({
      type: 'VELOCITY_CHECK',
      severity: transactionsInWindow.length >= 8 ? 'HIGH' : 'MEDIUM',
      message: `${transactionsInWindow.length} transactions in the last hour (threshold: ${THRESHOLDS.velocityMaxTransactions})`
    });
  }

  // Check for rapid successive transactions (less than 2 minutes apart)
  const twoMinutes = 120000;
  const rapidTransactions = recentTransactions.filter(t => {
    const time = new Date(t.createdAt).getTime();
    return Math.abs(time - txTime) <= twoMinutes && t.id !== transaction.id;
  });

  if (rapidTransactions.length >= 2) {
    riskScore += 10;
    flags.push({
      type: 'RAPID_SUCCESSION',
      severity: 'MEDIUM',
      message: `${rapidTransactions.length + 1} transactions within 2 minutes`
    });
  }

  // Same merchant multiple times in short period
  if (transaction.merchant) {
    const sameMerchantCount = transactionsInWindow.filter(
      t => t.merchant === transaction.merchant
    ).length;

    if (sameMerchantCount >= 3) {
      riskScore += 10;
      flags.push({
        type: 'REPEATED_MERCHANT',
        severity: 'MEDIUM',
        message: `${sameMerchantCount} transactions at ${transaction.merchant} within an hour`
      });
    }
  }

  return { riskScore: Math.min(riskScore, RISK_WEIGHTS.velocityAnomaly), flags };
}

/**
 * Rule 3: Location Anomaly Detection
 */
function checkLocationAnomaly(transaction, patterns, recentTransactions) {
  const flags = [];
  let riskScore = 0;

  if (!transaction.location) return { riskScore: 0, flags: [] };

  // Check if location is new/unusual
  if (patterns.commonLocations.length > 0 && !patterns.commonLocations.includes(transaction.location)) {
    riskScore += 10;
    flags.push({
      type: 'UNUSUAL_LOCATION',
      severity: 'MEDIUM',
      message: `Transaction from new location: ${transaction.location}`
    });
  }

  // Check for impossible travel (transactions in different locations within short time)
  if (recentTransactions.length > 0) {
    const lastTransaction = recentTransactions[0];
    if (lastTransaction.location && lastTransaction.location !== transaction.location) {
      const timeDiff = Math.abs(
        new Date(transaction.createdAt || new Date()).getTime() -
        new Date(lastTransaction.createdAt).getTime()
      );

      // If different location within 30 minutes, flag as suspicious
      if (timeDiff < 1800000) { // 30 minutes
        riskScore += 15;
        flags.push({
          type: 'IMPOSSIBLE_TRAVEL',
          severity: 'HIGH',
          message: `Location changed from ${lastTransaction.location} to ${transaction.location} in ${Math.round(timeDiff / 60000)} minutes`
        });
      }
    }
  }

  // Check for high-risk locations (would be configured in production)
  const highRiskLocations = ['Unknown', 'International', 'VPN'];
  if (highRiskLocations.some(loc => transaction.location.toLowerCase().includes(loc.toLowerCase()))) {
    riskScore += 10;
    flags.push({
      type: 'HIGH_RISK_LOCATION',
      severity: 'MEDIUM',
      message: 'Transaction from potentially high-risk location'
    });
  }

  return { riskScore: Math.min(riskScore, RISK_WEIGHTS.locationAnomaly), flags };
}

/**
 * Rule 4: Merchant/Category Anomaly Detection
 */
function checkMerchantAnomaly(transaction, patterns) {
  const flags = [];
  let riskScore = 0;

  // High-risk merchant categories
  const highRiskCategories = [
    'gambling', 'casino', 'cryptocurrency', 'wire_transfer',
    'money_order', 'gift_card', 'pawn_shop'
  ];

  if (transaction.category) {
    const category = transaction.category.toLowerCase();

    if (highRiskCategories.some(risk => category.includes(risk))) {
      riskScore += 15;
      flags.push({
        type: 'HIGH_RISK_CATEGORY',
        severity: 'HIGH',
        message: `High-risk merchant category: ${transaction.category}`
      });
    }

    // New category for user
    if (patterns.commonCategories.length > 0 && !patterns.commonCategories.includes(transaction.category)) {
      riskScore += 5;
      flags.push({
        type: 'NEW_CATEGORY',
        severity: 'LOW',
        message: `First transaction in category: ${transaction.category}`
      });
    }
  }

  // New merchant
  if (transaction.merchant && patterns.commonMerchants.length > 0 &&
      !patterns.commonMerchants.includes(transaction.merchant)) {
    // Only flag if user has established patterns
    if (patterns.totalTransactions >= 10) {
      riskScore += 3;
      flags.push({
        type: 'NEW_MERCHANT',
        severity: 'LOW',
        message: `First transaction with merchant: ${transaction.merchant}`
      });
    }
  }

  return { riskScore: Math.min(riskScore, RISK_WEIGHTS.merchantAnomaly), flags };
}

/**
 * Rule 5: Unusual Time Detection
 */
function checkTimeAnomaly(transaction) {
  const flags = [];
  let riskScore = 0;

  const txDate = new Date(transaction.createdAt || new Date());
  const hour = txDate.getHours();

  // Late night/early morning transactions
  if (hour >= THRESHOLDS.unusualHourStart && hour <= THRESHOLDS.unusualHourEnd) {
    riskScore += 10;
    flags.push({
      type: 'UNUSUAL_TIME',
      severity: 'MEDIUM',
      message: `Transaction at unusual hour: ${hour}:00`
    });
  }

  // Weekend large transactions might be suspicious for business accounts
  const dayOfWeek = txDate.getDay();
  if ((dayOfWeek === 0 || dayOfWeek === 6) && transaction.amount > 2000) {
    riskScore += 5;
    flags.push({
      type: 'WEEKEND_LARGE_TX',
      severity: 'LOW',
      message: 'Large transaction on weekend'
    });
  }

  return { riskScore: Math.min(riskScore, RISK_WEIGHTS.timeAnomaly), flags };
}

/**
 * Rule 6: Device Anomaly Detection
 */
function checkDeviceAnomaly(transaction, patterns) {
  const flags = [];
  let riskScore = 0;

  if (!transaction.deviceId) return { riskScore: 0, flags: [] };

  // New device detection
  if (patterns.typicalDevices.length > 0 && !patterns.typicalDevices.includes(transaction.deviceId)) {
    riskScore += 10;
    flags.push({
      type: 'DEVICE_MISMATCH',
      severity: 'MEDIUM',
      message: 'Transaction from unrecognized device'
    });
  }

  return { riskScore: Math.min(riskScore, RISK_WEIGHTS.deviceAnomaly), flags };
}

/**
 * Main fraud analysis function
 */
function analyzeTransaction(transaction, userTransactions = []) {
  // Calculate user patterns from transaction history
  const patterns = calculateUserPatterns(userTransactions);

  // Get recent transactions (last 24 hours)
  const now = new Date().getTime();
  const dayAgo = now - 86400000;
  const recentTransactions = userTransactions.filter(
    t => new Date(t.createdAt).getTime() > dayAgo
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Run all checks
  const amountCheck = checkAmountAnomaly(transaction, patterns);
  const velocityCheck = checkVelocityAnomaly(transaction, recentTransactions);
  const locationCheck = checkLocationAnomaly(transaction, patterns, recentTransactions);
  const merchantCheck = checkMerchantAnomaly(transaction, patterns);
  const timeCheck = checkTimeAnomaly(transaction);
  const deviceCheck = checkDeviceAnomaly(transaction, patterns);

  // Aggregate risk scores
  const totalRiskScore =
    amountCheck.riskScore +
    velocityCheck.riskScore +
    locationCheck.riskScore +
    merchantCheck.riskScore +
    timeCheck.riskScore +
    deviceCheck.riskScore;

  // Aggregate all flags
  const allFlags = [
    ...amountCheck.flags,
    ...velocityCheck.flags,
    ...locationCheck.flags,
    ...merchantCheck.flags,
    ...timeCheck.flags,
    ...deviceCheck.flags
  ];

  // Determine risk level
  let riskLevel;
  if (totalRiskScore >= 60) riskLevel = 'CRITICAL';
  else if (totalRiskScore >= 40) riskLevel = 'HIGH';
  else if (totalRiskScore >= 20) riskLevel = 'MEDIUM';
  else riskLevel = 'LOW';

  // Determine recommendation
  let recommendation;
  if (riskLevel === 'CRITICAL') recommendation = 'BLOCK';
  else if (riskLevel === 'HIGH') recommendation = 'REVIEW';
  else if (riskLevel === 'MEDIUM') recommendation = 'MONITOR';
  else recommendation = 'APPROVE';

  // Calculate confidence based on available data
  let confidence = 70; // Base confidence
  if (patterns.totalTransactions >= 50) confidence += 15;
  else if (patterns.totalTransactions >= 20) confidence += 10;
  else if (patterns.totalTransactions >= 10) confidence += 5;

  if (transaction.location) confidence += 5;
  if (transaction.deviceId) confidence += 5;
  if (transaction.category) confidence += 5;

  confidence = Math.min(95, confidence);

  return {
    riskScore: totalRiskScore,
    riskLevel,
    recommendation,
    confidence,
    flags: allFlags,
    breakdown: {
      amountRisk: amountCheck.riskScore,
      velocityRisk: velocityCheck.riskScore,
      locationRisk: locationCheck.riskScore,
      merchantRisk: merchantCheck.riskScore,
      timeRisk: timeCheck.riskScore,
      deviceRisk: deviceCheck.riskScore
    },
    patterns: {
      avgTransactionAmount: patterns.avgAmount,
      totalTransactionsAnalyzed: patterns.totalTransactions,
      commonLocations: patterns.commonLocations.slice(0, 3),
      commonCategories: patterns.commonCategories.slice(0, 3)
    }
  };
}

/**
 * Batch analyze multiple transactions
 */
function analyzeTransactionBatch(transactions, userTransactions = []) {
  return transactions.map(tx => ({
    transactionId: tx.id,
    ...analyzeTransaction(tx, userTransactions)
  }));
}

module.exports = {
  analyzeTransaction,
  analyzeTransactionBatch,
  calculateUserPatterns
};
