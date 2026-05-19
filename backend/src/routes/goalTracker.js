const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { callOpenRouter } = require('../services/openrouter');
const { parseAIJson } = require('../utils/parseAIJson');
const { paginatedQuery, bulkDelete, bulkUpdate, handleExport } = require('../utils/queryHelpers');



// Get all goals
router.get('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { search, status } = req.query;
    const baseWhere = { userId: req.user.id };
    if (status) baseWhere.status = status;

    const result = await paginatedQuery(prisma, 'financialGoal', {
      baseWhere,
      search,
      searchFields: ['name', 'description', 'category', 'status'],
      query: req.query
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get goals' });
  }
});

// Bulk delete financial goals
router.post('/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkDelete(prisma, 'financialGoal', req.user.id, req.body.ids);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

// Bulk update financial goals
router.patch('/bulk-update', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const result = await bulkUpdate(prisma, 'financialGoal', req.user.id, req.body.ids, req.body.data);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Bulk update failed' });
  }
});

// Export financial goals
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await handleExport(res, prisma, 'financialGoal', req.user.id, req.query, 'Financial Goals', ['name', 'category', 'targetAmount', 'currentAmount', 'deadline', 'priority', 'status', 'aiProgress', 'aiOnTrack']);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get single goal
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const goal = await prisma.financialGoal.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    res.json(goal);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get goal' });
  }
});

// Create goal
router.post('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { name, description, category, targetAmount, currentAmount, deadline,
            priority, monthlyContribution, autoSave } = req.body;

    const goal = await prisma.financialGoal.create({
      data: {
        userId: req.user.id,
        name,
        description,
        category: category || 'savings',
        targetAmount,
        currentAmount: currentAmount || 0,
        deadline: deadline ? new Date(deadline) : null,
        priority: priority || 1,
        monthlyContribution,
        autoSave: autoSave || false
      }
    });

    res.json(goal);
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// Update goal
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const data = { ...req.body };
    if (data.deadline) data.deadline = new Date(data.deadline);

    const goal = await prisma.financialGoal.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data
    });
    if (goal.count === 0) return res.status(404).json({ error: 'Goal not found' });

    const updated = await prisma.financialGoal.findFirst({
      where: { id: req.params.id }
    });

    // Check if goal is completed
    if (updated.currentAmount >= updated.targetAmount && updated.status !== 'completed') {
      await prisma.financialGoal.update({
        where: { id: updated.id },
        data: { status: 'completed' }
      });
      updated.status = 'completed';
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// Delete goal
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await prisma.financialGoal.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// Add contribution to goal
router.post('/:id/contribute', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { amount } = req.body;

    const goal = await prisma.financialGoal.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const newAmount = goal.currentAmount + amount;
    const status = newAmount >= goal.targetAmount ? 'completed' : goal.status;

    const updated = await prisma.financialGoal.update({
      where: { id: goal.id },
      data: { currentAmount: newAmount, status }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add contribution' });
  }
});

// AI Analyze single goal
router.post('/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const goal = await prisma.financialGoal.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const progress = (goal.currentAmount / goal.targetAmount * 100).toFixed(1);
    const remaining = goal.targetAmount - goal.currentAmount;
    const daysToDeadline = goal.deadline
      ? Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24))
      : null;

    const prompt = `Analyze this financial goal and provide actionable guidance:

GOAL DETAILS:
- Name: ${goal.name}
- Description: ${goal.description || 'N/A'}
- Category: ${goal.category}
- Target Amount: $${goal.targetAmount?.toLocaleString()}
- Current Amount: $${goal.currentAmount?.toLocaleString()}
- Progress: ${progress}%
- Remaining: $${remaining?.toLocaleString()}
- Deadline: ${goal.deadline || 'No deadline'}
- Days to Deadline: ${daysToDeadline || 'N/A'}
- Priority: ${goal.priority} (1=highest)
- Monthly Contribution: $${goal.monthlyContribution?.toLocaleString() || 'Not set'}

Provide goal analysis in this JSON format:
{
  "aiProgress": ${progress},
  "aiOnTrack": true,
  "aiProjectedCompletion": "2024-12-15",
  "analysis": {
    "summary": "Overall goal progress assessment",
    "paceAssessment": "Are you on track to meet the deadline?",
    "requiredMonthlyContribution": 500,
    "feasibilityScore": 85
  },
  "recommendations": [
    {"title": "Increase savings", "description": "Detailed recommendation", "impact": "high|medium|low"}
  ],
  "milestones": [
    {"percentage": 25, "amount": 2500, "status": "completed|current|upcoming", "estimatedDate": "2024-06-01"},
    {"percentage": 50, "amount": 5000, "status": "completed|current|upcoming", "estimatedDate": "2024-08-01"},
    {"percentage": 75, "amount": 7500, "status": "completed|current|upcoming", "estimatedDate": "2024-10-01"},
    {"percentage": 100, "amount": 10000, "status": "completed|current|upcoming", "estimatedDate": "2024-12-01"}
  ],
  "strategies": [
    {"name": "Strategy name", "description": "How to implement", "potentialImpact": "How much faster you could reach goal"}
  ],
  "motivation": "An encouraging message about the goal"
}`;

    const aiResponse = await callOpenRouter(prompt, 'You are an encouraging but realistic goal coach. Respond only with valid JSON. Keep responses concise.');
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let analysis = null;
    if (jsonMatch) {
      const _aiParsed = parseAIJson(jsonMatch[0]);
        analysis = _aiParsed || {};

      await prisma.financialGoal.update({
        where: { id: goal.id },
        data: {
          aiProgress: Math.round(parseFloat(analysis.aiProgress)),
          aiOnTrack: analysis.aiOnTrack,
          aiProjectedCompletion: analysis.aiProjectedCompletion ? new Date(analysis.aiProjectedCompletion) : null,
          aiRecommendations: analysis.recommendations,
          aiMilestones: analysis.milestones
        }
      });
    }

    // Log the analysis
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'goal_tracker',
        userId: req.user.id,
        inputData: { goal },
        outputData: { analysis },
        modelUsed: process.env.OPENROUTER_MODEL || 'openrouter',
        confidence: analysis?.analysis?.feasibilityScore || 0
      }
    });

    res.json({ goal, analysis, poweredBy: 'OpenRouter AI' });
  } catch (error) {
    console.error('Goal analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze goal: ' + error.message });
  }
});

