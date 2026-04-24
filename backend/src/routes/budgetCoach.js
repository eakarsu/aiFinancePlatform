const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { paginatedQuery, bulkDelete, bulkUpdate, handleExport } = require('../utils/queryHelpers');

// OpenRouter AI helper
async function callOpenRouter(prompt, systemPrompt = '') {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      max_tokens: 2500,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ================== BUDGET PLANS ==================

// Get all budget plans
router.get('/plans', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { search } = req.query;
    const baseWhere = { userId: req.user.id };
    const result = await paginatedQuery(prisma, 'budgetPlan', {
      baseWhere,
      search,
      searchFields: ['name', 'period'],
      query: req.query
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get budget plans' });
  }
});

// Bulk delete budget plans
router.post('/plans/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkDelete(prisma, 'budgetPlan', req.user.id, req.body.ids);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

// Bulk update budget plans
router.patch('/plans/bulk-update', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkUpdate(prisma, 'budgetPlan', req.user.id, req.body.ids, req.body.data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

// Export budget plans
router.get('/plans/export', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await handleExport(res, prisma, 'budgetPlan', req.user.id, req.query, 'Budget Plans', ['name', 'period', 'totalIncome', 'totalBudget', 'aiHealthScore']);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get single plan
router.get('/plans/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const plan = await prisma.budgetPlan.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get plan' });
  }
});

// Create budget plan
router.post('/plans', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { name, period, totalIncome, totalBudget, categories } = req.body;

    const plan = await prisma.budgetPlan.create({
      data: {
        userId: req.user.id,
        name: name || 'My Budget',
        period: period || 'monthly',
        totalIncome: totalIncome || 0,
        totalBudget: totalBudget || 0,
        categories: categories || []
      }
    });

    res.json(plan);
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Failed to create budget plan' });
  }
});

// Update plan
router.patch('/plans/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const plan = await prisma.budgetPlan.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: req.body
    });
    if (plan.count === 0) return res.status(404).json({ error: 'Plan not found' });

    const updated = await prisma.budgetPlan.findFirst({
      where: { id: req.params.id }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// Delete plan
router.delete('/plans/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await prisma.budgetPlan.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

// AI Analyze budget plan
router.post('/plans/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const plan = await prisma.budgetPlan.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    // Get recent expenses for this user
    const expenses = await prisma.expense.findMany({
      where: { userId: req.user.id },
      orderBy: { date: 'desc' },
      take: 100
    });

    const expensesByCategory = expenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {});

    const prompt = `Analyze this budget and provide coaching advice:

BUDGET PLAN:
- Name: ${plan.name}
- Period: ${plan.period}
- Total Income: $${plan.totalIncome?.toLocaleString()}
- Total Budget: $${plan.totalBudget?.toLocaleString()}
- Savings Rate: ${((plan.totalIncome - plan.totalBudget) / plan.totalIncome * 100).toFixed(1)}%

BUDGET CATEGORIES:
${JSON.stringify(plan.categories, null, 2)}

ACTUAL SPENDING (recent):
${JSON.stringify(expensesByCategory, null, 2)}

Provide budget coaching in this JSON format:
{
  "aiHealthScore": 75,
  "aiSavingsGoal": 500,
  "analysis": {
    "summary": "Overall budget health assessment",
    "incomeUtilization": "How well is income being used",
    "savingsRate": "Assessment of savings rate",
    "spendingPatterns": "Key spending patterns observed"
  },
  "insights": [
    {"category": "Housing", "insight": "Insight about this category", "status": "good|warning|concern"},
    {"category": "Food", "insight": "Insight about this category", "status": "good|warning|concern"}
  ],
  "recommendations": [
    {"title": "Reduce dining out", "description": "You could save $X by...", "potentialSavings": 200, "difficulty": "easy|medium|hard"}
  ],
  "optimizations": [
    {"category": "Subscriptions", "currentSpend": 150, "suggestedSpend": 100, "tip": "How to optimize"}
  ],
  "challenges": [
    {"name": "No-Spend Weekend", "description": "Try not spending on entertainment this weekend", "potentialSavings": 50}
  ],
  "rules": [
    {"rule": "50/30/20 Rule", "assessment": "How you compare to this rule", "compliance": 75}
  ],
  "actionPlan": [
    {"week": 1, "action": "Action to take", "goal": "Specific goal"}
  ]
}`;

    const aiResponse = await callOpenRouter(prompt, 'You are an expert budget coach. Be encouraging but honest. Respond only with valid JSON.');
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let analysis = null;
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);

      await prisma.budgetPlan.update({
        where: { id: plan.id },
        data: {
          aiHealthScore: analysis.aiHealthScore,
          aiSavingsGoal: analysis.aiSavingsGoal,
          aiInsights: analysis.insights,
          aiRecommendations: analysis.recommendations,
          aiOptimizations: analysis.optimizations
        }
      });
    }

    // Log the analysis
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'budget_coach',
        userId: req.user.id,
        inputData: { plan, expenses: expensesByCategory },
        outputData: { analysis },
        modelUsed: process.env.OPENROUTER_MODEL || 'openrouter',
        confidence: analysis?.aiHealthScore || 0
      }
    });

    res.json({ plan, analysis, poweredBy: 'OpenRouter AI' });
  } catch (error) {
    console.error('Budget analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze budget: ' + error.message });
  }
});

