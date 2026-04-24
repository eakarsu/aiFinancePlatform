import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register as apiRegister } from '../services/api';
import { User, Mail, Phone, Lock, ArrowRight } from 'lucide-react';

function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiRegister(formData);
      login(response.data.user, response.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left branding panel (reuse login styling) */}
      <div className="login-brand-panel">
        <div className="login-brand-content">
          <div className="login-brand-logo">AI Finance</div>
          <h1 className="login-brand-headline">
            Start your financial<br />journey today
          </h1>
          <p className="login-brand-sub">
            Join thousands of users leveraging AI-powered tools for smarter financial decisions.
          </p>
        </div>
        <div className="login-brand-footer">
          Free to get started. No credit card required.
        </div>
      </div>

      {/* Right form panel */}
      <div className="login-form-panel">
        <div className="login-form-wrapper">
          <div className="login-form-header">
            <h2>Create your account</h2>
            <p>Get started in just a few seconds</p>
          </div>

          {error && <div className="login-alert login-alert--error">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field-row">
              <div className="login-field">
                <label htmlFor="reg-first">First name</label>
                <div className="login-input-wrap">
                  <User size={18} className="login-input-icon" />
                  <input
                    id="reg-first"
                    type="text"
                    name="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div className="login-field">
                <label htmlFor="reg-last">Last name</label>
                <div className="login-input-wrap">
                  <User size={18} className="login-input-icon" />
                  <input
                    id="reg-last"
                    type="text"
                    name="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="reg-email">Email address</label>
              <div className="login-input-wrap">
                <Mail size={18} className="login-input-icon" />
                <input
                  id="reg-email"
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="reg-phone">Phone <span style={{color: 'var(--text-muted)', fontWeight: 400}}>(optional)</span></label>
              <div className="login-input-wrap">
                <Phone size={18} className="login-input-icon" />
                <input
                  id="reg-phone"
                  type="tel"
                  name="phone"
                  placeholder="+1 555-0100"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="reg-password">Password</label>
              <div className="login-input-wrap">
                <Lock size={18} className="login-input-icon" />
                <input
                  id="reg-password"
                  type="password"
                  name="password"
                  placeholder="Min 6 characters"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="login-submit-btn">
              {loading ? (
                <span className="login-spinner" />
              ) : (
                <>
                  Create account
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="login-footer-text">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
