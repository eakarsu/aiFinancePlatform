/**
 * Core Banking — Accounts Route
 * Module: accounts
 * Endpoints: 18 CRUD + 16 AI verbs = 34 total
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  storeCreate, storeGet, storeUpdate, storeDelete, storeList,
  storeCount, storeSearch, storeArchive, storeRestore, storeHistory,
  storeBatchCreate, storeBatchUpdate, storeBatchDelete,
  storeStats, exportCsv, importCsvRows, aiCall,
} = require('../utils/bankingHelpers');

const MODULE = 'banking_accounts';
const auth = authenticateToken;

// ── CRUD ─────────────────────────────────────────────────────────────────────

// 1. List (paginated + filtered)
router.get('/', auth, (req, res) => {
  const { page, limit, status, accountType, customerId } = req.query;
  const result = storeList(MODULE, { page, limit, filter: { status, accountType, customerId } });
  res.json(result);
});

// 2. Get by ID (with audit log)
router.get('/:id', auth, (req, res) => {
  const record = storeGet(MODULE, req.params.id);
  if (!record) return res.status(404).json({ error: 'Account not found' });
  res.json({ data: record, auditLog: [{ event: 'read', at: new Date().toISOString(), by: req.user.id }] });
});

// 3. Create
router.post('/', auth, (req, res) => {
  const { customerId, accountType, currency = 'USD', productCode, branchCode, overdraftLimit = 0 } = req.body;
  if (!customerId || !accountType) return res.status(400).json({ error: 'customerId and accountType required' });
  const accountNumber = `ACC${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const record = storeCreate(MODULE, {
    customerId, accountNumber, accountType, currency, productCode, branchCode,
    overdraftLimit, status: 'Active', availableBalance: 0, ledgerBalance: 0,
    interestRate: 0, openedAt: new Date().toISOString(),
  });
  res.status(201).json(record);
});

// 4. Update
router.patch('/:id', auth, (req, res) => {
  const record = storeUpdate(MODULE, req.params.id, req.body);
  if (!record) return res.status(404).json({ error: 'Account not found' });
  res.json(record);
});

// 5. Soft-delete (status = 'Closed')
router.delete('/:id', auth, (req, res) => {
  const record = storeUpdate(MODULE, req.params.id, { status: 'Closed', closedAt: new Date().toISOString() });
  if (!record) return res.status(404).json({ error: 'Account not found' });
  res.json({ message: 'Account closed', data: record });
});

// 6. List by customer
router.get('/by-customer/:customerId', auth, (req, res) => {
  const result = storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { customerId: req.params.customerId } });
  res.json(result);
});

// 7. List by secondary key (accountType)
router.get('/by-type/:accountType', auth, (req, res) => {
  const result = storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { accountType: req.params.accountType } });
  res.json(result);
});

// 8. Batch create
router.post('/batch', auth, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items[] required' });
  const records = storeBatchCreate(MODULE, items.map(i => ({ ...i, status: i.status || 'Active', accountNumber: `ACC${Date.now()}${Math.random().toFixed(4).slice(2)}` })));
  res.status(201).json({ created: records.length, data: records });
});

// 9. Batch update
router.patch('/batch', auth, (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates[] required' });
  const records = storeBatchUpdate(MODULE, updates);
  res.json({ updated: records.length, data: records });
});

// 10. Batch delete
router.post('/batch-delete', auth, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids[] required' });
  const records = storeBatchDelete(MODULE, ids);
  res.json({ deleted: records.length });
});

// 11. Count
router.get('/meta/count', auth, (req, res) => {
  res.json({ count: storeCount(MODULE, req.query) });
});

// 12. Search
router.get('/meta/search', auth, (req, res) => {
  res.json({ data: storeSearch(MODULE, req.query.q) });
});

// 13. Archive
router.post('/:id/archive', auth, (req, res) => {
  const record = storeArchive(MODULE, req.params.id);
  if (!record) return res.status(404).json({ error: 'Account not found' });
  res.json({ message: 'Archived', data: record });
});

// 14. Restore
router.post('/:id/restore', auth, (req, res) => {
  const record = storeRestore(MODULE, req.params.id);
  if (!record) return res.status(404).json({ error: 'Account not found' });
  res.json({ message: 'Restored', data: record });
});

// 15. History
router.get('/:id/history', auth, (req, res) => {
  res.json({ data: storeHistory(MODULE, req.params.id) });
});

// 16. Export CSV
router.get('/meta/export-csv', auth, (req, res) => {
  const { data } = storeList(MODULE, { limit: 10000 });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="accounts.csv"');
  res.send(exportCsv(data));
});

// 17. Import CSV
router.post('/meta/import-csv', auth, (req, res) => {
  const { csv } = req.body;
  if (!csv) return res.status(400).json({ error: 'csv text required' });
  const records = importCsvRows(csv, MODULE);
  res.status(201).json({ imported: records.length, data: records });
});

// 18. Stats summary
router.get('/meta/stats', auth, (req, res) => {
  const stats = storeStats(MODULE);
  res.json(stats);
});

// ── AI VERBS ─────────────────────────────────────────────────────────────────

// AI-1: classify-account-type
router.post('/:id/ai/classify-account-type', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a core banking analyst. Classify the optimal account type for this customer account and explain the reasoning.\n\nAccount data: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"classification": "<type>", "confidence": 0-100, "rationale": "<text>", "alternativeTypes": ["<type>"], "recommendation": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_classify_type`, prompt, 'You are a banking product specialist. Respond only with valid JSON.', { classification: 'Checking', confidence: 70, rationale: 'Default classification', alternativeTypes: [], recommendation: 'Review product fit' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-2: predict-balance-trajectory
router.post('/:id/ai/predict-balance-trajectory', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { months = 6 } = req.body;
    const prompt = `You are a financial data scientist. Predict the balance trajectory for this bank account over the next ${months} months.\n\nAccount: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"projections": [{"month": 1, "estimatedBalance": 0}], "trend": "increasing|decreasing|stable", "keyDrivers": ["<text>"], "riskFactors": ["<text>"], "summary": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_balance_trajectory`, prompt, 'You are a financial data scientist. Respond only with valid JSON.', { projections: [], trend: 'stable', keyDrivers: [], riskFactors: [], summary: 'Insufficient data for projection' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-3: detect-dormancy
router.post('/:id/ai/detect-dormancy', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a banking compliance analyst. Assess dormancy risk for this account based on activity patterns.\n\nAccount: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"isDormant": false, "dormancyScore": 0-100, "lastActivityDate": "<date>", "daysSinceActivity": 0, "dormancyThresholdDays": 365, "recommendedAction": "<text>", "regulatoryConsiderations": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_dormancy`, prompt, 'You are a banking compliance analyst. Respond only with valid JSON.', { isDormant: false, dormancyScore: 0, lastActivityDate: null, daysSinceActivity: 0, dormancyThresholdDays: 365, recommendedAction: 'No action required', regulatoryConsiderations: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-4: suggest-product-upgrade
router.post('/:id/ai/suggest-product-upgrade', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a retail banking product advisor. Suggest appropriate product upgrades for this account holder.\n\nAccount: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"currentProduct": "<text>", "suggestedUpgrade": "<text>", "upgradeBenefits": ["<text>"], "eligibilityCriteria": ["<text>"], "conversionLikelihood": 0-100, "recommendedTiming": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_product_upgrade`, prompt, 'You are a retail banking product advisor. Respond only with valid JSON.', { currentProduct: 'Standard', suggestedUpgrade: 'Premium Checking', upgradeBenefits: [], eligibilityCriteria: [], conversionLikelihood: 50, recommendedTiming: 'Next review cycle' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-5: score-customer-lifetime-value
router.post('/:id/ai/score-customer-lifetime-value', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a banking CRM analyst. Score the customer lifetime value for this account holder.\n\nAccount: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"clvScore": 0-100, "estimatedAnnualRevenue": 0, "tenureMonths": 0, "productDepth": 0, "clvSegment": "platinum|gold|silver|bronze", "growthPotential": "high|medium|low", "retentionPriority": "critical|high|medium|low"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_clv`, prompt, 'You are a banking CRM analyst. Respond only with valid JSON.', { clvScore: 50, estimatedAnnualRevenue: 0, tenureMonths: 0, productDepth: 1, clvSegment: 'silver', growthPotential: 'medium', retentionPriority: 'medium' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-6: detect-fee-anomalies
router.post('/:id/ai/detect-fee-anomalies', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { feeHistory = [] } = req.body;
    const prompt = `You are a banking operations analyst. Detect fee anomalies and potential fee errors for this account.\n\nAccount: ${JSON.stringify(record)}\nFee history: ${JSON.stringify(feeHistory)}\n\nRespond with valid JSON:\n{"anomaliesDetected": false, "anomalies": [], "totalFeesLast30Days": 0, "expectedFeeRange": {"min": 0, "max": 0}, "recommendations": ["<text>"], "potentialSavings": 0}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_fee_anomaly`, prompt, 'You are a banking operations analyst. Respond only with valid JSON.', { anomaliesDetected: false, anomalies: [], totalFeesLast30Days: 0, expectedFeeRange: { min: 0, max: 50 }, recommendations: [], potentialSavings: 0 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-7: generate-statement-narrative
router.post('/:id/ai/generate-statement-narrative', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { period = 'last-30-days' } = req.body;
    const prompt = `You are a banking statement writer. Generate a clear, customer-friendly narrative summary for this account statement period.\n\nAccount: ${JSON.stringify(record)}\nPeriod: ${period}\n\nRespond with valid JSON:\n{"narrative": "<text>", "highlights": ["<text>"], "keyMetrics": {"openingBalance": 0, "closingBalance": 0, "totalCredits": 0, "totalDebits": 0, "netChange": 0}, "callToAction": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_statement_narrative`, prompt, 'You are a banking communications specialist. Respond only with valid JSON.', { narrative: 'Account activity summary not available.', highlights: [], keyMetrics: {}, callToAction: 'Contact your relationship manager for details.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-8: predict-overdraft
router.post('/:id/ai/predict-overdraft', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a banking risk analyst. Predict the overdraft likelihood for this account over the next 30 days.\n\nAccount: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"overdraftLikelihood": 0-100, "predictedOverdraftDate": "<date or null>", "estimatedShortfall": 0, "triggerFactors": ["<text>"], "preventionRecommendations": ["<text>"], "overdraftProtectionSuggested": true}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_overdraft`, prompt, 'You are a banking risk analyst. Respond only with valid JSON.', { overdraftLikelihood: 10, predictedOverdraftDate: null, estimatedShortfall: 0, triggerFactors: [], preventionRecommendations: [], overdraftProtectionSuggested: false });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-9: suggest-savings-goal
router.post('/:id/ai/suggest-savings-goal', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a personal banking advisor. Suggest personalized savings goals for this account holder based on their account profile.\n\nAccount: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"suggestedGoals": [{"name": "<text>", "targetAmount": 0, "monthlyContribution": 0, "timelineMonths": 0, "priority": "high|medium|low"}], "emergencyFundStatus": "<text>", "savingsRateBenchmark": 0, "totalRecommendedMonthlySavings": 0}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_savings_goal`, prompt, 'You are a personal banking advisor. Respond only with valid JSON.', { suggestedGoals: [{ name: 'Emergency Fund', targetAmount: 10000, monthlyContribution: 500, timelineMonths: 20, priority: 'high' }], emergencyFundStatus: 'Insufficient', savingsRateBenchmark: 20, totalRecommendedMonthlySavings: 500 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-10: classify-spending
router.post('/:id/ai/classify-spending', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { transactions = [] } = req.body;
    const prompt = `You are a spending analytics AI. Classify and categorize spending patterns from these account transactions.\n\nTransactions: ${JSON.stringify(transactions.slice(0, 50))}\n\nRespond with valid JSON:\n{"categories": [{"name": "<text>", "amount": 0, "percentage": 0, "transactionCount": 0}], "topCategory": "<text>", "discretionaryRatio": 0, "essentialRatio": 0, "spendingHealthScore": 0-100, "insights": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_spending_classify`, prompt, 'You are a spending analytics AI. Respond only with valid JSON.', { categories: [], topCategory: 'Unknown', discretionaryRatio: 0, essentialRatio: 0, spendingHealthScore: 50, insights: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-11: generate-onboarding-checklist
router.post('/ai/generate-onboarding-checklist', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { accountType, customerId, jurisdiction = 'US' } = req.body;
    const prompt = `You are a bank onboarding compliance officer. Generate a complete onboarding checklist for a new ${accountType} account.\n\nJurisdiction: ${jurisdiction}\n\nRespond with valid JSON:\n{"checklist": [{"step": 1, "category": "<text>", "task": "<text>", "required": true, "estimatedTime": "<text>"}], "totalSteps": 0, "estimatedCompletionTime": "<text>", "regulatoryRequirements": ["<text>"], "digitalOptions": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_onboarding`, prompt, 'You are a bank compliance officer. Respond only with valid JSON.', { checklist: [{ step: 1, category: 'Identity', task: 'Verify government-issued ID', required: true, estimatedTime: '5 min' }, { step: 2, category: 'KYC', task: 'Complete KYC form', required: true, estimatedTime: '10 min' }], totalSteps: 2, estimatedCompletionTime: '15 minutes', regulatoryRequirements: ['Bank Secrecy Act', 'USA PATRIOT Act'], digitalOptions: ['eSign', 'Online ID verification'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-12: validate-account-naming
router.post('/ai/validate-account-naming', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { accountName, accountType } = req.body;
    const prompt = `You are a banking operations specialist. Validate whether this account name follows bank policy and regulatory requirements.\n\nProposed name: "${accountName}"\nAccount type: "${accountType}"\n\nRespond with valid JSON:\n{"isValid": true, "issues": [], "suggestions": ["<text>"], "complianceFlags": [], "sanitizedName": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_name_validate`, prompt, 'You are a banking operations specialist. Respond only with valid JSON.', { isValid: true, issues: [], suggestions: [], complianceFlags: [], sanitizedName: accountName || '' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-13: score-attrition-risk
router.post('/:id/ai/score-attrition-risk', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a banking retention analyst. Score the churn/attrition risk for this account holder.\n\nAccount: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"attritionScore": 0-100, "riskLevel": "low|medium|high|critical", "keyRiskFactors": ["<text>"], "retentionActions": [{"action": "<text>", "priority": "high|medium|low", "estimatedRetentionLift": 0}], "churnProbability30Days": 0, "churnProbability90Days": 0}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_attrition`, prompt, 'You are a banking retention analyst. Respond only with valid JSON.', { attritionScore: 20, riskLevel: 'low', keyRiskFactors: [], retentionActions: [], churnProbability30Days: 0.05, churnProbability90Days: 0.10 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-14: suggest-cross-sell
router.post('/:id/ai/suggest-cross-sell', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank relationship manager. Identify cross-sell opportunities for this account holder.\n\nAccount: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"crossSellOpportunities": [{"product": "<text>", "relevanceScore": 0-100, "pitch": "<text>", "estimatedRevenue": 0}], "bestNextProduct": "<text>", "propensityScore": 0-100, "bestContactChannel": "<text>", "bestContactTiming": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_cross_sell`, prompt, 'You are a bank relationship manager. Respond only with valid JSON.', { crossSellOpportunities: [], bestNextProduct: null, propensityScore: 30, bestContactChannel: 'email', bestContactTiming: 'weekday morning' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-15: detect-shared-pattern
router.post('/ai/detect-shared-pattern', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { accountIds = [] } = req.body;
    const accounts = accountIds.map(id => storeGet(MODULE, id)).filter(Boolean);
    const prompt = `You are a banking fraud and analytics specialist. Detect shared patterns across these accounts that may indicate linked entities, fraud rings, or unusual behavior.\n\nAccounts: ${JSON.stringify(accounts)}\n\nRespond with valid JSON:\n{"sharedPatterns": [{"pattern": "<text>", "affectedAccounts": [], "riskLevel": "low|medium|high", "explanation": "<text>"}], "linkedEntityFlag": false, "fraudRingScore": 0-100, "recommendations": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_shared_pattern`, prompt, 'You are a banking analytics specialist. Respond only with valid JSON.', { sharedPatterns: [], linkedEntityFlag: false, fraudRingScore: 5, recommendations: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-16: summarize-relationship
router.post('/:id/ai/summarize-relationship', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a banking relationship manager. Provide a comprehensive relationship summary for this account holder for use in CRM and relationship reviews.\n\nAccount: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"summary": "<text>", "relationshipStrength": "strong|moderate|weak", "totalProducts": 0, "estimatedAUM": 0, "relationshipTenureMonths": 0, "keyEvents": ["<text>"], "nextSteps": ["<text>"], "managerNotes": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_relationship_summary`, prompt, 'You are a banking relationship manager. Respond only with valid JSON.', { summary: 'Customer relationship data insufficient for full analysis.', relationshipStrength: 'moderate', totalProducts: 1, estimatedAUM: 0, relationshipTenureMonths: 0, keyEvents: [], nextSteps: ['Schedule relationship review'], managerNotes: '' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

module.exports = router;
