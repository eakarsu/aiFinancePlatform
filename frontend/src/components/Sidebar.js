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
  Sparkles,
  RefreshCw,
  Calculator,
  Bell,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  X,
  BarChart3,
  Building2,
  BookOpen,
  ArrowLeftRight,
  Percent,
  UserCheck,
  BadgeCheck,
  Send,
  Zap,
  Globe,
  Scale,
  FileText
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
      { to: '/cash-buffer-stress', label: 'Cash Buffer', Icon: Wallet },
      { to: '/goal-tracker', label: 'Goal Tracker', Icon: Target },
      { to: '/bill-negotiator', label: 'Bill Negotiator', Icon: Receipt },
      { to: '/asset-allocation', label: 'Asset Allocation', Icon: Sparkles },
      { to: '/rebalancing-suggest', label: 'Rebalancing', Icon: RefreshCw },
      { to: '/budget-optimize', label: 'Budget Optimize', Icon: Calculator },
      { to: '/stock-recommend', label: 'AI Stock Picks', Icon: TrendingUp },
      { to: '/insurance-recommend', label: 'AI Insurance', Icon: ShieldCheck },
      { to: '/retirement-project', label: 'AI Retirement', Icon: Clock },
      { to: '/advanced-tools', label: 'Advanced AI Tools', Icon: Sparkles },
    ],
  },
  {
    title: 'Finance Views',
    items: [
      { to: '/custom-views', label: 'Finance Views', Icon: BarChart3 },
    ],
  },
  {
    title: 'Core Banking',
    items: [
      { to: '/bank/accounts', label: 'Accounts', Icon: Building2 },
      { to: '/bank/ledger', label: 'Ledger', Icon: BookOpen },
      { to: '/bank/transactions', label: 'Transactions', Icon: ArrowLeftRight },
      { to: '/bank/interestAccrual', label: 'Interest Accrual', Icon: Percent },
      { to: '/bank/kyc', label: 'KYC', Icon: UserCheck },
      { to: '/bank/cardIssuance', label: 'Card Issuance', Icon: BadgeCheck },
      { to: '/bank/ach', label: 'ACH', Icon: Send },
      { to: '/bank/wire', label: 'Wire Transfers', Icon: Zap },
      { to: '/bank/swift', label: 'SWIFT', Icon: Globe },
      { to: '/bank/reconciliation', label: 'Reconciliation', Icon: Scale },
      { to: '/bank/regulatoryReporting', label: 'Regulatory Reporting', Icon: FileText },
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

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

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
