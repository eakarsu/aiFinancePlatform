import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNotificationCount, getFraudStats, getPortfolios } from '../services/api';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { TrendingUp, Shield, Wallet, Target, Phone, BarChart3, Bitcoin, Building2, Lock, Palmtree, CreditCard, PieChart, ClipboardList, Download, Bell, Settings as SettingsIcon } from 'lucide-react';

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
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
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      title: 'AI Portfolio Rebalancer',
      description: 'AI-powered investment recommendations and portfolio rebalancing',
      link: '/robo-advisor',
      icon: <TrendingUp size={28} color="white" />,
      color: '#4CAF50'
    },
    {
      title: 'AI Fraud Detector',
      description: 'Real-time AI analysis of transactions for fraud prevention',
      link: '/fraud-detection',
      icon: <Shield size={28} color="white" />,
      color: '#FF5722'
    },
    {
      title: 'AI Budget Coach',
      description: 'Personalized budget coaching and spending insights',
      link: '/budget-coach',
      icon: <Wallet size={28} color="white" />,
      color: '#9C27B0'
    },
    {
      title: 'AI Goal Tracker',
      description: 'Track and achieve financial goals with AI guidance',
      link: '/goal-tracker',
      icon: <Target size={28} color="white" />,
      color: '#673AB7'
    },
    {
      title: 'AI Bill Negotiator',
      description: 'Get AI-powered strategies to lower your bills',
      link: '/bill-negotiator',
      icon: <Phone size={28} color="white" />,
      color: '#795548'
    },
    {
      title: 'AI Stock Screener',
      description: 'Screen stocks with AI-powered analysis and recommendations',
      link: '/stock-screener',
      icon: <BarChart3 size={28} color="white" />,
      color: '#2196F3'
    },
    {
      title: 'AI Crypto Analyzer',
      description: 'Analyze cryptocurrencies with AI-powered insights',
      link: '/crypto-analyzer',
      icon: <Bitcoin size={28} color="white" />,
      color: '#FF9800'
    },
    {
      title: 'AI Loan Advisor',
      description: 'Get AI-powered loan advice and approval assessment',
      link: '/loan-advisor',
      icon: <Building2 size={28} color="white" />,
      color: '#00BCD4'
    },
    {
      title: 'AI Insurance Optimizer',
      description: 'Optimize insurance coverage with AI analysis',
      link: '/insurance-optimizer',
      icon: <Lock size={28} color="white" />,
      color: '#E91E63'
    },
    {
      title: 'AI Retirement Planner',
      description: 'Plan retirement with AI-powered projections',
      link: '/retirement-planner',
      icon: <Palmtree size={28} color="white" />,
      color: '#8BC34A'
    },
    {
      title: 'Credit Scoring',
      description: 'Alternative credit scoring using non-traditional data',
      link: '/credit-scoring',
      icon: <CreditCard size={28} color="white" />,
      color: '#3F51B5'
    },
    {
      title: 'Portfolio Dashboard',
      description: 'View your portfolio performance with interactive charts',
      link: '/portfolio-dashboard',
      icon: <PieChart size={28} color="white" />,
      color: '#009688'
    },
    {
      title: 'Risk Assessment',
      description: 'Complete questionnaire to determine your investment profile',
      link: '/risk-assessment',
      icon: <ClipboardList size={28} color="white" />,
      color: '#CDDC39'
    },
    {
      title: 'Import Transactions',
      description: 'Upload CSV files or connect your bank account',
      link: '/import',
      icon: <Download size={28} color="white" />,
      color: '#607D8B'
    },
    {
      title: 'Alerts & Notifications',
      description: 'View all alerts and manage notification preferences',
      link: '/alerts',
      icon: <Bell size={28} color="white" />,
      color: '#f44336'
    },
    {
      title: 'Settings',
      description: 'Manage your profile, security, and preferences',
      link: '/settings',
      icon: <SettingsIcon size={28} color="white" />,
      color: '#455A64'
    }
  ];

  const quickStats = [
    {
      label: 'Portfolio Value',
      value: `$${stats.portfolioValue.toLocaleString()}`,
      icon: <Wallet size={24} />,
      link: '/portfolio-dashboard',
      color: '#4CAF50'
    },
    {
      label: 'Transactions',
      value: stats.transactions,
      icon: <CreditCard size={24} />,
      link: '/import',
      color: '#2196F3'
    },
    {
      label: 'Unread Alerts',
      value: stats.notifications,
      icon: <Bell size={24} />,
      link: '/alerts',
      color: '#FF9800'
    },
    {
      label: 'Fraud Alerts',
      value: stats.alertsCount,
      icon: <Shield size={24} />,
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
      {loading ? (
        <LoadingSkeleton variant="card" count={4} />
      ) : (
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
      )}

      {loading ? (
        <LoadingSkeleton variant="card" count={8} />
      ) : (
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
      )}

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
