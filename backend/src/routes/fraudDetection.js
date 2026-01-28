const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const fraudEngine = require('../utils/fraudDetectionEngine');
const alertsEngine = require('../utils/alertsEngine');

// OpenRouter AI helper
async function callOpenRouter(prompt, systemPrompt = '') {
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
      temperature: 0.1
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Add Transaction
router.post('/transactions', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { type, amount, description, merchant, merchantName, category, merchantCategory, location, ipAddress, deviceId, date } = req.body;

    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user.id,
        type: type || 'PURCHASE',
        amount: parseFloat(amount),
        merchant: merchant || merchantName || 'Unknown',
        category: category || merchantCategory || 'Other',
        location: location || 'Unknown',
        ipAddress: ipAddress || '0.0.0.0',
        deviceId: deviceId || 'web',
        createdAt: date ? new Date(date) : new Date()
      }
    });

    res.json(transaction);
  } catch (error) {
    console.error('Transaction error:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Get Transactions
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { limit = 50 } = req.query;

    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Update Transaction
router.patch('/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { type, amount, merchant, category, location } = req.body;

    const transaction = await prisma.transaction.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: {
        ...(type && { type }),
        ...(amount && { amount: parseFloat(amount) }),
        ...(merchant && { merchant }),
        ...(category && { category }),
        ...(location && { location })
      }
    });

    if (transaction.count === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ message: 'Transaction updated successfully' });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

// Delete Transaction
router.delete('/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    // First delete related fraud alerts
    await prisma.fraudAlert.deleteMany({
      where: { transactionId: req.params.id, userId: req.user.id }
    });

    // Then delete the transaction
    const result = await prisma.transaction.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

// AI Fraud Analysis - Single Transaction
router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { transactionId } = req.body;

    // Get the transaction
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, userId: req.user.id }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Get user's transaction history for context
    const recentTransactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Calculate user's typical patterns
    const avgAmount = recentTransactions.reduce((sum, t) => sum + t.amount, 0) / recentTransactions.length;
    const maxAmount = Math.max(...recentTransactions.map(t => t.amount));
    const locations = [...new Set(recentTransactions.map(t => t.location).filter(Boolean))];
    const merchants = [...new Set(recentTransactions.map(t => t.merchantCategory).filter(Boolean))];

    const prompt = `You are an AI fraud detection system for SMB transactions. Analyze this transaction for fraud risk.

TRANSACTION TO ANALYZE:
- Amount: $${transaction.amount}
- Type: ${transaction.type}
- Merchant: ${transaction.merchantName || 'Unknown'}
- Category: ${transaction.merchantCategory || 'Unknown'}
- Location: ${transaction.location || 'Unknown'}
- Time: ${transaction.createdAt}
- Description: ${transaction.description || 'None'}

USER TRANSACTION PATTERNS:
- Average Transaction: $${avgAmount.toFixed(2)}
- Maximum Transaction: $${maxAmount}
- Usual Locations: ${locations.join(', ') || 'Not enough data'}
- Usual Categories: ${merchants.join(', ') || 'Not enough data'}
- Recent Transaction Count: ${recentTransactions.length}

FRAUD INDICATORS TO CHECK:
1. Amount significantly higher than average
2. Unusual location compared to history
3. New merchant category
4. Unusual time of transaction
5. Velocity (multiple transactions in short time)
6. Known fraud patterns

Analyze and respond in JSON:
{
  "riskScore": 0-100,
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "isFraudulent": false,
  "confidence": 85,
  "flags": [
    {"flag": "Amount 3x higher than average", "severity": "HIGH"},
    {"flag": "New merchant category", "severity": "LOW"}
  ],
  "recommendation": "APPROVE|REVIEW|BLOCK",
  "reasoning": "Explanation of the analysis"
}`;

    const aiResponse = await callOpenRouter(prompt, 'You are a fraud detection AI. Respond only in valid JSON.');

    // Parse JSON
    let jsonStr = aiResponse.match(/\{[\s\S]*\}/)?.[0] || '{}';
    jsonStr = jsonStr.replace(/(\d),(\d)/g, '$1$2');
    const fraudAnalysis = JSON.parse(jsonStr);

    // Update transaction with fraud score
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        fraudScore: fraudAnalysis.riskScore,
        fraudFlags: fraudAnalysis.flags || [],
        reviewStatus: fraudAnalysis.riskLevel === 'HIGH' || fraudAnalysis.riskLevel === 'CRITICAL' ? 'FLAGGED' : 'APPROVED'
      }
    });

    // Create alert if high risk
    if (fraudAnalysis.riskLevel === 'HIGH' || fraudAnalysis.riskLevel === 'CRITICAL') {
      await prisma.fraudAlert.create({
        data: {
          userId: req.user.id,
          transactionId: transactionId,
          alertType: fraudAnalysis.isFraudulent ? 'CONFIRMED_FRAUD' : 'SUSPICIOUS',
          severity: fraudAnalysis.riskLevel,
          description: fraudAnalysis.reasoning,
          aiConfidence: fraudAnalysis.confidence
        }
      });
    }

    // Log the analysis
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'fraud_detection',
        userId: req.user.id,
        inputData: { transaction, userPatterns: { avgAmount, maxAmount, locations, merchants } },
        outputData: fraudAnalysis,
        modelUsed: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-haiku',
        confidence: fraudAnalysis.confidence
      }
    });

    res.json({
      transaction: { id: transaction.id, amount: transaction.amount, merchantName: transaction.merchantName },
      analysis: fraudAnalysis
    });
  } catch (error) {
    console.error('Fraud analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze transaction' });
  }
});

