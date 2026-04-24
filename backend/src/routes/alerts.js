const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const alertsEngine = require('../utils/alertsEngine');
const { paginatedQuery, handleExport } = require('../utils/queryHelpers');

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
      max_tokens: 2000,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Get all notifications for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { category, unreadOnly, search } = req.query;

    const baseWhere = { userId: req.user.id };
    if (category) baseWhere.category = category;
    if (unreadOnly === 'true') {
      baseWhere.isRead = false;
      baseWhere.isDismissed = false;
    }

    const result = await paginatedQuery(prisma, 'notification', {
      baseWhere,
      search,
      searchFields: ['title', 'message', 'type', 'category'],
      query: req.query
    });

    // Format for display
    const formatted = result.data.map(n => alertsEngine.formatAlertForDisplay(n));

    res.json({
      notifications: formatted,
      total: result.total,
      offset: result.offset,
      limit: result.limit,
      counts: alertsEngine.getUnreadAlertCounts(result.data)
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Export notifications
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    await handleExport(res, prisma, 'notification', req.user.id, req.query, 'Notifications', ['type', 'category', 'severity', 'title', 'message', 'isRead', 'createdAt']);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Get unread count
router.get('/count', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.id,
        isRead: false,
        isDismissed: false
      }
    });

    res.json(alertsEngine.getUnreadAlertCounts(notifications));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get notification count' });
  }
});

// Get notifications grouped by category
router.get('/grouped', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.id,
        isDismissed: false
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const grouped = alertsEngine.groupAlertsByCategory(notifications);
    const counts = alertsEngine.getUnreadAlertCounts(notifications);

    res.json({ grouped, counts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get grouped notifications' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    const notification = await prisma.notification.updateMany({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    if (notification.count === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Mark all notifications as read
router.patch('/read-all', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { category } = req.body;

    const where = { userId: req.user.id, isRead: false };
    if (category) where.category = category;

    const result = await prisma.notification.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({ success: true, count: result.count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// Dismiss notification
router.patch('/:id/dismiss', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    const notification = await prisma.notification.updateMany({
      where: {
        id: req.params.id,
        userId: req.user.id
      },
      data: {
        isDismissed: true,
        dismissedAt: new Date()
      }
    });

    if (notification.count === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to dismiss notification' });
  }
});

// Dismiss all notifications
router.patch('/dismiss-all', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { category, severity } = req.body;

    const where = { userId: req.user.id, isDismissed: false };
    if (category) where.category = category;
    if (severity) where.severity = severity;

    const result = await prisma.notification.updateMany({
      where,
      data: {
        isDismissed: true,
        dismissedAt: new Date()
      }
    });

    res.json({ success: true, count: result.count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to dismiss all' });
  }
});

// Get notification preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { notificationPreferences: true }
    });

    // Return user's saved preferences or defaults
    const preferences = user?.notificationPreferences || alertsEngine.DEFAULT_PREFERENCES;
    res.json(preferences);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// Update notification preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const preferences = req.body;

    // Save preferences to user record
    await prisma.user.update({
      where: { id: req.user.id },
      data: { notificationPreferences: preferences }
    });

    res.json({ success: true, preferences });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// Create test notification (for development)
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { type = 'FRAUD_HIGH_RISK', message } = req.body;

    const alert = alertsEngine.createAlert(type, req.user.id, {
      message: message || 'This is a test notification'
    });

    const notification = await prisma.notification.create({
      data: {
        userId: req.user.id,
        type: alert.type,
        category: alert.category,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        details: alert.details,
        isPositive: alert.isPositive,
        actionRequired: alert.actionRequired
      }
    });

    res.json(notification);
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: 'Failed to create test notification' });
  }
});

// Get alert statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [total, unread, bySeverity, byCategory, recent] = await Promise.all([
      prisma.notification.count({
        where: { userId: req.user.id }
      }),
      prisma.notification.count({
        where: { userId: req.user.id, isRead: false, isDismissed: false }
      }),
      prisma.notification.groupBy({
        by: ['severity'],
        where: { userId: req.user.id, createdAt: { gte: startDate } },
        _count: true
      }),
      prisma.notification.groupBy({
        by: ['category'],
        where: { userId: req.user.id, createdAt: { gte: startDate } },
        _count: true
      }),
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    res.json({
      total,
      unread,
      bySeverity: bySeverity.reduce((acc, item) => {
        acc[item.severity] = item._count;
        return acc;
      }, {}),
      byCategory: byCategory.reduce((acc, item) => {
        acc[item.category] = item._count;
        return acc;
      }, {}),
      recent: recent.map(n => alertsEngine.formatAlertForDisplay(n))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// AI-powered alert analysis and summary
router.post('/ai-summary', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(400).json({ error: 'AI analysis requires OPENROUTER_API_KEY' });
    }

    // Get all recent notifications
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    if (notifications.length === 0) {
      return res.status(400).json({ error: 'No alerts to analyze.' });
    }

    // Summarize for AI
    const severityCounts = {};
    const categoryCounts = {};
    notifications.forEach(n => {
      severityCounts[n.severity] = (severityCounts[n.severity] || 0) + 1;
      categoryCounts[n.category] = (categoryCounts[n.category] || 0) + 1;
    });

    const unread = notifications.filter(n => !n.isRead && !n.isDismissed).length;
    const alertSamples = notifications.slice(0, 20).map(n => ({
      type: n.type, category: n.category, severity: n.severity,
      title: n.title, message: n.message, isRead: n.isRead,
      date: n.createdAt?.toISOString?.()?.split('T')[0]
    }));

    const prompt = `Analyze these financial platform alerts/notifications and provide an intelligent summary with recommendations.

Alert Statistics:
- Total Alerts: ${notifications.length}
- Unread: ${unread}
- By Severity: ${JSON.stringify(severityCounts)}
- By Category: ${JSON.stringify(categoryCounts)}

Recent Alerts:
${JSON.stringify(alertSamples, null, 2)}

Respond in JSON:
{
  "summary": "2-3 sentence overview of the user's alert landscape",
  "riskLevel": "low|moderate|high|critical",
  "urgentActions": [
    { "action": "what to do", "reason": "why it matters", "priority": "critical|high|medium" }
  ],
  "patterns": [
    { "pattern": "identified pattern", "description": "explanation", "type": "concern|info|positive" }
  ],
  "recommendations": [
    { "title": "recommendation", "description": "detailed advice", "category": "security|financial|general" }
  ],
  "alertPrioritization": {
    "topPriority": "which alert category needs attention first",
    "canDismiss": "which categories are safe to bulk dismiss",
    "suggestion": "overall notification management advice"
  }
}

Provide 2-4 urgent actions, 2-3 patterns, and 3-4 recommendations.`;

    const aiResponse = await callOpenRouter(prompt, 'You are an AI financial security analyst. Analyze notification/alert data to identify risks, patterns, and provide actionable recommendations. Always respond in valid JSON.');
    const analysis = JSON.parse(aiResponse.replace(/```json\n?|```\n?/g, '').trim());

    res.json({
      analysis,
      stats: {
        total: notifications.length,
        unread,
        severityCounts,
        categoryCounts
      }
    });
  } catch (error) {
    console.error('AI alert summary error:', error);
    res.status(500).json({ error: 'Failed to generate AI summary' });
  }
});

module.exports = router;
