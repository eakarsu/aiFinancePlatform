/**
 * Database Seed Script
 * Seeds at least 15 items for every feature in the AI Finance Platform
 */

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Helper function to generate random date within range
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Helper function to get random item from array
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper function to generate random number in range
function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to generate random float in range
function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await prisma.fraudAlert.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.creditHistory.deleteMany();
  await prisma.creditProfile.deleteMany();
  await prisma.investment.deleteMany();
  await prisma.holding.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.riskQuestionnaire.deleteMany();
  await prisma.transactionImport.deleteMany();
  await prisma.plaidConnection.deleteMany();
  await prisma.riskProfile.deleteMany();
  await prisma.aIAnalysisLog.deleteMany();
  await prisma.user.deleteMany();

  // ============== SEED USERS (15+) ==============
  console.log('\n👤 Seeding users...');

  const userNames = [
    { first: 'Demo', last: 'User', email: 'demo@aifinance.com' },
    { first: 'John', last: 'Smith', email: 'john.smith@email.com' },
    { first: 'Sarah', last: 'Johnson', email: 'sarah.j@email.com' },
    { first: 'Michael', last: 'Williams', email: 'mwilliams@email.com' },
    { first: 'Emily', last: 'Brown', email: 'emily.b@email.com' },
    { first: 'David', last: 'Miller', email: 'dmiller@email.com' },
    { first: 'Jessica', last: 'Davis', email: 'jdavis@email.com' },
    { first: 'Christopher', last: 'Garcia', email: 'cgarcia@email.com' },
    { first: 'Amanda', last: 'Martinez', email: 'amartinez@email.com' },
    { first: 'Matthew', last: 'Anderson', email: 'manderson@email.com' },
    { first: 'Ashley', last: 'Taylor', email: 'ataylor@email.com' },
    { first: 'James', last: 'Thomas', email: 'jthomas@email.com' },
    { first: 'Jennifer', last: 'Jackson', email: 'jjackson@email.com' },
    { first: 'Robert', last: 'White', email: 'rwhite@email.com' },
    { first: 'Nicole', last: 'Harris', email: 'nharris@email.com' },
    { first: 'Daniel', last: 'Clark', email: 'dclark@email.com' },
  ];

  const hashedPassword = await bcrypt.hash('demo123456', 10);

  const users = await Promise.all(
    userNames.map((user, index) =>
      prisma.user.create({
        data: {
          email: user.email,
          password: hashedPassword,
          firstName: user.first,
          lastName: user.last,
          phone: `+1 555-01${String(index).padStart(2, '0')}`,
          role: index === 0 ? 'ADMIN' : index < 3 ? 'ANALYST' : 'USER',
        },
      })
    )
  );
  console.log(`   ✓ Created ${users.length} users`);

  // ============== SEED RISK PROFILES (15+) ==============
  console.log('\n📊 Seeding risk profiles...');

  const riskLevels = ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'];
  const goals = ['retirement', 'growth', 'income', 'preservation'];

  const riskProfiles = await Promise.all(
    users.map((user, index) =>
      prisma.riskProfile.create({
        data: {
          userId: user.id,
          riskTolerance: riskLevels[index % 3],
          investmentGoal: goals[index % 4],
          timeHorizon: randomNumber(5, 30),
          monthlyIncome: randomFloat(3000, 15000),
          monthlyExpenses: randomFloat(2000, 8000),
          emergencyFund: randomFloat(5000, 50000),
        },
      })
    )
  );
  console.log(`   ✓ Created ${riskProfiles.length} risk profiles`);

  // ============== SEED RISK QUESTIONNAIRES (15+) ==============
  console.log('\n📝 Seeding risk questionnaires...');

  const riskQuestionnaires = await Promise.all(
    users.map((user, index) =>
      prisma.riskQuestionnaire.create({
        data: {
          userId: user.id,
          age: randomNumber(25, 65),
          dependents: randomNumber(0, 4),
          annualIncome: randomFloat(40000, 200000),
          netWorth: randomFloat(50000, 1000000),
          liquidAssets: randomFloat(10000, 200000),
          monthlyExpenses: randomFloat(2000, 8000),
          debtLevel: randomItem(['none', 'low', 'moderate', 'high']),
          hasEmergencyFund: Math.random() > 0.3,
          emergencyFundMonths: randomNumber(0, 12),
          riskAttitude: randomNumber(1, 10),
          lossTolerance: randomItem(['none', 'small', 'moderate', 'large']),
          investmentExperience: randomItem(['none', 'beginner', 'intermediate', 'advanced']),
          primaryGoal: goals[index % 4],
          timeHorizon: randomNumber(5, 30),
          incomeStability: randomItem(['very_stable', 'stable', 'variable', 'unstable']),
          marketDropReaction: randomItem(['sell_all', 'sell_some', 'hold', 'buy_more']),
          preferredApproach: randomItem(['guaranteed_low', 'moderate_growth', 'high_growth']),
          riskScore: randomNumber(20, 90),
          riskTolerance: riskLevels[index % 3],
        },
      })
    )
  );
  console.log(`   ✓ Created ${riskQuestionnaires.length} risk questionnaires`);

  // ============== SEED PORTFOLIOS (20+) ==============
  console.log('\n💼 Seeding portfolios...');

  const portfolioTypes = ['CONSERVATIVE', 'BALANCED', 'GROWTH', 'AGGRESSIVE', 'INCOME'];
  const portfolioNames = [
    'Retirement Fund', 'Growth Portfolio', 'Emergency Savings', 'College Fund',
    'Long-term Wealth', 'Dividend Income', 'Tech Growth', 'Global Diversified',
    'Blue Chip Core', 'Small Cap Growth', 'Bond Ladder', 'Real Estate Focus'
  ];

  const portfolios = [];
  for (let i = 0; i < users.length; i++) {
    const numPortfolios = randomNumber(1, 3);
    for (let j = 0; j < numPortfolios; j++) {
      const portfolio = await prisma.portfolio.create({
        data: {
          userId: users[i].id,
          name: `${portfolioNames[(i + j) % portfolioNames.length]}`,
          type: portfolioTypes[(i + j) % 5],
          totalValue: randomFloat(5000, 500000),
          cashBalance: randomFloat(500, 10000),
          aiScore: randomFloat(70, 98),
          aiRecommendation: randomItem([
            'Portfolio is well-balanced',
            'Consider increasing bond allocation',
            'Rebalancing recommended',
            'Growth stocks overweight'
          ]),
          lastRebalanced: randomDate(new Date('2024-01-01'), new Date()),
        },
      });
      portfolios.push(portfolio);
    }
  }
  console.log(`   ✓ Created ${portfolios.length} portfolios`);

  // ============== SEED HOLDINGS (50+) ==============
  console.log('\n📈 Seeding holdings...');

  const etfs = [
    { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', type: 'ETF' },
    { symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', type: 'ETF' },
    { symbol: 'BND', name: 'Vanguard Total Bond Market ETF', type: 'BOND' },
    { symbol: 'VNQ', name: 'Vanguard Real Estate ETF', type: 'ETF' },
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', type: 'ETF' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: 'ETF' },
    { symbol: 'AAPL', name: 'Apple Inc.', type: 'STOCK' },
    { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'STOCK' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'STOCK' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'STOCK' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'STOCK' },
    { symbol: 'META', name: 'Meta Platforms Inc.', type: 'STOCK' },
    { symbol: 'TSLA', name: 'Tesla Inc.', type: 'STOCK' },
    { symbol: 'BRK.B', name: 'Berkshire Hathaway', type: 'STOCK' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', type: 'STOCK' },
    { symbol: 'V', name: 'Visa Inc.', type: 'STOCK' },
  ];

  const holdings = [];
  for (const portfolio of portfolios) {
    const numHoldings = randomNumber(3, 8);
    const selectedEtfs = [...etfs].sort(() => Math.random() - 0.5).slice(0, numHoldings);

    for (const etf of selectedEtfs) {
      const avgCost = randomFloat(50, 500);
      const holding = await prisma.holding.create({
        data: {
          portfolioId: portfolio.id,
          symbol: etf.symbol,
          name: etf.name,
          assetType: etf.type,
          shares: randomFloat(5, 100),
          avgCost: avgCost,
          currentPrice: avgCost * randomFloat(0.9, 1.2),
        },
      });
      holdings.push(holding);
    }
  }
  console.log(`   ✓ Created ${holdings.length} holdings`);

  // ============== SEED INVESTMENTS (30+) ==============
  console.log('\n💰 Seeding investments...');

  const investmentTypes = ['DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'DIVIDEND', 'REBALANCE'];

  const investments = [];
  for (const portfolio of portfolios) {
    const numInvestments = randomNumber(2, 5);
    for (let i = 0; i < numInvestments; i++) {
      const type = investmentTypes[randomNumber(0, 5)];
      const investment = await prisma.investment.create({
        data: {
          userId: portfolio.userId,
          portfolioId: portfolio.id,
          type: type,
          amount: randomFloat(100, 10000),
          symbol: type === 'BUY' || type === 'SELL' ? randomItem(etfs).symbol : null,
          shares: type === 'BUY' || type === 'SELL' ? randomFloat(1, 50) : null,
          price: type === 'BUY' || type === 'SELL' ? randomFloat(50, 500) : null,
          createdAt: randomDate(new Date('2024-01-01'), new Date()),
        },
      });
      investments.push(investment);
    }
  }
  console.log(`   ✓ Created ${investments.length} investments`);

  // ============== SEED CREDIT PROFILES (15+) ==============
  console.log('\n💳 Seeding credit profiles...');

  const employmentStatuses = ['employed', 'self-employed', 'retired', 'student'];
  const housingStatuses = ['own', 'rent', 'mortgage'];

  const creditProfiles = await Promise.all(
    users.map((user, index) =>
      prisma.creditProfile.create({
        data: {
          userId: user.id,
          annualIncome: randomFloat(30000, 250000),
          employmentStatus: randomItem(employmentStatuses),
          employmentYears: randomFloat(0.5, 30),
          housingStatus: randomItem(housingStatuses),
          monthlyRent: randomFloat(500, 3000),
          rentPaymentHistory: randomNumber(0, 60),
          utilityPaymentHistory: randomNumber(0, 60),
          phonePaymentHistory: randomNumber(0, 60),
          bankAccountAge: randomNumber(6, 240),
          averageBalance: randomFloat(500, 50000),
          overdraftCount: randomNumber(0, 10),
          aiCreditScore: randomNumber(580, 820),
          aiScoreDate: randomDate(new Date('2024-01-01'), new Date()),
          aiConfidence: randomFloat(75, 98),
          aiFactors: {
            positive: ['On-time payment history', 'Low credit utilization', 'Long credit history'],
            negative: index % 3 === 0 ? ['Recent credit inquiries'] : [],
            neutral: []
          },
          traditionalScore: randomNumber(550, 850),
        },
      })
    )
  );
  console.log(`   ✓ Created ${creditProfiles.length} credit profiles`);

  // ============== SEED CREDIT HISTORIES (50+) ==============
  console.log('\n📜 Seeding credit histories...');

  const creditTypes = ['rent', 'utility', 'phone', 'loan', 'credit_card'];
  const providers = [
    'City Apartments', 'Pacific Gas & Electric', 'Verizon Wireless', 'Chase Bank',
    'AT&T', 'Comcast', 'Wells Fargo', 'Bank of America', 'Capital One',
    'State Farm Insurance', 'Netflix', 'Spotify', 'Adobe', 'Microsoft 365'
  ];

  const creditHistories = [];
  for (const profile of creditProfiles) {
    const numHistories = randomNumber(3, 6);
    for (let i = 0; i < numHistories; i++) {
      const onTime = randomNumber(12, 60);
      const late = randomNumber(0, 3);
      const missed = randomNumber(0, 1);

      const history = await prisma.creditHistory.create({
        data: {
          creditProfileId: profile.id,
          type: randomItem(creditTypes),
          provider: randomItem(providers),
          monthlyAmount: randomFloat(50, 2500),
          onTimePayments: onTime,
          latePayments: late,
          missedPayments: missed,
          startDate: randomDate(new Date('2020-01-01'), new Date('2023-01-01')),
          endDate: Math.random() > 0.3 ? null : randomDate(new Date('2024-01-01'), new Date()),
        },
      });
      creditHistories.push(history);
    }
  }
  console.log(`   ✓ Created ${creditHistories.length} credit histories`);

  // ============== SEED TRANSACTIONS (100+) ==============
  console.log('\n💸 Seeding transactions...');

  // Realistic example transactions
  const exampleTransactions = [
    // Daily spending
    { type: 'PURCHASE', amount: 5.75, merchant: 'Starbucks', category: 'Food & Drink', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 12.99, merchant: 'Chipotle', category: 'Food & Drink', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 8.50, merchant: 'Subway', category: 'Food & Drink', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 4.25, merchant: 'Dunkin Donuts', category: 'Food & Drink', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 15.00, merchant: 'Panera Bread', category: 'Food & Drink', location: 'San Francisco, CA' },

    // Groceries
    { type: 'PURCHASE', amount: 156.78, merchant: 'Whole Foods', category: 'Groceries', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 89.50, merchant: 'Trader Joes', category: 'Groceries', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 234.12, merchant: 'Costco', category: 'Groceries', location: 'Daly City, CA' },
    { type: 'PURCHASE', amount: 67.89, merchant: 'Safeway', category: 'Groceries', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 45.23, merchant: 'Target', category: 'Groceries', location: 'San Francisco, CA' },

    // Gas & Transportation
    { type: 'PURCHASE', amount: 65.00, merchant: 'Shell Gas Station', category: 'Gas', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 58.75, merchant: 'Chevron', category: 'Gas', location: 'Oakland, CA' },
    { type: 'PURCHASE', amount: 72.30, merchant: '76 Gas Station', category: 'Gas', location: 'San Jose, CA' },
    { type: 'PURCHASE', amount: 25.50, merchant: 'Uber', category: 'Transportation', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 18.75, merchant: 'Lyft', category: 'Transportation', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 2.50, merchant: 'BART', category: 'Transportation', location: 'San Francisco, CA' },

    // Shopping
    { type: 'PURCHASE', amount: 125.99, merchant: 'Amazon', category: 'Shopping', location: 'Online' },
    { type: 'PURCHASE', amount: 89.99, merchant: 'Apple Store', category: 'Electronics', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 249.00, merchant: 'Best Buy', category: 'Electronics', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 67.50, merchant: 'Target', category: 'Shopping', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 145.00, merchant: 'Nordstrom', category: 'Shopping', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 78.99, merchant: 'Home Depot', category: 'Home Improvement', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 55.00, merchant: 'IKEA', category: 'Home Improvement', location: 'Emeryville, CA' },

    // Subscriptions & Entertainment
    { type: 'PURCHASE', amount: 15.99, merchant: 'Netflix', category: 'Entertainment', location: 'Online' },
    { type: 'PURCHASE', amount: 10.99, merchant: 'Spotify', category: 'Entertainment', location: 'Online' },
    { type: 'PURCHASE', amount: 14.99, merchant: 'HBO Max', category: 'Entertainment', location: 'Online' },
    { type: 'PURCHASE', amount: 6.99, merchant: 'Disney+', category: 'Entertainment', location: 'Online' },
    { type: 'PURCHASE', amount: 9.99, merchant: 'YouTube Premium', category: 'Entertainment', location: 'Online' },
    { type: 'PURCHASE', amount: 14.99, merchant: 'Adobe Creative Cloud', category: 'Software', location: 'Online' },
    { type: 'PURCHASE', amount: 12.99, merchant: 'Microsoft 365', category: 'Software', location: 'Online' },

    // Utilities & Bills
    { type: 'PURCHASE', amount: 150.00, merchant: 'PG&E', category: 'Utilities', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 85.00, merchant: 'Comcast', category: 'Utilities', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 45.00, merchant: 'AT&T', category: 'Utilities', location: 'Online' },
    { type: 'PURCHASE', amount: 120.00, merchant: 'Verizon', category: 'Utilities', location: 'Online' },

    // Healthcare
    { type: 'PURCHASE', amount: 25.00, merchant: 'CVS Pharmacy', category: 'Healthcare', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 45.99, merchant: 'Walgreens', category: 'Healthcare', location: 'San Francisco, CA' },
    { type: 'PURCHASE', amount: 150.00, merchant: 'Kaiser Permanente', category: 'Healthcare', location: 'San Francisco, CA' },

    // Travel
    { type: 'PURCHASE', amount: 450.00, merchant: 'Delta Airlines', category: 'Travel', location: 'SFO Airport' },
    { type: 'PURCHASE', amount: 325.00, merchant: 'United Airlines', category: 'Travel', location: 'SFO Airport' },
    { type: 'PURCHASE', amount: 189.00, merchant: 'Airbnb', category: 'Travel', location: 'Online' },
    { type: 'PURCHASE', amount: 275.00, merchant: 'Marriott Hotel', category: 'Travel', location: 'Los Angeles, CA' },
    { type: 'PURCHASE', amount: 95.00, merchant: 'Hertz Car Rental', category: 'Travel', location: 'LAX Airport' },

    // Transfers & Deposits
    { type: 'DEPOSIT', amount: 3500.00, merchant: 'Direct Deposit - Employer', category: 'Income', location: 'Online' },
    { type: 'DEPOSIT', amount: 500.00, merchant: 'Venmo Transfer', category: 'Transfer', location: 'Online' },
    { type: 'TRANSFER', amount: 1000.00, merchant: 'Bank Transfer - Savings', category: 'Transfer', location: 'Online' },
    { type: 'TRANSFER', amount: 250.00, merchant: 'Zelle Payment', category: 'Transfer', location: 'Online' },
    { type: 'WITHDRAWAL', amount: 200.00, merchant: 'ATM Withdrawal', category: 'Cash', location: 'San Francisco, CA' },
    { type: 'WITHDRAWAL', amount: 100.00, merchant: 'ATM Withdrawal', category: 'Cash', location: 'Oakland, CA' },

    // Refunds
    { type: 'REFUND', amount: 45.99, merchant: 'Amazon Refund', category: 'Shopping', location: 'Online' },
    { type: 'REFUND', amount: 29.99, merchant: 'Target Refund', category: 'Shopping', location: 'San Francisco, CA' },

    // Suspicious/High-value transactions (for fraud detection demo)
    { type: 'PURCHASE', amount: 2500.00, merchant: 'Luxury Watches Inc', category: 'Shopping', location: 'Miami, FL', suspicious: true },
    { type: 'PURCHASE', amount: 1899.00, merchant: 'Electronics Outlet', category: 'Electronics', location: 'New York, NY', suspicious: true },
    { type: 'TRANSFER', amount: 5000.00, merchant: 'Wire Transfer', category: 'Transfer', location: 'Online', suspicious: true },
    { type: 'PURCHASE', amount: 3200.00, merchant: 'Jewelry Store', category: 'Shopping', location: 'Las Vegas, NV', suspicious: true },
    { type: 'WITHDRAWAL', amount: 2000.00, merchant: 'ATM Withdrawal', category: 'Cash', location: 'Chicago, IL', suspicious: true },
  ];

  const reviewStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED'];

  const transactions = [];

  // Create example transactions for all users
  for (const user of users) {
    // Each user gets a mix of transactions
    const userTransactions = [...exampleTransactions].sort(() => Math.random() - 0.5).slice(0, randomNumber(15, 30));

    for (const txn of userTransactions) {
      const isSuspicious = txn.suspicious || false;
      const fraudScore = isSuspicious ? randomFloat(65, 95) : randomFloat(0, 40);
      const isHighRisk = fraudScore > 70;

      const transaction = await prisma.transaction.create({
        data: {
          userId: user.id,
          type: txn.type,
          amount: txn.amount * randomFloat(0.9, 1.1), // Slight variation
          currency: 'USD',
          merchant: txn.merchant,
          category: txn.category,
          location: txn.location,
          ipAddress: `192.168.${randomNumber(1, 255)}.${randomNumber(1, 255)}`,
          deviceId: `device_${user.id.slice(0, 8)}_${randomNumber(1, 5)}`,
          fraudScore: fraudScore,
          fraudFlags: isHighRisk ? ['High amount', 'Unusual location', 'Velocity check'] : null,
          isBlocked: fraudScore > 90,
          reviewStatus: fraudScore > 70 ? 'FLAGGED' : randomItem(reviewStatuses),
          createdAt: randomDate(new Date('2024-06-01'), new Date()),
        },
      });
      transactions.push(transaction);
    }
  }
  console.log(`   ✓ Created ${transactions.length} transactions`);

  // ============== SEED FRAUD ALERTS (20+) ==============
  console.log('\n🚨 Seeding fraud alerts...');

  const alertTypes = ['UNUSUAL_AMOUNT', 'UNUSUAL_LOCATION', 'UNUSUAL_TIME', 'VELOCITY_CHECK', 'DEVICE_MISMATCH', 'PATTERN_ANOMALY'];
  const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  // Get transactions with any fraud score for creating alerts
  const riskTransactions = transactions.filter(t => t.fraudScore > 30);
  const fraudAlerts = [];

  // Detailed alert descriptions based on type
  const alertDescriptions = {
    UNUSUAL_AMOUNT: [
      'Transaction amount significantly exceeds typical spending pattern',
      'Large purchase detected - 3x above average transaction',
      'Unusually high transaction amount flagged for review',
      'Amount exceeds daily spending threshold'
    ],
    UNUSUAL_LOCATION: [
      'Transaction from unfamiliar geographic location',
      'Purchase made far from usual transaction area',
      'Cross-border transaction detected',
      'Location mismatch with user profile'
    ],
    UNUSUAL_TIME: [
      'Transaction occurred outside normal activity hours',
      'Late night purchase flagged',
      'Weekend transaction at unusual hour',
      'Activity detected during atypical time window'
    ],
    VELOCITY_CHECK: [
      'Multiple transactions in rapid succession',
      'High frequency of purchases detected',
      'Card used at multiple locations within short timeframe',
      'Velocity threshold exceeded'
    ],
    DEVICE_MISMATCH: [
      'Transaction from unrecognized device',
      'New device used for high-value purchase',
      'Device fingerprint does not match profile',
      'Browser/device change detected'
    ],
    PATTERN_ANOMALY: [
      'Spending pattern deviates from historical behavior',
      'Category of purchase unusual for this user',
      'Transaction does not match established patterns',
      'AI detected anomalous behavior'
    ]
  };

  // Create at least 20 fraud alerts
  for (const transaction of riskTransactions.slice(0, 30)) {
    const severity = transaction.fraudScore > 80 ? 'CRITICAL' :
                     transaction.fraudScore > 60 ? 'HIGH' :
                     transaction.fraudScore > 40 ? 'MEDIUM' : 'LOW';

    const alertType = randomItem(alertTypes);
    const description = randomItem(alertDescriptions[alertType]);

    const alert = await prisma.fraudAlert.create({
      data: {
        userId: transaction.userId,
        transactionId: transaction.id,
        alertType: alertType,
        severity: severity,
        description: `${description}: ${transaction.merchant} - $${transaction.amount.toFixed(2)}`,
        aiConfidence: randomFloat(60, 99),
        isResolved: Math.random() > 0.6,
        resolvedAt: Math.random() > 0.6 ? randomDate(new Date('2024-06-01'), new Date()) : null,
        resolvedBy: Math.random() > 0.6 ? randomItem(['system_auto', 'admin_review', 'user_confirmed']) : null,
        resolution: Math.random() > 0.6 ? randomItem(['Verified legitimate', 'User confirmed', 'Blocked permanently', 'False positive', 'Under investigation']) : null,
      },
    });
    fraudAlerts.push(alert);
  }
  console.log(`   ✓ Created ${fraudAlerts.length} fraud alerts`);

  // ============== SEED NOTIFICATIONS (40+) ==============
  console.log('\n🔔 Seeding notifications...');

  const notificationTypes = [
    { type: 'FRAUD_HIGH_RISK', category: 'fraud', title: 'High Risk Transaction Detected' },
    { type: 'CREDIT_SCORE_CHANGE', category: 'credit', title: 'Credit Score Update' },
    { type: 'PORTFOLIO_DRIFT', category: 'portfolio', title: 'Portfolio Rebalancing Needed' },
    { type: 'DEPOSIT_RECEIVED', category: 'transaction', title: 'Deposit Confirmed' },
    { type: 'MARKET_ALERT', category: 'portfolio', title: 'Market Movement Alert' },
    { type: 'PAYMENT_DUE', category: 'general', title: 'Payment Reminder' },
    { type: 'SECURITY_ALERT', category: 'security', title: 'Security Notice' },
    { type: 'GOAL_MILESTONE', category: 'portfolio', title: 'Investment Goal Progress' },
  ];

  const notifications = [];

  // First, create comprehensive notifications for demo user (at least 15)
  const demoUser = users.find(u => u.email === 'demo@aifinance.com');
  if (demoUser) {
    // Create at least one notification of each type for demo user
    for (const notifType of notificationTypes) {
      for (const severity of severities) {
        const isPositive = ['DEPOSIT_RECEIVED', 'GOAL_MILESTONE', 'CREDIT_SCORE_CHANGE'].includes(notifType.type);

        const notification = await prisma.notification.create({
          data: {
            userId: demoUser.id,
            type: notifType.type,
            category: notifType.category,
            severity: severity,
            title: notifType.title,
            message: `${severity} alert: ${notifType.title} - This is a ${notifType.category} notification for ${demoUser.firstName}`,
            details: {
              source: 'system',
              timestamp: new Date().toISOString(),
              userId: demoUser.id,
              severity: severity,
              category: notifType.category,
              alertType: notifType.type
            },
            isRead: Math.random() > 0.6,
            isDismissed: false,
            isPositive: isPositive,
            actionRequired: severity === 'HIGH' || severity === 'CRITICAL',
            readAt: Math.random() > 0.6 ? randomDate(new Date('2024-06-01'), new Date()) : null,
            createdAt: randomDate(new Date('2024-01-01'), new Date()),
          },
        });
        notifications.push(notification);
      }
    }
  }

  // Then create notifications for other users
  for (const user of users.filter(u => u.email !== 'demo@aifinance.com')) {
    const numNotifications = randomNumber(2, 5);
    for (let i = 0; i < numNotifications; i++) {
      const notifType = randomItem(notificationTypes);
      const isPositive = ['DEPOSIT_RECEIVED', 'GOAL_MILESTONE', 'CREDIT_SCORE_CHANGE'].includes(notifType.type);

      const notification = await prisma.notification.create({
        data: {
          userId: user.id,
          type: notifType.type,
          category: notifType.category,
          severity: randomItem(severities),
          title: notifType.title,
          message: `This is a ${notifType.category} notification for ${user.firstName}`,
          details: { source: 'system', timestamp: new Date().toISOString(), userId: user.id },
          isRead: Math.random() > 0.5,
          isDismissed: Math.random() > 0.7,
          isPositive: isPositive,
          actionRequired: Math.random() > 0.7,
          readAt: Math.random() > 0.5 ? randomDate(new Date('2024-06-01'), new Date()) : null,
          createdAt: randomDate(new Date('2024-01-01'), new Date()),
        },
      });
      notifications.push(notification);
    }
  }
  console.log(`   ✓ Created ${notifications.length} notifications`);

  // ============== SEED TRANSACTION IMPORTS (15+) ==============
  console.log('\n📥 Seeding transaction imports...');

  const importStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL'];
  const sources = ['csv', 'plaid', 'manual'];

  const transactionImports = [];
  for (const user of users) {
    const numImports = randomNumber(1, 2);
    for (let i = 0; i < numImports; i++) {
      const status = randomItem(importStatuses);
      const totalRecords = randomNumber(10, 500);
      const processedRecords = status === 'COMPLETED' ? totalRecords :
                               status === 'PARTIAL' ? randomNumber(1, totalRecords - 1) :
                               randomNumber(0, totalRecords);

      const importRecord = await prisma.transactionImport.create({
        data: {
          userId: user.id,
          source: randomItem(sources),
          fileName: `transactions_${user.firstName.toLowerCase()}_${randomNumber(1, 999)}.csv`,
          status: status,
          totalRecords: totalRecords,
          processedRecords: processedRecords,
          failedRecords: status === 'FAILED' ? totalRecords : randomNumber(0, 5),
          errorLog: status === 'FAILED' ? JSON.stringify({ error: 'Invalid file format' }) : null,
          summary: status === 'COMPLETED' ? JSON.stringify({
            categories: { Shopping: 40, Groceries: 30, Other: 30 },
            totalAmount: randomFloat(5000, 50000)
          }) : null,
          startedAt: randomDate(new Date('2024-01-01'), new Date()),
          completedAt: status === 'COMPLETED' || status === 'PARTIAL' ? randomDate(new Date('2024-06-01'), new Date()) : null,
        },
      });
      transactionImports.push(importRecord);
    }
  }
  console.log(`   ✓ Created ${transactionImports.length} transaction imports`);

  // ============== SEED PLAID CONNECTIONS (15+) ==============
  console.log('\n🏦 Seeding Plaid connections...');

  const institutions = [
    { id: 'ins_3', name: 'Chase' },
    { id: 'ins_4', name: 'Bank of America' },
    { id: 'ins_5', name: 'Wells Fargo' },
    { id: 'ins_6', name: 'Citibank' },
    { id: 'ins_7', name: 'US Bank' },
    { id: 'ins_8', name: 'Capital One' },
    { id: 'ins_9', name: 'PNC Bank' },
    { id: 'ins_10', name: 'TD Bank' },
  ];

  const plaidConnections = [];
  for (const user of users) {
    if (Math.random() > 0.3) { // 70% of users have Plaid connections
      const institution = randomItem(institutions);
      const connection = await prisma.plaidConnection.create({
        data: {
          userId: user.id,
          accessToken: `access-sandbox-${user.id.slice(0, 8)}-${randomNumber(10000, 99999)}`,
          itemId: `item_${randomNumber(100000, 999999)}`,
          institutionId: institution.id,
          institutionName: institution.name,
          accountIds: JSON.stringify([`account_${randomNumber(1000, 9999)}`, `account_${randomNumber(1000, 9999)}`]),
          consentExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          lastSync: randomDate(new Date('2024-06-01'), new Date()),
          status: randomItem(['active', 'active', 'active', 'expired', 'error']),
        },
      });
      plaidConnections.push(connection);
    }
  }
  console.log(`   ✓ Created ${plaidConnections.length} Plaid connections`);

  // ============== SEED AI ANALYSIS LOGS (30+) ==============
  console.log('\n🤖 Seeding AI analysis logs...');

  const modules = ['robo_advisor', 'credit_score', 'fraud_detection'];
  const models = ['algorithm', 'algorithm+ai', 'claude-3-haiku', 'local-engine'];

  const aiLogs = [];
  for (let i = 0; i < 40; i++) {
    const module = randomItem(modules);
    const log = await prisma.aIAnalysisLog.create({
      data: {
        module: module,
        userId: randomItem(users).id,
        inputData: JSON.stringify({
          requestType: module === 'robo_advisor' ? 'portfolio_recommendation' :
                       module === 'credit_score' ? 'score_calculation' : 'fraud_check',
          amount: randomFloat(100, 10000)
        }),
        outputData: JSON.stringify({
          result: 'success',
          score: randomNumber(60, 95),
          recommendations: ['Recommendation 1', 'Recommendation 2']
        }),
        modelUsed: randomItem(models),
        confidence: randomFloat(70, 99),
        processingTime: randomNumber(50, 2000),
        createdAt: randomDate(new Date('2024-01-01'), new Date()),
      },
    });
    aiLogs.push(log);
  }
  console.log(`   ✓ Created ${aiLogs.length} AI analysis logs`);

  // ============== SUMMARY ==============
  console.log('\n' + '═'.repeat(60));
  console.log('✅ SEED COMPLETE! Summary:');
  console.log('═'.repeat(60));
  console.log(`   👤 Users:                ${users.length}`);
  console.log(`   📊 Risk Profiles:        ${riskProfiles.length}`);
  console.log(`   📝 Risk Questionnaires:  ${riskQuestionnaires.length}`);
  console.log(`   💼 Portfolios:           ${portfolios.length}`);
  console.log(`   📈 Holdings:             ${holdings.length}`);
  console.log(`   💰 Investments:          ${investments.length}`);
  console.log(`   💳 Credit Profiles:      ${creditProfiles.length}`);
  console.log(`   📜 Credit Histories:     ${creditHistories.length}`);
  console.log(`   💸 Transactions:         ${transactions.length}`);
  console.log(`   🚨 Fraud Alerts:         ${fraudAlerts.length}`);
  console.log(`   🔔 Notifications:        ${notifications.length}`);
  console.log(`   📥 Transaction Imports:  ${transactionImports.length}`);
  console.log(`   🏦 Plaid Connections:    ${plaidConnections.length}`);
  console.log(`   🤖 AI Analysis Logs:     ${aiLogs.length}`);
  console.log('═'.repeat(60));
  console.log('\n🎉 Demo credentials: demo@aifinance.com / demo123456\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