// AI Batch Analysis - Analyze multiple transactions
router.post('/analyze-batch', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    console.log('Starting batch fraud analysis with OpenRouter...');

    // Get recent transactions to analyze (regardless of existing fraudScore)
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.user.id
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (transactions.length === 0) {
      return res.json({ message: 'No transactions to analyze', analyzed: 0, overallRiskLevel: 'N/A' });
    }

    // Get all user transactions for pattern analysis
    const allTransactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const avgAmount = allTransactions.reduce((sum, t) => sum + t.amount, 0) / allTransactions.length;

    const prompt = `Analyze these transactions for fraud patterns. Look for anomalies, unusual patterns, and potential fraud.

TRANSACTIONS TO ANALYZE:
${transactions.map((t, i) => `${i + 1}. $${(t.amount || 0).toFixed(2)} at ${t.merchant || t.merchantName || 'Unknown'} (${t.category || t.merchantCategory || 'Unknown'}) - ${t.location || 'Unknown location'}`).join('\n')}

USER AVERAGE TRANSACTION: $${(avgAmount || 0).toFixed(2)}
TOTAL TRANSACTIONS IN HISTORY: ${allTransactions.length}

For each transaction, provide a risk assessment. Respond in JSON:
{
  "batchAnalysis": [
    {"index": 1, "riskScore": 15, "riskLevel": "LOW", "recommendation": "APPROVE"},
    {"index": 2, "riskScore": 75, "riskLevel": "HIGH", "recommendation": "REVIEW"}
  ],
  "overallRiskLevel": "LOW",
  "patternAlerts": ["Pattern alert 1", "Pattern alert 2"],
  "summary": "Brief summary of findings"
}`;

    console.log('Calling OpenRouter for batch fraud analysis...');
    const startTime = Date.now();
    const aiResponse = await callOpenRouter(prompt, 'You are a fraud detection AI. Respond only in valid JSON.');
    console.log('OpenRouter batch analysis response time:', Date.now() - startTime, 'ms');

    let jsonStr = aiResponse.match(/\{[\s\S]*\}/)?.[0] || '{}';
    jsonStr = jsonStr.replace(/(\d),(\d)/g, '$1$2');
    const batchResult = JSON.parse(jsonStr);

    // Update each transaction with its risk score
    for (const analysis of batchResult.batchAnalysis || []) {
      const transaction = transactions[analysis.index - 1];
      if (transaction) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            fraudScore: analysis.riskScore,
            fraudFlags: [{ type: 'BATCH_ANALYSIS', riskLevel: analysis.riskLevel, recommendation: analysis.recommendation }],
            reviewStatus: analysis.riskLevel === 'HIGH' || analysis.riskLevel === 'CRITICAL' ? 'FLAGGED' : 'APPROVED'
          }
        });

        // Create alert for high-risk transactions
        if (analysis.riskLevel === 'HIGH' || analysis.riskLevel === 'CRITICAL') {
          await prisma.fraudAlert.create({
            data: {
              userId: req.user.id,
              transactionId: transaction.id,
              alertType: 'PATTERN_ANOMALY',
              severity: analysis.riskLevel,
              description: `Batch analysis flagged: Risk score ${analysis.riskScore}`,
              aiConfidence: 80
            }
          });
        }
      }
    }

    console.log('Batch analysis complete:', {
      analyzed: transactions.length,
      overallRiskLevel: batchResult.overallRiskLevel || 'LOW'
    });

    res.json({
      analyzed: transactions.length,
      batchAnalysis: batchResult.batchAnalysis || [],
      overallRiskLevel: batchResult.overallRiskLevel || 'LOW',
      patternAlerts: batchResult.patternAlerts || [],
      summary: batchResult.summary || `Analyzed ${transactions.length} transactions successfully.`
    });
  } catch (error) {
    console.error('Batch analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze transactions', details: error.message });
  }
});

