import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import RoboAdvisor from './pages/RoboAdvisor';
import CreditScoring from './pages/CreditScoring';
import FraudDetection from './pages/FraudDetection';
import PortfolioDashboard from './pages/PortfolioDashboard';
import RiskAssessment from './pages/RiskAssessment';
import Alerts from './pages/Alerts';
import TransactionImport from './pages/TransactionImport';
import Settings from './pages/Settings';
import StockScreener from './pages/StockScreener';
import CryptoAnalyzer from './pages/CryptoAnalyzer';
import LoanAdvisor from './pages/LoanAdvisor';
import InsuranceOptimizer from './pages/InsuranceOptimizer';
import RetirementPlanner from './pages/RetirementPlanner';
import BudgetCoach from './pages/BudgetCoach';
import GoalTracker from './pages/GoalTracker';
import BillNegotiator from './pages/BillNegotiator';
import './App.css';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return user ? children : <Navigate to="/login" />;
}

function Home() {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />;
}

const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebarCollapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const isAuthPage = AUTH_PATHS.includes(location.pathname);
  const showSidebar = user && !isAuthPage;

  useEffect(() => {
    try {
      localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
    } catch {
      // localStorage not available
    }
  }, [sidebarCollapsed]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const appClassName = [
    'App',
    showSidebar && 'app--with-sidebar',
    showSidebar && sidebarCollapsed && 'app--sidebar-collapsed',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={appClassName}>
      {!isAuthPage && (
        <Navbar onHamburgerClick={showSidebar ? () => setMobileSidebarOpen(true) : undefined} />
      )}
      {showSidebar && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={handleToggleSidebar}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
      )}
      <main className="main-content">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/robo-advisor"
              element={
                <PrivateRoute>
                  <RoboAdvisor />
                </PrivateRoute>
              }
            />
            <Route
              path="/credit-scoring"
              element={
                <PrivateRoute>
                  <CreditScoring />
                </PrivateRoute>
              }
            />
            <Route
              path="/fraud-detection"
              element={
                <PrivateRoute>
                  <FraudDetection />
                </PrivateRoute>
              }
            />
            <Route
              path="/portfolio-dashboard"
              element={
                <PrivateRoute>
                  <PortfolioDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/risk-assessment"
              element={
                <PrivateRoute>
                  <RiskAssessment />
                </PrivateRoute>
              }
            />
            <Route
              path="/alerts"
              element={
                <PrivateRoute>
                  <Alerts />
                </PrivateRoute>
              }
            />
            <Route
              path="/import"
              element={
                <PrivateRoute>
                  <TransactionImport />
                </PrivateRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <Settings />
                </PrivateRoute>
              }
            />
            <Route
              path="/stock-screener"
              element={
                <PrivateRoute>
                  <StockScreener />
                </PrivateRoute>
              }
            />
            <Route
              path="/crypto-analyzer"
              element={
                <PrivateRoute>
                  <CryptoAnalyzer />
                </PrivateRoute>
              }
            />
            <Route
              path="/loan-advisor"
              element={
                <PrivateRoute>
                  <LoanAdvisor />
                </PrivateRoute>
              }
            />
            <Route
              path="/insurance-optimizer"
              element={
                <PrivateRoute>
                  <InsuranceOptimizer />
                </PrivateRoute>
              }
            />
            <Route
              path="/retirement-planner"
              element={
                <PrivateRoute>
                  <RetirementPlanner />
                </PrivateRoute>
              }
            />
            <Route
              path="/budget-coach"
              element={
                <PrivateRoute>
                  <BudgetCoach />
                </PrivateRoute>
              }
            />
            <Route
              path="/goal-tracker"
              element={
                <PrivateRoute>
                  <GoalTracker />
                </PrivateRoute>
              }
            />
            <Route
              path="/bill-negotiator"
              element={
                <PrivateRoute>
                  <BillNegotiator />
                </PrivateRoute>
              }
            />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppLayout />
      </Router>
    </AuthProvider>
  );
}

export default App;
