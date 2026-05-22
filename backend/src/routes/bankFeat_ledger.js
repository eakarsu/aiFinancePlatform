/**
 * Core Banking — General Ledger Route
 * Module: ledger
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

const MODULE = 'banking_ledger';
const auth = authenticateToken;

// ── CRUD ─────────────────────────────────────────────────────────────────────

// 1. List (paginated + filtered)
router.get('/', auth, (req, res) => {
  const { page, limit, postingStatus, glCode, periodCode } = req.query;
  const result = storeList(MODULE, { page, limit, filter: { postingStatus, glCode, periodCode } });
  res.json(result);
});

// 2. Get by ID (with audit log)
router.get('/:id', auth, (req, res) => {
  const record = storeGet(MODULE, req.params.id);
  if (!record) return res.status(404).json({ error: 'Ledger entry not found' });
  res.json({ data: record, auditLog: [{ event: 'read', at: new Date().toISOString(), by: req.user.id }] });
});

// 3. Create (journal entry)
router.post('/', auth, (req, res) => {
  const { journalId, entryDate, accountId, debit = 0, credit = 0, description, glCode, reference } = req.body;
  if (!accountId || (!debit && !credit)) return res.status(400).json({ error: 'accountId and debit or credit required' });
  if (parseFloat(debit) !== 0 && parseFloat(credit) !== 0) return res.status(400).json({ error: 'Each entry must be either debit OR credit, not both' });
  const record = storeCreate(MODULE, {
    journalId: journalId || `JNL${Date.now()}`,
    entryDate: entryDate || new Date().toISOString(),
    accountId, debit: parseFloat(debit), credit: parseFloat(credit),
    description, glCode, reference, postingStatus: 'Draft',
    periodCode: new Date().toISOString().slice(0, 7),
  });
  res.status(201).json(record);
});

// 4. Update
router.patch('/:id', auth, (req, res) => {
  const record = storeGet(MODULE, req.params.id);
  if (!record) return res.status(404).json({ error: 'Ledger entry not found' });
  if (record.postingStatus === 'Posted') return res.status(409).json({ error: 'Cannot modify a posted entry; create a reversal instead' });
  const updated = storeUpdate(MODULE, req.params.id, req.body);
  res.json(updated);
});

// 5. Soft-delete (status = 'Reversed')
router.delete('/:id', auth, (req, res) => {
  const record = storeGet(MODULE, req.params.id);
  if (!record) return res.status(404).json({ error: 'Ledger entry not found' });
  const updated = storeUpdate(MODULE, req.params.id, { postingStatus: 'Reversed', reversalOf: req.params.id });
  res.json({ message: 'Entry reversed', data: updated });
});

// 6. List by account
router.get('/by-account/:accountId', auth, (req, res) => {
  const result = storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { accountId: req.params.accountId } });
  res.json(result);
});

// 7. List by period
router.get('/by-period/:periodCode', auth, (req, res) => {
  const result = storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { periodCode: req.params.periodCode } });
  res.json(result);
});

// 8. Batch create
router.post('/batch', auth, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items[] required' });
  // Validate double-entry balance
  const totalDebit = items.reduce((s, i) => s + parseFloat(i.debit || 0), 0);
  const totalCredit = items.reduce((s, i) => s + parseFloat(i.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return res.status(400).json({ error: 'Journal not balanced', totalDebit, totalCredit });
  }
  const journalId = `JNL${Date.now()}`;
  const records = storeBatchCreate(MODULE, items.map(i => ({ ...i, journalId, postingStatus: i.postingStatus || 'Draft' })));
  res.status(201).json({ created: records.length, journalId, data: records });
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
  if (!record) return res.status(404).json({ error: 'Entry not found' });
  res.json({ message: 'Archived', data: record });
});

// 14. Restore
router.post('/:id/restore', auth, (req, res) => {
  const record = storeRestore(MODULE, req.params.id);
  if (!record) return res.status(404).json({ error: 'Entry not found' });
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
  res.setHeader('Content-Disposition', 'attachment; filename="ledger.csv"');
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
  const totalDebit = data.reduce((s, r) => s + parseFloat(r.debit || 0), 0);
  const totalCredit = data.reduce((s, r) => s + parseFloat(r.credit || 0), 0);
  res.json({ ...storeStats(MODULE), totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.001 });
});

// ── AI VERBS ─────────────────────────────────────────────────────────────────

// AI-1: validate-journal-balance
router.post('/ai/validate-journal-balance', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { journalId, entries = [] } = req.body;
    const totalDebit = entries.reduce((s, e) => s + parseFloat(e.debit || 0), 0);
    const totalCredit = entries.reduce((s, e) => s + parseFloat(e.credit || 0), 0);
    const prompt = `You are a senior accountant. Validate this journal entry for double-entry balance and accounting correctness.\n\nJournal ID: ${journalId}\nEntries: ${JSON.stringify(entries)}\nTotal Debit: ${totalDebit}\nTotal Credit: ${totalCredit}\n\nRespond with valid JSON:\n{"isBalanced": true, "difference": 0, "issues": [], "suggestions": ["<text>"], "complianceNotes": ["<text>"], "postingRecommendation": "post|hold|reject"}`;
    const fallback = { isBalanced: Math.abs(totalDebit - totalCredit) < 0.001, difference: totalDebit - totalCredit, issues: Math.abs(totalDebit - totalCredit) > 0.001 ? ['Journal is out of balance'] : [], suggestions: [], complianceNotes: [], postingRecommendation: Math.abs(totalDebit - totalCredit) < 0.001 ? 'post' : 'hold' };
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_validate_balance`, prompt, 'You are a senior accountant. Respond only with valid JSON.', fallback);
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-2: suggest-account-coding
router.post('/ai/suggest-account-coding', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { description, amount, transactionType } = req.body;
    const prompt = `You are a bank accounting specialist. Suggest the correct GL account coding for this transaction.\n\nDescription: "${description}"\nAmount: ${amount}\nType: ${transactionType}\n\nRespond with valid JSON:\n{"suggestedDebitGl": "<code>", "suggestedCreditGl": "<code>", "description": "<text>", "confidence": 0-100, "alternativeCoding": [], "gaapReference": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_account_coding`, prompt, 'You are a bank accounting specialist. Respond only with valid JSON.', { suggestedDebitGl: '10000', suggestedCreditGl: '20000', description: 'Generic coding', confidence: 50, alternativeCoding: [], gaapReference: 'ASC 310' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-3: detect-out-of-period
router.post('/ai/detect-out-of-period', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { entries = [], currentPeriod } = req.body;
    const prompt = `You are a bank accounting controller. Identify entries that appear to belong to a different accounting period (out-of-period entries).\n\nCurrent period: ${currentPeriod}\nEntries: ${JSON.stringify(entries)}\n\nRespond with valid JSON:\n{"outOfPeriodEntries": [], "totalOutOfPeriodAmount": 0, "materialityAssessment": "<text>", "adjustingEntriesRequired": [], "disclosureRequired": false}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_out_of_period`, prompt, 'You are a bank accounting controller. Respond only with valid JSON.', { outOfPeriodEntries: [], totalOutOfPeriodAmount: 0, materialityAssessment: 'No out-of-period items detected', adjustingEntriesRequired: [], disclosureRequired: false });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-4: reconcile-subledger
router.post('/ai/reconcile-subledger', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { glBalance, subledgerBalance, differences = [] } = req.body;
    const prompt = `You are a bank reconciliation specialist. Analyze the discrepancy between GL and subledger balances and suggest reconciling items.\n\nGL Balance: ${glBalance}\nSubledger Balance: ${subledgerBalance}\nDifference: ${glBalance - subledgerBalance}\nKnown differences: ${JSON.stringify(differences)}\n\nRespond with valid JSON:\n{"netDifference": 0, "reconcilingItems": [], "unresolvedDifference": 0, "rootCauses": ["<text>"], "clearingJournals": [], "recommendedActions": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_subledger_recon`, prompt, 'You are a bank reconciliation specialist. Respond only with valid JSON.', { netDifference: (glBalance || 0) - (subledgerBalance || 0), reconcilingItems: [], unresolvedDifference: 0, rootCauses: [], clearingJournals: [], recommendedActions: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-5: generate-trial-balance
router.post('/ai/generate-trial-balance', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { periodCode } = req.body;
    const { data } = storeList(MODULE, { limit: 10000, filter: { periodCode } });
    const glTotals = {};
    data.forEach(e => {
      if (!glTotals[e.glCode]) glTotals[e.glCode] = { debit: 0, credit: 0 };
      glTotals[e.glCode].debit += parseFloat(e.debit || 0);
      glTotals[e.glCode].credit += parseFloat(e.credit || 0);
    });
    const prompt = `You are a bank controller. Generate a formatted trial balance summary and validate it.\n\nPeriod: ${periodCode}\nGL Totals: ${JSON.stringify(glTotals)}\n\nRespond with valid JSON:\n{"trialBalance": [{"glCode": "<code>", "accountName": "<text>", "debit": 0, "credit": 0, "netBalance": 0}], "totalDebits": 0, "totalCredits": 0, "isBalanced": true, "periodNote": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_trial_balance`, prompt, 'You are a bank controller. Respond only with valid JSON.', { trialBalance: Object.entries(glTotals).map(([k, v]) => ({ glCode: k, accountName: k, debit: v.debit, credit: v.credit, netBalance: v.debit - v.credit })), totalDebits: data.reduce((s, e) => s + parseFloat(e.debit || 0), 0), totalCredits: data.reduce((s, e) => s + parseFloat(e.credit || 0), 0), isBalanced: true, periodNote: `Period: ${periodCode}` });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-6: classify-transaction-gl
router.post('/ai/classify-transaction-gl', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { transactions = [] } = req.body;
    const prompt = `You are a bank GL classification specialist. Map each transaction to the appropriate GL account.\n\nTransactions: ${JSON.stringify(transactions.slice(0, 30))}\n\nRespond with valid JSON:\n{"classifications": [{"txId": "<id>", "glCode": "<code>", "glName": "<text>", "confidence": 0-100, "notes": "<text>"}], "unmappedCount": 0, "reviewRequired": []}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_classify_gl`, prompt, 'You are a bank GL classification specialist. Respond only with valid JSON.', { classifications: [], unmappedCount: transactions.length, reviewRequired: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-7: predict-period-close-risk
router.post('/ai/predict-period-close-risk', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { periodCode, daysToClose } = req.body;
    const stats = storeStats(MODULE);
    const prompt = `You are a bank period-close manager. Assess the risk of completing the period close on time.\n\nPeriod: ${periodCode}\nDays to close: ${daysToClose}\nLedger stats: ${JSON.stringify(stats)}\n\nRespond with valid JSON:\n{"riskScore": 0-100, "riskLevel": "low|medium|high|critical", "blockers": ["<text>"], "openItems": 0, "estimatedCloseDate": "<date>", "recommendations": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_close_risk`, prompt, 'You are a bank period-close manager. Respond only with valid JSON.', { riskScore: 20, riskLevel: 'low', blockers: [], openItems: stats.active, estimatedCloseDate: null, recommendations: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-8: suggest-adjusting-entries
router.post('/ai/suggest-adjusting-entries', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { periodCode, knownAccruals = [], prepaidAmounts = [] } = req.body;
    const prompt = `You are a bank accounting specialist. Suggest period-end adjusting entries for accruals, deferrals, and corrections.\n\nPeriod: ${periodCode}\nKnown accruals: ${JSON.stringify(knownAccruals)}\nPrepaid amounts: ${JSON.stringify(prepaidAmounts)}\n\nRespond with valid JSON:\n{"adjustingEntries": [{"type": "accrual|deferral|correction", "description": "<text>", "debitGl": "<code>", "creditGl": "<code>", "amount": 0, "rationale": "<text>"}], "totalAdjustments": 0, "materialityNotes": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_adjusting_entries`, prompt, 'You are a bank accounting specialist. Respond only with valid JSON.', { adjustingEntries: [], totalAdjustments: 0, materialityNotes: 'No adjusting entries suggested based on available data.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-9: detect-fraud-pattern
router.post('/ai/detect-fraud-pattern', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { entries = [] } = req.body;
    const prompt = `You are a forensic accountant specializing in bank fraud. Analyze these GL entries for patterns indicative of fraud, embezzlement, or financial manipulation.\n\nEntries: ${JSON.stringify(entries.slice(0, 50))}\n\nRespond with valid JSON:\n{"fraudScore": 0-100, "patterns": [{"pattern": "<text>", "severity": "low|medium|high", "affectedEntries": [], "explanation": "<text>"}], "overallRisk": "low|medium|high|critical", "investigationRecommended": false, "evidencePackage": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_fraud_pattern`, prompt, 'You are a forensic accountant. Respond only with valid JSON.', { fraudScore: 5, patterns: [], overallRisk: 'low', investigationRecommended: false, evidencePackage: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-10: summarize-variance
router.post('/ai/summarize-variance', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { actualEntries = [], budgetEntries = [] } = req.body;
    const prompt = `You are a bank financial analyst. Summarize variances between actual and budget GL entries and explain root causes.\n\nActual entries: ${JSON.stringify(actualEntries.slice(0, 20))}\nBudget entries: ${JSON.stringify(budgetEntries.slice(0, 20))}\n\nRespond with valid JSON:\n{"totalVariance": 0, "favorableVariance": 0, "unfavorableVariance": 0, "varianceByGl": [], "rootCauses": ["<text>"], "managementSummary": "<text>", "forecastAdjustment": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_variance`, prompt, 'You are a bank financial analyst. Respond only with valid JSON.', { totalVariance: 0, favorableVariance: 0, unfavorableVariance: 0, varianceByGl: [], rootCauses: [], managementSummary: 'Variance analysis requires actual and budget data.', forecastAdjustment: 'No adjustment needed.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-11: generate-audit-trail
router.post('/:id/ai/generate-audit-trail', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id);
    const prompt = `You are a bank internal auditor. Generate a comprehensive audit trail narrative for this ledger entry.\n\nEntry: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"auditTrail": [{"timestamp": "<date>", "event": "<text>", "user": "<text>", "changes": {}, "system": "<text>"}], "integrityCheck": "pass|fail", "completenessScore": 0-100, "anomalies": [], "narrative": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_audit_trail`, prompt, 'You are a bank internal auditor. Respond only with valid JSON.', { auditTrail: record ? [{ timestamp: record.createdAt, event: 'created', user: 'system', changes: {}, system: 'banking_ledger' }] : [], integrityCheck: 'pass', completenessScore: 70, anomalies: [], narrative: 'Audit trail generated from available data.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-12: suggest-allocation-rules
router.post('/ai/suggest-allocation-rules', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { costCenter, glCode, allocationBasis } = req.body;
    const prompt = `You are a bank management accounting specialist. Suggest cost allocation rules for this GL account or cost center.\n\nCost center: ${costCenter}\nGL code: ${glCode}\nBasis: ${allocationBasis}\n\nRespond with valid JSON:\n{"allocationRules": [{"ruleName": "<text>", "method": "headcount|revenue|usage|fixed", "driverBase": "<text>", "allocationPercentages": [], "rationale": "<text>"}], "recommendedMethod": "<text>", "implementationSteps": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_allocation_rules`, prompt, 'You are a management accounting specialist. Respond only with valid JSON.', { allocationRules: [], recommendedMethod: 'revenue', implementationSteps: ['Define cost pools', 'Identify drivers', 'Calculate rates'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-13: validate-cutoff
router.post('/ai/validate-cutoff', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { periodEnd, entries = [] } = req.body;
    const prompt = `You are a bank accounting controller. Validate revenue/expense cutoff for these entries around the period-end date.\n\nPeriod end: ${periodEnd}\nEntries: ${JSON.stringify(entries.slice(0, 30))}\n\nRespond with valid JSON:\n{"cutoffIssues": [], "totalMisstatement": 0, "direction": "overstatement|understatement|balanced", "affectedPeriods": [], "correctionEntries": [], "managementLetter": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_cutoff_validate`, prompt, 'You are a bank accounting controller. Respond only with valid JSON.', { cutoffIssues: [], totalMisstatement: 0, direction: 'balanced', affectedPeriods: [], correctionEntries: [], managementLetter: 'No cutoff issues identified.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-14: explain-balance-movement
router.post('/:id/ai/explain-balance-movement', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { priorBalance, currentBalance } = req.body;
    const prompt = `You are a bank financial analyst. Explain the movement in this GL account balance in plain language for management reporting.\n\nGL Entry: ${JSON.stringify(record)}\nPrior balance: ${priorBalance}\nCurrent balance: ${currentBalance}\nChange: ${currentBalance - priorBalance}\n\nRespond with valid JSON:\n{"explanation": "<text>", "changeAmount": 0, "changePercent": 0, "primaryDrivers": ["<text>"], "unusualItems": [], "trendAnalysis": "<text>", "managementNote": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_balance_movement`, prompt, 'You are a bank financial analyst. Respond only with valid JSON.', { explanation: 'Balance movement analysis requires additional data.', changeAmount: (currentBalance || 0) - (priorBalance || 0), changePercent: 0, primaryDrivers: [], unusualItems: [], trendAnalysis: 'Insufficient history for trend analysis.', managementNote: '' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-15: score-data-quality
router.post('/ai/score-data-quality', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { data: entries } = storeList(MODULE, { limit: 200 });
    const completeness = entries.filter(e => e.glCode && e.description && e.reference).length / Math.max(entries.length, 1);
    const prompt = `You are a bank data quality analyst. Score the overall quality of this GL data.\n\nSample entries: ${JSON.stringify(entries.slice(0, 20))}\nCompleteness rate: ${(completeness * 100).toFixed(1)}%\n\nRespond with valid JSON:\n{"overallScore": 0-100, "dimensions": {"completeness": 0, "accuracy": 0, "consistency": 0, "timeliness": 0}, "issues": ["<text>"], "recommendations": ["<text>"], "grade": "A|B|C|D|F"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_data_quality`, prompt, 'You are a data quality analyst. Respond only with valid JSON.', { overallScore: Math.round(completeness * 100), dimensions: { completeness: Math.round(completeness * 100), accuracy: 70, consistency: 80, timeliness: 75 }, issues: [], recommendations: [], grade: completeness > 0.9 ? 'A' : completeness > 0.7 ? 'B' : 'C' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-16: predict-month-end-load
router.post('/ai/predict-month-end-load', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { historicalVolumes = [] } = req.body;
    const stats = storeStats(MODULE);
    const prompt = `You are a bank IT capacity planner. Predict the month-end processing load for GL systems based on historical patterns.\n\nHistorical volumes: ${JSON.stringify(historicalVolumes)}\nCurrent stats: ${JSON.stringify(stats)}\n\nRespond with valid JSON:\n{"predictedEntryVolume": 0, "predictedPeakHour": "<text>", "estimatedProcessingTime": "<text>", "resourceRequirements": {"cpu": "<text>", "memory": "<text>", "storage": "<text>"}, "bottlenecks": ["<text>"], "recommendations": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_month_end_load`, prompt, 'You are a bank IT capacity planner. Respond only with valid JSON.', { predictedEntryVolume: stats.active * 3, predictedPeakHour: '17:00-19:00 last business day', estimatedProcessingTime: '2-4 hours', resourceRequirements: { cpu: 'Standard', memory: 'Standard', storage: 'Standard' }, bottlenecks: [], recommendations: ['Pre-stage reports', 'Increase batch size'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

module.exports = router;
