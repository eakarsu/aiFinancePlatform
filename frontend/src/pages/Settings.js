import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  updateProfile,
  changePassword,
  deleteAccount,
  exportUserData
} from '../services/api';

function Settings() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [notificationPrefs, setNotificationPrefs] = useState({
    fraud: { enabled: true, channels: ['in_app', 'email'], minSeverity: 'LOW' },
    credit: { enabled: true, channels: ['in_app', 'email'], minSeverity: 'LOW' },
    portfolio: { enabled: true, channels: ['in_app'], minSeverity: 'LOW' },
    security: { enabled: true, channels: ['in_app', 'email', 'sms'], minSeverity: 'LOW' },
    transaction: { enabled: false, channels: ['in_app'], minSeverity: 'MEDIUM' },
    general: { enabled: true, channels: ['in_app'], minSeverity: 'LOW' }
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await getNotificationPreferences();
      setNotificationPrefs(response.data);
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await updateProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone
      });
      // Update the user context with new data
      if (updateUser && response.data.user) {
        updateUser(response.data.user);
      }
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      console.error('Profile update error:', error);
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (passwords.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    setSaving(true);
    try {
      await changePassword(passwords.currentPassword, passwords.newPassword);
      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Password change error:', error);
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to change password' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }
    if (!window.confirm('This will permanently delete all your data. Type "DELETE" to confirm.')) {
      return;
    }
    try {
      await deleteAccount();
      logout();
      navigate('/');
    } catch (error) {
      console.error('Delete account error:', error);
      setMessage({ type: 'error', text: 'Failed to delete account' });
    }
  };

  const handleExportData = async () => {
    try {
      setSaving(true);
      const response = await exportUserData();
      // Download as JSON file
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `my-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Data exported successfully!' });
    } catch (error) {
      console.error('Export data error:', error);
      setMessage({ type: 'error', text: 'Failed to export data' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleNotificationPrefChange = (category, field, value) => {
    setNotificationPrefs(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const handleChannelToggle = (category, channel) => {
    setNotificationPrefs(prev => {
      const currentChannels = prev[category].channels || [];
      const newChannels = currentChannels.includes(channel)
        ? currentChannels.filter(c => c !== channel)
        : [...currentChannels, channel];
      return {
        ...prev,
        [category]: {
          ...prev[category],
          channels: newChannels
        }
      };
    });
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      await updateNotificationPreferences(notificationPrefs);
      setMessage({ type: 'success', text: 'Notification preferences saved!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const categoryLabels = {
    fraud: { label: 'Fraud Detection', icon: '🛡️' },
    credit: { label: 'Credit Score', icon: '💳' },
    portfolio: { label: 'Portfolio', icon: '📈' },
    security: { label: 'Security', icon: '🔒' },
    transaction: { label: 'Transactions', icon: '💰' },
    general: { label: 'General', icon: '📋' }
  };

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      {/* Tabs */}
      <div className="settings-tabs">
        <button
          className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          👤 Profile
        </button>
        <button
          className={`tab ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          🔔 Notifications
        </button>
        <button
          className={`tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          🔐 Security
        </button>
        <button
          className={`tab ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          📊 Data & Privacy
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="settings-section">
          <h2>Profile Information</h2>
          <form onSubmit={handleSaveProfile}>
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={profile.firstName}
                  onChange={handleProfileChange}
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={profile.lastName}
                  onChange={handleProfileChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={profile.email}
                onChange={handleProfileChange}
                disabled
              />
              <span className="hint">Email cannot be changed</span>
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={profile.phone}
                onChange={handleProfileChange}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="settings-section">
          <h2>Notification Preferences</h2>
          <p className="section-desc">
            Choose how and when you want to receive notifications for different alert types.
          </p>

          <div className="notification-settings">
            {Object.entries(notificationPrefs).map(([category, prefs]) => (
              <div key={category} className="notification-category">
                <div className="category-header">
                  <span className="category-icon">{categoryLabels[category]?.icon}</span>
                  <span className="category-name">{categoryLabels[category]?.label}</span>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={prefs.enabled}
                      onChange={(e) => handleNotificationPrefChange(category, 'enabled', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {prefs.enabled && (
                  <div className="category-options">
                    <div className="channels">
                      <span className="option-label">Channels:</span>
                      <label className={`channel-option ${prefs.channels?.includes('in_app') ? 'active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={prefs.channels?.includes('in_app')}
                          onChange={() => handleChannelToggle(category, 'in_app')}
                        />
                        In-App
                      </label>
                      <label className={`channel-option ${prefs.channels?.includes('email') ? 'active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={prefs.channels?.includes('email')}
                          onChange={() => handleChannelToggle(category, 'email')}
                        />
                        Email
                      </label>
                      <label className={`channel-option ${prefs.channels?.includes('sms') ? 'active' : ''}`}>
                        <input
                          type="checkbox"
                          checked={prefs.channels?.includes('sms')}
                          onChange={() => handleChannelToggle(category, 'sms')}
                        />
                        SMS
                      </label>
                    </div>

                    <div className="severity">
                      <span className="option-label">Minimum Severity:</span>
                      <select
                        value={prefs.minSeverity}
                        onChange={(e) => handleNotificationPrefChange(category, 'minSeverity', e.target.value)}
                      >
                        <option value="LOW">All (Low+)</option>
                        <option value="MEDIUM">Medium+</option>
                        <option value="HIGH">High+</option>
                        <option value="CRITICAL">Critical Only</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className="btn-primary" onClick={handleSaveNotifications} disabled={saving}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="settings-section">
          <h2>Security Settings</h2>

          <div className="security-option">
            <h3>Change Password</h3>
            <p>Update your account password</p>
            <form className="password-form" onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  placeholder="Enter current password"
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className="btn-secondary" disabled={saving}>
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>

          <div className="security-option">
            <h3>Two-Factor Authentication</h3>
            <p>Add an extra layer of security to your account</p>
            <div className="two-factor-status">
              <span className="status-badge disabled">Not Enabled</span>
              <button className="btn-secondary">Enable 2FA</button>
            </div>
          </div>

          <div className="security-option">
            <h3>Active Sessions</h3>
            <p>Manage devices where you're logged in</p>
            <div className="sessions-list">
              <div className="session-item current">
                <span className="device-icon">💻</span>
                <div className="session-info">
                  <span className="device-name">Current Device</span>
                  <span className="session-details">Last active: Now</span>
                </div>
                <span className="current-badge">Current</span>
              </div>
            </div>
          </div>

          <div className="security-option danger-zone">
            <h3>Danger Zone</h3>
            <button className="btn-danger" onClick={logout}>
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Data & Privacy Tab */}
      {activeTab === 'data' && (
        <div className="settings-section">
          <h2>Data & Privacy</h2>

          <div className="data-option">
            <h3>Export Your Data</h3>
            <p>Download a copy of all your data stored on our platform</p>
            <button className="btn-secondary" onClick={handleExportData} disabled={saving}>
              {saving ? 'Exporting...' : '📥 Request Data Export'}
            </button>
          </div>

          <div className="data-option">
            <h3>Connected Services</h3>
            <p>Manage third-party integrations and connected accounts</p>
            <div className="connected-services">
              <p className="no-services">No connected services</p>
            </div>
          </div>

          <div className="data-option">
            <h3>Data Retention</h3>
            <p>Your transaction data is retained for 7 years for compliance purposes.</p>
            <p>AI analysis logs are retained for 1 year.</p>
          </div>

          <div className="data-option danger-zone">
            <h3>Delete Account</h3>
            <p>Permanently delete your account and all associated data. This action cannot be undone.</p>
            <button className="btn-danger" onClick={handleDeleteAccount}>
              🗑️ Delete My Account
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
