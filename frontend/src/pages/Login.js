import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin, demoLogin as apiDemoLogin, register as apiRegister, forgotPassword, resetPassword } from '../services/api';
import { Mail, Lock, ArrowRight, Zap, Shield, TrendingUp, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react';

// Demo credentials
const DEMO_EMAIL = 'demo@aifinance.com';
const DEMO_PASSWORD = 'demo123456';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState('email'); // email | token | done

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await apiLogin(email, password, requires2FA ? totpCode : undefined);
      if (response.data.requires2FA) {
        setRequires2FA(true);
        setMessage('Please enter your 2FA code');
        setLoading(false);
        return;
      }
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

  const quickDemoLogin = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await apiDemoLogin();
      login(response.data.user, response.data.token);
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.status === 401) {
        try {
          await apiRegister({
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
            firstName: 'Demo',
            lastName: 'User',
            phone: '+1 555-0100'
          });
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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await forgotPassword(forgotEmail);
      setMessage(response.data.message);
      // In dev mode, the token is returned in the response
      if (response.data.resetToken) {
        setResetToken(response.data.resetToken);
      }
      setResetStep('token');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await resetPassword(resetToken, newPassword);
      setMessage(response.data.message);
      setResetStep('done');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const backToLogin = () => {
    setShowForgotPassword(false);
    setResetStep('email');
    setForgotEmail('');
    setResetToken('');
    setNewPassword('');
    setError('');
    setMessage('');
  };

  return (
    <div className="login-page">
      {/* Left branding panel */}
      <div className="login-brand-panel">
        <div className="login-brand-content">
          <div className="login-brand-logo">AI Finance</div>
          <h1 className="login-brand-headline">
            Smarter finances,<br />powered by AI
          </h1>
          <p className="login-brand-sub">
            Portfolio management, fraud detection, and intelligent insights — all in one platform.
          </p>
          <div className="login-brand-features">
            <div className="login-feature">
              <div className="login-feature-icon">
                <TrendingUp size={20} />
              </div>
              <div>
                <div className="login-feature-title">AI Portfolio Analysis</div>
                <div className="login-feature-desc">Real-time insights and recommendations</div>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">
                <Shield size={20} />
              </div>
              <div>
                <div className="login-feature-title">Fraud Protection</div>
                <div className="login-feature-desc">Advanced anomaly detection</div>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">
                <Zap size={20} />
              </div>
              <div>
                <div className="login-feature-title">Smart Budgeting</div>
                <div className="login-feature-desc">Automated coaching and goal tracking</div>
              </div>
            </div>
          </div>
        </div>
        <div className="login-brand-footer">
          Trusted by thousands of users worldwide
        </div>
      </div>

      {/* Right form panel */}
      <div className="login-form-panel">
        <div className="login-form-wrapper">

          {/* Forgot Password Flow */}
          {showForgotPassword ? (
            <>
              <button type="button" className="login-back-btn" onClick={backToLogin}>
                <ArrowLeft size={16} /> Back to Login
              </button>

              <div className="login-form-header">
                <h2>{resetStep === 'done' ? 'Password Reset' : 'Forgot Password'}</h2>
                <p>
                  {resetStep === 'email' && 'Enter your email to receive a reset link.'}
                  {resetStep === 'token' && 'Enter the reset token and your new password.'}
                  {resetStep === 'done' && 'Your password has been reset successfully!'}
                </p>
              </div>

              {error && <div className="login-alert login-alert--error">{error}</div>}
              {message && <div className="login-alert login-alert--success">{message}</div>}

              {resetStep === 'email' && (
                <form onSubmit={handleForgotPassword} className="login-form">
                  <div className="login-field">
                    <label htmlFor="forgot-email">Email address</label>
                    <div className="login-input-wrap">
                      <Mail size={18} className="login-input-icon" />
                      <input
                        id="forgot-email"
                        type="email"
                        placeholder="you@example.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="login-submit-btn">
                    {loading ? <span className="login-spinner" /> : 'Send Reset Link'}
                  </button>
                </form>
              )}

              {resetStep === 'token' && (
                <form onSubmit={handleResetPassword} className="login-form">
                  <div className="login-field">
                    <label htmlFor="reset-token">Reset Token</label>
                    <div className="login-input-wrap">
                      <Lock size={18} className="login-input-icon" />
                      <input
                        id="reset-token"
                        type="text"
                        placeholder="Paste your reset token"
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="login-field">
                    <label htmlFor="new-password">New Password</label>
                    <div className="login-input-wrap">
                      <Lock size={18} className="login-input-icon" />
                      <input
                        id="new-password"
                        type="password"
                        placeholder="Enter new password (min 6 chars)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="login-submit-btn">
                    {loading ? <span className="login-spinner" /> : 'Reset Password'}
                  </button>
                </form>
              )}

              {resetStep === 'done' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <CheckCircle size={48} color="#4CAF50" />
                  <button type="button" className="login-submit-btn" onClick={backToLogin} style={{ marginTop: '20px' }}>
                    Back to Login
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Standard Login Flow */
            <>
              <div className="login-form-header">
                <h2>Welcome back</h2>
                <p>Sign in to your account to continue</p>
              </div>

              {error && <div className="login-alert login-alert--error">{error}</div>}
              {message && <div className="login-alert login-alert--success">{message}</div>}

              <form onSubmit={handleSubmit} className="login-form">
                <div className="login-field">
                  <label htmlFor="login-email">Email address</label>
                  <div className="login-input-wrap">
                    <Mail size={18} className="login-input-icon" />
                    <input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="login-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label htmlFor="login-password">Password</label>
                    <button
                      type="button"
                      className="login-forgot-link"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="login-input-wrap">
                    <Lock size={18} className="login-input-icon" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="login-eye-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {requires2FA && (
                  <div className="login-field">
                    <label htmlFor="login-totp">2FA Code</label>
                    <div className="login-input-wrap">
                      <Shield size={18} className="login-input-icon" />
                      <input
                        id="login-totp"
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value)}
                        maxLength={6}
                        autoFocus
                      />
                    </div>
                  </div>
                )}

                <button type="submit" disabled={loading} className="login-submit-btn">
                  {loading ? (
                    <span className="login-spinner" />
                  ) : (
                    <>
                      Sign in
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <div className="login-divider">
                <span>or try it out</span>
              </div>

              <div className="login-demo-row">
                <button
                  type="button"
                  onClick={quickDemoLogin}
                  disabled={loading}
                  className="login-demo-btn login-demo-btn--primary"
                >
                  <Zap size={16} />
                  Quick Demo Login
                </button>
                <button
                  type="button"
                  onClick={fillDemoCredentials}
                  disabled={loading}
                  className="login-demo-btn login-demo-btn--secondary"
                >
                  Fill Demo Credentials
                </button>
              </div>

              <p className="login-footer-text">
                Don't have an account? <Link to="/register">Create one</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
