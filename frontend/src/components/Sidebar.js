import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  PieChart,
  Upload,
  Bot,
  Shield,
  CreditCard,
  ClipboardList,
  TrendingUp,
  Bitcoin,
  Landmark,
  ShieldCheck,
  Clock,
  Wallet,
  Target,
  Receipt,
  Bell,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  X
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
      { to: '/portfolio-dashboard', label: 'Portfolio', Icon: PieChart },
      { to: '/import', label: 'Import Transactions', Icon: Upload },
    ],
  },
  {
    title: 'AI Tools',
    items: [
      { to: '/robo-advisor', label: 'AI Advisor', Icon: Bot },
      { to: '/fraud-detection', label: 'Fraud Detection', Icon: Shield },
      { to: '/credit-scoring', label: 'Credit Scoring', Icon: CreditCard },
      { to: '/risk-assessment', label: 'Risk Assessment', Icon: ClipboardList },
    ],
  },
  {
    title: 'Investments',
    items: [
      { to: '/stock-screener', label: 'Stock Screener', Icon: TrendingUp },
      { to: '/crypto-analyzer', label: 'Crypto Analyzer', Icon: Bitcoin },
    ],
  },
  {
    title: 'Planning',
    items: [
      { to: '/loan-advisor', label: 'Loan Advisor', Icon: Landmark },
      { to: '/insurance-optimizer', label: 'Insurance', Icon: ShieldCheck },
      { to: '/retirement-planner', label: 'Retirement', Icon: Clock },
      { to: '/budget-coach', label: 'Budget Coach', Icon: Wallet },
      { to: '/goal-tracker', label: 'Goal Tracker', Icon: Target },
      { to: '/bill-negotiator', label: 'Bill Negotiator', Icon: Receipt },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/alerts', label: 'Notifications', Icon: Bell },
      { to: '/settings', label: 'Settings', Icon: Settings },
    ],
  },
];

function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const handleLinkClick = () => {
    if (mobileOpen) {
      onMobileClose();
    }
  };

  const sidebarContent = (
    <>
      <div className="sidebar-header">
        {!collapsed && <span className="sidebar-logo">AI Finance</span>}
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => (
          <div className="sidebar-section" key={section.title}>
            {collapsed ? (
              <div className="sidebar-section-divider" />
            ) : (
              <div className="sidebar-section-title">{section.title}</div>
            )}
            {section.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`sidebar-link${isActive(item.to) ? ' sidebar-link--active' : ''}`}
                onClick={handleLinkClick}
              >
                <item.Icon size={20} />
                {!collapsed && <span className="sidebar-link-label">{item.label}</span>}
                {collapsed && <span className="sidebar-tooltip">{item.label}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}>
        {sidebarContent}
      </aside>

      {/* Mobile overlay drawer */}
      {mobileOpen && (
        <div className="sidebar-mobile-overlay" onClick={onMobileClose}>
          <aside
            className="sidebar sidebar--mobile"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sidebar-header">
              <span className="sidebar-logo">AI Finance</span>
              <button className="sidebar-toggle" onClick={onMobileClose}>
                <X size={18} />
              </button>
            </div>
            <nav className="sidebar-nav">
              {NAV_SECTIONS.map((section) => (
                <div className="sidebar-section" key={section.title}>
                  <div className="sidebar-section-title">{section.title}</div>
                  {section.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`sidebar-link${isActive(item.to) ? ' sidebar-link--active' : ''}`}
                      onClick={handleLinkClick}
                    >
                      <item.Icon size={20} />
                      <span className="sidebar-link-label">{item.label}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}

export default Sidebar;
