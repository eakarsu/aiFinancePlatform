const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { callOpenRouter } = require('../services/openrouter');
const { parseAIJson } = require('../utils/parseAIJson');
const { paginatedQuery, bulkDelete, bulkUpdate, handleExport } = require('../utils/queryHelpers');



// Get all bills
router.get('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { search, status } = req.query;
    const baseWhere = { userId: req.user.id };
    if (status) baseWhere.status = status;

    const result = await paginatedQuery(prisma, 'bill', {
      baseWhere,
      search,
      searchFields: ['billType', 'provider', 'status', 'accountNumber'],
      query: req.query
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get bills' });
  }
});

// Bulk delete bills
router.post('/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkDelete(prisma, 'bill', req.user.id, req.body.ids);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

// Bulk update bills
router.patch('/bulk-update', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkUpdate(prisma, 'bill', req.user.id, req.body.ids, req.body.data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

// Export bills
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await handleExport(res, prisma, 'bill', req.user.id, req.query, 'Bills', ['billType', 'provider', 'currentAmount', 'originalAmount', 'frequency', 'status', 'aiSavingsEstimate', 'aiSuccessLikelihood']);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get single bill
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const bill = await prisma.bill.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    res.json(bill);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get bill' });
  }
});

// Add bill
router.post('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { billType, provider, currentAmount, originalAmount, frequency, dueDate,
            accountNumber, contractStart, contractEnd, isUnderContract } = req.body;

    const bill = await prisma.bill.create({
      data: {
        userId: req.user.id,
        billType,
        provider,
        currentAmount,
        originalAmount: originalAmount || currentAmount,
        frequency: frequency || 'monthly',
        dueDate,
        accountNumber,
        contractStart: contractStart ? new Date(contractStart) : null,
        contractEnd: contractEnd ? new Date(contractEnd) : null,
        isUnderContract: isUnderContract || false
      }
    });

    res.json(bill);
  } catch (error) {
    console.error('Add bill error:', error);
    res.status(500).json({ error: 'Failed to add bill' });
  }
});

// Update bill
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const data = { ...req.body };
    if (data.contractStart) data.contractStart = new Date(data.contractStart);
    if (data.contractEnd) data.contractEnd = new Date(data.contractEnd);

    const bill = await prisma.bill.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data
    });
    if (bill.count === 0) return res.status(404).json({ error: 'Bill not found' });

    const updated = await prisma.bill.findFirst({
      where: { id: req.params.id }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update bill' });
  }
});

// Delete bill
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await prisma.bill.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete bill' });
  }
});

// Record negotiation result
router.post('/:id/negotiate', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { newAmount, notes, success } = req.body;

    const bill = await prisma.bill.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const history = bill.negotiationHistory || [];
    history.push({
      date: new Date().toISOString(),
      previousAmount: bill.currentAmount,
      newAmount: success ? newAmount : bill.currentAmount,
      savings: success ? bill.currentAmount - newAmount : 0,
      success,
      notes
    });

    const updated = await prisma.bill.update({
      where: { id: bill.id },
      data: {
        currentAmount: success ? newAmount : bill.currentAmount,
        lastNegotiated: new Date(),
        negotiationHistory: history
      }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to record negotiation' });
  }
});

// AI Generate negotiation strategy
router.post('/:id/strategy', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const bill = await prisma.bill.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const contractStatus = bill.isUnderContract
      ? `Under contract until ${bill.contractEnd}`
      : 'Not under contract';

    const prompt = `Create a negotiation strategy for reducing this bill:

BILL DETAILS:
- Type: ${bill.billType}
- Provider: ${bill.provider}
- Current Amount: $${bill.currentAmount}/month
- Original Amount: $${bill.originalAmount || bill.currentAmount}/month
- Frequency: ${bill.frequency}
- Contract Status: ${contractStatus}
- Last Negotiated: ${bill.lastNegotiated || 'Never'}
- Negotiation History: ${JSON.stringify(bill.negotiationHistory || [])}

Provide a CONCISE negotiation strategy in this JSON format (keep all text brief, 1-2 sentences max):
{
  "aiSavingsEstimate": 25,
  "aiSuccessLikelihood": 70,
  "analysis": {
    "summary": "Brief overview",
    "marketRate": "Brief competitor pricing"
  },
  "negotiationScript": {
    "opening": "One sentence opening line",
    "keyPoints": ["Point 1", "Point 2", "Point 3"],
    "objectionHandling": [
      {"objection": "They say X", "response": "You say Y"}
    ],
    "closing": "One sentence closing"
  },
  "alternatives": [
    {"provider": "Name", "estimatedCost": 75, "features": "Brief description"}
  ],
  "tips": [
    {"tip": "Brief tip", "importance": "high"}
  ],
  "timeline": {
    "preparation": "Brief prep note",
    "bestDays": "Best days to call",
    "estimatedCallTime": "15 min"
  }
}`;

    const aiResponse = await callOpenRouter(prompt, 'You are an expert bill negotiation coach. Respond only with valid JSON. Keep responses concise.');
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let strategy = null;
    if (jsonMatch) {
      try {
        const _aiParsed = parseAIJson(jsonMatch[0]);
        strategy = _aiParsed || {};
      } catch (parseErr) {
        console.error('Strategy JSON parse error, using raw text fallback');
        strategy = {
          aiSavingsEstimate: 0,
          aiSuccessLikelihood: 50,
          analysis: { summary: aiResponse.replace(/```json?|```/g, '').trim() },
          negotiationScript: null,
          alternatives: [],
          tips: [],
          timeline: null
        };
      }

      try {
        await prisma.bill.update({
          where: { id: bill.id },
          data: {
            aiSavingsEstimate: strategy.aiSavingsEstimate || 0,
            aiSuccessLikelihood: strategy.aiSuccessLikelihood || 50,
            aiNegotiationScript: strategy.negotiationScript?.keyPoints?.join('\n\n') || '',
            aiAlternatives: strategy.alternatives || [],
            aiTips: strategy.tips || []
          }
        });
      } catch (dbErr) {
        console.error('Failed to save strategy to DB:', dbErr.message);
      }
    }

    // Log the analysis
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'bill_negotiator',
        userId: req.user.id,
        inputData: { bill },
        outputData: { strategy },
        modelUsed: process.env.OPENROUTER_MODEL || 'openrouter',
        confidence: strategy?.aiSuccessLikelihood || 0
      }
    });

    res.json({ bill, strategy, poweredBy: 'OpenRouter AI' });
  } catch (error) {
    console.error('Negotiation strategy error:', error);
    res.status(500).json({ error: 'Failed to generate strategy: ' + error.message });
  }
});