// Get Fraud Alerts
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { status } = req.query;

    const where = { userId: req.user.id };
    if (status) where.status = status;

    const alerts = await prisma.fraudAlert.findMany({
      where,
      include: { transaction: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Update Alert Status
router.patch('/alerts/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { status, resolution } = req.body;

    const alert = await prisma.fraudAlert.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: {
        status,
        resolution,
        resolvedAt: status === 'RESOLVED' ? new Date() : null
      }
    });

    if (alert.count === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ message: 'Alert updated', status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// Get Fraud Statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    const [totalTransactions, flaggedTransactions, alerts, recentAlerts] = await Promise.all([
      prisma.transaction.count({ where: { userId: req.user.id } }),
      prisma.transaction.count({ where: { userId: req.user.id, fraudScore: { gte: 50 } } }),
      prisma.fraudAlert.count({ where: { userId: req.user.id } }),
      prisma.fraudAlert.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id, fraudScore: { not: null } }
    });

    const avgRiskScore = transactions.length > 0
      ? transactions.reduce((sum, t) => sum + (t.fraudScore || 0), 0) / transactions.length
      : 0;

    res.json({
      totalTransactions,
      flaggedTransactions,
      totalAlerts: alerts,
      averageRiskScore: avgRiskScore.toFixed(1),
      flagRate: totalTransactions > 0 ? ((flaggedTransactions / totalTransactions) * 100).toFixed(1) : 0,
      recentAlerts
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Real-time Transaction Monitoring with Rules-Based Engine
router.post('/monitor', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { amount, merchant, category, location, deviceId, ipAddress } = req.body;

    // Create the transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user.id,
        type: 'PURCHASE',
        amount,
        merchant,
        category,
        location,
        deviceId,
        ipAddress
      }
    });

    // Get user's transaction history for analysis
    const userTransactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Use the rules-based fraud detection engine
    const fraudAnalysis = fraudEngine.analyzeTransaction(
      { ...transaction, createdAt: new Date() },
      userTransactions.filter(t => t.id !== transaction.id)
    );

    // Update transaction with fraud analysis
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        fraudScore: fraudAnalysis.riskScore,
        fraudFlags: fraudAnalysis.flags,
        isBlocked: fraudAnalysis.recommendation === 'BLOCK',
        reviewStatus: fraudAnalysis.recommendation === 'REVIEW' ? 'FLAGGED' :
                      fraudAnalysis.recommendation === 'BLOCK' ? 'REJECTED' : 'APPROVED'
      }
    });

    // Create fraud alert if needed
    if (fraudAnalysis.riskLevel === 'HIGH' || fraudAnalysis.riskLevel === 'CRITICAL') {
      const alertType = fraudAnalysis.flags[0]?.type || 'PATTERN_ANOMALY';

      await prisma.fraudAlert.create({
        data: {
          userId: req.user.id,
          transactionId: transaction.id,
          alertType: alertType,
          severity: fraudAnalysis.riskLevel,
          description: fraudAnalysis.flags.map(f => f.message).join('; '),
          aiConfidence: fraudAnalysis.confidence
        }
      });

      // Create notification for the user
      const notificationAlerts = alertsEngine.monitorFraudResults(fraudAnalysis, req.user.id, transaction.id);
      for (const alert of notificationAlerts) {
        await prisma.notification.create({
          data: {
            userId: req.user.id,
            type: alert.type,
            category: alert.category,
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            details: alert.details,
            actionRequired: alert.actionRequired
          }
        });
      }
    }

    // Log the analysis
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'fraud_detection',
        userId: req.user.id,
        inputData: { transaction, patternsAnalyzed: fraudAnalysis.patterns.totalTransactionsAnalyzed },
        outputData: fraudAnalysis,
        modelUsed: 'rules-based-engine',
        confidence: fraudAnalysis.confidence
      }
    });

    res.json({
      transactionId: transaction.id,
      riskScore: fraudAnalysis.riskScore,
      riskLevel: fraudAnalysis.riskLevel,
      recommendation: fraudAnalysis.recommendation,
      confidence: fraudAnalysis.confidence,
      flags: fraudAnalysis.flags,
      breakdown: fraudAnalysis.breakdown,
      patterns: fraudAnalysis.patterns,
      isBlocked: fraudAnalysis.recommendation === 'BLOCK',
      message: fraudAnalysis.recommendation === 'APPROVE' ? 'Transaction approved' :
               fraudAnalysis.recommendation === 'BLOCK' ? 'Transaction blocked - suspicious activity detected' :
               'Transaction flagged for review'
    });
  } catch (error) {
    console.error('Monitor error:', error);
    res.status(500).json({ error: 'Failed to monitor transaction' });
  }
});

