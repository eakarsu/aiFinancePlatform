import React, { useState, useEffect } from 'react';
import { User, Lock, Bell, Shield, Download, Trash2, Monitor, Smartphone, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  updateProfile,
  changePassword,
  deleteAccount,
  exportUserData,
  logout as apiLogout,
  setup2FA,
  verify2FA,
  disable2FA
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

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(user?.twoFactorEnabled || false);
  const [twoFASetup, setTwoFASetup] = useState(null); // { qrCode, secret }
  const [twoFACode, setTwoFACode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisable2FA, setShowDisable2FA] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({ open: false });

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

  const handleDeleteAccount = () => {
    setConfirmDialog({
      open: true,
      title: 'Delete Account',
      message: 'This will permanently delete your account and all associated data. This action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete My Account',
      onConfirm: async () => {
        setConfirmDialog({ open: false });
        try {
          await deleteAccount();
          logout();
          navigate('/');
        } catch (error) {
          console.error('Delete account error:', error);
          setMessage({ type: 'error', text: 'Failed to delete account' });
        }
      },
      onCancel: () => setConfirmDialog({ open: false })
    });
  };

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch (e) {
      // Logout even if API call fails
    }
    logout();
    navigate('/login');
  };

  const handleExportData = async () => {
    try {
      setSaving(true);
      const response = await exportUserData();
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

  // 2FA handlers
  const handleSetup2FA = async () => {
    try {
      setSaving(true);
      const response = await setup2FA();
      setTwoFASetup(response.data);
      setMessage({ type: 'success', text: 'Scan the QR code with your authenticator app' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to setup 2FA' });
    } finally {
      setSaving(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await verify2FA(twoFACode);
      setTwoFAEnabled(true);
      setTwoFASetup(null);
      setTwoFACode('');
      setMessage({ type: 'success', text: '2FA enabled successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Invalid code' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDisable2FA = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await disable2FA(disablePassword);
      setTwoFAEnabled(false);
      setShowDisable2FA(false);
      setDisablePassword('');
      setMessage({ type: 'success', text: '2FA disabled' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to disable 2FA' });
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
    fraud: { label: 'Fraud Detection', icon: <Shield size={18} /> },
    credit: { label: 'Credit Score', icon: <Monitor size={18} /> },
    portfolio: { label: 'Portfolio', icon: <Monitor size={18} /> },
    security: { label: 'Security', icon: <Lock size={18} /> },
    transaction: { label: 'Transactions', icon: <Monitor size={18} /> },
    general: { label: 'General', icon: <Bell size={18} /> }
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
          <User size={16} style={{marginRight:'6px',verticalAlign:'middle'}} /> Profile
        </button>
        <button
          className={`tab ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <Bell size={16} style={{marginRight:'6px',verticalAlign:'middle'}} /> Notifications
        </button>
        <button
          className={`tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <Lock size={16} style={{marginRight:'6px',verticalAlign:'middle'}} /> Security
        </button>
        <button
          className={`tab ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          <Shield size={16} style={{marginRight:'6px',verticalAlign:'middle'}} /> Data & Privacy
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

            {twoFAEnabled ? (
              <div className="two-factor-status">
                <span className="status-badge enabled">
                  <CheckCircle size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Enabled
                </span>
                {showDisable2FA ? (
                  <form onSubmit={handleDisable2FA} style={{ marginTop: '12px' }}>
                    <div className="form-group">
                      <label>Enter your password to disable 2FA</label>
                      <input
                        type="password"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        placeholder="Your account password"
                        required
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="submit" className="btn-danger" disabled={saving}>Disable 2FA</button>
                      <button type="button" className="btn-secondary" onClick={() => setShowDisable2FA(false)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button className="btn-secondary" onClick={() => setShowDisable2FA(true)}>Disable 2FA</button>
                )}
              </div>
            ) : twoFASetup ? (
              <div className="two-factor-setup">
                <p>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
                <div className="qr-code-container">
                  <img src={twoFASetup.qrCode} alt="2FA QR Code" className="qr-code-img" />
                </div>
                <p className="two-factor-secret">
                  Manual entry code: <code>{twoFASetup.secret}</code>
                </p>
                <form onSubmit={handleVerify2FA} style={{ marginTop: '12px' }}>
                  <div className="form-group">
                    <label>Enter the 6-digit code from your app</label>
                    <input
                      type="text"
                      value={twoFACode}
                      onChange={(e) => setTwoFACode(e.target.value)}
                      placeholder="000000"
                      maxLength={6}
                      style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '4px' }}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="submit" className="btn-primary" disabled={saving}>Verify & Enable</button>
                    <button type="button" className="btn-secondary" onClick={() => setTwoFASetup(null)}>Cancel</button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="two-factor-status">
                <span className="status-badge disabled">Not Enabled</span>
                <button className="btn-secondary" onClick={handleSetup2FA} disabled={saving}>
                  <Smartphone size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  {saving ? 'Setting up...' : 'Enable 2FA'}
                </button>
              </div>
            )}
          </div>

          <div className="security-option">
            <h3>Active Sessions</h3>
            <p>Manage devices where you're logged in</p>
            <div className="sessions-list">
              <div className="session-item current">
                <span className="device-icon"><Monitor size={24} /></span>
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
            <button className="btn-danger" onClick={handleLogout}>
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
              {saving ? 'Exporting...' : <><Download size={16} style={{marginRight:'4px',verticalAlign:'middle'}} /> Request Data Export</>}
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
              <Trash2 size={16} style={{marginRight:'4px',verticalAlign:'middle'}} /> Delete My Account
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
      />
    </div>
  );
}

export default Settings;
