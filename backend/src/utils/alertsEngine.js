/**
 * Alerts and Notifications Engine
 * Monitors for anomalies and generates alerts across all modules
 */

// Alert types and their configurations
const ALERT_TYPES = {
  // Fraud Detection Alerts
  FRAUD_HIGH_RISK: {
    category: 'fraud',
    severity: 'HIGH',
    title: 'High Risk Transaction Detected',
    actionRequired: true
  },
  FRAUD_CRITICAL: {
    category: 'fraud',
    severity: 'CRITICAL',
    title: 'Critical Fraud Alert - Immediate Action Required',
    actionRequired: true
  },
  FRAUD_VELOCITY: {
    category: 'fraud',
    severity: 'MEDIUM',
    title: 'Unusual Transaction Velocity',
    actionRequired: false
  },

  // Credit Score Alerts
  CREDIT_SCORE_DROP: {
    category: 'credit',
    severity: 'MEDIUM',
    title: 'Credit Score Decreased',
    actionRequired: false
  },
  CREDIT_SCORE_IMPROVEMENT: {
    category: 'credit',
    severity: 'LOW',
    title: 'Credit Score Improved',
    actionRequired: false,
    isPositive: true
  },
  CREDIT_LATE_PAYMENT_RISK: {
    category: 'credit',
    severity: 'MEDIUM',
    title: 'Payment Due Soon',
    actionRequired: true
  },

  // Portfolio Alerts
  PORTFOLIO_DRIFT: {
    category: 'portfolio',
    severity: 'LOW',
    title: 'Portfolio Needs Rebalancing',
    actionRequired: false
  },
  PORTFOLIO_LARGE_LOSS: {
    category: 'portfolio',
    severity: 'HIGH',
    title: 'Significant Portfolio Loss',
    actionRequired: true
  },
  PORTFOLIO_LARGE_GAIN: {
    category: 'portfolio',
    severity: 'LOW',
    title: 'Significant Portfolio Gain',
    actionRequired: false,
    isPositive: true
  },

  // Account Security Alerts
  SECURITY_NEW_DEVICE: {
    category: 'security',
    severity: 'MEDIUM',
    title: 'Login from New Device',
    actionRequired: true
  },
  SECURITY_UNUSUAL_LOCATION: {
    category: 'security',
    severity: 'HIGH',
    title: 'Login from Unusual Location',
    actionRequired: true
  },

  // General Alerts
  LARGE_TRANSACTION: {
    category: 'transaction',
    severity: 'LOW',
    title: 'Large Transaction Processed',
    actionRequired: false
  },
  DAILY_SUMMARY: {
    category: 'general',
    severity: 'LOW',
    title: 'Daily Activity Summary',
    actionRequired: false
  }
};

// Notification channels
const NOTIFICATION_CHANNELS = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push'
};

// Default notification preferences
const DEFAULT_PREFERENCES = {
  fraud: {
    channels: ['in_app', 'email', 'sms'],
    enabled: true,
    minSeverity: 'LOW'
  },
  credit: {
    channels: ['in_app', 'email'],
    enabled: true,
    minSeverity: 'LOW'
  },
  portfolio: {
    channels: ['in_app', 'email'],
    enabled: true,
    minSeverity: 'LOW'
  },
  security: {
    channels: ['in_app', 'email', 'sms'],
    enabled: true,
    minSeverity: 'LOW'
  },
  transaction: {
    channels: ['in_app'],
    enabled: true,
    minSeverity: 'MEDIUM'
  },
  general: {
    channels: ['in_app'],
    enabled: true,
    minSeverity: 'LOW'
  }
};

// Severity levels in order
const SEVERITY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * Create a new alert
 */
