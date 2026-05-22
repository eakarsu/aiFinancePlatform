/**
 * Core Banking Model Registry
 *
 * This file mirrors the EHR pattern from AIPatientTriageforER/backend/models/ehr.js
 * but adapted for this Prisma-based application.
 *
 * Banking models are stored in Prisma via JSON blobs in the bankingRecords table
 * (defined in schema.prisma). Each route uses req.app.get('prisma') to access the
 * Prisma client, consistent with every other route in this application.
 *
 * Model descriptors below define the shape and metadata for each banking entity.
 */

const BANKING_MODELS = {

  BankAccount: {
    tableName: 'bank_accounts',
    module: 'banking_accounts',
    fields: ['customerId', 'accountNumber', 'accountType', 'status', 'currency',
             'availableBalance', 'ledgerBalance', 'interestRate', 'openedAt',
             'closedAt', 'productCode', 'branchCode', 'overdraftLimit', 'aiSummary'],
    accountTypes: ['Checking', 'Savings', 'MoneyMarket', 'CD', 'Loan', 'Credit', 'Line'],
    statuses: ['Active', 'Dormant', 'Frozen', 'Closed', 'PendingApproval'],
  },

  LedgerEntry: {
    tableName: 'ledger_entries',
    module: 'banking_ledger',
    fields: ['journalId', 'entryDate', 'accountId', 'debit', 'credit', 'description',
             'glCode', 'reference', 'postingStatus', 'periodCode', 'reversalOf',
             'preparedBy', 'approvedBy', 'aiValidationNotes'],
    postingStatuses: ['Draft', 'Posted', 'Reversed', 'Pending', 'Rejected'],
  },

  BankTransaction: {
    tableName: 'bank_transactions',
    module: 'banking_transactions',
    fields: ['accountId', 'customerId', 'txType', 'amount', 'currency', 'direction',
             'status', 'channel', 'merchantName', 'mccCode', 'description',
             'referenceNumber', 'settlementDate', 'valueDate', 'feeAmount',
             'runningBalance', 'reversalOf', 'amlScore', 'aiNarrative'],
    txTypes: ['Deposit', 'Withdrawal', 'Transfer', 'Fee', 'Interest', 'Chargeback', 'Refund'],
    channels: ['Branch', 'ATM', 'Online', 'Mobile', 'ACH', 'Wire', 'Check', 'POS'],
  },

  InterestAccrual: {
    tableName: 'interest_accruals',
    module: 'banking_interest',
    fields: ['accountId', 'accrualDate', 'principal', 'rate', 'dayCount', 'accrualAmount',
             'ytdAccrued', 'postingDate', 'postingStatus', 'rateType', 'compoundingFreq',
             'dayCountConvention', 'promoRateExpiry', 'aiRateNotes'],
    rateTypes: ['Fixed', 'Variable', 'Promo', 'Penalty', 'Tiered'],
    dayCountConventions: ['Actual360', 'Actual365', '30_360', 'ActualActual'],
  },

  KycProfile: {
    tableName: 'kyc_profiles',
    module: 'banking_kyc',
    fields: ['customerId', 'kycStatus', 'riskTier', 'onboardedAt', 'lastReviewedAt',
             'nextReviewDue', 'idDocType', 'idDocNumber', 'idIssuedBy', 'idExpiresAt',
             'pepFlag', 'sanctionsFlag', 'occupationRisk', 'geographicRisk',
             'sourceOfFunds', 'annualIncomeBand', 'aiRiskScore', 'eddRequired',
             'eddCompletedAt', 'aiCddSummary'],
    riskTiers: ['Low', 'Medium', 'High', 'Prohibited'],
    kycStatuses: ['Pending', 'InReview', 'Approved', 'Rejected', 'Expired', 'Enhanced'],
  },

  Card: {
    tableName: 'cards',
    module: 'banking_cards',
    fields: ['accountId', 'customerId', 'cardType', 'cardStatus', 'last4', 'network',
             'expiryMonth', 'expiryYear', 'embossedName', 'issuedAt', 'activatedAt',
             'blockedAt', 'blockReason', 'creditLimit', 'availableCredit',
             'pinFailCount', 'contactless', 'virtualCard', 'aiIssuanceRisk'],
    cardTypes: ['Debit', 'Credit', 'Prepaid', 'Business'],
    cardStatuses: ['PendingActivation', 'Active', 'Blocked', 'Expired', 'Cancelled', 'Lost', 'Stolen'],
  },

  AchEntry: {
    tableName: 'ach_entries',
    module: 'banking_ach',
    fields: ['batchId', 'secCode', 'traceNumber', 'effectiveDate', 'direction',
             'receiverName', 'receiverRoutingAba', 'receiverAccountNumber',
             'receiverAccountType', 'amount', 'transactionCode', 'status',
             'returnCode', 'returnReason', 'prenotification', 'originatorId',
             'companyName', 'companyId', 'aiOriginatorRisk'],
    secCodes: ['PPD', 'CCD', 'WEB', 'TEL', 'ARC', 'BOC', 'POP', 'RCK', 'IAT'],
    directions: ['Origination', 'Receipt'],
    statuses: ['Pending', 'Batched', 'Transmitted', 'Settled', 'Returned', 'NOC', 'Prenote'],
  },

  WireTransfer: {
    tableName: 'wire_transfers',
    module: 'banking_wire',
    fields: ['accountId', 'customerId', 'direction', 'amount', 'currency', 'status',
             'fedReference', 'beneficiaryName', 'beneficiaryAccount', 'beneficiaryBank',
             'beneficiaryBankSwift', 'beneficiaryAddress', 'originatorName',
             'originatorAccount', 'purposeOfPayment', 'ofacScreeningResult',
             'ofacHitDetail', 'correspondentBank', 'feeAmount', 'valueDate',
             'recallStatus', 'aiCounterpartyRisk'],
    statuses: ['Pending', 'Processing', 'Completed', 'Recalled', 'Rejected', 'OnHold', 'Cancelled'],
    directions: ['Outgoing', 'Incoming'],
  },

  SwiftMessage: {
    tableName: 'swift_messages',
    module: 'banking_swift',
    fields: ['messageType', 'sender', 'receiver', 'senderBic', 'receiverBic',
             'transactionRef', 'relatedRef', 'currency', 'amount', 'valueDate',
             'orderingCustomer', 'beneficiaryCustomer', 'correspondentAccount',
             'remittanceInfo', 'rawMt', 'parsedFields', 'validationStatus',
             'validationErrors', 'stpStatus', 'coverMethod', 'aiQualityScore'],
    messageTypes: ['MT103', 'MT202', 'MT192', 'MT196', 'MT199', 'MT900', 'MT910', 'MT950'],
    stpStatuses: ['STP', 'NonSTP', 'PendingReview', 'Rejected'],
  },

  ReconciliationRecord: {
    tableName: 'reconciliation_records',
    module: 'banking_reconciliation',
    fields: ['reconDate', 'reconType', 'accountId', 'glBalance', 'statementBalance',
             'difference', 'status', 'unresolvedItems', 'resolvedItems',
             'suspenseAmount', 'preparedBy', 'reviewedBy', 'approvedBy',
             'closedAt', 'exceptionNotes', 'aiReconNarrative', 'aiQualityScore'],
    reconTypes: ['Daily', 'Monthly', 'Nostro', 'Vostro', 'GL', 'Suspense', 'CardSettlement'],
    statuses: ['Open', 'InProgress', 'Reconciled', 'ExceptionOpen', 'Escalated', 'Closed'],
  },

  RegulatoryReport: {
    tableName: 'regulatory_reports',
    module: 'banking_regulatory',
    fields: ['reportType', 'reportingPeriod', 'dueDate', 'filedAt', 'status',
             'subjectCustomerId', 'subjectAccountId', 'reportingOfficer',
             'approvedBy', 'filedWith', 'referenceNumber', 'totalAmount',
             'currencyType', 'narrativeText', 'attachments', 'aiDraftedNarrative',
             'examinerId', 'examinerFeedback'],
    reportTypes: ['SAR', 'CTR', 'RegD', 'FFIEC', 'CRA', 'CMIR', 'FBAR', 'BoardReport'],
    statuses: ['Draft', 'PendingReview', 'Approved', 'Filed', 'Amended', 'Superseded'],
  },
};

