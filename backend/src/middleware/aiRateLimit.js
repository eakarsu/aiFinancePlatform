const rateLimit = require('express-rate-limit');

let ipKeyGenerator;
try { ({ ipKeyGenerator } = require('express-rate-limit')); } catch (_) { ipKeyGenerator = null; }

/**
 * Rate limiter for AI endpoints: 30 requests per 15 minutes per IP.
 * Applied to all routes mounted under /api/ai/*.
 */
const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many AI requests. You are limited to 30 requests per 15 minutes. Please try again later.',
    retryAfter: '15 minutes',
  },
  keyGenerator: (req, res) => {
    if (req.user?.id) return `user:${req.user.id}`;
    if (ipKeyGenerator) return ipKeyGenerator(req, res);
    return req.ip;
  },
  skip: (req) => {
    return req.user?.role === 'ADMIN';
  },
});

module.exports = { aiRateLimit };
