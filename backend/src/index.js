require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const { aiRateLimit } = require('./middleware/aiRateLimit');
const { aiRateLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth');
const roboAdvisorRoutes = require('./routes/roboAdvisor');
const plaidRoutes = require('./routes/plaid');
const holdingsRoutes = require('./routes/holdings');
const portfolioRoutes = require('./routes/portfolio');
const insightsRoutes = require('./routes/insights');
const marketRoutes = require('./routes/market');
const aiRoutes = require('./routes/ai');
const creditScoringRoutes = require('./routes/creditScoring');
const fraudDetectionRoutes = require('./routes/fraudDetection');
const alertsRoutes = require('./routes/alerts');
const transactionImportRoutes = require('./routes/transactionImport');
const riskAssessmentRoutes = require('./routes/riskAssessment');
const stockScreenerRoutes = require('./routes/stockScreener');
const cryptoAnalyzerRoutes = require('./routes/cryptoAnalyzer');
const loanAdvisorRoutes = require('./routes/loanAdvisor');
const insuranceOptimizerRoutes = require('./routes/insuranceOptimizer');
const retirementPlannerRoutes = require('./routes/retirementPlanner');
const budgetCoachRoutes = require('./routes/budgetCoach');
const goalTrackerRoutes = require('./routes/goalTracker');
const billNegotiatorRoutes = require('./routes/billNegotiator');

const app = express();

// Validate JWT_SECRET at boot rather than on first request
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('FATAL: JWT_SECRET environment variable must be set and at least 16 characters.');
  process.exit(1);
}

// Create PostgreSQL connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Security headers
app.use(helmet());

// Env-based CORS allowlist (audit flagged wide-open `app.use(cors())`)
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));

// Make prisma available to routes
app.set('prisma', prisma);

// AI rate limiter — 30 req / 15 min per IP on all /api/ai/* routes
app.use('/api/ai', aiRateLimit);

// AI rate limiter (20 req/hour, user-keyed) on heavy AI endpoints
app.use('/api/robo-advisor/recommend-portfolio', aiRateLimiter);
app.use('/api/robo-advisor/portfolios', aiRateLimiter);
app.use('/api/loan-advisor', aiRateLimiter);
app.use('/api/insurance-optimizer', aiRateLimiter);
app.use('/api/retirement-planner', aiRateLimiter);
app.use('/api/budget-coach', aiRateLimiter);
app.use('/api/goal-tracker', aiRateLimiter);
app.use('/api/bill-negotiator', aiRateLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/plaid', plaidRoutes);
app.use('/api/holdings', holdingsRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/robo-advisor', roboAdvisorRoutes);
app.use('/api/credit-scoring', creditScoringRoutes);
app.use('/api/fraud-detection', fraudDetectionRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/transaction-import', transactionImportRoutes);
app.use('/api/risk-assessment', riskAssessmentRoutes);
app.use('/api/stock-screener', stockScreenerRoutes);
app.use('/api/crypto-analyzer', cryptoAnalyzerRoutes);
app.use('/api/loan-advisor', loanAdvisorRoutes);
app.use('/api/insurance-optimizer', insuranceOptimizerRoutes);
app.use('/api/retirement-planner', retirementPlannerRoutes);
app.use('/api/budget-coach', budgetCoachRoutes);
app.use('/api/goal-tracker', goalTrackerRoutes);
app.use('/api/bill-negotiator', billNegotiatorRoutes);
app.use('/api/agentic-advisor', require('./routes/agenticAdvisor'));
app.use('/api/realtime-monitoring', require('./routes/realtimeMonitoring'));
app.use('/api/defi-portfolio', require('./routes/defiPortfolio'));
app.use('/api/esg-screening', require('./routes/esgScreening'));
app.use('/api/behavioral-coaching', require('./routes/behavioralCoaching'));
app.use('/api/fractional-shares', require('./routes/fractionalShares'));
app.use('/api/espp-rsu', require('./routes/esppRsuOptim'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    modules: [
      'robo-advisor',
      'credit-scoring',
      'fraud-detection',
      'alerts',
      'transaction-import',
      'risk-assessment',
      'stock-screener',
      'crypto-analyzer',
      'loan-advisor',
      'insurance-optimizer',
      'retirement-planner',
      'budget-coach',
      'goal-tracker',
      'bill-negotiator',
      'plaid-bank-sync',
      'market-data',
      'ai-tax-loss-harvest'
    ],
    version: '3.2.0'
  });
});

const PORT = process.env.PORT || 3002;

// === Batch 03 Gaps & Frontend Mounts ===
try {
  const _batch03 = require('../routes/batch03Gaps');
  if (typeof authenticateToken === 'function') app.use('/api', authenticateToken, _batch03);
  else app.use('/api', _batch03);
} catch (_e) { /* batch03 gap routes optional */ }

app.listen(PORT, () => {
  console.log(`AI Finance Platform running on port ${PORT}`);
  console.log('Modules: Robo-Advisor, Credit Scoring, Fraud Detection');
});
