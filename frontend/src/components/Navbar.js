import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNotificationCount } from '../services/api';
import {
  Bell,
  Settings,
  Menu,
  LogOut,
} from 'lucide-react';

function Navbar({ onHamburgerClick }) {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadUnreadCount();
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
      <div className="navbar-left">
        {user && onHamburgerClick && (
          <button className="hamburger-btn" onClick={onHamburgerClick}>
            <Menu size={22} />
          </button>
        )}
        <div className="navbar-brand">
          <Link to="/">AI Finance Platform</Link>
        </div>
      </div>

      {user ? (
        <div className="navbar-user">
          <Link to="/alerts" className="alerts-icon">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="alert-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </Link>
          <Link to="/settings" className="settings-icon" title="Settings">
            <Settings size={20} />
          </Link>
          <span className="user-name">{user.firstName || user.email}</span>
          <button onClick={logout} className="btn-logout">
            <LogOut size={16} /> Logout
          </button>
        </div>
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