// Rules-based batch analysis
router.post('/analyze-rules', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    // Get unanalyzed transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.user.id,
        fraudScore: null
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    if (transactions.length === 0) {
      return res.json({ message: 'No transactions to analyze', analyzed: 0 });
    }

    // Get all transactions for pattern analysis
    const allTransactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const results = [];
    let highRiskCount = 0;

    for (const transaction of transactions) {
      const analysis = fraudEngine.analyzeTransaction(
        transaction,
        allTransactions.filter(t => t.id !== transaction.id)
      );

      // Update transaction
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          fraudScore: analysis.riskScore,
          fraudFlags: analysis.flags,
          reviewStatus: analysis.riskLevel === 'HIGH' || analysis.riskLevel === 'CRITICAL' ? 'FLAGGED' : 'APPROVED'
        }
      });

      if (analysis.riskLevel === 'HIGH' || analysis.riskLevel === 'CRITICAL') {
        highRiskCount++;
        await prisma.fraudAlert.create({
          data: {
            userId: req.user.id,
            transactionId: transaction.id,
            alertType: analysis.flags[0]?.type || 'PATTERN_ANOMALY',
            severity: analysis.riskLevel,
            description: analysis.flags.map(f => f.message).join('; '),
            aiConfidence: analysis.confidence
          }
        });
      }

      results.push({
        transactionId: transaction.id,
        amount: transaction.amount,
        riskScore: analysis.riskScore,
        riskLevel: analysis.riskLevel,
        flagCount: analysis.flags.length
      });
    }

    res.json({
      analyzed: transactions.length,
      highRiskCount,
      results,
      summary: {
        totalAnalyzed: transactions.length,
        lowRisk: results.filter(r => r.riskLevel === 'LOW').length,
        mediumRisk: results.filter(r => r.riskLevel === 'MEDIUM').length,
        highRisk: results.filter(r => r.riskLevel === 'HIGH').length,
        criticalRisk: results.filter(r => r.riskLevel === 'CRITICAL').length
      }
    });
  } catch (error) {
    console.error('Rules analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze transactions' });
  }
});

module.exports = router;
