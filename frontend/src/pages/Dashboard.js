import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNotificationCount, getFraudStats, getPortfolios } from '../services/api';

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    notifications: 0,
    transactions: 0,
    portfolioValue: 0,
    alertsCount: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [notifRes, fraudRes, portfolioRes] = await Promise.all([
        getNotificationCount().catch(() => ({ data: { unread: 0 } })),
        getFraudStats().catch(() => ({ data: { totalTransactions: 0, totalAlerts: 0 } })),
        getPortfolios().catch(() => ({ data: [] }))
      ]);

      const totalValue = portfolioRes.data.reduce((sum, p) => sum + (p.totalValue || 0), 0);

      setStats({
        notifications: notifRes.data.unread || 0,
        transactions: fraudRes.data.totalTransactions || 0,
        portfolioValue: totalValue,
        alertsCount: fraudRes.data.totalAlerts || 0
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const features = [
    {
      title: 'Portfolio Dashboard',
      description: 'View your portfolio performance with interactive charts',
      link: '/portfolio-dashboard',
      icon: '📊',
      color: '#9C27B0'
    },
    {
      title: 'Risk Assessment',
      description: 'Complete questionnaire to determine your investment profile',
      link: '/risk-assessment',
      icon: '📋',
      color: '#673AB7'
    },
    {
      title: 'Robo-Advisor',
      description: 'AI-powered investment recommendations based on your risk profile',
      link: '/robo-advisor',
      icon: '📈',
      color: '#4CAF50'
    },
    {
      title: 'Credit Scoring',
      description: 'Alternative credit scoring using non-traditional data',
      link: '/credit-scoring',
      icon: '💳',
      color: '#2196F3'
    },
    {
      title: 'Fraud Detection',
      description: 'Real-time AI analysis of transactions for fraud prevention',
      link: '/fraud-detection',
      icon: '🛡️',
      color: '#FF5722'
    },
    {
      title: 'Import Transactions',
      description: 'Upload CSV files or connect your bank account',
      link: '/import',
      icon: '📥',
      color: '#00BCD4'
    },
    {
      title: 'Alerts & Notifications',
      description: 'View all alerts and manage notification preferences',
      link: '/alerts',
      icon: '🔔',
      color: '#FF9800'
    },
    {
      title: 'Settings',
      description: 'Manage your profile, security, and preferences',
      link: '/settings',
      icon: '⚙️',
      color: '#607D8B'
    }
  ];

  const quickStats = [
    {
      label: 'Portfolio Value',
      value: `$${stats.portfolioValue.toLocaleString()}`,
      icon: '💰',
      link: '/portfolio-dashboard',
      color: '#4CAF50'
    },
    {
      label: 'Transactions',
      value: stats.transactions,
      icon: '💳',
      link: '/import',
      color: '#2196F3'
    },
    {
      label: 'Unread Alerts',
      value: stats.notifications,
      icon: '🔔',
      link: '/alerts',
      color: '#FF9800'
    },
    {
      label: 'Fraud Alerts',
      value: stats.alertsCount,
      icon: '🛡️',
      link: '/fraud-detection',
      color: '#f44336'
    }
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome back, {user?.firstName || 'User'}!</h1>
        <p>Access AI-powered financial tools to manage your finances smarter.</p>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        {quickStats.map((stat, index) => (
          <div
            key={index}
            className="stat-card clickable"
            onClick={() => navigate(stat.link)}
            style={{ borderTopColor: stat.color }}
          >
            <div className="stat-icon">{stat.icon}</div>
            <div className="stat-content">
              <span className="stat-value">{stat.value}</span>
              <span className="stat-label">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="features-grid">
        {features.map((feature) => (
          <Link to={feature.link} key={feature.title} className="feature-card">
            <div className="feature-icon" style={{ backgroundColor: feature.color }}>
              {feature.icon}
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
            <span className="feature-link">Get Started →</span>
          </Link>
        ))}
      </div>

      <div className="dashboard-info">
        <div className="info-card clickable" onClick={() => navigate('/risk-assessment')}>
          <h3>How It Works</h3>
          <ol>
            <li><strong>Robo-Advisor:</strong> Complete your risk profile and get AI-generated portfolio recommendations</li>
            <li><strong>Credit Scoring:</strong> Input your alternative data (rent, utilities) for AI credit analysis</li>
            <li><strong>Fraud Detection:</strong> Add transactions and let AI analyze for potential fraud</li>
          </ol>
          <span className="card-action">Start with Risk Assessment →</span>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
