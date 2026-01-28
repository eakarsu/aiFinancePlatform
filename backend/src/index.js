require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const authRoutes = require('./routes/auth');
const roboAdvisorRoutes = require('./routes/roboAdvisor');
const creditScoringRoutes = require('./routes/creditScoring');
const fraudDetectionRoutes = require('./routes/fraudDetection');
const alertsRoutes = require('./routes/alerts');
const transactionImportRoutes = require('./routes/transactionImport');
const riskAssessmentRoutes = require('./routes/riskAssessment');

const app = express();

// Create PostgreSQL connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Middleware
app.use(cors());
app.use(express.json());

// Make prisma available to routes
app.set('prisma', prisma);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/robo-advisor', roboAdvisorRoutes);
app.use('/api/credit-scoring', creditScoringRoutes);
app.use('/api/fraud-detection', fraudDetectionRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/transaction-import', transactionImportRoutes);
app.use('/api/risk-assessment', riskAssessmentRoutes);

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
      'risk-assessment'
    ],
    version: '2.0.0'
  });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`AI Finance Platform running on port ${PORT}`);
  console.log('Modules: Robo-Advisor, Credit Scoring, Fraud Detection');
});
