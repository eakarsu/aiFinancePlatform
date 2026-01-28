-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'ANALYST');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE');

-- CreateEnum
CREATE TYPE "PortfolioType" AS ENUM ('CONSERVATIVE', 'BALANCED', 'GROWTH', 'AGGRESSIVE', 'INCOME');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'ETF', 'BOND', 'CRYPTO', 'CASH');

-- CreateEnum
CREATE TYPE "InvestmentType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'DIVIDEND', 'REBALANCE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PURCHASE', 'TRANSFER', 'WITHDRAWAL', 'DEPOSIT', 'REFUND');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('UNUSUAL_AMOUNT', 'UNUSUAL_LOCATION', 'UNUSUAL_TIME', 'VELOCITY_CHECK', 'DEVICE_MISMATCH', 'PATTERN_ANOMALY');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "riskTolerance" "RiskLevel" NOT NULL DEFAULT 'MODERATE',
    "investmentGoal" TEXT NOT NULL,
    "timeHorizon" INTEGER NOT NULL,
    "monthlyIncome" DOUBLE PRECISION,
    "monthlyExpenses" DOUBLE PRECISION,
    "emergencyFund" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PortfolioType" NOT NULL DEFAULT 'BALANCED',
    "totalValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiScore" DOUBLE PRECISION,
    "aiRecommendation" TEXT,
    "lastRebalanced" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "shares" DOUBLE PRECISION NOT NULL,
    "avgCost" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "type" "InvestmentType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "symbol" TEXT,
    "shares" DOUBLE PRECISION,
    "price" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "annualIncome" DOUBLE PRECISION,
    "employmentStatus" TEXT,
    "employmentYears" DOUBLE PRECISION,
    "housingStatus" TEXT,
    "monthlyRent" DOUBLE PRECISION,
    "rentPaymentHistory" INTEGER,
    "utilityPaymentHistory" INTEGER,
    "phonePaymentHistory" INTEGER,
    "bankAccountAge" INTEGER,
    "averageBalance" DOUBLE PRECISION,
    "overdraftCount" INTEGER,
    "aiCreditScore" INTEGER,
    "aiScoreDate" TIMESTAMP(3),
    "aiConfidence" DOUBLE PRECISION,
    "aiFactors" JSONB,
    "traditionalScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_histories" (
    "id" TEXT NOT NULL,
    "creditProfileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "monthlyAmount" DOUBLE PRECISION NOT NULL,
    "onTimePayments" INTEGER NOT NULL,
    "latePayments" INTEGER NOT NULL,
    "missedPayments" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "merchant" TEXT,
    "category" TEXT,
    "location" TEXT,
    "ipAddress" TEXT,
    "deviceId" TEXT,
    "fraudScore" DOUBLE PRECISION,
    "fraudFlags" JSONB,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "description" TEXT NOT NULL,
    "aiConfidence" DOUBLE PRECISION NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analysis_logs" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "userId" TEXT,
    "inputData" JSONB NOT NULL,
    "outputData" JSONB NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "processingTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analysis_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "risk_profiles_userId_key" ON "risk_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_profiles_userId_key" ON "credit_profiles"("userId");

-- AddForeignKey
ALTER TABLE "risk_profiles" ADD CONSTRAINT "risk_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_profiles" ADD CONSTRAINT "credit_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_histories" ADD CONSTRAINT "credit_histories_creditProfileId_fkey" FOREIGN KEY ("creditProfileId") REFERENCES "credit_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_alerts" ADD CONSTRAINT "fraud_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_alerts" ADD CONSTRAINT "fraud_alerts_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
