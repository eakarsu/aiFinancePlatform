import React, { useState, useEffect } from 'react';
import { Bell, Shield, CreditCard, TrendingUp, Lock, Wallet, ClipboardList, Megaphone, Trash2 } from 'lucide-react';
import {
  getNotifications,
  getNotificationCount,
  getGroupedNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  dismissAllNotifications,
  getNotificationStats,
  getAIAlertSummary,
  exportNotifications,
  downloadExport
} from '../services/api';
import SearchBar from '../components/SearchBar';
import Pagination from '../components/Pagination';
import BulkActions from '../components/BulkActions';
import ExportButton from '../components/ExportButton';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSkeleton from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';
import SortControls from '../components/SortControls';

const SEVERITY_COLORS = {
  LOW: '#4CAF50',
  MEDIUM: '#FF9800',
  HIGH: '#f44336',
  CRITICAL: '#9C27B0'
};

const CATEGORY_ICONS = {
  fraud: <Shield size={20} />,
  credit: <CreditCard size={20} />,
  portfolio: <TrendingUp size={20} />,
  security: <Lock size={20} />,
  transaction: <Wallet size={20} />,
  general: <ClipboardList size={20} />
};

const SORT_COLUMNS = [
  { field: 'createdAt', label: 'Date' },
  { field: 'severity', label: 'Severity' },
  { field: 'category', label: 'Category' }
];