/**
 * Returns model descriptor for a given banking entity.
 */
function getBankingModel(name) {
  if (!BANKING_MODELS[name]) throw new Error(`Unknown banking model: ${name}`);
  return BANKING_MODELS[name];
}

/**
 * setupBankingAssociations — placeholder mirroring ehr.js setupEhrAssociations signature.
 * In this Prisma app, associations are declared in schema.prisma.
 * This function documents the logical relationships for reference.
 */
function setupBankingAssociations() {
  // BankAccount -> BankTransaction (one-to-many via accountId)
  // BankAccount -> LedgerEntry     (one-to-many via accountId)
  // BankAccount -> InterestAccrual (one-to-many via accountId)
  // BankAccount -> Card            (one-to-many via accountId)
  // BankAccount -> AchEntry        (many-to-many via accountId)
  // BankAccount -> WireTransfer    (one-to-many via accountId)
  // BankAccount -> ReconciliationRecord (one-to-many)
  // KycProfile  -> BankAccount     (customer-level, via customerId)
  // SwiftMessage -> WireTransfer   (linked via transactionRef)
}

module.exports = {
  BANKING_MODELS,
  getBankingModel,
  setupBankingAssociations,
  // Named exports for each model descriptor
  BankAccount: BANKING_MODELS.BankAccount,
  LedgerEntry: BANKING_MODELS.LedgerEntry,
  BankTransaction: BANKING_MODELS.BankTransaction,
  InterestAccrual: BANKING_MODELS.InterestAccrual,
  KycProfile: BANKING_MODELS.KycProfile,
  Card: BANKING_MODELS.Card,
  AchEntry: BANKING_MODELS.AchEntry,
  WireTransfer: BANKING_MODELS.WireTransfer,
  SwiftMessage: BANKING_MODELS.SwiftMessage,
  ReconciliationRecord: BANKING_MODELS.ReconciliationRecord,
  RegulatoryReport: BANKING_MODELS.RegulatoryReport,
};
