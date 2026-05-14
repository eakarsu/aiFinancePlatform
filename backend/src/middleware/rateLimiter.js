const rateLimit = require('express-rate-limit');

let ipKeyGenerator;
try { ({ ipKeyGenerator } = require('express-rate-limit')); } catch (_) { ipKeyGenerator = null; }

/**
 * AI endpoint rate limiter: 20 requests per hour per user (or IP fallback).
 * Apply to CPU/cost-heavy AI endpoints.
 */
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many AI requests. You are limited to 20 requests per hour. Please try again later.',
    retryAfter: '1 hour',
  },
  keyGenerator: (req, res) => {
    if (req.user) return `user:${req.user.id}`;
    if (ipKeyGenerator) return ipKeyGenerator(req, res);
    return req.ip;
  },
  skip: (req) => {
    return req.user?.role === 'ADMIN';
  },
});

/**
 * Auth endpoint rate limiter: 10 requests per 15 minutes per IP.
 * Apply to /login, /register, /forgot-password to prevent brute-force.
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again later.',
    retryAfter: '15 minutes',
  },
  keyGenerator: (req, res) => (ipKeyGenerator ? ipKeyGenerator(req, res) : req.ip),
});

module.exports = { aiRateLimiter, authRateLimiter };