// AI Analyze all bills for savings opportunities
router.post('/analyze-all', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const bills = await prisma.bill.findMany({
      where: { userId: req.user.id, status: 'active' }
    });

    if (bills.length === 0) {
      return res.status(400).json({ error: 'No active bills to analyze' });
    }

    const billsSummary = bills.map(b => ({
      type: b.billType,
      provider: b.provider,
      amount: b.currentAmount,
      frequency: b.frequency,
      underContract: b.isUnderContract,
      lastNegotiated: b.lastNegotiated
    }));

    const totalMonthly = bills.reduce((sum, b) => {
      const monthly = b.frequency === 'yearly' ? b.currentAmount / 12 : b.currentAmount;
      return sum + monthly;
    }, 0);

    const prompt = `Analyze these bills for savings opportunities:

BILLS PORTFOLIO:
${JSON.stringify(billsSummary, null, 2)}

Total Monthly Bills: $${totalMonthly.toFixed(2)}
Total Annual Bills: $${(totalMonthly * 12).toFixed(2)}

Provide detailed analysis in this JSON format (give thorough advice, up to 5 items per array):
{
  "totalMonthly": ${totalMonthly.toFixed(2)},
  "potentialMonthlySavings": 150,
  "potentialAnnualSavings": 1800,
  "analysis": {
    "summary": "Thorough overall assessment of spending patterns and savings opportunities (3-4 sentences)",
    "quickWins": ["Detailed quick win 1", "Detailed quick win 2", "Detailed quick win 3"],
    "overPayingBills": ["Bill you are overpaying on and why"],
    "marketComparison": "How your bills compare to market averages"
  },
  "billAnalysis": [
    {"bill": "Provider - Type", "currentAmount": 100, "marketAverage": 70, "savingsPotential": 30, "recommendation": "Specific action to take for this bill"}
  ],
  "recommendations": [
    {"title": "Strategy name", "description": "Detailed recommendation with specific steps to take", "potentialSavings": 50, "effort": "low"}
  ],
  "actionPlan": [
    {"priority": 1, "bill": "Bill name", "action": "Specific step-by-step action to take", "expectedSavings": 30, "timeframe": "This week"},
    {"priority": 2, "bill": "Bill name", "action": "Next action", "expectedSavings": 20, "timeframe": "Next week"}
  ],
  "negotiationCalendar": [
    {"bill": "Bill name", "bestTime": "When to negotiate", "reason": "Why this timing is best"}
  ]
}`;

    const aiResponse = await callOpenRouter(prompt, 'You are a personal finance expert specializing in reducing household bills. Respond only with valid JSON. Keep responses concise.');
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let analysis = null;
    if (jsonMatch) {
      try {
        const _aiParsed = parseAIJson(jsonMatch[0]);
        analysis = _aiParsed || {};
      } catch (parseErr) {
        console.error('Bills analysis JSON parse error, using fallback');
        analysis = {
          totalMonthly,
          potentialMonthlySavings: 0,
          potentialAnnualSavings: 0,
          analysis: { summary: aiResponse.replace(/```json?|```/g, '').trim() },
          recommendations: [],
          actionPlan: []
        };
      }
    }

    // Log the analysis
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'bill_negotiator_portfolio',
        userId: req.user.id,
        inputData: { bills: billsSummary },
        outputData: { analysis },
        modelUsed: process.env.OPENROUTER_MODEL || 'openrouter',
        confidence: 85
      }
    });

    res.json({
      bills: billsSummary,
      totals: { totalMonthly, totalAnnual: totalMonthly * 12 },
      analysis,
      poweredBy: 'OpenRouter AI'
    });
  } catch (error) {
    console.error('Bills analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze bills: ' + error.message });
  }
});

module.exports = router;
