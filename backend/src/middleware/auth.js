const jwt = require('jsonwebtoken');

const SESSION_OPTIONS = Object.freeze({
  algorithms: ['HS256'], issuer: 'ai-finance-platform', audience: 'ai-finance-browser',
});

function jwtSecret() {
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return secret;
}

function signSession(user) {
  return jwt.sign(user, jwtSecret(), {
    algorithm: 'HS256', issuer: SESSION_OPTIONS.issuer, audience: SESSION_OPTIONS.audience,
    expiresIn: '8h',
  });
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET missing or too short' });
  }

  jwt.verify(token, process.env.JWT_SECRET, SESSION_OPTIONS, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });
  next();
};

module.exports = { authenticateToken, requireAdmin, signSession };