function createAlert(type, userId, data = {}) {
  const alertConfig = ALERT_TYPES[type];
  if (!alertConfig) {
    throw new Error(`Unknown alert type: ${type}`);
  }

  return {
    id: generateAlertId(),
    type,
    userId,
    category: alertConfig.category,
    severity: alertConfig.severity,
    title: alertConfig.title,
    message: data.message || '',
    details: data.details || {},
    actionRequired: alertConfig.actionRequired,
    isPositive: alertConfig.isPositive || false,
    isRead: false,
    isDismissed: false,
    createdAt: new Date().toISOString(),
    expiresAt: data.expiresAt || null,
    metadata: data.metadata || {}
  };
}

/**
 * Generate unique alert ID
 */
function generateAlertId() {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if alert should be sent based on preferences
 */
function shouldSendAlert(alert, preferences = DEFAULT_PREFERENCES) {
  const categoryPrefs = preferences[alert.category];
  if (!categoryPrefs || !categoryPrefs.enabled) {
    return false;
  }

  const alertSeverityIndex = SEVERITY_ORDER.indexOf(alert.severity);
  const minSeverityIndex = SEVERITY_ORDER.indexOf(categoryPrefs.minSeverity);

  return alertSeverityIndex >= minSeverityIndex;
}

/**
 * Get notification channels for an alert
 */
function getNotificationChannels(alert, preferences = DEFAULT_PREFERENCES) {
  const categoryPrefs = preferences[alert.category];
  if (!categoryPrefs) return ['in_app'];

  // High severity alerts always include SMS if configured
  if (alert.severity === 'CRITICAL' || alert.severity === 'HIGH') {
    const channels = new Set(categoryPrefs.channels);
    if (categoryPrefs.channels.includes('sms')) {
      channels.add('sms');
    }
    return Array.from(channels);
  }

  return categoryPrefs.channels;
}

/**
 * Monitor fraud detection results and generate alerts
 */
function monitorFraudResults(fraudAnalysis, userId, transactionId) {
  const alerts = [];

  if (fraudAnalysis.riskLevel === 'CRITICAL') {
    alerts.push(createAlert('FRAUD_CRITICAL', userId, {
      message: `Transaction flagged as critical risk (Score: ${fraudAnalysis.riskScore})`,
      details: {
        transactionId,
        riskScore: fraudAnalysis.riskScore,
        flags: fraudAnalysis.flags,
        recommendation: fraudAnalysis.recommendation
      }
    }));
  } else if (fraudAnalysis.riskLevel === 'HIGH') {
    alerts.push(createAlert('FRAUD_HIGH_RISK', userId, {
      message: `High risk transaction detected (Score: ${fraudAnalysis.riskScore})`,
      details: {
        transactionId,
        riskScore: fraudAnalysis.riskScore,
        flags: fraudAnalysis.flags
      }
    }));
  }

  // Velocity alert
  if (fraudAnalysis.breakdown && fraudAnalysis.breakdown.velocityRisk >= 15) {
    alerts.push(createAlert('FRAUD_VELOCITY', userId, {
      message: 'Unusual number of transactions detected',
      details: {
        velocityRisk: fraudAnalysis.breakdown.velocityRisk
      }
    }));
  }

  return alerts;
}

/**
 * Monitor credit score changes and generate alerts
 */
function monitorCreditScore(currentScore, previousScore, userId) {
  const alerts = [];

  if (!previousScore) return alerts;

  const scoreDiff = currentScore - previousScore;

  if (scoreDiff <= -30) {
    alerts.push(createAlert('CREDIT_SCORE_DROP', userId, {
      message: `Your credit score dropped by ${Math.abs(scoreDiff)} points`,
      details: {
        previousScore,
        currentScore,
        change: scoreDiff
      }
    }));
  } else if (scoreDiff >= 20) {
    alerts.push(createAlert('CREDIT_SCORE_IMPROVEMENT', userId, {
      message: `Great news! Your credit score improved by ${scoreDiff} points`,
      details: {
        previousScore,
        currentScore,
        change: scoreDiff
      }
    }));
  }

  return alerts;
}

/**
 * Monitor portfolio performance and generate alerts
 */
function monitorPortfolio(portfolio, previousValue, userId) {
  const alerts = [];

  if (!previousValue || previousValue === 0) return alerts;

  const changePercent = ((portfolio.totalValue - previousValue) / previousValue) * 100;

  if (changePercent <= -5) {
    alerts.push(createAlert('PORTFOLIO_LARGE_LOSS', userId, {
      message: `Your portfolio decreased by ${Math.abs(changePercent).toFixed(1)}%`,
      details: {
        portfolioId: portfolio.id,
        previousValue,
        currentValue: portfolio.totalValue,
        changePercent: changePercent.toFixed(2)
      }
    }));
  } else if (changePercent >= 5) {
    alerts.push(createAlert('PORTFOLIO_LARGE_GAIN', userId, {
      message: `Your portfolio increased by ${changePercent.toFixed(1)}%`,
      details: {
        portfolioId: portfolio.id,
        previousValue,
        currentValue: portfolio.totalValue,
        changePercent: changePercent.toFixed(2)
      }
    }));
  }

  // Check for drift
  if (portfolio.driftScore && portfolio.driftScore > 15) {
    alerts.push(createAlert('PORTFOLIO_DRIFT', userId, {
      message: 'Your portfolio allocation has drifted from targets',
      details: {
        portfolioId: portfolio.id,
        driftScore: portfolio.driftScore
      }
    }));
  }

  return alerts;
}

/**
 * Generate large transaction alert
 */
function alertLargeTransaction(transaction, userId, threshold = 5000) {
  if (transaction.amount >= threshold) {
    return createAlert('LARGE_TRANSACTION', userId, {
      message: `Transaction of $${transaction.amount.toLocaleString()} processed`,
      details: {
        transactionId: transaction.id,
        amount: transaction.amount,
        merchant: transaction.merchant,
        type: transaction.type
      }
    });
  }
  return null;
}

/**
 * Generate daily summary alert
 */
function generateDailySummary(userId, summaryData) {
  return createAlert('DAILY_SUMMARY', userId, {
    message: 'Here\'s your daily activity summary',
    details: {
      transactionCount: summaryData.transactionCount || 0,
      totalSpent: summaryData.totalSpent || 0,
      alertsCount: summaryData.alertsCount || 0,
      portfolioChange: summaryData.portfolioChange || 0
    },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Expires in 24 hours
  });
}

/**
 * Format alert for display
 */
function formatAlertForDisplay(alert) {
  const severityColors = {
    LOW: '#4CAF50',
    MEDIUM: '#FF9800',
    HIGH: '#f44336',
    CRITICAL: '#9C27B0'
  };

  const categoryIcons = {
    fraud: '🛡️',
    credit: '💳',
    portfolio: '📈',
    security: '🔒',
    transaction: '💰',
    general: '📋'
  };

  return {
    ...alert,
    color: severityColors[alert.severity],
    icon: categoryIcons[alert.category],
    formattedDate: new Date(alert.createdAt).toLocaleString(),
    isExpired: alert.expiresAt ? new Date(alert.expiresAt) < new Date() : false
  };
}

/**
 * Group alerts by category
 */
function groupAlertsByCategory(alerts) {
  return alerts.reduce((groups, alert) => {
    const category = alert.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(alert);
    return groups;
  }, {});
}

/**
 * Get unread alert count by severity
 */
function getUnreadAlertCounts(alerts) {
  return alerts
    .filter(a => !a.isRead && !a.isDismissed)
    .reduce((counts, alert) => {
      counts[alert.severity] = (counts[alert.severity] || 0) + 1;
      counts.total = (counts.total || 0) + 1;
      return counts;
    }, { total: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 });
}

module.exports = {
  ALERT_TYPES,
  NOTIFICATION_CHANNELS,
  DEFAULT_PREFERENCES,
  createAlert,
  shouldSendAlert,
  getNotificationChannels,
  monitorFraudResults,
  monitorCreditScore,
  monitorPortfolio,
  alertLargeTransaction,
  generateDailySummary,
  formatAlertForDisplay,
  groupAlertsByCategory,
  getUnreadAlertCounts
};