// ================== EXPENSES ==================

// Get all expenses
router.get('/expenses', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { search, category, startDate, endDate } = req.query;

    const baseWhere = { userId: req.user.id };
    if (category) baseWhere.category = category;
    if (startDate || endDate) {
      baseWhere.date = {};
      if (startDate) baseWhere.date.gte = new Date(startDate);
      if (endDate) baseWhere.date.lte = new Date(endDate);
    }

    const result = await paginatedQuery(prisma, 'expense', {
      baseWhere,
      search,
      searchFields: ['category', 'description', 'merchant'],
      query: req.query
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get expenses' });
  }
});

// Bulk delete expenses
router.post('/expenses/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkDelete(prisma, 'expense', req.user.id, req.body.ids);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

// Bulk update expenses
router.patch('/expenses/bulk-update', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkUpdate(prisma, 'expense', req.user.id, req.body.ids, req.body.data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

// Export expenses
router.get('/expenses/export', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await handleExport(res, prisma, 'expense', req.user.id, req.query, 'Expenses', ['amount', 'category', 'description', 'merchant', 'date']);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get single expense
router.get('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const expense = await prisma.expense.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get expense' });
  }
});

// Add expense
router.post('/expenses', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { amount, category, description, merchant, date, isRecurring, recurringFrequency } = req.body;

    const expense = await prisma.expense.create({
      data: {
        userId: req.user.id,
        amount,
        category,
        description,
        merchant,
        date: date ? new Date(date) : new Date(),
        isRecurring: isRecurring || false,
        recurringFrequency
      }
    });

    res.json(expense);
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// Update expense
router.patch('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const data = { ...req.body };
    if (data.date) data.date = new Date(data.date);

    const expense = await prisma.expense.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data
    });
    if (expense.count === 0) return res.status(404).json({ error: 'Expense not found' });

    const updated = await prisma.expense.findFirst({
      where: { id: req.params.id }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Delete expense
router.delete('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await prisma.expense.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// Get expense summary
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { period = 'month' } = req.query;

    const now = new Date();
    let startDate;
    if (period === 'week') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (period === 'month') {
      startDate = new Date(now.setMonth(now.getMonth() - 1));
    } else {
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
    }

    const expenses = await prisma.expense.findMany({
      where: {
        userId: req.user.id,
        date: { gte: startDate }
      }
    });

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const byCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});

    const categoryBreakdown = Object.entries(byCategory).map(([name, amount]) => ({
      name,
      amount,
      percentage: (amount / total * 100).toFixed(1)
    })).sort((a, b) => b.amount - a.amount);

    res.json({
      period,
      total,
      count: expenses.length,
      average: expenses.length > 0 ? total / expenses.length : 0,
      categoryBreakdown
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

module.exports = router;
