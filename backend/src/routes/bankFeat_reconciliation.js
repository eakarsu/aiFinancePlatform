/**
 * Core Banking — Reconciliation Route
 * Module: reconciliation
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

const MODULE = 'banking_reconciliation';
const auth = authenticateToken;

// ── CRUD ─────────────────────────────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const { page, limit, status, reconType, accountId } = req.query;
  res.json(storeList(MODULE, { page, limit, filter: { status, reconType, accountId } }));
});

router.get('/:id', auth, (req, res) => {
  const r = storeGet(MODULE, req.params.id);
  if (!r) return res.status(404).json({ error: 'Reconciliation record not found' });
  res.json({ data: r, auditLog: [{ event: 'read', at: new Date().toISOString(), by: req.user.id }] });
});

router.post('/', auth, (req, res) => {
  const { reconDate, reconType, accountId, glBalance, statementBalance } = req.body;
  if (!reconDate || !reconType || !accountId) return res.status(400).json({ error: 'reconDate, reconType, accountId required' });
  const gl = parseFloat(glBalance || 0);
  const stmt = parseFloat(statementBalance || 0);
  const r = storeCreate(MODULE, { reconDate, reconType, accountId, glBalance: gl, statementBalance: stmt, difference: parseFloat((gl - stmt).toFixed(2)), status: 'Open', unresolvedItems: 0, resolvedItems: 0, suspenseAmount: 0 });
  res.status(201).json(r);
});

router.patch('/:id', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, req.body);
  if (!r) return res.status(404).json({ error: 'Reconciliation record not found' });
  res.json(r);
});

router.delete('/:id', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, { status: 'Closed' });
  if (!r) return res.status(404).json({ error: 'Reconciliation record not found' });
  res.json({ message: 'Reconciliation closed', data: r });
});

router.get('/by-account/:accountId', auth, (req, res) => {
  res.json(storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { accountId: req.params.accountId } }));
});

router.get('/by-type/:reconType', auth, (req, res) => {
  res.json(storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { reconType: req.params.reconType } }));
});

router.post('/batch', auth, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items[] required' });
  const r = storeBatchCreate(MODULE, items.map(i => ({ ...i, status: i.status || 'Open', difference: parseFloat(((parseFloat(i.glBalance || 0)) - parseFloat(i.statementBalance || 0)).toFixed(2)) })));
  res.status(201).json({ created: r.length, data: r });
});

router.patch('/batch', auth, (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates[] required' });
  const r = storeBatchUpdate(MODULE, updates);
  res.json({ updated: r.length, data: r });
});

router.post('/batch-delete', auth, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids[] required' });
  res.json({ deleted: storeBatchDelete(MODULE, ids).length });
});

router.get('/meta/count', auth, (req, res) => res.json({ count: storeCount(MODULE, req.query) }));
router.get('/meta/search', auth, (req, res) => res.json({ data: storeSearch(MODULE, req.query.q) }));

router.post('/:id/archive', auth, (req, res) => {
  const r = storeArchive(MODULE, req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Archived', data: r });
});

router.post('/:id/restore', auth, (req, res) => {
  const r = storeRestore(MODULE, req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Restored', data: r });
});

router.get('/:id/history', auth, (req, res) => res.json({ data: storeHistory(MODULE, req.params.id) }));

router.get('/meta/export-csv', auth, (req, res) => {
  const { data } = storeList(MODULE, { limit: 10000 });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="reconciliation.csv"');
  res.send(exportCsv(data));
});

router.post('/meta/import-csv', auth, (req, res) => {
  if (!req.body.csv) return res.status(400).json({ error: 'csv required' });
  const r = importCsvRows(req.body.csv, MODULE);
  res.status(201).json({ imported: r.length, data: r });
});

router.get('/meta/stats', auth, (req, res) => {
  const { data } = storeList(MODULE, { limit: 10000 });
  const openCount = data.filter(r => r.status === 'Open' || r.status === 'ExceptionOpen').length;
  const totalDiff = data.reduce((s, r) => s + Math.abs(parseFloat(r.difference || 0)), 0);
  res.json({ ...storeStats(MODULE), openCount, totalUnresolvedDifference: parseFloat(totalDiff.toFixed(2)) });
});

// ── AI VERBS ─────────────────────────────────────────────────────────────────
router.post('/:id/ai/detect-out-of-balance', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const diff = parseFloat(record.difference || 0);
    const prompt = `You are a bank reconciliation specialist. Analyze this reconciliation and detect out-of-balance conditions.\n\nRecord: ${JSON.stringify(record)}\nDifference: ${diff}\n\nRespond with valid JSON:\n{"outOfBalance": ${Math.abs(diff) > 0.01}, "difference": ${diff}, "severity": "${Math.abs(diff) > 10000 ? 'high' : Math.abs(diff) > 1000 ? 'medium' : 'low'}", "likelyCauses": ["<text>"], "urgency": "routine|priority|immediate", "escalationRequired": ${Math.abs(diff) > 100000}}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_out_of_balance`, prompt, 'You are a bank reconciliation specialist. Respond only with valid JSON.', { outOfBalance: Math.abs(diff) > 0.01, difference: diff, severity: Math.abs(diff) > 10000 ? 'high' : Math.abs(diff) > 1000 ? 'medium' : 'low', likelyCauses: Math.abs(diff) > 0 ? ['Timing differences', 'Missing entries', 'Data entry errors'] : ['None — balanced'], urgency: Math.abs(diff) > 10000 ? 'immediate' : Math.abs(diff) > 0 ? 'priority' : 'routine', escalationRequired: Math.abs(diff) > 100000 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/suggest-clearing-entry', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const diff = parseFloat(record.difference || 0);
    const prompt = `You are a bank accounting specialist. Suggest the clearing journal entry to resolve this reconciliation difference.\n\nRecord: ${JSON.stringify(record)}\nDifference: ${diff}\n\nRespond with valid JSON:\n{"clearingEntry": {"debitGl": "<code>", "creditGl": "<code>", "amount": ${Math.abs(diff)}, "description": "<text>"}, "approvalRequired": ${Math.abs(diff) > 10000}, "materialityAssessment": "<text>", "alternativeApproaches": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_clearing_entry`, prompt, 'You are a bank accounting specialist. Respond only with valid JSON.', { clearingEntry: { debitGl: diff > 0 ? '19999' : '20000', creditGl: diff > 0 ? '20000' : '19999', amount: Math.abs(diff), description: `Reconciling entry for ${record.reconType} — ${record.reconDate}` }, approvalRequired: Math.abs(diff) > 10000, materialityAssessment: Math.abs(diff) < 100 ? 'Immaterial — standard clearing' : `Material difference of ${diff} requires investigation`, alternativeApproaches: ['Identify and correct underlying transactions', 'Post to suspense pending investigation'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/classify-suspense-item', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { suspenseItem = {} } = req.body;
    const prompt = `You are a bank operations analyst. Classify this suspense account item and recommend a resolution path.\n\nSuspense item: ${JSON.stringify(suspenseItem)}\n\nRespond with valid JSON:\n{"classification": "<text>", "rootCause": "<text>", "resolutionPath": "<text>", "priority": "high|medium|low", "agingBucket": "<text>", "writeOffCandidate": false, "estimatedResolutionDays": 0}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_suspense_classify`, prompt, 'You are a bank operations analyst. Respond only with valid JSON.', { classification: suspenseItem.type || 'Unidentified', rootCause: 'Classification requires investigation', resolutionPath: 'Research underlying transactions and post to correct GL', priority: 'medium', agingBucket: '0-30 days', writeOffCandidate: false, estimatedResolutionDays: 5 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/predict-resolution-time', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const diff = parseFloat(record.difference || 0);
    const prompt = `You are a bank operations manager. Predict how long it will take to resolve this reconciliation exception.\n\nRecord: ${JSON.stringify(record)}\nDifference: ${diff}\n\nRespond with valid JSON:\n{"predictedResolutionDays": 0, "confidenceRange": {"min": 0, "max": 0}, "bottlenecks": ["<text>"], "accelerationOptions": ["<text>"], "slaStatus": "within-sla|at-risk|breached"}`;
    const days = Math.abs(diff) > 100000 ? 10 : Math.abs(diff) > 10000 ? 5 : Math.abs(diff) > 0 ? 2 : 0;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_resolution_time`, prompt, 'You are a bank operations manager. Respond only with valid JSON.', { predictedResolutionDays: days, confidenceRange: { min: Math.max(0, days - 1), max: days + 2 }, bottlenecks: days > 5 ? ['Documentation gathering', 'Approval workflow'] : [], accelerationOptions: ['Escalate to senior analyst', 'Request direct general ledger access'], slaStatus: days <= 2 ? 'within-sla' : days <= 5 ? 'at-risk' : 'breached' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/generate-recon-narrative', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank reconciliation specialist. Write a professional reconciliation narrative for management reporting.\n\nRecord: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"narrative": "<text>", "executiveSummary": "<text>", "openItems": [], "reconconclusion": "<text>", "nextActions": ["<text>"], "preparedBy": "AI-Assisted", "reviewDate": "<date>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_narrative`, prompt, 'You are a reconciliation specialist. Respond only with valid JSON.', { narrative: `${record.reconType} reconciliation for account ${record.accountId} as of ${record.reconDate}. GL balance: $${record.glBalance || 0}. Statement balance: $${record.statementBalance || 0}. Difference: $${record.difference || 0}. Status: ${record.status}.`, executiveSummary: Math.abs(parseFloat(record.difference || 0)) < 0.01 ? 'Account is fully reconciled with no outstanding differences.' : `Outstanding difference of $${record.difference} requires investigation.`, openItems: [], reconconclusion: record.status === 'Reconciled' ? 'Reconciliation complete.' : 'Reconciliation open — pending resolution.', nextActions: record.status !== 'Reconciled' ? ['Investigate difference', 'Post clearing entries'] : ['Archive reconciliation'], preparedBy: 'AI-Assisted', reviewDate: new Date().toISOString().slice(0, 10) });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/summarize-exceptions', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { data } = storeList(MODULE, { limit: 1000, filter: { status: 'ExceptionOpen' } });
    const totalDiff = data.reduce((s, r) => s + Math.abs(parseFloat(r.difference || 0)), 0);
    const prompt = `You are a bank operations manager. Summarize open reconciliation exceptions for management.\n\nOpen exceptions: ${data.length}\nTotal unresolved amount: ${totalDiff}\n\nRespond with valid JSON:\n{"summary": "<text>", "exceptionCount": ${data.length}, "totalAmount": ${totalDiff}, "agingBreakdown": {}, "topIssues": ["<text>"], "riskAssessment": "<text>", "recommendedActions": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_exception_summary`, prompt, 'You are a bank operations manager. Respond only with valid JSON.', { summary: `${data.length} open exceptions totaling $${totalDiff.toFixed(2)}`, exceptionCount: data.length, totalAmount: parseFloat(totalDiff.toFixed(2)), agingBreakdown: { '0-7 days': data.length, '8-30 days': 0, '30+ days': 0 }, topIssues: data.length > 0 ? ['Timing differences', 'Unposted transactions'] : [], riskAssessment: totalDiff > 100000 ? 'High — material exceptions outstanding' : totalDiff > 0 ? 'Medium — exceptions being investigated' : 'Low — fully reconciled', recommendedActions: data.length > 0 ? ['Assign exceptions to analysts', 'Review daily', 'Escalate aged items'] : ['Maintain current controls'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/score-recon-quality', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { data } = storeList(MODULE, { limit: 1000 });
    const reconciledCount = data.filter(r => r.status === 'Reconciled').length;
    const qualityScore = data.length ? Math.round((reconciledCount / data.length) * 100) : 100;
    const prompt = `You are a bank internal audit manager. Score the quality of the reconciliation program.\n\nTotal records: ${data.length}\nReconciled: ${reconciledCount}\nQuality score: ${qualityScore}%\n\nRespond with valid JSON:\n{"qualityScore": ${qualityScore}, "grade": "${qualityScore >= 90 ? 'A' : qualityScore >= 75 ? 'B' : qualityScore >= 60 ? 'C' : 'D'}", "dimensions": {}, "deficiencies": [], "bestPractices": ["<text>"], "auditRating": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_quality_score`, prompt, 'You are a bank internal audit manager. Respond only with valid JSON.', { qualityScore, grade: qualityScore >= 90 ? 'A' : qualityScore >= 75 ? 'B' : qualityScore >= 60 ? 'C' : 'D', dimensions: { timeliness: qualityScore, completeness: qualityScore, accuracy: qualityScore, documentation: Math.max(0, qualityScore - 10) }, deficiencies: qualityScore < 90 ? ['Not all accounts reconciled within SLA'] : [], bestPractices: ['Reconcile daily for high-risk accounts', 'Document all exceptions', 'Dual approval for clearing entries', 'Monthly management review'], auditRating: qualityScore >= 90 ? 'Satisfactory' : qualityScore >= 75 ? 'Needs Improvement' : 'Unsatisfactory' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/recommend-write-off', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const diff = parseFloat(record.difference || 0);
    const prompt = `You are a bank operations controller. Assess whether the difference in this reconciliation should be written off.\n\nRecord: ${JSON.stringify(record)}\nDifference: ${diff}\n\nRespond with valid JSON:\n{"writeOffRecommended": false, "writeOffAmount": 0, "basis": "<text>", "approvalLevel": "<text>", "glAccounts": {"debit": "<code>", "credit": "<code>"}, "regulatoryConsiderations": "<text>", "conditions": ["<text>"]}`;
    const writeOff = Math.abs(diff) > 0 && Math.abs(diff) < 100;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_write_off`, prompt, 'You are a bank operations controller. Respond only with valid JSON.', { writeOffRecommended: writeOff, writeOffAmount: writeOff ? Math.abs(diff) : 0, basis: writeOff ? 'Immaterial amount below write-off threshold' : Math.abs(diff) >= 100 ? 'Amount exceeds write-off threshold — investigation required' : 'Account is balanced', approvalLevel: Math.abs(diff) < 100 ? 'Operations Manager' : 'Controller', glAccounts: { debit: diff < 0 ? '59999' : '19999', credit: diff < 0 ? '19999' : '59999' }, regulatoryConsiderations: 'Ensure write-off aligns with bank policy and audit requirements', conditions: writeOff ? ['Amount must be below $100', 'Investigation must be documented', 'Manager approval required'] : [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/detect-timing-difference', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { transactions = [] } = req.body;
    const prompt = `You are a bank reconciliation analyst. Identify timing differences that explain the reconciling discrepancy.\n\nRecord: ${JSON.stringify(record)}\nTransactions: ${JSON.stringify(transactions.slice(0, 20))}\n\nRespond with valid JSON:\n{"timingDifferences": [{"description": "<text>", "amount": 0, "expectedClearDate": "<date>"}], "totalTimingAmount": 0, "residualDifference": 0, "clearanceExpected": "<text>"}`;
    const diff = parseFloat(record.difference || 0);
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_timing_diff`, prompt, 'You are a bank reconciliation analyst. Respond only with valid JSON.', { timingDifferences: transactions.length > 0 ? [{ description: 'Transactions in transit', amount: diff, expectedClearDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) }] : [], totalTimingAmount: transactions.length > 0 ? diff : 0, residualDifference: transactions.length > 0 ? 0 : diff, clearanceExpected: transactions.length > 0 ? '1-2 business days' : 'Unknown — requires investigation' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/validate-recon-completeness', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank internal auditor. Validate the completeness of this reconciliation.\n\nRecord: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"completenessScore": 0-100, "missingElements": ["<text>"], "documentationComplete": true, "signaturesRequired": [], "supportingSchedulesReview": "<text>", "auditTrailComplete": true, "passesQaReview": true}`;
    const score = [record.glBalance !== undefined, record.statementBalance !== undefined, record.reconDate, record.status].filter(Boolean).length * 25;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_completeness`, prompt, 'You are a bank internal auditor. Respond only with valid JSON.', { completenessScore: score, missingElements: [!record.preparedBy ? 'Preparer not recorded' : null, !record.reviewedBy ? 'Reviewer signature missing' : null].filter(Boolean), documentationComplete: score >= 75, signaturesRequired: ['Preparer', 'Reviewer', record.difference > 10000 ? 'Approver' : null].filter(Boolean), supportingSchedulesReview: 'Attach transaction listing and exception schedules', auditTrailComplete: !!record.createdAt, passesQaReview: score >= 75 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/suggest-control-improvement', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { currentControls = [], auditFindings = [] } = req.body;
    const prompt = `You are a bank internal controls specialist. Suggest improvements to the reconciliation control environment.\n\nCurrent controls: ${JSON.stringify(currentControls)}\nAudit findings: ${JSON.stringify(auditFindings)}\n\nRespond with valid JSON:\n{"improvements": [{"control": "<text>", "gap": "<text>", "recommendation": "<text>", "priority": "high|medium|low", "estimatedCost": "<text>"}], "keyRiskAreas": ["<text>"], "bestPractices": ["<text>"], "maturityLevel": "initial|developing|defined|managed|optimized"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_control_improvement`, prompt, 'You are a bank internal controls specialist. Respond only with valid JSON.', { improvements: [{ control: 'Reconciliation Timeliness', gap: 'No automated alerts for aged items', recommendation: 'Implement automated escalation for items >5 days', priority: 'high', estimatedCost: 'Low — configuration only' }, { control: 'Exception Documentation', gap: 'Manual narrative creation', recommendation: 'AI-assisted narrative generation (already implemented)', priority: 'medium', estimatedCost: 'Already available' }], keyRiskAreas: ['Suspense account aging', 'High-volume period-end items', 'Manual override tracking'], bestPractices: ['Daily reconciliation for high-risk accounts', 'Automated matching rules', 'Real-time dashboards for management'], maturityLevel: 'developing' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/generate-management-report', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { period = 'monthly', asOfDate } = req.body;
    const { data } = storeList(MODULE, { limit: 10000 });
    const open = data.filter(r => r.status !== 'Reconciled' && r.status !== 'Closed').length;
    const totalDiff = data.reduce((s, r) => s + Math.abs(parseFloat(r.difference || 0)), 0);
    const prompt = `You are a bank operations manager. Generate an executive reconciliation summary report.\n\nPeriod: ${period}\nAs of: ${asOfDate}\nTotal records: ${data.length}\nOpen items: ${open}\nTotal unresolved: ${totalDiff}\n\nRespond with valid JSON:\n{"reportTitle": "<text>", "executiveSummary": "<text>", "kpis": [], "statusBreakdown": {}, "riskHighlights": [], "actionItems": [], "nextSteps": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_mgmt_report`, prompt, 'You are a bank operations manager. Respond only with valid JSON.', { reportTitle: `Reconciliation Management Report — ${period} — ${asOfDate || new Date().toISOString().slice(0, 10)}`, executiveSummary: `Total ${data.length} reconciliations reviewed. ${open} open items with $${totalDiff.toFixed(2)} unresolved.`, kpis: [{ metric: 'Open Items', value: open }, { metric: 'Total Unresolved Amount', value: `$${totalDiff.toFixed(2)}` }, { metric: 'Completion Rate', value: `${data.length ? ((data.length - open) / data.length * 100).toFixed(1) : 100}%` }], statusBreakdown: {}, riskHighlights: totalDiff > 100000 ? ['Material unresolved amounts — management attention required'] : [], actionItems: open > 0 ? [`Resolve ${open} open reconciliation items`] : [], nextSteps: ['Review open items daily', 'Distribute report to operations leadership'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/predict-month-end-issues', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { daysToMonthEnd } = req.body;
    const { data } = storeList(MODULE, { limit: 1000 });
    const openCount = data.filter(r => r.status !== 'Reconciled').length;
    const prompt = `You are a bank operations planning analyst. Predict month-end reconciliation issues.\n\nDays to month end: ${daysToMonthEnd}\nCurrently open: ${openCount}\nTotal recon records: ${data.length}\n\nRespond with valid JSON:\n{"predictedIssues": ["<text>"], "riskScore": 0-100, "workloadEstimate": "<text>", "staffingRecommendation": "<text>", "criticalDeadlines": ["<text>"], "proactiveActions": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_month_end_predict`, prompt, 'You are a bank operations planning analyst. Respond only with valid JSON.', { predictedIssues: openCount > 5 ? ['Open items may not clear before month-end', 'Potential need for overtime resources'] : [], riskScore: Math.min(100, openCount * 5 + (5 - (daysToMonthEnd || 5)) * 10), workloadEstimate: `${data.length} reconciliations, ${openCount} currently open`, staffingRecommendation: openCount > 10 ? 'Consider additional temporary staff for month-end' : 'Standard staffing sufficient', criticalDeadlines: [`T-2: All daily recons complete`, `T-1: Review exceptions`, `T-0: Close and sign off`], proactiveActions: ['Resolve aged items before month-end', 'Pre-post known adjustments', 'Brief management on open items'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/classify-exception-root-cause', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank root cause analysis specialist. Classify the root cause of this reconciliation exception.\n\nRecord: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"rootCause": "<text>", "category": "system|human|process|external", "recurrenceRisk": "low|medium|high", "preventionMeasures": ["<text>"], "systemFix": "<text>", "processFix": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_root_cause`, prompt, 'You are a bank root cause analysis specialist. Respond only with valid JSON.', { rootCause: record.difference !== 0 ? 'Unidentified — investigation required' : 'No exception present', category: 'process', recurrenceRisk: 'medium', preventionMeasures: ['Implement automated matching', 'Daily exception review', 'Root cause tracking'], systemFix: 'Review transaction processing for timing issues', processFix: 'Establish daily cut-off procedures and documentation standards' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/summarize-aging-buckets', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { data } = storeList(MODULE, { limit: 10000 });
    const now = Date.now();
    const buckets = { '0-7': 0, '8-30': 0, '31-60': 0, '60+': 0 };
    data.filter(r => r.status !== 'Reconciled').forEach(r => {
      const age = Math.floor((now - new Date(r.createdAt).getTime()) / 86400000);
      if (age <= 7) buckets['0-7']++;
      else if (age <= 30) buckets['8-30']++;
      else if (age <= 60) buckets['31-60']++;
      else buckets['60+']++;
    });
    const prompt = `You are a bank operations analyst. Analyze the aging of open reconciliation items.\n\nAging buckets: ${JSON.stringify(buckets)}\n\nRespond with valid JSON:\n{"agingBuckets": ${JSON.stringify(buckets)}, "criticalItems": ${buckets['60+'] + buckets['31-60']}, "overallHealth": "${buckets['60+'] > 0 ? 'poor' : buckets['31-60'] > 0 ? 'fair' : 'good'}", "ageWeightedRisk": 0-100, "recommendations": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_aging_buckets`, prompt, 'You are a bank operations analyst. Respond only with valid JSON.', { agingBuckets: buckets, criticalItems: buckets['60+'] + buckets['31-60'], overallHealth: buckets['60+'] > 0 ? 'poor' : buckets['31-60'] > 0 ? 'fair' : 'good', ageWeightedRisk: Math.min(100, buckets['60+'] * 20 + buckets['31-60'] * 10 + buckets['8-30'] * 5), recommendations: buckets['60+'] > 0 ? ['Escalate items aged 60+ days immediately', 'Management review required'] : buckets['31-60'] > 0 ? ['Assign senior analyst to 30+ day items'] : ['Maintain current resolution pace'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/explain-variance', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank finance analyst. Explain the variance in this reconciliation in plain language suitable for management presentation.\n\nRecord: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"explanation": "<text>", "varianceAmount": 0, "direction": "favorable|unfavorable", "businessImpact": "<text>", "managementNote": "<text>", "nextActions": ["<text>"]}`;
    const diff = parseFloat(record.difference || 0);
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_variance_explain`, prompt, 'You are a bank finance analyst. Respond only with valid JSON.', { explanation: diff === 0 ? 'The account is fully reconciled with no outstanding variance.' : `GL balance exceeds statement balance by $${Math.abs(diff).toFixed(2)}. This may indicate ${diff > 0 ? 'unposted debit transactions or duplicate credits' : 'unposted credit transactions or duplicate debits'}.`, varianceAmount: Math.abs(diff), direction: diff > 0 ? 'unfavorable' : diff < 0 ? 'favorable' : 'balanced', businessImpact: diff === 0 ? 'None — account reconciled' : `$${Math.abs(diff).toFixed(2)} unresolved may affect reported balances`, managementNote: diff === 0 ? 'No action required.' : 'Investigation underway — see exception log.', nextActions: diff !== 0 ? ['Review transaction listing', 'Identify unposted items', 'Post correcting entries'] : ['Archive reconciliation record'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

module.exports = router;
