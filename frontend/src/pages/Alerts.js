import React, { useState, useEffect } from 'react';
import {
  getNotifications,
  getNotificationCount,
  getGroupedNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  dismissAllNotifications,
  getNotificationStats
} from '../services/api';

const SEVERITY_COLORS = {
  LOW: '#4CAF50',
  MEDIUM: '#FF9800',
  HIGH: '#f44336',
  CRITICAL: '#9C27B0'
};

const CATEGORY_ICONS = {
  fraud: '🛡️',
  credit: '💳',
  portfolio: '📈',
  security: '🔒',
  transaction: '💰',
  general: '📋'
};

function Alerts() {
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({ total: 0 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, category
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);

  useEffect(() => {
    loadNotifications();
    loadStats();
  }, [filter, categoryFilter]);

  const loadNotifications = async () => {
    try {
      const params = {};
      if (filter === 'unread') params.unreadOnly = 'true';
      if (categoryFilter) params.category = categoryFilter;

      const response = await getNotifications(params);
      setNotifications(response.data.notifications);
      setCounts(response.data.counts);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await getNotificationStats(30);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      setCounts(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(categoryFilter);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      loadNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDismiss = async (id) => {
    try {
      await dismissNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to dismiss:', error);
    }
  };

  const handleDismissAll = async () => {
    if (!window.confirm('Are you sure you want to dismiss all notifications?')) return;
    try {
      await dismissAllNotifications({ category: categoryFilter });
      setNotifications([]);
    } catch (error) {
      console.error('Failed to dismiss all:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  const categories = ['fraud', 'credit', 'portfolio', 'security', 'transaction', 'general'];

  if (loading) {
    return <div className="loading">Loading notifications...</div>;
  }

  return (
    <div className="alerts-page">
      <div className="alerts-header">
        <h1>Alerts & Notifications</h1>
        <div className="header-actions">
          {counts.total > 0 && (
            <>
              <button className="btn-secondary" onClick={handleMarkAllRead}>
                Mark All Read
              </button>
              <button className="btn-text" onClick={handleDismissAll}>
                Dismiss All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="alerts-stats">
          <div className="stat-card">
            <span className="stat-value">{stats.unread}</span>
            <span className="stat-label">Unread</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.bySeverity?.CRITICAL || 0}</span>
            <span className="stat-label critical">Critical</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.bySeverity?.HIGH || 0}</span>
            <span className="stat-label high">High</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total (30 days)</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="alerts-filters">
        <div className="filter-group">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread ({counts.total})
          </button>
        </div>

        <div className="category-filters">
          <button
            className={`category-btn ${!categoryFilter ? 'active' : ''}`}
            onClick={() => setCategoryFilter(null)}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`category-btn ${categoryFilter === cat ? 'active' : ''}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {CATEGORY_ICONS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="notifications-list">
        {notifications.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🔔</span>
            <h3>No notifications</h3>
            <p>You're all caught up! We'll notify you when something important happens.</p>
          </div>
        ) : (
          notifications.map(notification => (
            <div
              key={notification.id}
              className={`notification-card ${notification.isRead ? 'read' : 'unread'} ${notification.severity?.toLowerCase()}`}
              onClick={() => {
                setSelectedNotification(notification);
                if (!notification.isRead) handleMarkRead(notification.id);
              }}
            >
              <div
                className="severity-indicator"
                style={{ backgroundColor: SEVERITY_COLORS[notification.severity] }}
              />

              <div className="notification-icon">
                {CATEGORY_ICONS[notification.category] || '📢'}
              </div>

              <div className="notification-content">
                <div className="notification-header">
                  <h4>{notification.title}</h4>
                  <span className={`severity-badge ${notification.severity?.toLowerCase()}`}>
                    {notification.severity}
                  </span>
                </div>
                <p className="notification-message">{notification.message}</p>
                <div className="notification-meta">
                  <span className="category">{notification.category}</span>
                  <span className="time">{formatDate(notification.createdAt)}</span>
                </div>
              </div>

              <div className="notification-actions">
                {notification.actionRequired && (
                  <span className="action-required">Action Required</span>
                )}
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDismiss(notification.id);
                  }}
                  title="Dismiss"
                >
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="modal-overlay" onClick={() => setSelectedNotification(null)}>
          <div className="modal notification-detail" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon" style={{ backgroundColor: SEVERITY_COLORS[selectedNotification.severity] }}>
                {CATEGORY_ICONS[selectedNotification.category]}
              </div>
              <div>
                <h2>{selectedNotification.title}</h2>
                <span className={`severity-badge ${selectedNotification.severity?.toLowerCase()}`}>
                  {selectedNotification.severity}
                </span>
              </div>
              <button className="close-btn" onClick={() => setSelectedNotification(null)}>×</button>
            </div>

            <div className="modal-body">
              <p className="message">{selectedNotification.message}</p>

              {selectedNotification.details && (
                <div className="details-section">
                  <h4>Details</h4>
                  <div className="details-grid">
                    {(() => {
                      // Parse details if it's a string
                      let details = selectedNotification.details;
                      if (typeof details === 'string') {
                        try {
                          details = JSON.parse(details);
                        } catch (e) {
                          return <p>{details}</p>;
                        }
                      }
                      if (typeof details !== 'object' || details === null) {
                        return <p>{String(details)}</p>;
                      }
                      return Object.entries(details).map(([key, value]) => (
                        <div key={key} className="detail-item">
                          <span className="detail-label">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="detail-value">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              <div className="meta-section">
                <p><strong>Category:</strong> {selectedNotification.category}</p>
                <p><strong>Time:</strong> {new Date(selectedNotification.createdAt).toLocaleString()}</p>
                {selectedNotification.actionRequired && (
                  <p className="action-warning">This notification requires your attention.</p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedNotification(null)}>
                Close
              </button>
              <button
                className="btn-delete"
                onClick={() => {
                  handleDismiss(selectedNotification.id);
                  setSelectedNotification(null);
                }}
              >
                🗑️ Delete
              </button>
              {selectedNotification.actionRequired && (
                <button className="btn-primary">
                  Take Action
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Alerts;
