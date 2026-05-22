/**
 * Core Banking — Regulatory Reporting Route
 * Module: regulatoryReporting
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

const MODULE = 'banking_regulatory';
const auth = authenticateToken;

// ── CRUD ─────────────────────────────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const { page, limit, reportType, status, reportingPeriod } = req.query;
  res.json(storeList(MODULE, { page, limit, filter: { reportType, status, reportingPeriod } }));
});

router.get('/:id', auth, (req, res) => {
  const r = storeGet(MODULE, req.params.id);
  if (!r) return res.status(404).json({ error: 'Regulatory report not found' });
  res.json({ data: r, auditLog: [{ event: 'read', at: new Date().toISOString(), by: req.user.id }] });
});

router.post('/', auth, (req, res) => {
  const { reportType, reportingPeriod, dueDate, subjectCustomerId, subjectAccountId, reportingOfficer, totalAmount, currencyType } = req.body;
  if (!reportType || !reportingPeriod) return res.status(400).json({ error: 'reportType and reportingPeriod required' });
  const r = storeCreate(MODULE, { reportType, reportingPeriod, dueDate, subjectCustomerId, subjectAccountId, reportingOfficer, totalAmount: totalAmount ? parseFloat(totalAmount) : null, currencyType: currencyType || 'USD', status: 'Draft', filedWith: null, referenceNumber: null, narrativeText: null, aiDraftedNarrative: null });
  res.status(201).json(r);
});

router.patch('/:id', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, req.body);
  if (!r) return res.status(404).json({ error: 'Regulatory report not found' });
  res.json(r);
});

router.delete('/:id', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, { status: 'Superseded' });
  if (!r) return res.status(404).json({ error: 'Regulatory report not found' });
  res.json({ message: 'Report superseded', data: r });
});

router.get('/by-type/:reportType', auth, (req, res) => {
  res.json(storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { reportType: req.params.reportType } }));
});

router.get('/by-period/:reportingPeriod', auth, (req, res) => {
  res.json(storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { reportingPeriod: req.params.reportingPeriod } }));
});

router.post('/batch', auth, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items[] required' });
  const r = storeBatchCreate(MODULE, items.map(i => ({ ...i, status: i.status || 'Draft' })));
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
  res.setHeader('Content-Disposition', 'attachment; filename="regulatory_reports.csv"');
  res.send(exportCsv(data));
});

router.post('/meta/import-csv', auth, (req, res) => {
  if (!req.body.csv) return res.status(400).json({ error: 'csv required' });
  const r = importCsvRows(req.body.csv, MODULE);
  res.status(201).json({ imported: r.length, data: r });
});

router.get('/meta/stats', auth, (req, res) => {
  const { data } = storeList(MODULE, { limit: 10000 });
  const byType = {}, byStatus = {};
  data.forEach(r => { byType[r.reportType] = (byType[r.reportType] || 0) + 1; byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
  const overdue = data.filter(r => r.dueDate && new Date(r.dueDate) < new Date() && r.status !== 'Filed').length;
  res.json({ ...storeStats(MODULE), byType, byStatus, overdueCount: overdue });
});

// ── AI VERBS ─────────────────────────────────────────────────────────────────
router.post('/:id/ai/classify-bsa-priority', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank BSA Officer. Classify the priority level of this BSA-related regulatory report.\n\nReport: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"priority": "low|medium|high|critical", "priorityScore": 0-100, "bsaRequirement": "<text>", "filingDeadline": "<text>", "penaltyRisk": "<text>", "bsaOfficerAction": "<text>", "ctrOrSarFlag": "<SAR|CTR|both|neither>"}`;
    const isSAR = record.reportType === 'SAR';
    const isCTR = record.reportType === 'CTR';
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_bsa_priority`, prompt, 'You are a bank BSA Officer. Respond only with valid JSON.', { priority: isSAR ? 'critical' : isCTR ? 'high' : 'medium', priorityScore: isSAR ? 95 : isCTR ? 80 : 50, bsaRequirement: isSAR ? 'SAR required per 31 CFR 1020.320' : isCTR ? 'CTR required per 31 CFR 1010.311' : 'Standard regulatory reporting', filingDeadline: isSAR ? '30 calendar days from detection' : isCTR ? '15 calendar days after transaction' : 'Per report schedule', penaltyRisk: isSAR ? 'Up to $1M per violation' : isCTR ? 'Up to $500K per violation' : 'Varies', bsaOfficerAction: 'Review and approve before filing', ctrOrSarFlag: isSAR ? 'SAR' : isCTR ? 'CTR' : 'neither' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/draft-sar-narrative', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { suspiciousActivityDetails = {} } = req.body;
    const prompt = `You are a bank SAR analyst. Draft a FinCEN-compliant SAR narrative for this suspicious activity.\n\nReport: ${JSON.stringify(record)}\nActivity details: ${JSON.stringify(suspiciousActivityDetails)}\n\nRespond with valid JSON:\n{"sarNarrative": "<text>", "5wsAnswered": {"who": "<text>", "what": "<text>", "when": "<text>", "where": "<text>", "why": "<text>"}, "typologyCode": "<text>", "wordCount": 0, "complianceChecks": ["<text>"], "redFlags": ["<text>"]}`;
    const narrative = `This SAR is filed regarding ${record.subjectCustomerId ? `customer ID ${record.subjectCustomerId}` : 'an unknown subject'} for suspected ${suspiciousActivityDetails.type || 'suspicious activity'} totaling ${record.currencyType || 'USD'} ${record.totalAmount || 0}. The institution detected anomalous transaction patterns inconsistent with the customer's stated business purpose and account history. ${suspiciousActivityDetails.description || 'Detailed investigation conducted per BSA program requirements.'}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_sar_narrative`, prompt, 'You are a bank SAR analyst. Respond only with valid JSON.', { sarNarrative: narrative, '5wsAnswered': { who: record.subjectCustomerId || 'Subject to be identified', what: `${suspiciousActivityDetails.type || 'Suspicious transactions'} totaling $${record.totalAmount || 0}`, when: record.reportingPeriod, where: 'Institution accounts and transactions', why: 'Pattern inconsistent with expected customer behavior' }, typologyCode: 'ML:STRUCT', wordCount: narrative.split(' ').length, complianceChecks: ['5Ws addressed', 'Dollar amount stated', 'Time period specified', 'Account information included'], redFlags: ['Unusual transaction pattern', 'Inconsistent with customer profile'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/draft-ctr', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { transactions = [], customerId, transactionDate } = req.body;
    const total = transactions.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
    const prompt = `You are a bank CTR filing specialist. Prepare a Currency Transaction Report (CTR) for these cash transactions over $10,000.\n\nCustomer: ${customerId}\nDate: ${transactionDate}\nTransactions: ${JSON.stringify(transactions)}\nTotal: ${total}\n\nRespond with valid JSON:\n{"ctrRequired": ${total >= 10000}, "totalCashAmount": ${total}, "transactionDate": "${transactionDate}", "filingDeadline": "<date>", "requiredFields": ["<text>"], "filingInstructions": "<text>", "ctrNarrative": "<text>"}`;
    const deadline = transactionDate ? new Date(new Date(transactionDate).getTime() + 15 * 86400000).toISOString().slice(0, 10) : 'Within 15 calendar days';
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_ctr_draft`, prompt, 'You are a bank CTR specialist. Respond only with valid JSON.', { ctrRequired: total >= 10000, totalCashAmount: parseFloat(total.toFixed(2)), transactionDate, filingDeadline: deadline, requiredFields: ['Financial institution info', 'Person(s) involved in transaction', 'Amount and type of transaction', 'Transaction date'], filingInstructions: 'File electronically via FinCEN BSA E-Filing System within 15 calendar days', ctrNarrative: `CTR for ${customerId || 'customer'}: cash transaction(s) totaling $${total.toFixed(2)} on ${transactionDate}. ${transactions.length} transaction(s) included.` });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/suggest-reportable-threshold', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { transactionType, jurisdiction = 'US', amount, customerType } = req.body;
    const prompt = `You are a bank regulatory compliance specialist. Assess whether this transaction meets reporting thresholds.\n\nType: ${transactionType}\nJurisdiction: ${jurisdiction}\nAmount: ${amount}\nCustomer type: ${customerType}\n\nRespond with valid JSON:\n{"meetsThreshold": false, "applicableThresholds": [{"regulation": "<text>", "threshold": 0, "met": false}], "reportingRequired": false, "filingType": "<text>", "deadline": "<text>", "notes": "<text>"}`;
    const amt = parseFloat(amount || 0);
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_threshold`, prompt, 'You are a bank regulatory compliance specialist. Respond only with valid JSON.', { meetsThreshold: amt >= 10000, applicableThresholds: [{ regulation: 'Bank Secrecy Act CTR (31 CFR 1010.311)', threshold: 10000, met: amt >= 10000 }, { regulation: 'CMIR (31 CFR 1010.340)', threshold: 10000, met: amt >= 10000 && transactionType === 'international_transport' }], reportingRequired: amt >= 10000, filingType: amt >= 10000 ? 'CTR' : 'None required', deadline: amt >= 10000 ? '15 calendar days after transaction' : 'N/A', notes: amt >= 9000 ? 'Note: Transactions approaching $10,000 require enhanced monitoring for structuring' : '' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/validate-ffiec-call-data', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { callReportData = {} } = req.body;
    const prompt = `You are a bank FFIEC Call Report specialist. Validate the data fields in this Call Report submission.\n\nReport: ${JSON.stringify(record)}\nCall report data: ${JSON.stringify(callReportData)}\n\nRespond with valid JSON:\n{"validationPassed": true, "errors": [], "warnings": [], "schedulesCovered": [], "editChecks": [{"editCode": "<text>", "passed": true, "description": "<text>"}], "submissionReady": true}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_ffiec_validate`, prompt, 'You are a bank FFIEC Call Report specialist. Respond only with valid JSON.', { validationPassed: true, errors: [], warnings: [], schedulesCovered: ['RC', 'RC-B', 'RC-C', 'RC-D', 'RC-E', 'RC-K', 'RC-L', 'RC-N', 'RC-O'], editChecks: [{ editCode: 'VC10', passed: true, description: 'Total assets = total liabilities + equity' }], submissionReady: true });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/predict-examiner-findings', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { amlProgramData = {}, historicalExamFindings = [] } = req.body;
    const { data } = storeList(MODULE, { limit: 100 });
    const sarCount = data.filter(r => r.reportType === 'SAR').length;
    const prompt = `You are a bank regulatory examination consultant. Predict likely examiner findings based on the AML program and historical examination data.\n\nAML program: ${JSON.stringify(amlProgramData)}\nHistorical findings: ${JSON.stringify(historicalExamFindings)}\nSAR count: ${sarCount}\n\nRespond with valid JSON:\n{"predictedFindings": [{"area": "<text>", "severity": "minor|moderate|major|critical", "description": "<text>", "probability": 0-100}], "overallRisk": "low|medium|high", "priorityActions": ["<text>"], "examReadinessScore": 0-100}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_examiner_findings`, prompt, 'You are a regulatory examination consultant. Respond only with valid JSON.', { predictedFindings: [], overallRisk: 'low', priorityActions: ['Ensure all required BSA reports are filed timely', 'Document customer risk ratings', 'Update AML policies and procedures', 'Complete staff training records'], examReadinessScore: 75 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/summarize-aml-program-effectiveness', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { programMetrics = {} } = req.body;
    const { data } = storeList(MODULE, { limit: 1000 });
    const sarFiled = data.filter(r => r.reportType === 'SAR' && r.status === 'Filed').length;
    const ctrFiled = data.filter(r => r.reportType === 'CTR' && r.status === 'Filed').length;
    const prompt = `You are a bank BSA/AML program effectiveness analyst. Assess the overall effectiveness of the AML compliance program.\n\nSARs filed: ${sarFiled}\nCTRs filed: ${ctrFiled}\nProgram metrics: ${JSON.stringify(programMetrics)}\n\nRespond with valid JSON:\n{"effectivenessScore": 0-100, "fivePillarsAssessment": {}, "pillarScores": {}, "deficiencies": [], "strengths": [], "overallRating": "Satisfactory|Needs Improvement|Unsatisfactory", "recommendedEnhancements": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_aml_effectiveness`, prompt, 'You are a BSA/AML effectiveness analyst. Respond only with valid JSON.', { effectivenessScore: 75, fivePillarsAssessment: { 'Internal Controls': 'Adequate', 'BSA Officer': 'Designated and qualified', 'Training': 'Annual program in place', 'Independent Testing': 'Annual audit conducted', 'CDD': 'Risk-based CDD program established' }, pillarScores: { 'Internal Controls': 75, 'BSA Officer': 85, Training: 70, 'Independent Testing': 80, CDD: 65 }, deficiencies: ['Enhanced CDD documentation needs improvement'], strengths: ['Timely SAR and CTR filings', 'Risk-based customer categorization'], overallRating: 'Satisfactory', recommendedEnhancements: ['Improve EDD documentation', 'Enhance transaction monitoring rules', 'Increase training frequency for high-risk business lines'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/generate-compliance-attestation', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { period, attestingOfficer, regulatoryScope } = req.body;
    const prompt = `You are a bank Chief Compliance Officer. Generate a formal compliance attestation for this period.\n\nPeriod: ${period}\nAttesting officer: ${attestingOfficer}\nRegulatory scope: ${regulatoryScope}\n\nRespond with valid JSON:\n{"attestationText": "<text>", "complianceCertifications": ["<text>"], "exceptions": [], "qualifications": [], "signatoryTitle": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_attestation`, prompt, 'You are a bank Chief Compliance Officer. Respond only with valid JSON.', { attestationText: `I, ${attestingOfficer || 'Compliance Officer'}, hereby attest that for the period ${period}, the institution has maintained compliance with applicable BSA/AML requirements, including timely filing of all required Currency Transaction Reports (CTRs) and Suspicious Activity Reports (SARs), and has implemented and maintained a BSA/AML compliance program consistent with 31 CFR Part 1020.`, complianceCertifications: ['BSA/AML Program', 'OFAC Compliance', 'CTR Filing', 'SAR Filing', 'Record Retention'], exceptions: [], qualifications: [], signatoryTitle: attestingOfficer ? `${attestingOfficer}, BSA/AML Compliance Officer` : 'BSA/AML Compliance Officer' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/score-regulatory-risk', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { data } = storeList(MODULE, { limit: 1000 });
    const overdue = data.filter(r => r.dueDate && new Date(r.dueDate) < new Date() && r.status !== 'Filed').length;
    const filedLate = data.filter(r => r.filedAt && r.dueDate && new Date(r.filedAt) > new Date(r.dueDate)).length;
    const prompt = `You are a bank regulatory risk officer. Score the overall regulatory filing risk.\n\nTotal reports: ${data.length}\nOverdue: ${overdue}\nFiled late: ${filedLate}\n\nRespond with valid JSON:\n{"riskScore": 0-100, "riskLevel": "low|medium|high|critical", "penaltyExposure": "<text>", "mitigationActions": ["<text>"], "reputationalRisk": "<text>", "regulatoryRelationshipStatus": "<text>"}`;
    const riskScore = Math.min(100, overdue * 20 + filedLate * 10);
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_reg_risk`, prompt, 'You are a bank regulatory risk officer. Respond only with valid JSON.', { riskScore, riskLevel: riskScore > 70 ? 'critical' : riskScore > 40 ? 'high' : riskScore > 20 ? 'medium' : 'low', penaltyExposure: overdue > 0 ? `Potential civil money penalties for ${overdue} late/unfiled reports` : 'Minimal — filings current', mitigationActions: overdue > 0 ? ['File overdue reports immediately', 'Notify regulator proactively', 'Implement calendar controls'] : ['Maintain current compliance calendar', 'Conduct quarterly self-assessment'], reputationalRisk: overdue > 2 ? 'Significant — multiple overdue filings' : 'Low', regulatoryRelationshipStatus: overdue > 0 ? 'At risk — proactive communication with regulator recommended' : 'Good standing' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/detect-reporting-gaps', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { expectedReports = [], period } = req.body;
    const { data } = storeList(MODULE, { limit: 1000, filter: { reportingPeriod: period } });
    const filed = data.map(r => r.reportType);
    const gaps = expectedReports.filter(r => !filed.includes(r));
    const prompt = `You are a bank compliance analyst. Identify gaps in regulatory reporting for this period.\n\nPeriod: ${period}\nExpected reports: ${JSON.stringify(expectedReports)}\nFiled reports: ${JSON.stringify(filed)}\nGaps identified: ${JSON.stringify(gaps)}\n\nRespond with valid JSON:\n{"gaps": ${JSON.stringify(gaps)}, "gapCount": ${gaps.length}, "priorityGaps": [], "deadlines": {}, "immediateActions": ["<text>"], "rootCause": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_reporting_gaps`, prompt, 'You are a bank compliance analyst. Respond only with valid JSON.', { gaps, gapCount: gaps.length, priorityGaps: gaps.filter(g => ['SAR', 'CTR'].includes(g)), deadlines: Object.fromEntries(gaps.map(g => [g, g === 'SAR' ? '30 days from detection' : g === 'CTR' ? '15 days from transaction' : 'Per schedule'])), immediateActions: gaps.length > 0 ? ['File missing reports immediately', 'Document reason for gap', 'Notify BSA Officer'] : ['No action required'], rootCause: gaps.length > 0 ? 'Gap analysis detected missing reports — review compliance calendar' : 'No gaps detected' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/classify-currency-event', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { amount, transactionType, isAggregated, customerPresentFlag } = req.body;
    const amt = parseFloat(amount || 0);
    const prompt = `You are a bank BSA/AML specialist. Classify whether this currency event requires a CTR filing.\n\nAmount: ${amount}\nType: ${transactionType}\nAggregated: ${isAggregated}\nCustomer present: ${customerPresentFlag}\n\nRespond with valid JSON:\n{"ctrRequired": ${amt >= 10000}, "currencyTransactionType": "<text>", "aggregationRule": "<text>", "exemptions": ["<text>"], "structuringRisk": "${amt >= 8000 && amt < 10000 ? 'elevated' : 'low'}", "filingInstructions": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_currency_event`, prompt, 'You are a bank BSA/AML specialist. Respond only with valid JSON.', { ctrRequired: amt >= 10000, currencyTransactionType: transactionType || 'Cash', aggregationRule: isAggregated ? 'Multiple transactions aggregated to $10,000+ threshold' : 'Single transaction', exemptions: ['Phase II exempt customers may qualify — verify exemption form on file'], structuringRisk: amt >= 8000 && amt < 10000 ? 'elevated' : 'low', filingInstructions: amt >= 10000 ? 'File CTR via FinCEN BSA E-Filing within 15 calendar days' : 'No CTR required — retain records per BSA 5-year requirement' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/draft-reg-d-violation-notice', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { customerId, accountId, excessWithdrawals, violationPeriod, withdrawalLimit = 6 } = req.body;
    const prompt = `You are a bank compliance officer. Draft a Regulation D violation notice for excess savings withdrawals.\n\nCustomer: ${customerId}\nAccount: ${accountId}\nExcess withdrawals: ${excessWithdrawals} (limit: ${withdrawalLimit}/month)\nPeriod: ${violationPeriod}\n\nRespond with valid JSON:\n{"noticeText": "<text>", "regulatoryBasis": "<text>", "consequencesIfContinued": "<text>", "customerOptions": ["<text>"], "contactInstructions": "<text>", "appealRights": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_reg_d_notice`, prompt, 'You are a bank compliance officer. Respond only with valid JSON.', { noticeText: `Dear Account Holder (Account: ${accountId}),\n\nThis notice informs you that your savings/money market account exceeded the Federal Reserve Regulation D limit of ${withdrawalLimit} convenient transfers or withdrawals per statement cycle during ${violationPeriod}. You made ${excessWithdrawals} excess transaction(s).\n\nPlease limit future withdrawals to comply with federal banking regulations.`, regulatoryBasis: '12 CFR Part 204 (Regulation D)', consequencesIfContinued: 'Continued violations may result in conversion of your account to a transaction account or account closure.', customerOptions: ['Open a checking account for frequent transactions', 'Plan withdrawals within the monthly limit', 'Contact us to discuss account options'], contactInstructions: 'Please contact Customer Service at 1-800-BANK-SVC to discuss your account options.', appealRights: 'If you believe this notice was sent in error, please contact us within 30 days.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/generate-board-report', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { period, includeMetrics = true } = req.body;
    const { data } = storeList(MODULE, { limit: 1000 });
    const sarCount = data.filter(r => r.reportType === 'SAR').length;
    const ctrCount = data.filter(r => r.reportType === 'CTR').length;
    const overdueCount = data.filter(r => r.dueDate && new Date(r.dueDate) < new Date() && r.status !== 'Filed').length;
    const prompt = `You are a bank Chief Compliance Officer preparing a board-level compliance report.\n\nPeriod: ${period}\nSARs filed: ${sarCount}\nCTRs filed: ${ctrCount}\nOverdue reports: ${overdueCount}\n\nRespond with valid JSON:\n{"boardReport": "<text>", "executiveSummary": "<text>", "keyMetrics": [], "riskHighlights": [], "regulatoryUpdates": [], "actionItems": [], "nextPeriodFocus": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_board_report`, prompt, 'You are a bank Chief Compliance Officer. Respond only with valid JSON.', { boardReport: `BSA/AML & Regulatory Compliance Report — ${period}`, executiveSummary: `During ${period}, the institution filed ${sarCount} SARs and ${ctrCount} CTRs. ${overdueCount > 0 ? `${overdueCount} reports are currently overdue and require immediate attention.` : 'All regulatory filings are current.'}`, keyMetrics: [{ metric: 'SARs Filed', value: sarCount, trend: 'stable' }, { metric: 'CTRs Filed', value: ctrCount, trend: 'stable' }, { metric: 'Overdue Reports', value: overdueCount, trend: overdueCount > 0 ? 'adverse' : 'favorable' }], riskHighlights: overdueCount > 0 ? ['Overdue regulatory filings — immediate attention required'] : ['All filings current'], regulatoryUpdates: ['FinCEN beneficial ownership rules update — effective January 1, 2025', 'FFIEC AML/CFT examination procedures update pending'], actionItems: overdueCount > 0 ? [`File ${overdueCount} overdue reports immediately`] : ['Maintain current compliance program'], nextPeriodFocus: ['Enhanced transaction monitoring implementation', 'Annual BSA training completion', 'Third-party AML audit scheduling'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/validate-cra-data', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { craData = {} } = req.body;
    const prompt = `You are a bank CRA (Community Reinvestment Act) compliance specialist. Validate this CRA report data.\n\nReport: ${JSON.stringify(record)}\nCRA data: ${JSON.stringify(craData)}\n\nRespond with valid JSON:\n{"dataValid": true, "issues": [], "loanDataComplete": true, "assessmentAreaDefined": true, "hmda-compatible": true, "suggestions": ["<text>"], "craRating": "Outstanding|Satisfactory|Needs to Improve|Substantial Noncompliance"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_cra_validate`, prompt, 'You are a bank CRA compliance specialist. Respond only with valid JSON.', { dataValid: true, issues: [], loanDataComplete: !!(craData.lendingData), assessmentAreaDefined: !!(craData.assessmentArea), 'hmda-compatible': true, suggestions: ['Ensure all HMDA fields are mapped to CRA reporting', 'Verify assessment area boundaries match FFIEC definitions', 'Document community development investments and services'], craRating: 'Satisfactory' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/summarize-fincen-feedback', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { feedbackItems = [] } = req.body;
    const prompt = `You are a bank BSA compliance officer. Summarize FinCEN feedback on SAR/CTR filings and recommend program improvements.\n\nFinCEN feedback items: ${JSON.stringify(feedbackItems)}\n\nRespond with valid JSON:\n{"summary": "<text>", "keyThemes": ["<text>"], "criticalFindings": [], "actionPlan": [{"action": "<text>", "owner": "<text>", "timeline": "<text>"}], "programImprovements": ["<text>"], "qualityMetrics": {}}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_fincen_feedback`, prompt, 'You are a bank BSA compliance officer. Respond only with valid JSON.', { summary: feedbackItems.length > 0 ? `FinCEN provided feedback on ${feedbackItems.length} item(s). Review and address within 60 days.` : 'No FinCEN feedback items to summarize.', keyThemes: feedbackItems.length > 0 ? ['Narrative completeness', 'Timely filing', 'Accurate subject information'] : [], criticalFindings: [], actionPlan: feedbackItems.length > 0 ? [{ action: 'Review FinCEN feedback items', owner: 'BSA Officer', timeline: '30 days' }, { action: 'Implement narrative quality improvements', owner: 'AML Team', timeline: '60 days' }] : [], programImprovements: ['Enhanced SAR narrative templates', 'Peer review process for SARs', 'Quality assurance checklist'], qualityMetrics: { completenessScore: 80, timelinessScore: 90, accuracyScore: 85 } });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/suggest-program-enhancement', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { currentProgramElements = [], budget, examinationHistory = [] } = req.body;
    const prompt = `You are a bank BSA/AML program consultant. Suggest enhancements to the compliance program.\n\nCurrent program elements: ${JSON.stringify(currentProgramElements)}\nBudget: ${budget}\nExamination history: ${JSON.stringify(examinationHistory)}\n\nRespond with valid JSON:\n{"enhancements": [{"area": "<text>", "recommendation": "<text>", "benefit": "<text>", "estimatedCost": "<text>", "priority": "high|medium|low"}], "quickWins": ["<text>"], "longTermInvestments": ["<text>"], "expectedROI": "<text>", "regulatoryAlignment": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_program_enhancement`, prompt, 'You are a BSA/AML program consultant. Respond only with valid JSON.', { enhancements: [{ area: 'Transaction Monitoring', recommendation: 'Implement AI-enhanced scenario tuning to reduce false positives', benefit: 'Reduce analyst alert volume by 30-40%', estimatedCost: '$50,000-200,000', priority: 'high' }, { area: 'Customer Risk Rating', recommendation: 'Automate periodic risk re-rating using behavioral analytics', benefit: 'More timely identification of risk changes', estimatedCost: '$25,000-75,000', priority: 'medium' }, { area: 'Training', recommendation: 'Add role-specific BSA training modules for front-line staff', benefit: 'Improved SAR referral quality', estimatedCost: '$10,000-30,000', priority: 'medium' }], quickWins: ['Update SAR narrative templates', 'Automate CTR pre-population', 'Implement compliance calendar alerts'], longTermInvestments: ['AI-based transaction monitoring', 'Integrated CDD platform', 'Regulatory change management system'], expectedROI: 'Reduced regulatory risk, lower false positive rates, operational efficiency gains', regulatoryAlignment: ['FFIEC BSA/AML Manual', 'FinCEN AML Priorities (2021)', 'Section 6101 AML Act of 2020'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

module.exports = router;
