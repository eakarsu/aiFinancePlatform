/**
 * Core Banking — Transactions Route
 * Module: transactions
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

const MODULE = 'banking_transactions';
const auth = authenticateToken;

// ── CRUD ─────────────────────────────────────────────────────────────────────

// 1. List (paginated + filtered)
router.get('/', auth, (req, res) => {
  const { page, limit, txType, status, accountId, channel } = req.query;
  const result = storeList(MODULE, { page, limit, filter: { txType, status, accountId, channel } });
  res.json(result);
});

// 2. Get by ID (with audit log)
router.get('/:id', auth, (req, res) => {
  const record = storeGet(MODULE, req.params.id);
  if (!record) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ data: record, auditLog: [{ event: 'read', at: new Date().toISOString(), by: req.user.id }] });
});

// 3. Create
router.post('/', auth, (req, res) => {
  const { accountId, txType, amount, currency = 'USD', direction, channel, merchantName, mccCode, description } = req.body;
  if (!accountId || !txType || !amount) return res.status(400).json({ error: 'accountId, txType, and amount required' });
  const referenceNumber = `TXN${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const record = storeCreate(MODULE, {
    accountId, txType, amount: parseFloat(amount), currency, direction: direction || 'Debit',
    channel: channel || 'Online', merchantName, mccCode, description, referenceNumber,
    status: 'Completed', valueDate: new Date().toISOString(), feeAmount: 0, amlScore: 0,
  });
  res.status(201).json(record);
});

// 4. Update
router.patch('/:id', auth, (req, res) => {
  const record = storeUpdate(MODULE, req.params.id, req.body);
  if (!record) return res.status(404).json({ error: 'Transaction not found' });
  res.json(record);
});

// 5. Soft-delete (status = 'Reversed')
router.delete('/:id', auth, (req, res) => {
  const record = storeUpdate(MODULE, req.params.id, { status: 'Reversed' });
  if (!record) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ message: 'Transaction reversed', data: record });
});

// 6. List by account
router.get('/by-account/:accountId', auth, (req, res) => {
  const result = storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { accountId: req.params.accountId } });
  res.json(result);
});

// 7. List by secondary key (txType)
router.get('/by-type/:txType', auth, (req, res) => {
  const result = storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { txType: req.params.txType } });
  res.json(result);
});

// 8. Batch create
router.post('/batch', auth, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items[] required' });
  const records = storeBatchCreate(MODULE, items.map(i => ({ ...i, referenceNumber: `TXN${Date.now()}${Math.random().toFixed(4).slice(2)}`, status: i.status || 'Completed' })));
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
  if (!record) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ message: 'Archived', data: record });
});

// 14. Restore
router.post('/:id/restore', auth, (req, res) => {
  const record = storeRestore(MODULE, req.params.id);
  if (!record) return res.status(404).json({ error: 'Transaction not found' });
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
  res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
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
  const { data } = storeList(MODULE, { limit: 10000 });
  const totalVolume = data.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const byType = {};
  data.forEach(r => { byType[r.txType] = (byType[r.txType] || 0) + 1; });
  res.json({ ...storeStats(MODULE), totalVolume, byType });
});

// ── AI VERBS ─────────────────────────────────────────────────────────────────

// AI-1: detect-fraud
router.post('/:id/ai/detect-fraud', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank fraud detection AI. Analyze this transaction for fraud indicators.\n\nTransaction: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"fraudScore": 0-100, "isFraud": false, "confidence": 0-100, "signals": ["<text>"], "riskLevel": "low|medium|high|critical", "recommendedAction": "allow|review|block|decline", "explanation": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_fraud_detect`, prompt, 'You are a fraud detection specialist. Respond only with valid JSON.', { fraudScore: 10, isFraud: false, confidence: 70, signals: [], riskLevel: 'low', recommendedAction: 'allow', explanation: 'Transaction appears normal.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-2: classify-mcc
router.post('/:id/ai/classify-mcc', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a payment classification specialist. Classify the merchant category code (MCC) for this transaction and provide context.\n\nTransaction: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"mccCode": "<code>", "mccDescription": "<text>", "categoryGroup": "<text>", "isHighRisk": false, "rewardsEligible": true, "taxDeductible": false, "irsCategory": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_mcc_classify`, prompt, 'You are a payment classification specialist. Respond only with valid JSON.', { mccCode: record.mccCode || '5999', mccDescription: 'Miscellaneous Retail', categoryGroup: 'Retail', isHighRisk: false, rewardsEligible: true, taxDeductible: false, irsCategory: 'Personal' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-3: suggest-categorization
router.post('/:id/ai/suggest-categorization', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a personal finance AI. Suggest the best spending category for this transaction.\n\nTransaction: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"primaryCategory": "<text>", "subCategory": "<text>", "confidence": 0-100, "alternativeCategories": ["<text>"], "budgetImpact": "<text>", "isRecurring": false}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_categorize`, prompt, 'You are a personal finance AI. Respond only with valid JSON.', { primaryCategory: 'General', subCategory: 'Other', confidence: 50, alternativeCategories: [], budgetImpact: 'Unknown', isRecurring: false });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-4: predict-reversal-risk
router.post('/:id/ai/predict-reversal-risk', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank operations analyst. Predict the likelihood this transaction will be reversed, disputed, or charged back.\n\nTransaction: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"reversalRisk": 0-100, "chargebackRisk": 0-100, "disputeRisk": 0-100, "riskFactors": ["<text>"], "preventionActions": ["<text>"], "estimatedReversalCost": 0}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_reversal_risk`, prompt, 'You are a bank operations analyst. Respond only with valid JSON.', { reversalRisk: 5, chargebackRisk: 3, disputeRisk: 5, riskFactors: [], preventionActions: [], estimatedReversalCost: 0 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-5: score-aml-risk
router.post('/:id/ai/score-aml-risk', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank AML compliance analyst. Score this transaction for anti-money laundering risk per BSA/AML guidelines.\n\nTransaction: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"amlScore": 0-100, "riskLevel": "low|medium|high|critical", "typologies": ["<text>"], "ctrRequired": false, "sarIndicator": false, "investigationRecommended": false, "notes": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_aml_score`, prompt, 'You are a bank AML compliance analyst. Respond only with valid JSON.', { amlScore: 10, riskLevel: 'low', typologies: [], ctrRequired: false, sarIndicator: false, investigationRecommended: false, notes: 'No AML indicators detected.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-6: detect-structuring
router.post('/ai/detect-structuring', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { transactions = [], customerId } = req.body;
    const prompt = `You are a bank BSA/AML compliance officer. Analyze these transactions for structuring patterns (smurfing) — attempts to evade CTR reporting by breaking transactions below $10,000.\n\nCustomer: ${customerId}\nTransactions: ${JSON.stringify(transactions.slice(0, 50))}\n\nRespond with valid JSON:\n{"structuringDetected": false, "structuringScore": 0-100, "suspiciousGroups": [], "totalAmount": 0, "sarRecommended": false, "evidenceSummary": "<text>", "typologyCode": "<text>"}`;
    const totalAmt = transactions.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_structuring`, prompt, 'You are a BSA/AML compliance officer. Respond only with valid JSON.', { structuringDetected: false, structuringScore: 5, suspiciousGroups: [], totalAmount: totalAmt, sarRecommended: false, evidenceSummary: 'No structuring patterns detected.', typologyCode: 'N/A' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-7: generate-receipt-description
router.post('/:id/ai/generate-receipt-description', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a banking communications specialist. Generate a clear, customer-friendly receipt description for this transaction.\n\nTransaction: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"receiptDescription": "<text>", "shortDescription": "<text>", "merchantDisplayName": "<text>", "categoryLabel": "<text>", "customerNote": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_receipt_desc`, prompt, 'You are a banking communications specialist. Respond only with valid JSON.', { receiptDescription: record.description || 'Banking transaction', shortDescription: record.txType || 'Transaction', merchantDisplayName: record.merchantName || 'Unknown', categoryLabel: 'General', customerNote: '' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-8: validate-routing-numbers
router.post('/ai/validate-routing-numbers', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { routingNumbers = [] } = req.body;
    const prompt = `You are a bank payments specialist. Validate these ABA routing numbers using the checksum algorithm and provide institution details.\n\nRouting numbers: ${JSON.stringify(routingNumbers)}\n\nRespond with valid JSON:\n{"results": [{"routing": "<number>", "isValid": true, "institution": "<name>", "federalReserveDistrict": "<text>", "checkDigitValid": true}], "validCount": 0, "invalidCount": 0}`;
    const results = routingNumbers.map(r => {
      const digits = String(r).replace(/\D/g, '');
      const isValid = digits.length === 9;
      return { routing: r, isValid, institution: isValid ? 'Institution lookup requires API' : 'Invalid format', federalReserveDistrict: 'Unknown', checkDigitValid: isValid };
    });
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_routing_validate`, prompt, 'You are a bank payments specialist. Respond only with valid JSON.', { results, validCount: results.filter(r => r.isValid).length, invalidCount: results.filter(r => !r.isValid).length });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-9: predict-settlement-time
router.post('/:id/ai/predict-settlement-time', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank settlement specialist. Predict the settlement timeline for this transaction.\n\nTransaction: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"estimatedSettlementDate": "<date>", "settlementDays": 0, "settlementRail": "<text>", "cutoffApplied": false, "holidayImpact": false, "expeditedOptions": ["<text>"], "feeForExpedited": 0}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_settlement_time`, prompt, 'You are a bank settlement specialist. Respond only with valid JSON.', { estimatedSettlementDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), settlementDays: 1, settlementRail: 'ACH', cutoffApplied: false, holidayImpact: false, expeditedOptions: ['Same-day ACH', 'Wire'], feeForExpedited: 25 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-10: summarize-customer-spending
router.post('/ai/summarize-customer-spending', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { customerId, period = '30d' } = req.body;
    const { data: txs } = storeList(MODULE, { limit: 200, filter: { customerId } });
    const totalSpend = txs.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const prompt = `You are a personal finance analyst. Summarize the spending patterns for this customer.\n\nCustomer: ${customerId}\nPeriod: ${period}\nTransactions: ${JSON.stringify(txs.slice(0, 30))}\nTotal spend: ${totalSpend}\n\nRespond with valid JSON:\n{"summary": "<text>", "totalSpend": 0, "avgTransactionSize": 0, "topCategories": [], "insights": ["<text>"], "comparisonToBenchmark": "<text>", "savingsOpportunities": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_spending_summary`, prompt, 'You are a personal finance analyst. Respond only with valid JSON.', { summary: `${txs.length} transactions, total $${totalSpend.toFixed(2)}`, totalSpend, avgTransactionSize: txs.length ? totalSpend / txs.length : 0, topCategories: [], insights: [], comparisonToBenchmark: 'Benchmark unavailable', savingsOpportunities: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-11: suggest-fee-waiver
router.post('/:id/ai/suggest-fee-waiver', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank customer service specialist. Assess whether the fee on this transaction should be waived based on customer value and bank policy.\n\nTransaction: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"waivable": false, "waiverConfidence": 0-100, "reasoning": "<text>", "policyReference": "<text>", "clvImpact": "<text>", "recommendedAction": "waive|retain|partial", "waiveAmount": 0}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_fee_waiver`, prompt, 'You are a bank customer service specialist. Respond only with valid JSON.', { waivable: false, waiverConfidence: 30, reasoning: 'Standard fee per product terms.', policyReference: 'Fee Schedule Section 3', clvImpact: 'Minimal', recommendedAction: 'retain', waiveAmount: 0 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-12: detect-duplicate
router.post('/ai/detect-duplicate', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { transaction } = req.body;
    const { data: recent } = storeList(MODULE, { limit: 100, filter: { accountId: transaction.accountId } });
    const duplicates = recent.filter(t => t.amount == transaction.amount && t.txType === transaction.txType && Math.abs(new Date(t.createdAt) - new Date()) < 86400000 * 2);
    const prompt = `You are a bank payment operations analyst. Determine if this is a duplicate transaction.\n\nTransaction to check: ${JSON.stringify(transaction)}\nRecent similar transactions: ${JSON.stringify(duplicates)}\n\nRespond with valid JSON:\n{"isDuplicate": false, "duplicateConfidence": 0-100, "matchedTransactionId": null, "matchCriteria": ["<text>"], "recommendedAction": "process|hold|reject", "explanation": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_duplicate`, prompt, 'You are a bank payment operations analyst. Respond only with valid JSON.', { isDuplicate: duplicates.length > 0, duplicateConfidence: duplicates.length > 0 ? 75 : 5, matchedTransactionId: duplicates[0]?.id || null, matchCriteria: duplicates.length ? ['amount', 'type', 'time window'] : [], recommendedAction: duplicates.length > 0 ? 'hold' : 'process', explanation: duplicates.length > 0 ? 'Potential duplicate detected within 48 hours' : 'No duplicate detected.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-13: classify-purpose
router.post('/:id/ai/classify-purpose', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank compliance analyst. Classify the economic purpose of this transaction for regulatory and reporting purposes.\n\nTransaction: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"purpose": "<text>", "purposeCode": "<text>", "isCommercial": false, "isPersonal": true, "regulatoryCategory": "<text>", "reportingRequired": false, "purposeConfidence": 0-100}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_classify_purpose`, prompt, 'You are a bank compliance analyst. Respond only with valid JSON.', { purpose: 'General payment', purposeCode: 'GNR', isCommercial: false, isPersonal: true, regulatoryCategory: 'Consumer', reportingRequired: false, purposeConfidence: 60 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-14: score-velocity-risk
router.post('/ai/score-velocity-risk', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { accountId, windowHours = 24 } = req.body;
    const { data: recent } = storeList(MODULE, { limit: 200, filter: { accountId } });
    const windowMs = windowHours * 3600000;
    const inWindow = recent.filter(t => Date.now() - new Date(t.createdAt).getTime() < windowMs);
    const prompt = `You are a bank fraud velocity analyst. Score the transaction velocity risk for this account.\n\nAccount: ${accountId}\nWindow: ${windowHours} hours\nTransactions in window: ${inWindow.length}\nTotal amount in window: ${inWindow.reduce((s, t) => s + parseFloat(t.amount || 0), 0)}\n\nRespond with valid JSON:\n{"velocityScore": 0-100, "txCountInWindow": 0, "totalAmountInWindow": 0, "riskLevel": "low|medium|high|critical", "limitBreaches": ["<text>"], "recommendedAction": "allow|review|block", "explanation": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_velocity`, prompt, 'You are a fraud velocity analyst. Respond only with valid JSON.', { velocityScore: Math.min(100, inWindow.length * 5), txCountInWindow: inWindow.length, totalAmountInWindow: inWindow.reduce((s, t) => s + parseFloat(t.amount || 0), 0), riskLevel: inWindow.length > 20 ? 'high' : inWindow.length > 10 ? 'medium' : 'low', limitBreaches: [], recommendedAction: inWindow.length > 20 ? 'review' : 'allow', explanation: `${inWindow.length} transactions in ${windowHours}h window.` });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-15: recommend-decline
router.post('/:id/ai/recommend-decline', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank authorization specialist. Evaluate whether this transaction should be declined and provide the decline reason code and customer message.\n\nTransaction: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"shouldDecline": false, "declineCode": "<text>", "declineReason": "<text>", "customerMessage": "<text>", "internalNote": "<text>", "appealable": true, "alternativeSuggestion": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_decline`, prompt, 'You are a bank authorization specialist. Respond only with valid JSON.', { shouldDecline: false, declineCode: 'N/A', declineReason: 'Transaction approved', customerMessage: 'Your transaction was approved.', internalNote: 'No decline indicators.', appealable: false, alternativeSuggestion: '' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-16: generate-narrative
router.post('/:id/ai/generate-narrative', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank compliance documentation specialist. Generate a comprehensive transaction narrative suitable for BSA/AML case files and internal reporting.\n\nTransaction: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"narrative": "<text>", "executiveSummary": "<text>", "keyFacts": ["<text>"], "regulatoryContext": "<text>", "recommendedFollowUp": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_narrative`, prompt, 'You are a bank compliance documentation specialist. Respond only with valid JSON.', { narrative: `Transaction ${record.referenceNumber || record.id} — ${record.txType}: $${record.amount} via ${record.channel}.`, executiveSummary: 'Standard transaction processed within normal parameters.', keyFacts: [], regulatoryContext: 'No reportable activity detected.', recommendedFollowUp: 'None required.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

module.exports = router;
