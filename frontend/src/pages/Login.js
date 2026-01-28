import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin, demoLogin as apiDemoLogin, register as apiRegister } from '../services/api';

// Demo credentials
const DEMO_EMAIL = 'demo@aifinance.com';
const DEMO_PASSWORD = 'demo123456';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await apiLogin(email, password);
      login(response.data.user, response.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError('');
    setMessage('Demo credentials filled. Click Login to continue.');
  };

  const createDemoAccount = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Try to create demo account
      await apiRegister({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        firstName: 'Demo',
        lastName: 'User',
        phone: '+1 555-0100'
      });
      setMessage('Demo account created! Click Login to continue.');
      setEmail(DEMO_EMAIL);
      setPassword(DEMO_PASSWORD);
    } catch (err) {
      // Account might already exist
      if (err.response?.data?.error?.includes('exists')) {
        setMessage('Demo account already exists. Click Login to continue.');
        setEmail(DEMO_EMAIL);
        setPassword(DEMO_PASSWORD);
      } else {
        setError(err.response?.data?.error || 'Failed to create demo account');
      }
    } finally {
      setLoading(false);
    }
  };

  const quickDemoLogin = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Use the special demo-login endpoint that bypasses password check
      const response = await apiDemoLogin();
      login(response.data.user, response.data.token);
      navigate('/dashboard');
    } catch (err) {
      // If demo account doesn't exist, try to create it first
      if (err.response?.status === 401) {
        try {
          await apiRegister({
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
            firstName: 'Demo',
            lastName: 'User',
            phone: '+1 555-0100'
          });
          // Now try demo login again
          const response = await apiDemoLogin();
          login(response.data.user, response.data.token);
          navigate('/dashboard');
        } catch (regErr) {
          setError('Demo login failed. Please try again.');
        }
      } else {
        setError('Demo login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Login</h2>
        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="demo-section">
          <p className="demo-label">Quick Test Options:</p>
          <div className="demo-buttons">
            <button
              type="button"
              onClick={quickDemoLogin}
              disabled={loading}
              className="btn-demo"
            >
              Quick Demo Login
            </button>
            <button
              type="button"
              onClick={fillDemoCredentials}
              disabled={loading}
              className="btn-demo-secondary"
            >
              Fill Demo Credentials
            </button>
          </div>
        </div>

        <p className="auth-link">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
