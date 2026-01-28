const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const alertsEngine = require('../utils/alertsEngine');

// Get all notifications for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { category, unreadOnly, limit = 50 } = req.query;

    const where = { userId: req.user.id };
    if (category) where.category = category;
    if (unreadOnly === 'true') {
      where.isRead = false;
      where.isDismissed = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    // Format for display
    const formatted = notifications.map(n => alertsEngine.formatAlertForDisplay(n));

    res.json({
      notifications: formatted,
      counts: alertsEngine.getUnreadAlertCounts(notifications)
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
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

module.exports = router;