function Alerts() {
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({ total: 0 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, category
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Search, sort, pagination state
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  // Bulk selection & confirm dialog
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    loadNotifications();
    loadStats();
  }, [filter, categoryFilter, search, sortBy, sortOrder, offset, limit]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const params = { search, sortBy, sortOrder, offset, limit };
      if (filter === 'unread') params.unreadOnly = 'true';
      if (categoryFilter) params.category = categoryFilter;

      const response = await getNotifications(params);
      const result = response.data;
      setNotifications(result.notifications || result.data || result);
      setCounts(result.counts || { total: 0 });
      setTotal(result.total || (result.notifications || result.data || result).length);
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
    setConfirmDialog({
      open: true,
      title: 'Dismiss All Notifications',
      message: 'Are you sure you want to dismiss all notifications?',
      onConfirm: async () => {
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
        try {
          await dismissAllNotifications({ category: categoryFilter });
          setNotifications([]);
        } catch (error) {
          console.error('Failed to dismiss all:', error);
        }
      }
    });
  };

  const handleBulkDismiss = async () => {
    setConfirmDialog({
      open: true,
      title: 'Dismiss Selected Notifications',
      message: `Are you sure you want to dismiss ${selectedIds.length} notification(s)?`,
      onConfirm: async () => {
        setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
        try {
          for (const id of selectedIds) {
            await dismissNotification(id);
          }
          setSelectedIds([]);
          loadNotifications();
        } catch (error) {
          console.error('Bulk dismiss failed:', error);
        }
      }
    });
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

  const handleAISummary = async () => {
    setAiLoading(true);
    try {
      const response = await getAIAlertSummary();
      setAiSummary(response.data);
    } catch (error) {
      console.error('AI summary failed:', error);
      alert('Failed to generate AI summary. Make sure you have alerts and the AI API key is configured.');
    } finally {
      setAiLoading(false);
    }
  };

  const toggleSelectNotification = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === notifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notifications.map(n => n.id));
    }
  };

  const handleSort = (field, order) => {
    setSortBy(field);
    setSortOrder(order);
    setOffset(0);
  };

  const handleSearch = (val) => {
    setSearch(val);
    setOffset(0);
    setSelectedIds([]);
  };

  const handleExport = (format) => {
    downloadExport(exportNotifications, format, 'notifications');
  };

  const categories = ['fraud', 'credit', 'portfolio', 'security', 'transaction', 'general'];

  if (loading && notifications.length === 0) {
    return (
      <div className="alerts-page">
        <div className="alerts-header">
          <h1>Alerts & Notifications</h1>
        </div>
        <LoadingSkeleton variant="card" count={4} />
      </div>
    );
  }

  return (
    <div className="alerts-page">
      <div className="alerts-header">
        <h1>Alerts & Notifications</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={handleAISummary} disabled={aiLoading || notifications.length === 0}>
            {aiLoading ? 'Analyzing...' : 'AI Alert Analysis'}
          </button>
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

      {/* AI Summary */}
      {aiSummary && (
        <div className="portfolio-analysis-card">
          <div className="portfolio-header">
            <h3>AI Alert Analysis</h3>
            <button className="btn-close" onClick={() => setAiSummary(null)}>×</button>
          </div>
          <div className="portfolio-score">
            <div className="score-circle" style={{
              backgroundColor: aiSummary.analysis?.riskLevel === 'critical' ? '#9C27B0' :
                aiSummary.analysis?.riskLevel === 'high' ? '#f44336' :
                aiSummary.analysis?.riskLevel === 'moderate' ? '#FF9800' : '#4CAF50'
            }}>
              <span className="score">{aiSummary.analysis?.riskLevel?.toUpperCase()}</span>
            </div>
            <div className="portfolio-stats">
              <div><label>Total Alerts</label><span>{aiSummary.stats?.total}</span></div>
              <div><label>Unread</label><span>{aiSummary.stats?.unread}</span></div>
            </div>
          </div>
          <div className="portfolio-insights">
            <p>{aiSummary.analysis?.summary}</p>
          </div>

          {aiSummary.analysis?.urgentActions?.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ color: '#1a237e', marginBottom: '0.5rem' }}>Urgent Actions</h4>
              {aiSummary.analysis.urgentActions.map((action, i) => (
                <div key={i} className={`recommendation-item ${action.priority}`}>
                  <h5>{action.action}</h5>
                  <p>{action.reason}</p>
                </div>
              ))}
            </div>
          )}

          {aiSummary.analysis?.patterns?.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ color: '#1a237e', marginBottom: '0.5rem' }}>Patterns Detected</h4>
              {aiSummary.analysis.patterns.map((pattern, i) => (
                <div key={i} className={`insight-item ${pattern.type === 'concern' ? 'over_budget' : pattern.type === 'positive' ? 'on_budget' : ''}`}>
                  <span className="category">{pattern.pattern}</span>
                  <p>{pattern.description}</p>
                </div>
              ))}
            </div>
          )}

          {aiSummary.analysis?.recommendations?.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ color: '#1a237e', marginBottom: '0.5rem' }}>Recommendations</h4>
              {aiSummary.analysis.recommendations.map((rec, i) => (
                <div key={i} className="recommendation-item medium">
                  <h5>{rec.title}</h5>
                  <p>{rec.description}</p>
                </div>
              ))}
            </div>
          )}

          {aiSummary.analysis?.alertPrioritization && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f5f7fa', borderRadius: '8px' }}>
              <h4 style={{ color: '#1a237e', marginBottom: '0.5rem' }}>Prioritization Advice</h4>
              <p style={{ color: '#555', fontSize: '0.9rem', lineHeight: '1.6' }}>{aiSummary.analysis.alertPrioritization.suggestion}</p>
            </div>
          )}

          <p className="powered-by">Powered by OpenRouter AI</p>
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

      {/* Toolbar */}
      <div className="list-toolbar">
        <SearchBar value={search} onChange={handleSearch} placeholder="Search notifications..." />
        <SortControls columns={SORT_COLUMNS} sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
        <ExportButton onExport={handleExport} />
      </div>
      <BulkActions selectedCount={selectedIds.length} onDelete={handleBulkDismiss} onClear={() => setSelectedIds([])} />

      {/* Notifications List */}
      <div className="notifications-list">
        {loading ? (
          <LoadingSkeleton variant="card" count={4} />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={<Bell size={48} />}
            title="No notifications"
            description="You're all caught up!"
          />
        ) : (
          <>
            <div className="select-all-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedIds.length === notifications.length && notifications.length > 0}
                  onChange={toggleSelectAll}
                />
                Select All
              </label>
            </div>
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`notification-card ${notification.isRead ? 'read' : 'unread'} ${notification.severity?.toLowerCase()}`}
                onClick={() => {
                  setSelectedNotification(notification);
                  if (!notification.isRead) handleMarkRead(notification.id);
                }}
              >
                <div className="notification-checkbox" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(notification.id)}
                    onChange={() => toggleSelectNotification(notification.id)}
                  />
                </div>
                <div
                  className="severity-indicator"
                  style={{ backgroundColor: SEVERITY_COLORS[notification.severity] }}
                />

                <div className="notification-icon">
                  {CATEGORY_ICONS[notification.category] || <Megaphone size={20} />}
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
            ))}
            <Pagination total={total} offset={offset} limit={limit} onPageChange={setOffset} onLimitChange={(val) => { setLimit(val); setOffset(0); }} />
          </>
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
                <Trash2 size={14} style={{marginRight:'4px',verticalAlign:'middle'}} /> Delete
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

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Dismiss"
        variant="warning"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: null })}
      />
    </div>
  );
}

export default Alerts;
