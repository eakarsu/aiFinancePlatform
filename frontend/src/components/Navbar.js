import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNotificationCount } from '../services/api';

function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    if (user) {
      loadUnreadCount();
      // Refresh count every 30 seconds
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadUnreadCount = async () => {
    try {
      const response = await getNotificationCount();
      setUnreadCount(response.data.total || 0);
    } catch (error) {
      // Silently fail
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">AI Finance Platform</Link>
      </div>

      {user ? (
        <>
          <div className="navbar-menu">
            <Link to="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
              Dashboard
            </Link>
            <Link to="/portfolio-dashboard" className={isActive('/portfolio-dashboard') ? 'active' : ''}>
              Portfolio
            </Link>
            <Link to="/robo-advisor" className={isActive('/robo-advisor') ? 'active' : ''}>
              Advisor
            </Link>
            <Link to="/fraud-detection" className={isActive('/fraud-detection') ? 'active' : ''}>
              Fraud
            </Link>
            <Link to="/credit-scoring" className={isActive('/credit-scoring') ? 'active' : ''}>
              Credit
            </Link>
            <Link to="/risk-assessment" className={isActive('/risk-assessment') ? 'active' : ''}>
              Risk
            </Link>
            <Link to="/import" className={isActive('/import') ? 'active' : ''}>
              Import
            </Link>
          </div>

          <div className="navbar-user">
            <Link to="/alerts" className="alerts-icon">
              🔔
              {unreadCount > 0 && (
                <span className="alert-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </Link>
            <Link to="/settings" className="settings-icon" title="Settings">
              ⚙️
            </Link>
            <span className="user-name">{user.firstName || user.email}</span>
            <button onClick={logout} className="btn-logout">Logout</button>
          </div>
        </>
      ) : (
        <div className="navbar-auth">
          <Link to="/login" className="btn-login">Login</Link>
          <Link to="/register" className="btn-register">Register</Link>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
