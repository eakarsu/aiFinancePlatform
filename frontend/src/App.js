import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
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

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Navbar />
          <main className="main-content">
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
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