// AI Analyze all goals (portfolio view)
router.post('/analyze-all', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const goals = await prisma.financialGoal.findMany({
      where: { userId: req.user.id, status: 'active' },
      orderBy: { priority: 'asc' }
    });

    if (goals.length === 0) {
      return res.status(400).json({ error: 'No active goals to analyze' });
    }

    const goalsSummary = goals.map(g => ({
      name: g.name,
      category: g.category,
      target: g.targetAmount,
      current: g.currentAmount,
      progress: (g.currentAmount / g.targetAmount * 100).toFixed(1),
      deadline: g.deadline,
      priority: g.priority,
      monthlyContribution: g.monthlyContribution
    }));

    const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalCurrent = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const totalMonthly = goals.reduce((sum, g) => sum + (g.monthlyContribution || 0), 0);

    const prompt = `Analyze this portfolio of financial goals:

GOALS PORTFOLIO:
${JSON.stringify(goalsSummary, null, 2)}

TOTALS:
- Total Target: $${totalTarget.toLocaleString()}
- Total Saved: $${totalCurrent.toLocaleString()}
- Overall Progress: ${(totalCurrent / totalTarget * 100).toFixed(1)}%
- Total Monthly Contributions: $${totalMonthly.toLocaleString()}

Provide portfolio analysis in this COMPACT JSON format (keep descriptions short, max 2-3 sentences each, max 3 items per array):
{
  "overallScore": 75,
  "overallProgress": ${(totalCurrent / totalTarget * 100).toFixed(1)},
  "analysis": {
    "summary": "Brief overall assessment",
    "prioritization": "Brief priority assessment",
    "feasibility": "Brief feasibility note"
  },
  "recommendations": [
    {"title": "Short title", "description": "Brief advice"}
  ],
  "optimizations": [
    {"goal": "Goal name", "suggestion": "Brief suggestion", "impact": "Brief impact"}
  ],
  "actionPlan": [
    {"month": "This Month", "actions": ["Action 1", "Action 2"]}
  ]
}`;

    const aiResponse = await callOpenRouter(prompt, 'You are a financial goals strategist. Respond only with valid JSON. Keep responses concise.');
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);

    let analysis = null;
    if (jsonMatch) {
      const _aiParsed = parseAIJson(jsonMatch[0]);
        analysis = _aiParsed || {};
    }

    // Log the analysis
    await prisma.aIAnalysisLog.create({
      data: {
        module: 'goal_tracker_portfolio',
        userId: req.user.id,
        inputData: { goals: goalsSummary },
        outputData: { analysis },
        modelUsed: process.env.OPENROUTER_MODEL || 'openrouter',
        confidence: analysis?.overallScore || 0
      }
    });

    res.json({
      goals: goalsSummary,
      totals: { totalTarget, totalCurrent, totalMonthly },
      analysis,
      poweredBy: 'OpenRouter AI'
    });
  } catch (error) {
    console.error('Goals portfolio analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze goals: ' + error.message });
  }
});

module.exports = router;
