const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { authenticateToken, signSession } = require('../middleware/auth');
const { authRateLimiter } = require('../middleware/rateLimiter');

// Register
router.post('/register', authRateLimiter, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { email, password, firstName, lastName, phone } = req.body;

    if (!email || !password || password.length < 12 || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, name, and a password of at least 12 characters are required' });
    }
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), password: hashedPassword, firstName, lastName, phone }
    });

    const token = signSession({ id: user.id, email: user.email, role: user.role });

    res.json({
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', authRateLimiter, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { email, password, totpCode } = req.body;

    const user = await prisma.user.findUnique({ where: { email: String(email || '').toLowerCase() } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totpCode) {
        return res.status(200).json({ requires2FA: true, message: 'Please provide your 2FA code' });
      }
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: totpCode
      });
      if (!verified) {
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }
    }

    const token = signSession({ id: user.id, email: user.email, role: user.role });

    res.json({
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, twoFactorEnabled: user.twoFactorEnabled },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  // Client-side token removal is the primary mechanism.
  // This endpoint confirms logout for audit/logging purposes.
  res.json({ success: true, message: 'Logged out successfully' });
});

// Forgot Password - generates reset token
router.post('/forgot-password', authRateLimiter, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether email exists
      return res.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: resetTokenHash, resetTokenExpiry }
    });

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
      // Include token in dev mode for testing
      ...(process.env.NODE_ENV !== 'production' && { resetToken })
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Reset Password - validates token and resets password
router.post('/reset-password', authRateLimiter, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 12) {
      return res.status(400).json({ error: 'Password must be at least 12 characters' });
    }

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetToken: resetTokenHash,
        resetTokenExpiry: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// 2FA Setup - generate secret and QR code
router.post('/2fa/setup', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    const secret = speakeasy.generateSecret({
      name: `AI Finance (${req.user.email})`,
      issuer: 'AI Finance Platform'
    });

    // Save secret temporarily (not enabled until verified)
    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorSecret: secret.base32 }
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      otpauthUrl: secret.otpauth_url
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

// 2FA Verify - verify code and enable 2FA
router.post('/2fa/verify', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { code } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.twoFactorSecret) {
      return res.status(400).json({ error: '2FA setup required first' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorEnabled: true }
    });

    res.json({ success: true, message: '2FA enabled successfully' });
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

// 2FA Verify-Setup alias (for clients using /2fa/verify-setup endpoint name)
router.post('/2fa/verify-setup', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { code } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user?.twoFactorSecret) {
      return res.status(400).json({ error: '2FA setup required first' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorEnabled: true }
    });

    res.json({ success: true, message: '2FA enabled successfully' });
  } catch (error) {
    console.error('2FA verify-setup error:', error);
    res.status(500).json({ error: 'Failed to verify 2FA setup' });
  }
});

// 2FA Validate — standalone endpoint to verify TOTP code during login (step-2 flow)
// Client sends email + TOTP code after password has already been verified (requires2FA=true response)
router.post('/2fa/validate', async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { email, totpCode } = req.body;

    if (!email || !totpCode) {
      return res.status(400).json({ error: 'email and totpCode are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'Invalid request or 2FA not enabled' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: totpCode
    });

    if (!verified) {
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    // Issue JWT token after successful 2FA validation
    const token = signSession({ id: user.id, email: user.email, role: user.role });

    res.json({
      success: true,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, twoFactorEnabled: user.twoFactorEnabled },
      token
    });
  } catch (error) {
    console.error('2FA validate error:', error);
    res.status(500).json({ error: 'Failed to validate 2FA code' });
  }
});

// 2FA Disable
router.post('/2fa/disable', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { password } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null }
    });

    res.json({ success: true, message: '2FA disabled successfully' });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, phone: true, twoFactorEnabled: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { firstName, lastName, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { firstName, lastName, phone },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, phone: true }
    });

    res.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 12) {
      return res.status(400).json({ error: 'Current password and a new password of at least 12 characters are required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Delete account
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    await prisma.user.delete({
      where: { id: req.user.id }
    });

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Export user data
router.get('/export-data', authenticateToken, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');

    const userData = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        portfolios: { include: { holdings: true } },
        riskProfile: true,
        creditProfile: { include: { creditHistories: true } },
        transactions: true,
        fraudAlerts: true,
        notifications: true
      }
    });

    // Remove sensitive data
    delete userData.password;
    delete userData.twoFactorSecret;

    res.json({
      exportDate: new Date().toISOString(),
      data: userData
    });
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;
