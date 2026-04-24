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
  // Clear new feature tables
  await prisma.stockScreener.deleteMany();
  await prisma.cryptoAnalysis.deleteMany();
  await prisma.loanApplication.deleteMany();
  await prisma.insurancePolicy.deleteMany();
  await prisma.retirementPlan.deleteMany();
  await prisma.budgetPlan.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.financialGoal.deleteMany();
  await prisma.bill.deleteMany();
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

  // Create fully-populated risk questionnaire for demo user first
  const demoRiskQ = await prisma.riskQuestionnaire.create({
    data: {
      userId: users[0].id,
      age: 35,
      dependents: 2,
      annualIncome: 125000,
      netWorth: 450000,
      liquidAssets: 85000,
      monthlyExpenses: 5200,
      debtLevel: 'low',
      hasEmergencyFund: true,
      emergencyFundMonths: 8,
      riskAttitude: 7,
      lossTolerance: 'moderate',
      investmentExperience: 'intermediate',
      primaryGoal: 'growth',
      timeHorizon: 20,
      incomeStability: 'stable',
      marketDropReaction: 'buy_more',
      preferredApproach: 'moderate_growth',
      riskScore: 68,
      riskTolerance: 'MODERATE',
    },
  });

  const riskQuestionnaires = [demoRiskQ];

  // Create questionnaires for other users
  const otherQuestionnaires = await Promise.all(
    users.slice(1).map((user, index) =>
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
          primaryGoal: goals[(index + 1) % 4],
          timeHorizon: randomNumber(5, 30),
          incomeStability: randomItem(['very_stable', 'stable', 'variable', 'unstable']),
          marketDropReaction: randomItem(['sell_all', 'sell_some', 'hold', 'buy_more']),
          preferredApproach: randomItem(['guaranteed_low', 'moderate_growth', 'high_growth']),
          riskScore: randomNumber(20, 90),
          riskTolerance: riskLevels[(index + 1) % 3],
        },
      })
    )
  );
  riskQuestionnaires.push(...otherQuestionnaires);
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

  // Create 25 portfolios for demo user
  const demoUserRef = users[0]; // demo@aifinance.com
  const demoPortfolioNames = [
    'Retirement Fund', 'Growth Portfolio', 'Emergency Savings', 'College Fund',
    'Long-term Wealth', 'Dividend Income', 'Tech Growth', 'Global Diversified',
    'Blue Chip Core', 'Small Cap Growth', 'Bond Ladder', 'Real Estate Focus',
    'ESG Impact Fund', 'Healthcare Sector', 'Energy Transition', 'Value Fund',
    'Momentum Strategy', 'International Growth', 'Emerging Markets', 'High Yield Bond',
    'S&P 500 Index', 'Total Market Fund', 'Balanced Retirement', 'Aggressive Growth',
    'Conservative Income'
  ];
  const demoRecommendations = [
    'Portfolio is well-balanced. Consider maintaining current allocation.',
    'Consider increasing bond allocation for better risk management.',
    'Rebalancing recommended — equity allocation has drifted 5% above target.',
    'Growth stocks overweight by 8%. Consider trimming tech exposure.',
    'Portfolio aligned with retirement timeline. On track for goals.',
    'Dividend yield is strong at 3.2%. Consider reinvesting dividends.',
    'International exposure is low. Consider adding emerging market ETFs.',
    'ESG score is excellent. Portfolio aligns with sustainability goals.',
    'Cash allocation is high — consider deploying into fixed income.',
    'Tax-loss harvesting opportunity identified in 3 positions.'
  ];
  for (let j = 0; j < 25; j++) {
    const portfolio = await prisma.portfolio.create({
      data: {
        userId: demoUserRef.id,
        name: demoPortfolioNames[j],
        type: portfolioTypes[j % 5],
        totalValue: randomFloat(5000, 500000),
        cashBalance: randomFloat(500, 10000),
        aiScore: randomFloat(70, 98),
        aiRecommendation: demoRecommendations[j % demoRecommendations.length],
        lastRebalanced: randomDate(new Date('2024-01-01'), new Date()),
      },
    });
    portfolios.push(portfolio);
  }

  // Create 1-2 portfolios for other users
  for (let i = 1; i < users.length; i++) {
    const numPortfolios = randomNumber(1, 2);
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

  // Create 25+ credit histories for demo user's profile
  const demoCreditProfile = creditProfiles[0]; // demo user's profile
  const demoCreditProviders = [
    'City Apartments LLC', 'Pacific Gas & Electric', 'Verizon Wireless', 'Chase Bank Visa',
    'AT&T Wireless', 'Comcast Xfinity', 'Wells Fargo Auto Loan', 'Bank of America Mastercard',
    'Capital One Rewards', 'State Farm Insurance', 'Netflix Premium', 'Spotify Family',
    'Adobe Creative Cloud', 'Microsoft 365', 'T-Mobile Family Plan', 'Geico Auto Insurance',
    'Home Depot Credit Card', 'Amazon Prime Card', 'Citi Double Cash', 'Discover It Card',
    'PG&E Solar Plan', 'Water Utility District', 'Google Fi Phone', 'Progressive Insurance',
    'Best Buy Store Card', 'Costco Membership', 'SoCalEdison'
  ];
  const demoCreditTypes = ['rent', 'utility', 'phone', 'loan', 'credit_card', 'insurance', 'subscription'];
  for (let i = 0; i < 27; i++) {
    const onTime = randomNumber(18, 72);
    const late = randomNumber(0, 3);
    const missed = randomNumber(0, 1);
    const history = await prisma.creditHistory.create({
      data: {
        creditProfileId: demoCreditProfile.id,
        type: demoCreditTypes[i % demoCreditTypes.length],
        provider: demoCreditProviders[i % demoCreditProviders.length],
        monthlyAmount: randomFloat(15, 2500),
        onTimePayments: onTime,
        latePayments: late,
        missedPayments: missed,
        startDate: randomDate(new Date('2018-01-01'), new Date('2023-01-01')),
        endDate: Math.random() > 0.4 ? null : randomDate(new Date('2024-01-01'), new Date()),
      },
    });
    creditHistories.push(history);
  }

  // Create credit histories for other users
  for (let p = 1; p < creditProfiles.length; p++) {
    const numHistories = randomNumber(3, 6);
    for (let i = 0; i < numHistories; i++) {
      const onTime = randomNumber(12, 60);
      const late = randomNumber(0, 3);
      const missed = randomNumber(0, 1);

      const history = await prisma.creditHistory.create({
        data: {
          creditProfileId: creditProfiles[p].id,
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

  // ============== SEED STOCK SCREENER (15+) ==============
  console.log('\n📊 Seeding stock screener...');
  const stocksData = [
    { symbol: 'AAPL', companyName: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics', marketCap: 2800000000000, currentPrice: 178.50, targetPrice: 200.00, peRatio: 28.5, eps: 6.26, dividendYield: 0.55 },
    { symbol: 'MSFT', companyName: 'Microsoft Corporation', sector: 'Technology', industry: 'Software', marketCap: 2600000000000, currentPrice: 378.90, targetPrice: 420.00, peRatio: 35.2, eps: 10.76, dividendYield: 0.74 },
    { symbol: 'GOOGL', companyName: 'Alphabet Inc.', sector: 'Technology', industry: 'Internet Services', marketCap: 1700000000000, currentPrice: 141.25, targetPrice: 165.00, peRatio: 24.8, eps: 5.69 },
    { symbol: 'AMZN', companyName: 'Amazon.com Inc.', sector: 'Consumer Discretionary', industry: 'E-Commerce', marketCap: 1500000000000, currentPrice: 178.35, targetPrice: 200.00, peRatio: 62.5, eps: 2.85 },
    { symbol: 'NVDA', companyName: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', marketCap: 1200000000000, currentPrice: 495.22, targetPrice: 600.00, peRatio: 65.3, eps: 7.58 },
    { symbol: 'TSLA', companyName: 'Tesla Inc.', sector: 'Consumer Discretionary', industry: 'Auto Manufacturers', marketCap: 780000000000, currentPrice: 245.50, targetPrice: 280.00, peRatio: 75.2, eps: 3.26 },
    { symbol: 'META', companyName: 'Meta Platforms Inc.', sector: 'Technology', industry: 'Internet Services', marketCap: 850000000000, currentPrice: 330.75, targetPrice: 380.00, peRatio: 25.4, eps: 13.02 },
    { symbol: 'JPM', companyName: 'JPMorgan Chase & Co.', sector: 'Financial Services', industry: 'Banks', marketCap: 480000000000, currentPrice: 165.20, targetPrice: 185.00, peRatio: 10.8, eps: 15.30, dividendYield: 2.52 },
    { symbol: 'V', companyName: 'Visa Inc.', sector: 'Financial Services', industry: 'Credit Services', marketCap: 520000000000, currentPrice: 258.45, targetPrice: 290.00, peRatio: 29.5, eps: 8.76, dividendYield: 0.75 },
    { symbol: 'JNJ', companyName: 'Johnson & Johnson', sector: 'Healthcare', industry: 'Drug Manufacturers', marketCap: 380000000000, currentPrice: 157.80, targetPrice: 175.00, peRatio: 15.2, eps: 10.38, dividendYield: 2.95 },
    { symbol: 'WMT', companyName: 'Walmart Inc.', sector: 'Consumer Defensive', industry: 'Discount Stores', marketCap: 420000000000, currentPrice: 156.25, targetPrice: 170.00, peRatio: 27.8, eps: 5.62, dividendYield: 1.35 },
    { symbol: 'PG', companyName: 'Procter & Gamble Co.', sector: 'Consumer Defensive', industry: 'Household Products', marketCap: 350000000000, currentPrice: 148.90, targetPrice: 165.00, peRatio: 24.5, eps: 6.08, dividendYield: 2.42 },
    { symbol: 'XOM', companyName: 'Exxon Mobil Corporation', sector: 'Energy', industry: 'Oil & Gas', marketCap: 430000000000, currentPrice: 105.75, targetPrice: 120.00, peRatio: 12.5, eps: 8.46, dividendYield: 3.45 },
    { symbol: 'HD', companyName: 'The Home Depot Inc.', sector: 'Consumer Discretionary', industry: 'Home Improvement', marketCap: 320000000000, currentPrice: 322.50, targetPrice: 360.00, peRatio: 21.5, eps: 15.00, dividendYield: 2.65 },
    { symbol: 'DIS', companyName: 'The Walt Disney Company', sector: 'Communication Services', industry: 'Entertainment', marketCap: 180000000000, currentPrice: 98.45, targetPrice: 120.00, peRatio: 68.5, eps: 1.44 },
    { symbol: 'NFLX', companyName: 'Netflix Inc.', sector: 'Communication Services', industry: 'Streaming', marketCap: 195000000000, currentPrice: 450.25, targetPrice: 520.00, peRatio: 42.5, eps: 10.59 }
  ];
  for (const stock of stocksData) {
    await prisma.stockScreener.create({ data: { userId: demoUser.id, ...stock } });
  }
  console.log(`   ✓ Created ${stocksData.length} stock screener entries`);

  // ============== SEED CRYPTO ANALYZER (15+) ==============
  console.log('\n₿ Seeding crypto analyzer...');
  const cryptosData = [
    { symbol: 'BTC', name: 'Bitcoin', currentPrice: 43250.00, priceChange24h: 2.5, priceChange7d: 8.3, marketCap: 850000000000, volume24h: 25000000000, allTimeHigh: 69000, allTimeLow: 67.81 },
    { symbol: 'ETH', name: 'Ethereum', currentPrice: 2285.50, priceChange24h: 3.2, priceChange7d: 12.5, marketCap: 275000000000, volume24h: 15000000000, allTimeHigh: 4878, allTimeLow: 0.42 },
    { symbol: 'BNB', name: 'Binance Coin', currentPrice: 312.45, priceChange24h: 1.8, priceChange7d: 5.2, marketCap: 48000000000, volume24h: 1200000000, allTimeHigh: 686, allTimeLow: 0.10 },
    { symbol: 'SOL', name: 'Solana', currentPrice: 98.75, priceChange24h: 5.5, priceChange7d: 18.2, marketCap: 42000000000, volume24h: 2500000000, allTimeHigh: 260, allTimeLow: 0.50 },
    { symbol: 'XRP', name: 'XRP', currentPrice: 0.52, priceChange24h: 1.2, priceChange7d: 3.5, marketCap: 28000000000, volume24h: 1500000000, allTimeHigh: 3.40, allTimeLow: 0.003 },
    { symbol: 'ADA', name: 'Cardano', currentPrice: 0.58, priceChange24h: 2.1, priceChange7d: 6.8, marketCap: 20500000000, volume24h: 450000000, allTimeHigh: 3.10, allTimeLow: 0.017 },
    { symbol: 'DOGE', name: 'Dogecoin', currentPrice: 0.082, priceChange24h: 4.5, priceChange7d: 15.2, marketCap: 11500000000, volume24h: 800000000, allTimeHigh: 0.74, allTimeLow: 0.00008 },
    { symbol: 'AVAX', name: 'Avalanche', currentPrice: 35.25, priceChange24h: 3.8, priceChange7d: 10.5, marketCap: 13000000000, volume24h: 550000000, allTimeHigh: 146, allTimeLow: 2.80 },
    { symbol: 'DOT', name: 'Polkadot', currentPrice: 7.45, priceChange24h: 2.8, priceChange7d: 8.9, marketCap: 9500000000, volume24h: 350000000, allTimeHigh: 55, allTimeLow: 2.69 },
    { symbol: 'MATIC', name: 'Polygon', currentPrice: 0.85, priceChange24h: 3.5, priceChange7d: 11.2, marketCap: 8500000000, volume24h: 450000000, allTimeHigh: 2.92, allTimeLow: 0.003 },
    { symbol: 'LINK', name: 'Chainlink', currentPrice: 14.85, priceChange24h: 2.2, priceChange7d: 7.5, marketCap: 8700000000, volume24h: 320000000, allTimeHigh: 52.88, allTimeLow: 0.13 },
    { symbol: 'UNI', name: 'Uniswap', currentPrice: 6.25, priceChange24h: 1.9, priceChange7d: 5.8, marketCap: 4700000000, volume24h: 180000000, allTimeHigh: 44.97, allTimeLow: 0.42 },
    { symbol: 'ATOM', name: 'Cosmos', currentPrice: 9.85, priceChange24h: 2.5, priceChange7d: 6.2, marketCap: 3800000000, volume24h: 150000000, allTimeHigh: 44.70, allTimeLow: 1.13 },
    { symbol: 'LTC', name: 'Litecoin', currentPrice: 72.50, priceChange24h: 1.5, priceChange7d: 4.2, marketCap: 5400000000, volume24h: 350000000, allTimeHigh: 412, allTimeLow: 1.11 },
    { symbol: 'XLM', name: 'Stellar', currentPrice: 0.12, priceChange24h: 1.8, priceChange7d: 5.5, marketCap: 3400000000, volume24h: 120000000, allTimeHigh: 0.94, allTimeLow: 0.001 }
  ];
  for (const crypto of cryptosData) {
    await prisma.cryptoAnalysis.create({ data: { userId: demoUser.id, ...crypto } });
  }
  console.log(`   ✓ Created ${cryptosData.length} crypto analyzer entries`);

  // ============== SEED LOAN ADVISOR (15+) ==============
  console.log('\n🏦 Seeding loan advisor...');
  const loansData = [
    { loanType: 'mortgage', loanAmount: 350000, loanPurpose: 'Home purchase', loanTerm: 360, annualIncome: 120000, employmentStatus: 'employed', employmentYears: 8, creditScore: 740, existingDebts: 15000, downPayment: 70000 },
    { loanType: 'auto', loanAmount: 35000, loanPurpose: 'New car purchase', loanTerm: 60, annualIncome: 75000, employmentStatus: 'employed', employmentYears: 5, creditScore: 720, existingDebts: 8000 },
    { loanType: 'personal', loanAmount: 15000, loanPurpose: 'Debt consolidation', loanTerm: 36, annualIncome: 55000, employmentStatus: 'employed', employmentYears: 3, creditScore: 680, existingDebts: 12000 },
    { loanType: 'student', loanAmount: 45000, loanPurpose: 'Graduate school', loanTerm: 120, annualIncome: 45000, employmentStatus: 'employed', employmentYears: 2, creditScore: 700, existingDebts: 5000 },
    { loanType: 'business', loanAmount: 100000, loanPurpose: 'Business expansion', loanTerm: 84, annualIncome: 150000, employmentStatus: 'self-employed', employmentYears: 6, creditScore: 750, collateralValue: 80000 },
    { loanType: 'mortgage', loanAmount: 250000, loanPurpose: 'Investment property', loanTerm: 360, annualIncome: 95000, employmentStatus: 'employed', employmentYears: 10, creditScore: 760, existingDebts: 180000, downPayment: 50000 },
    { loanType: 'auto', loanAmount: 25000, loanPurpose: 'Used car purchase', loanTerm: 48, annualIncome: 60000, employmentStatus: 'employed', employmentYears: 4, creditScore: 695, existingDebts: 5000 },
    { loanType: 'personal', loanAmount: 8000, loanPurpose: 'Home improvement', loanTerm: 24, annualIncome: 50000, employmentStatus: 'employed', employmentYears: 2, creditScore: 710, existingDebts: 3000 },
    { loanType: 'business', loanAmount: 50000, loanPurpose: 'Equipment purchase', loanTerm: 60, annualIncome: 90000, employmentStatus: 'self-employed', employmentYears: 4, creditScore: 725, collateralValue: 40000 },
    { loanType: 'mortgage', loanAmount: 500000, loanPurpose: 'Luxury home', loanTerm: 360, annualIncome: 200000, employmentStatus: 'employed', employmentYears: 15, creditScore: 780, existingDebts: 45000, downPayment: 100000 },
    { loanType: 'personal', loanAmount: 20000, loanPurpose: 'Medical expenses', loanTerm: 48, annualIncome: 65000, employmentStatus: 'employed', employmentYears: 5, creditScore: 690, existingDebts: 8000 },
    { loanType: 'auto', loanAmount: 45000, loanPurpose: 'Electric vehicle', loanTerm: 72, annualIncome: 85000, employmentStatus: 'employed', employmentYears: 7, creditScore: 735, existingDebts: 10000 },
    { loanType: 'student', loanAmount: 30000, loanPurpose: 'Medical school', loanTerm: 120, annualIncome: 40000, employmentStatus: 'employed', employmentYears: 1, creditScore: 680, existingDebts: 15000 },
    { loanType: 'business', loanAmount: 200000, loanPurpose: 'Franchise purchase', loanTerm: 120, annualIncome: 180000, employmentStatus: 'self-employed', employmentYears: 8, creditScore: 770, collateralValue: 150000 },
    { loanType: 'personal', loanAmount: 5000, loanPurpose: 'Emergency fund', loanTerm: 12, annualIncome: 42000, employmentStatus: 'employed', employmentYears: 2, creditScore: 650, existingDebts: 2000 }
  ];
  for (const loan of loansData) {
    await prisma.loanApplication.create({ data: { userId: demoUser.id, ...loan } });
  }
  console.log(`   ✓ Created ${loansData.length} loan advisor entries`);

  // ============== SEED INSURANCE OPTIMIZER (15+) ==============
  console.log('\n🔒 Seeding insurance optimizer...');
  const insuranceData = [
    { insuranceType: 'health', provider: 'Blue Cross Blue Shield', coverageAmount: 500000, premium: 450, deductible: 2500, isActive: true },
    { insuranceType: 'auto', provider: 'State Farm', coverageAmount: 100000, premium: 125, deductible: 500, isActive: true },
    { insuranceType: 'home', provider: 'Allstate', coverageAmount: 350000, premium: 175, deductible: 1000, isActive: true },
    { insuranceType: 'life', provider: 'Northwestern Mutual', coverageAmount: 500000, premium: 85, deductible: 0, isActive: true },
    { insuranceType: 'disability', provider: 'MetLife', coverageAmount: 60000, premium: 95, deductible: 90, isActive: true },
    { insuranceType: 'umbrella', provider: 'GEICO', coverageAmount: 1000000, premium: 35, deductible: 0, isActive: true },
    { insuranceType: 'health', provider: 'UnitedHealthcare', coverageAmount: 750000, premium: 550, deductible: 1500, isActive: true },
    { insuranceType: 'auto', provider: 'Progressive', coverageAmount: 150000, premium: 145, deductible: 750, isActive: true },
    { insuranceType: 'home', provider: 'Liberty Mutual', coverageAmount: 450000, premium: 210, deductible: 1500, isActive: true },
    { insuranceType: 'life', provider: 'New York Life', coverageAmount: 1000000, premium: 150, deductible: 0, isActive: true },
    { insuranceType: 'health', provider: 'Aetna', coverageAmount: 1000000, premium: 620, deductible: 3000, isActive: true },
    { insuranceType: 'auto', provider: 'Nationwide', coverageAmount: 200000, premium: 165, deductible: 1000, isActive: true },
    { insuranceType: 'disability', provider: 'Principal', coverageAmount: 72000, premium: 110, deductible: 60, isActive: true },
    { insuranceType: 'life', provider: 'Prudential', coverageAmount: 250000, premium: 45, deductible: 0, isActive: true },
    { insuranceType: 'umbrella', provider: 'Chubb', coverageAmount: 2000000, premium: 65, deductible: 0, isActive: true }
  ];
  for (const ins of insuranceData) {
    await prisma.insurancePolicy.create({ data: { userId: demoUser.id, ...ins } });
  }
  console.log(`   ✓ Created ${insuranceData.length} insurance optimizer entries`);

  // ============== SEED RETIREMENT PLANNER (15+) ==============
  console.log('\n🏖️ Seeding retirement planner...');
  const retirementData = [
    { currentAge: 35, retirementAge: 65, lifeExpectancy: 90, currentSavings: 150000, monthlyContribution: 1500, expectedReturn: 7, inflationRate: 3, socialSecurityAge: 67, socialSecurityAmount: 2500, desiredRetirementIncome: 6000 },
    { currentAge: 45, retirementAge: 67, lifeExpectancy: 92, currentSavings: 350000, monthlyContribution: 2000, expectedReturn: 6.5, inflationRate: 3, socialSecurityAge: 67, socialSecurityAmount: 3000, pensionAmount: 1500, desiredRetirementIncome: 8000 },
    { currentAge: 28, retirementAge: 60, lifeExpectancy: 95, currentSavings: 45000, monthlyContribution: 800, expectedReturn: 8, inflationRate: 3, socialSecurityAge: 67, socialSecurityAmount: 2000, desiredRetirementIncome: 5000 },
    { currentAge: 55, retirementAge: 65, lifeExpectancy: 88, currentSavings: 650000, monthlyContribution: 3000, expectedReturn: 5.5, inflationRate: 2.5, socialSecurityAge: 66, socialSecurityAmount: 3200, pensionAmount: 2000, desiredRetirementIncome: 10000 },
    { currentAge: 40, retirementAge: 62, lifeExpectancy: 90, currentSavings: 200000, monthlyContribution: 1800, expectedReturn: 7, inflationRate: 3, socialSecurityAge: 67, socialSecurityAmount: 2800, desiredRetirementIncome: 7000, legacyGoal: 200000 },
    { currentAge: 32, retirementAge: 55, lifeExpectancy: 92, currentSavings: 85000, monthlyContribution: 2500, expectedReturn: 8.5, inflationRate: 3, desiredRetirementIncome: 6500 },
    { currentAge: 50, retirementAge: 67, lifeExpectancy: 90, currentSavings: 480000, monthlyContribution: 2200, expectedReturn: 6, inflationRate: 2.5, socialSecurityAge: 67, socialSecurityAmount: 3100, pensionAmount: 1000, desiredRetirementIncome: 9000 },
    { currentAge: 25, retirementAge: 65, lifeExpectancy: 95, currentSavings: 15000, monthlyContribution: 500, expectedReturn: 8, inflationRate: 3, desiredRetirementIncome: 4500 },
    { currentAge: 42, retirementAge: 60, lifeExpectancy: 88, currentSavings: 280000, monthlyContribution: 2800, expectedReturn: 7, inflationRate: 3, socialSecurityAge: 67, socialSecurityAmount: 2600, desiredRetirementIncome: 8500, healthcareCosts: 800 },
    { currentAge: 38, retirementAge: 65, lifeExpectancy: 92, currentSavings: 180000, monthlyContribution: 1200, expectedReturn: 7.5, inflationRate: 3, socialSecurityAge: 67, socialSecurityAmount: 2400, desiredRetirementIncome: 6000 },
    { currentAge: 52, retirementAge: 62, lifeExpectancy: 85, currentSavings: 520000, monthlyContribution: 3500, expectedReturn: 5, inflationRate: 2.5, socialSecurityAge: 65, socialSecurityAmount: 3400, pensionAmount: 2500, desiredRetirementIncome: 12000 },
    { currentAge: 30, retirementAge: 58, lifeExpectancy: 90, currentSavings: 65000, monthlyContribution: 1500, expectedReturn: 8, inflationRate: 3, desiredRetirementIncome: 5500, legacyGoal: 100000 },
    { currentAge: 48, retirementAge: 65, lifeExpectancy: 90, currentSavings: 380000, monthlyContribution: 2000, expectedReturn: 6.5, inflationRate: 3, socialSecurityAge: 67, socialSecurityAmount: 2900, desiredRetirementIncome: 7500 },
    { currentAge: 33, retirementAge: 60, lifeExpectancy: 92, currentSavings: 95000, monthlyContribution: 1800, expectedReturn: 7.5, inflationRate: 3, socialSecurityAge: 67, socialSecurityAmount: 2300, desiredRetirementIncome: 6000 },
    { currentAge: 58, retirementAge: 65, lifeExpectancy: 88, currentSavings: 750000, monthlyContribution: 4000, expectedReturn: 5, inflationRate: 2.5, socialSecurityAge: 66, socialSecurityAmount: 3500, pensionAmount: 2200, desiredRetirementIncome: 11000, healthcareCosts: 1000 }
  ];
  for (const plan of retirementData) {
    await prisma.retirementPlan.create({ data: { userId: demoUser.id, ...plan } });
  }
  console.log(`   ✓ Created ${retirementData.length} retirement planner entries`);

  // ============== SEED BUDGET COACH (3+ plans, 50+ expenses) ==============
  console.log('\n💰 Seeding budget coach...');
  const budgetPlansData = [
    { name: 'Monthly Household Budget', period: 'monthly', totalIncome: 8500, totalBudget: 6800, categories: [
      { name: 'Housing', budgeted: 2000, spent: 2000, color: '#4CAF50' }, { name: 'Food', budgeted: 800, spent: 720, color: '#2196F3' },
      { name: 'Transportation', budgeted: 600, spent: 580, color: '#FF9800' }, { name: 'Utilities', budgeted: 350, spent: 340, color: '#9C27B0' },
      { name: 'Entertainment', budgeted: 400, spent: 450, color: '#E91E63' }, { name: 'Healthcare', budgeted: 200, spent: 180, color: '#00BCD4' },
      { name: 'Shopping', budgeted: 450, spent: 520, color: '#FF5722' }, { name: 'Savings', budgeted: 1500, spent: 1500, color: '#8BC34A' }, { name: 'Other', budgeted: 500, spent: 380, color: '#607D8B' }
    ]},
    { name: 'Single Income Budget', period: 'monthly', totalIncome: 5200, totalBudget: 4500, categories: [
      { name: 'Housing', budgeted: 1400, spent: 1400, color: '#4CAF50' }, { name: 'Food', budgeted: 500, spent: 480, color: '#2196F3' },
      { name: 'Transportation', budgeted: 400, spent: 420, color: '#FF9800' }, { name: 'Utilities', budgeted: 200, spent: 195, color: '#9C27B0' },
      { name: 'Entertainment', budgeted: 200, spent: 250, color: '#E91E63' }, { name: 'Healthcare', budgeted: 150, spent: 120, color: '#00BCD4' },
      { name: 'Savings', budgeted: 700, spent: 700, color: '#8BC34A' }, { name: 'Other', budgeted: 450, spent: 400, color: '#607D8B' }
    ]},
    { name: 'Family Budget', period: 'monthly', totalIncome: 12000, totalBudget: 10000, categories: [
      { name: 'Housing', budgeted: 3000, spent: 3000, color: '#4CAF50' }, { name: 'Food', budgeted: 1200, spent: 1350, color: '#2196F3' },
      { name: 'Transportation', budgeted: 800, spent: 750, color: '#FF9800' }, { name: 'Utilities', budgeted: 500, spent: 480, color: '#9C27B0' },
      { name: 'Entertainment', budgeted: 600, spent: 700, color: '#E91E63' }, { name: 'Healthcare', budgeted: 400, spent: 350, color: '#00BCD4' },
      { name: 'Childcare', budgeted: 1500, spent: 1500, color: '#795548' }, { name: 'Savings', budgeted: 2000, spent: 2000, color: '#8BC34A' }
    ]},
    { name: 'Student Budget', period: 'monthly', totalIncome: 2800, totalBudget: 2600, categories: [
      { name: 'Housing', budgeted: 900, spent: 900, color: '#4CAF50' }, { name: 'Food', budgeted: 400, spent: 450, color: '#2196F3' },
      { name: 'Transportation', budgeted: 150, spent: 120, color: '#FF9800' }, { name: 'Utilities', budgeted: 100, spent: 95, color: '#9C27B0' },
      { name: 'Entertainment', budgeted: 150, spent: 200, color: '#E91E63' }, { name: 'Savings', budgeted: 300, spent: 200, color: '#8BC34A' },
      { name: 'Education', budgeted: 400, spent: 380, color: '#3F51B5' }, { name: 'Other', budgeted: 200, spent: 180, color: '#607D8B' }
    ]},
    { name: 'Aggressive Savings Plan', period: 'monthly', totalIncome: 10000, totalBudget: 6000, categories: [
      { name: 'Housing', budgeted: 1800, spent: 1800, color: '#4CAF50' }, { name: 'Food', budgeted: 500, spent: 480, color: '#2196F3' },
      { name: 'Transportation', budgeted: 300, spent: 280, color: '#FF9800' }, { name: 'Utilities', budgeted: 200, spent: 190, color: '#9C27B0' },
      { name: 'Entertainment', budgeted: 200, spent: 150, color: '#E91E63' }, { name: 'Savings', budgeted: 3000, spent: 3000, color: '#8BC34A' }
    ]},
    { name: 'Debt Payoff Budget', period: 'monthly', totalIncome: 7000, totalBudget: 6500, categories: [
      { name: 'Housing', budgeted: 1600, spent: 1600, color: '#4CAF50' }, { name: 'Food', budgeted: 600, spent: 580, color: '#2196F3' },
      { name: 'Debt Payments', budgeted: 2500, spent: 2500, color: '#F44336' }, { name: 'Utilities', budgeted: 300, spent: 290, color: '#9C27B0' },
      { name: 'Transportation', budgeted: 400, spent: 380, color: '#FF9800' }, { name: 'Savings', budgeted: 500, spent: 500, color: '#8BC34A' },
      { name: 'Other', budgeted: 600, spent: 550, color: '#607D8B' }
    ]},
    { name: 'Vacation Savings Budget', period: 'monthly', totalIncome: 9000, totalBudget: 7500, categories: [
      { name: 'Housing', budgeted: 2200, spent: 2200, color: '#4CAF50' }, { name: 'Food', budgeted: 700, spent: 650, color: '#2196F3' },
      { name: 'Transportation', budgeted: 500, spent: 480, color: '#FF9800' }, { name: 'Utilities', budgeted: 350, spent: 340, color: '#9C27B0' },
      { name: 'Vacation Fund', budgeted: 1200, spent: 1200, color: '#00BCD4' }, { name: 'Savings', budgeted: 1500, spent: 1500, color: '#8BC34A' },
      { name: 'Other', budgeted: 1050, spent: 900, color: '#607D8B' }
    ]},
    { name: 'Freelancer Budget', period: 'monthly', totalIncome: 6500, totalBudget: 5800, categories: [
      { name: 'Housing', budgeted: 1500, spent: 1500, color: '#4CAF50' }, { name: 'Food', budgeted: 600, spent: 550, color: '#2196F3' },
      { name: 'Business Expenses', budgeted: 800, spent: 920, color: '#FF5722' }, { name: 'Utilities', budgeted: 250, spent: 240, color: '#9C27B0' },
      { name: 'Taxes', budgeted: 1300, spent: 1300, color: '#F44336' }, { name: 'Healthcare', budgeted: 450, spent: 450, color: '#00BCD4' },
      { name: 'Savings', budgeted: 500, spent: 400, color: '#8BC34A' }, { name: 'Other', budgeted: 400, spent: 350, color: '#607D8B' }
    ]},
    { name: 'Minimalist Budget', period: 'monthly', totalIncome: 4000, totalBudget: 3200, categories: [
      { name: 'Housing', budgeted: 1200, spent: 1200, color: '#4CAF50' }, { name: 'Food', budgeted: 350, spent: 340, color: '#2196F3' },
      { name: 'Transportation', budgeted: 200, spent: 180, color: '#FF9800' }, { name: 'Utilities', budgeted: 150, spent: 140, color: '#9C27B0' },
      { name: 'Savings', budgeted: 800, spent: 800, color: '#8BC34A' }, { name: 'Other', budgeted: 500, spent: 420, color: '#607D8B' }
    ]},
    { name: 'DINK Household', period: 'monthly', totalIncome: 15000, totalBudget: 11000, categories: [
      { name: 'Housing', budgeted: 3500, spent: 3500, color: '#4CAF50' }, { name: 'Food', budgeted: 1200, spent: 1100, color: '#2196F3' },
      { name: 'Transportation', budgeted: 800, spent: 750, color: '#FF9800' }, { name: 'Utilities', budgeted: 400, spent: 380, color: '#9C27B0' },
      { name: 'Entertainment', budgeted: 1000, spent: 1200, color: '#E91E63' }, { name: 'Travel', budgeted: 1000, spent: 800, color: '#00BCD4' },
      { name: 'Savings', budgeted: 3100, spent: 3100, color: '#8BC34A' }
    ]},
    { name: 'New Parent Budget', period: 'monthly', totalIncome: 9500, totalBudget: 8500, categories: [
      { name: 'Housing', budgeted: 2200, spent: 2200, color: '#4CAF50' }, { name: 'Food', budgeted: 900, spent: 950, color: '#2196F3' },
      { name: 'Baby Expenses', budgeted: 1200, spent: 1400, color: '#E91E63' }, { name: 'Healthcare', budgeted: 600, spent: 580, color: '#00BCD4' },
      { name: 'Utilities', budgeted: 350, spent: 340, color: '#9C27B0' }, { name: 'Savings', budgeted: 1000, spent: 800, color: '#8BC34A' },
      { name: 'Transportation', budgeted: 500, spent: 480, color: '#FF9800' }, { name: 'Other', budgeted: 750, spent: 700, color: '#607D8B' }
    ]},
    { name: 'Retirement Prep Budget', period: 'monthly', totalIncome: 11000, totalBudget: 7500, categories: [
      { name: 'Housing', budgeted: 1800, spent: 1800, color: '#4CAF50' }, { name: 'Food', budgeted: 700, spent: 680, color: '#2196F3' },
      { name: 'Healthcare', budgeted: 600, spent: 550, color: '#00BCD4' }, { name: 'Retirement Savings', budgeted: 3000, spent: 3000, color: '#8BC34A' },
      { name: 'Utilities', budgeted: 300, spent: 290, color: '#9C27B0' }, { name: 'Entertainment', budgeted: 400, spent: 350, color: '#E91E63' },
      { name: 'Other', budgeted: 700, spent: 600, color: '#607D8B' }
    ]},
    { name: 'Side Hustle Budget', period: 'monthly', totalIncome: 3500, totalBudget: 2800, categories: [
      { name: 'Business Tools', budgeted: 200, spent: 180, color: '#FF5722' }, { name: 'Marketing', budgeted: 300, spent: 350, color: '#E91E63' },
      { name: 'Supplies', budgeted: 500, spent: 480, color: '#FF9800' }, { name: 'Taxes', budgeted: 700, spent: 700, color: '#F44336' },
      { name: 'Savings', budgeted: 800, spent: 600, color: '#8BC34A' }, { name: 'Other', budgeted: 300, spent: 250, color: '#607D8B' }
    ]},
    { name: 'Pet Owner Budget', period: 'monthly', totalIncome: 7500, totalBudget: 6200, categories: [
      { name: 'Housing', budgeted: 1800, spent: 1800, color: '#4CAF50' }, { name: 'Food', budgeted: 600, spent: 580, color: '#2196F3' },
      { name: 'Pet Expenses', budgeted: 350, spent: 400, color: '#795548' }, { name: 'Transportation', budgeted: 400, spent: 380, color: '#FF9800' },
      { name: 'Utilities', budgeted: 250, spent: 240, color: '#9C27B0' }, { name: 'Entertainment', budgeted: 300, spent: 350, color: '#E91E63' },
      { name: 'Savings', budgeted: 1200, spent: 1100, color: '#8BC34A' }, { name: 'Other', budgeted: 500, spent: 450, color: '#607D8B' }
    ]},
    { name: 'Wedding Planning Budget', period: 'monthly', totalIncome: 8000, totalBudget: 7000, categories: [
      { name: 'Housing', budgeted: 1600, spent: 1600, color: '#4CAF50' }, { name: 'Food', budgeted: 500, spent: 480, color: '#2196F3' },
      { name: 'Wedding Fund', budgeted: 2000, spent: 2000, color: '#E91E63' }, { name: 'Transportation', budgeted: 350, spent: 340, color: '#FF9800' },
      { name: 'Utilities', budgeted: 250, spent: 240, color: '#9C27B0' }, { name: 'Savings', budgeted: 800, spent: 800, color: '#8BC34A' },
      { name: 'Other', budgeted: 500, spent: 450, color: '#607D8B' }
    ]},
    { name: 'Home Buyer Saving Budget', period: 'monthly', totalIncome: 9000, totalBudget: 6500, categories: [
      { name: 'Housing', budgeted: 1500, spent: 1500, color: '#4CAF50' }, { name: 'Food', budgeted: 600, spent: 570, color: '#2196F3' },
      { name: 'Down Payment Fund', budgeted: 2500, spent: 2500, color: '#3F51B5' }, { name: 'Transportation', budgeted: 400, spent: 380, color: '#FF9800' },
      { name: 'Utilities', budgeted: 250, spent: 240, color: '#9C27B0' }, { name: 'Savings', budgeted: 750, spent: 750, color: '#8BC34A' },
      { name: 'Other', budgeted: 500, spent: 420, color: '#607D8B' }
    ]},
    { name: 'Health-Focused Budget', period: 'monthly', totalIncome: 7000, totalBudget: 6000, categories: [
      { name: 'Housing', budgeted: 1600, spent: 1600, color: '#4CAF50' }, { name: 'Healthy Food', budgeted: 800, spent: 850, color: '#2196F3' },
      { name: 'Gym & Fitness', budgeted: 200, spent: 200, color: '#E91E63' }, { name: 'Healthcare', budgeted: 400, spent: 380, color: '#00BCD4' },
      { name: 'Supplements', budgeted: 150, spent: 140, color: '#FF9800' }, { name: 'Savings', budgeted: 1000, spent: 900, color: '#8BC34A' },
      { name: 'Other', budgeted: 850, spent: 780, color: '#607D8B' }
    ]},
    { name: 'Weekly Groceries Only', period: 'weekly', totalIncome: 2000, totalBudget: 400, categories: [
      { name: 'Groceries', budgeted: 250, spent: 230, color: '#4CAF50' }, { name: 'Eating Out', budgeted: 100, spent: 120, color: '#FF9800' },
      { name: 'Snacks', budgeted: 50, spent: 45, color: '#E91E63' }
    ]},
    { name: 'Annual Subscription Budget', period: 'yearly', totalIncome: 96000, totalBudget: 5000, categories: [
      { name: 'Streaming', budgeted: 600, spent: 550, color: '#E91E63' }, { name: 'Software', budgeted: 1200, spent: 1100, color: '#3F51B5' },
      { name: 'Memberships', budgeted: 800, spent: 750, color: '#00BCD4' }, { name: 'Insurance', budgeted: 2400, spent: 2400, color: '#FF5722' }
    ]},
    { name: 'Emergency Spending Plan', period: 'monthly', totalIncome: 6000, totalBudget: 5500, categories: [
      { name: 'Housing', budgeted: 1400, spent: 1400, color: '#4CAF50' }, { name: 'Food', budgeted: 400, spent: 380, color: '#2196F3' },
      { name: 'Emergency Fund', budgeted: 1500, spent: 1500, color: '#F44336' }, { name: 'Utilities', budgeted: 200, spent: 190, color: '#9C27B0' },
      { name: 'Transportation', budgeted: 300, spent: 280, color: '#FF9800' }, { name: 'Other', budgeted: 700, spent: 650, color: '#607D8B' }
    ]},
    { name: 'Travel Enthusiast Budget', period: 'monthly', totalIncome: 8500, totalBudget: 7200, categories: [
      { name: 'Housing', budgeted: 1800, spent: 1800, color: '#4CAF50' }, { name: 'Food', budgeted: 600, spent: 570, color: '#2196F3' },
      { name: 'Travel Fund', budgeted: 1500, spent: 1500, color: '#00BCD4' }, { name: 'Transportation', budgeted: 400, spent: 380, color: '#FF9800' },
      { name: 'Utilities', budgeted: 300, spent: 290, color: '#9C27B0' }, { name: 'Entertainment', budgeted: 300, spent: 350, color: '#E91E63' },
      { name: 'Savings', budgeted: 1000, spent: 900, color: '#8BC34A' }, { name: 'Other', budgeted: 300, spent: 280, color: '#607D8B' }
    ]},
    { name: 'Tech Professional Budget', period: 'monthly', totalIncome: 13000, totalBudget: 9500, categories: [
      { name: 'Housing', budgeted: 3000, spent: 3000, color: '#4CAF50' }, { name: 'Food', budgeted: 1000, spent: 950, color: '#2196F3' },
      { name: 'Tech & Gadgets', budgeted: 500, spent: 600, color: '#3F51B5' }, { name: 'Transportation', budgeted: 600, spent: 550, color: '#FF9800' },
      { name: 'Utilities', budgeted: 400, spent: 380, color: '#9C27B0' }, { name: 'Entertainment', budgeted: 500, spent: 550, color: '#E91E63' },
      { name: 'Savings', budgeted: 2500, spent: 2500, color: '#8BC34A' }, { name: 'Other', budgeted: 1000, spent: 850, color: '#607D8B' }
    ]},
    { name: 'Charitable Giving Budget', period: 'monthly', totalIncome: 10000, totalBudget: 8000, categories: [
      { name: 'Housing', budgeted: 2000, spent: 2000, color: '#4CAF50' }, { name: 'Food', budgeted: 700, spent: 680, color: '#2196F3' },
      { name: 'Charitable Giving', budgeted: 1000, spent: 1000, color: '#E91E63' }, { name: 'Transportation', budgeted: 500, spent: 480, color: '#FF9800' },
      { name: 'Utilities', budgeted: 300, spent: 290, color: '#9C27B0' }, { name: 'Savings', budgeted: 2000, spent: 2000, color: '#8BC34A' },
      { name: 'Other', budgeted: 500, spent: 450, color: '#607D8B' }
    ]},
    { name: 'College Student Budget', period: 'monthly', totalIncome: 1800, totalBudget: 1700, categories: [
      { name: 'Rent', budgeted: 700, spent: 700, color: '#4CAF50' }, { name: 'Food', budgeted: 300, spent: 320, color: '#2196F3' },
      { name: 'Books & Supplies', budgeted: 150, spent: 130, color: '#3F51B5' }, { name: 'Transportation', budgeted: 100, spent: 90, color: '#FF9800' },
      { name: 'Entertainment', budgeted: 150, spent: 180, color: '#E91E63' }, { name: 'Phone', budgeted: 50, spent: 50, color: '#9C27B0' },
      { name: 'Savings', budgeted: 150, spent: 100, color: '#8BC34A' }, { name: 'Other', budgeted: 100, spent: 80, color: '#607D8B' }
    ]},
    { name: 'Post-Divorce Budget', period: 'monthly', totalIncome: 5500, totalBudget: 5000, categories: [
      { name: 'Housing', budgeted: 1500, spent: 1500, color: '#4CAF50' }, { name: 'Food', budgeted: 500, spent: 480, color: '#2196F3' },
      { name: 'Child Support', budgeted: 1200, spent: 1200, color: '#F44336' }, { name: 'Transportation', budgeted: 400, spent: 380, color: '#FF9800' },
      { name: 'Utilities', budgeted: 250, spent: 240, color: '#9C27B0' }, { name: 'Savings', budgeted: 500, spent: 400, color: '#8BC34A' },
      { name: 'Other', budgeted: 650, spent: 600, color: '#607D8B' }
    ]}
  ];
  for (const plan of budgetPlansData) {
    await prisma.budgetPlan.create({ data: { userId: demoUser.id, ...plan } });
  }

  // Create 100 expenses for demo user
  const expenseCategories = ['Housing', 'Food', 'Transportation', 'Utilities', 'Entertainment', 'Healthcare', 'Shopping', 'Other'];
  const merchantNames = ['Walmart', 'Amazon', 'Target', 'Costco', 'Starbucks', 'Shell', 'Netflix', 'Spotify', 'Apple', 'CVS', 'Whole Foods', 'Trader Joes', 'Home Depot', 'Best Buy', 'Uber'];
  const expenseDescriptions = [
    'Weekly groceries', 'Gas fill-up', 'Monthly subscription', 'Office supplies', 'Dinner out',
    'Coffee run', 'Online purchase', 'Medical copay', 'Car maintenance', 'Home repair',
    'Birthday gift', 'Dry cleaning', 'Parking', 'Pharmacy', 'Gym membership',
    'Pet food', 'Haircut', 'Movie tickets', 'Books', 'Clothing'
  ];
  for (let i = 0; i < 100; i++) {
    await prisma.expense.create({ data: {
      userId: demoUser.id,
      amount: randomFloat(5, 350),
      category: randomItem(expenseCategories),
      merchant: randomItem(merchantNames),
      description: randomItem(expenseDescriptions),
      date: randomDate(new Date('2024-08-01'), new Date()),
      isRecurring: Math.random() > 0.8,
      recurringFrequency: Math.random() > 0.8 ? randomItem(['weekly', 'monthly', 'yearly']) : null,
    }});
  }
  console.log(`   ✓ Created ${budgetPlansData.length} budget plans and 100 expenses`);

  // ============== SEED GOAL TRACKER (15+) ==============
  console.log('\n🎯 Seeding goal tracker...');
  const goalsData = [
    { name: 'Emergency Fund', description: '6 months of expenses', category: 'emergency_fund', targetAmount: 25000, currentAmount: 15000, priority: 1, monthlyContribution: 500 },
    { name: 'Down Payment for House', description: 'Save for 20% down payment', category: 'savings', targetAmount: 80000, currentAmount: 35000, priority: 2, monthlyContribution: 1500 },
    { name: 'Pay Off Credit Cards', description: 'Eliminate credit card debt', category: 'debt_payoff', targetAmount: 8500, currentAmount: 3200, priority: 1, monthlyContribution: 800 },
    { name: 'Vacation Fund', description: 'European trip next year', category: 'savings', targetAmount: 5000, currentAmount: 2100, priority: 3, monthlyContribution: 250 },
    { name: 'New Car Fund', description: 'Save for car down payment', category: 'purchase', targetAmount: 15000, currentAmount: 6500, priority: 2, monthlyContribution: 400 },
    { name: 'Retirement Boost', description: 'Extra retirement savings', category: 'retirement', targetAmount: 50000, currentAmount: 12000, priority: 2, monthlyContribution: 1000 },
    { name: 'Wedding Fund', description: 'Save for wedding expenses', category: 'savings', targetAmount: 20000, currentAmount: 8500, priority: 3, monthlyContribution: 600 },
    { name: 'Student Loan Payoff', description: 'Pay off remaining student loans', category: 'debt_payoff', targetAmount: 25000, currentAmount: 18000, priority: 1, monthlyContribution: 700 },
    { name: 'Home Renovation', description: 'Kitchen remodel', category: 'purchase', targetAmount: 30000, currentAmount: 5000, priority: 4, monthlyContribution: 500 },
    { name: 'Investment Portfolio', description: 'Build investment portfolio', category: 'investment', targetAmount: 100000, currentAmount: 25000, priority: 2, monthlyContribution: 1500 },
    { name: 'College Fund', description: 'Kids college savings', category: 'education', targetAmount: 150000, currentAmount: 28000, priority: 2, monthlyContribution: 800 },
    { name: 'Business Startup', description: 'Seed money for side business', category: 'savings', targetAmount: 25000, currentAmount: 7500, priority: 3, monthlyContribution: 400 },
    { name: 'Medical Expenses Fund', description: 'HSA/medical fund', category: 'emergency_fund', targetAmount: 10000, currentAmount: 4500, priority: 2, monthlyContribution: 300 },
    { name: 'Travel Fund', description: 'Annual family vacations', category: 'savings', targetAmount: 8000, currentAmount: 2000, priority: 4, monthlyContribution: 200 },
    { name: 'Pay Off Car Loan', description: 'Finish car payments early', category: 'debt_payoff', targetAmount: 12000, currentAmount: 9500, priority: 1, monthlyContribution: 600 }
  ];
  for (const goal of goalsData) {
    await prisma.financialGoal.create({ data: { userId: demoUser.id, ...goal } });
  }
  console.log(`   ✓ Created ${goalsData.length} goal tracker entries`);

  // ============== SEED BILL NEGOTIATOR (15+) ==============
  console.log('\n📞 Seeding bill negotiator...');
  const billsData = [
    { billType: 'internet', provider: 'Comcast Xfinity', currentAmount: 89.99, originalAmount: 99.99, frequency: 'monthly', dueDate: 15 },
    { billType: 'cable', provider: 'DirecTV', currentAmount: 125.00, originalAmount: 125.00, frequency: 'monthly', dueDate: 1 },
    { billType: 'phone', provider: 'Verizon Wireless', currentAmount: 85.00, originalAmount: 95.00, frequency: 'monthly', dueDate: 22 },
    { billType: 'insurance', provider: 'State Farm Auto', currentAmount: 145.00, originalAmount: 160.00, frequency: 'monthly', dueDate: 5 },
    { billType: 'subscription', provider: 'Netflix', currentAmount: 15.99, originalAmount: 15.99, frequency: 'monthly', dueDate: 10 },
    { billType: 'utility', provider: 'Duke Energy', currentAmount: 185.00, originalAmount: 185.00, frequency: 'monthly', dueDate: 20 },
    { billType: 'gym', provider: 'Planet Fitness', currentAmount: 24.99, originalAmount: 24.99, frequency: 'monthly', dueDate: 1 },
    { billType: 'streaming', provider: 'Spotify Premium', currentAmount: 10.99, originalAmount: 10.99, frequency: 'monthly', dueDate: 15 },
    { billType: 'internet', provider: 'AT&T Fiber', currentAmount: 75.00, originalAmount: 80.00, frequency: 'monthly', dueDate: 8 },
    { billType: 'phone', provider: 'T-Mobile', currentAmount: 70.00, originalAmount: 80.00, frequency: 'monthly', dueDate: 25 },
    { billType: 'subscription', provider: 'Amazon Prime', currentAmount: 139.00, originalAmount: 139.00, frequency: 'yearly', dueDate: 1 },
    { billType: 'insurance', provider: 'Allstate Home', currentAmount: 175.00, originalAmount: 200.00, frequency: 'monthly', dueDate: 12 },
    { billType: 'utility', provider: 'Water Utility', currentAmount: 65.00, originalAmount: 65.00, frequency: 'monthly', dueDate: 28 },
    { billType: 'streaming', provider: 'Disney+', currentAmount: 13.99, originalAmount: 13.99, frequency: 'monthly', dueDate: 5 },
    { billType: 'gym', provider: 'LA Fitness', currentAmount: 34.99, originalAmount: 39.99, frequency: 'monthly', dueDate: 1 }
  ];
  for (const bill of billsData) {
    await prisma.bill.create({ data: { userId: demoUser.id, ...bill } });
  }
  console.log(`   ✓ Created ${billsData.length} bill negotiator entries`);

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
  console.log('   --- NEW FEATURES ---');
  console.log(`   📊 Stocks:               ${stocksData.length}`);
  console.log(`   ₿ Cryptos:               ${cryptosData.length}`);
  console.log(`   🏦 Loans:                ${loansData.length}`);
  console.log(`   🔒 Insurance Policies:   ${insuranceData.length}`);
  console.log(`   🏖️ Retirement Plans:     ${retirementData.length}`);
  console.log(`   💰 Budget Plans:         ${budgetPlansData.length}`);
  console.log(`   📋 Expenses:             100`);
  console.log(`   🎯 Financial Goals:      ${goalsData.length}`);
  console.log(`   📞 Bills:                ${billsData.length}`);
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
