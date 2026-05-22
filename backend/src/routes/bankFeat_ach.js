/**
 * Core Banking — ACH Route
 * Module: ach
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

const MODULE = 'banking_ach';
const auth = authenticateToken;

// ── CRUD ─────────────────────────────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const { page, limit, status, secCode, direction } = req.query;
  res.json(storeList(MODULE, { page, limit, filter: { status, secCode, direction } }));
});

router.get('/:id', auth, (req, res) => {
  const r = storeGet(MODULE, req.params.id);
  if (!r) return res.status(404).json({ error: 'ACH entry not found' });
  res.json({ data: r, auditLog: [{ event: 'read', at: new Date().toISOString(), by: req.user.id }] });
});

router.post('/', auth, (req, res) => {
  const { secCode, direction, receiverName, receiverRoutingAba, receiverAccountNumber, receiverAccountType, amount, transactionCode, companyName, companyId } = req.body;
  if (!receiverRoutingAba || !receiverAccountNumber || !amount || !secCode) return res.status(400).json({ error: 'secCode, receiverRoutingAba, receiverAccountNumber, amount required' });
  const traceNumber = `${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(7, '0')}`;
  const r = storeCreate(MODULE, { secCode, direction: direction || 'Origination', receiverName, receiverRoutingAba, receiverAccountNumber, receiverAccountType: receiverAccountType || 'Checking', amount: parseFloat(amount), transactionCode, companyName, companyId, traceNumber, status: 'Pending', effectiveDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), prenotification: false });
  res.status(201).json(r);
});

router.patch('/:id', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, req.body);
  if (!r) return res.status(404).json({ error: 'ACH entry not found' });
  res.json(r);
});

router.delete('/:id', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, { status: 'Returned', returnCode: 'R67' });
  if (!r) return res.status(404).json({ error: 'ACH entry not found' });
  res.json({ message: 'ACH entry reversed/returned', data: r });
});

router.get('/by-batch/:batchId', auth, (req, res) => {
  res.json(storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { batchId: req.params.batchId } }));
});

router.get('/by-status/:status', auth, (req, res) => {
  res.json(storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { status: req.params.status } }));
});

router.post('/batch', auth, (req, res) => {
  const { items, batchId } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items[] required' });
  const bid = batchId || `BATCH${Date.now()}`;
  const r = storeBatchCreate(MODULE, items.map(i => ({ ...i, batchId: bid, status: i.status || 'Pending', traceNumber: `${Date.now()}${Math.floor(Math.random() * 9999999).toString().padStart(7, '0')}` })));
  res.status(201).json({ created: r.length, batchId: bid, data: r });
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
  res.setHeader('Content-Disposition', 'attachment; filename="ach.csv"');
  res.send(exportCsv(data));
});

router.post('/meta/import-csv', auth, (req, res) => {
  if (!req.body.csv) return res.status(400).json({ error: 'csv required' });
  const r = importCsvRows(req.body.csv, MODULE);
  res.status(201).json({ imported: r.length, data: r });
});

router.get('/meta/stats', auth, (req, res) => {
  const { data } = storeList(MODULE, { limit: 10000 });
  const totalVolume = data.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const returned = data.filter(r => r.status === 'Returned').length;
  const returnRate = data.length ? returned / data.length : 0;
  const bySecCode = {};
  data.forEach(r => { bySecCode[r.secCode] = (bySecCode[r.secCode] || 0) + 1; });
  res.json({ ...storeStats(MODULE), totalVolume: parseFloat(totalVolume.toFixed(2)), returnRate: parseFloat(returnRate.toFixed(4)), bySecCode });
});

// ── AI VERBS ─────────────────────────────────────────────────────────────────
router.post('/ai/validate-routing-aba', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { routingNumbers = [] } = req.body;
    const results = routingNumbers.map(rn => {
      const d = String(rn).replace(/\D/g, '');
      if (d.length !== 9) return { routing: rn, valid: false, reason: 'Must be 9 digits' };
      const w = [3, 7, 1, 3, 7, 1, 3, 7, 1];
      const sum = d.split('').reduce((s, c, i) => s + parseInt(c) * w[i], 0);
      return { routing: rn, valid: sum % 10 === 0, reason: sum % 10 === 0 ? 'Checksum valid' : 'Checksum invalid', checksum: sum % 10 };
    });
    const prompt = `You are a bank payments specialist. Provide context for these ABA routing number validation results.\n\nResults: ${JSON.stringify(results)}\n\nRespond with valid JSON:\n{"results": ${JSON.stringify(results)}, "validCount": ${results.filter(r => r.valid).length}, "invalidCount": ${results.filter(r => !r.valid).length}, "institutionLookupNote": "Live institution lookup requires Fed ABA registry API"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_aba_validate`, prompt, 'You are a bank payments specialist. Respond only with valid JSON.', { results, validCount: results.filter(r => r.valid).length, invalidCount: results.filter(r => !r.valid).length, institutionLookupNote: 'Live institution lookup requires Federal Reserve ABA registry API' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/detect-rdfi-rejection-pattern', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { returnedEntries = [] } = req.body;
    const prompt = `You are a bank ACH operations analyst. Analyze RDFI rejection patterns to identify systemic issues.\n\nReturned entries: ${JSON.stringify(returnedEntries.slice(0, 50))}\n\nRespond with valid JSON:\n{"patterns": [{"rdi": "<routing>", "returnCode": "<code>", "frequency": 0, "issue": "<text>"}], "topReturnCodes": [], "systemicIssues": ["<text>"], "correctionActions": ["<text>"], "originatorRisk": "low|medium|high"}`;
    const codes = {};
    returnedEntries.forEach(e => { codes[e.returnCode || 'Unknown'] = (codes[e.returnCode || 'Unknown'] || 0) + 1; });
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_rdfi_pattern`, prompt, 'You are a bank ACH analyst. Respond only with valid JSON.', { patterns: [], topReturnCodes: Object.entries(codes).map(([k, v]) => ({ code: k, count: v })), systemicIssues: [], correctionActions: [], originatorRisk: 'low' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/classify-sec-code', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { transactionDescription, receiverType, channel, isVerbal } = req.body;
    const prompt = `You are a bank ACH compliance specialist. Classify the appropriate NACHA SEC code for this ACH transaction.\n\nDescription: "${transactionDescription}"\nReceiver type: ${receiverType}\nChannel: ${channel}\nVerbal authorization: ${isVerbal}\n\nRespond with valid JSON:\n{"secCode": "<code>", "fullName": "<text>", "rationale": "<text>", "authorizationType": "<text>", "recordRetentionDays": 0, "alternatives": ["<text>"]}`;
    const secCodes = { consumer: isVerbal ? 'TEL' : channel === 'web' ? 'WEB' : 'PPD', business: 'CCD' };
    const code = receiverType === 'business' ? secCodes.business : secCodes.consumer;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_sec_code`, prompt, 'You are a bank ACH compliance specialist. Respond only with valid JSON.', { secCode: code, fullName: { PPD: 'Prearranged Payment and Deposit', CCD: 'Corporate Credit or Debit', WEB: 'Internet-initiated Debit', TEL: 'Telephone-initiated Entry' }[code] || code, rationale: `${receiverType} account via ${channel || 'branch'} channel`, authorizationType: isVerbal ? 'Verbal' : 'Written', recordRetentionDays: 2 * 365, alternatives: ['PPD', 'CCD', 'WEB'].filter(c => c !== code) });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/predict-return-rate', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { originatorId, secCode, historicalReturnRate } = req.body;
    const { data } = storeList(MODULE, { limit: 1000, filter: { originatorId } });
    const totalEntries = data.length;
    const returnedEntries = data.filter(e => e.status === 'Returned').length;
    const actualReturnRate = totalEntries > 0 ? returnedEntries / totalEntries : historicalReturnRate || 0.01;
    const prompt = `You are a bank ACH risk analyst. Predict future return rates for this originator.\n\nOriginator: ${originatorId}\nSEC code: ${secCode}\nHistorical return rate: ${(actualReturnRate * 100).toFixed(2)}%\nNACHA threshold for debit entries: 0.5%\n\nRespond with valid JSON:\n{"predictedReturnRate": 0, "nachaThreshold": 0.005, "thresholdBreachRisk": "low|medium|high", "trendDirection": "improving|stable|worsening", "recommendations": ["<text>"], "odfiExposure": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_return_rate`, prompt, 'You are a bank ACH risk analyst. Respond only with valid JSON.', { predictedReturnRate: parseFloat(actualReturnRate.toFixed(4)), nachaThreshold: 0.005, thresholdBreachRisk: actualReturnRate > 0.005 ? 'high' : actualReturnRate > 0.003 ? 'medium' : 'low', trendDirection: 'stable', recommendations: actualReturnRate > 0.005 ? ['Conduct originator audit', 'Implement enhanced monitoring', 'Review authorization procedures'] : [], odfiExposure: actualReturnRate > 0.005 ? 'ODFI regulatory action risk' : 'Within acceptable thresholds' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/suggest-return-reason-code', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { reason, entryDetails = {} } = req.body;
    const prompt = `You are a bank ACH operations specialist. Suggest the correct NACHA return reason code for this situation.\n\nReturn reason: "${reason}"\nEntry details: ${JSON.stringify(entryDetails)}\n\nRespond with valid JSON:\n{"returnCode": "<Rxx>", "codeName": "<text>", "codeDescription": "<text>", "returnTimeframe": "<text>", "odfiObligations": ["<text>"], "rdfiObligations": ["<text>"]}`;
    const commonCodes = { 'insufficient funds': { code: 'R01', name: 'Insufficient Funds' }, 'account closed': { code: 'R02', name: 'Account Closed' }, 'no account': { code: 'R03', name: 'No Account' }, 'unauthorized': { code: 'R10', name: 'Customer Advises Unauthorized' } };
    const match = Object.entries(commonCodes).find(([k]) => reason?.toLowerCase().includes(k));
    const code = match ? match[1] : { code: 'R99', name: 'Unknown' };
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_return_code`, prompt, 'You are a bank ACH specialist. Respond only with valid JSON.', { returnCode: code.code, codeName: code.name, codeDescription: `Return reason: ${reason}`, returnTimeframe: 'By end of next banking day', odfiObligations: ['Notify originator', 'Reverse entry if required'], rdfiObligations: ['Return within timeframe', 'Provide correct return code'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/generate-nacha-file-narrative', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { batchId } = req.body;
    const { data: entries } = storeList(MODULE, { limit: 10000, filter: { batchId } });
    const totalDebit = entries.filter(e => e.direction === 'Origination').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const prompt = `You are a bank ACH file specialist. Generate a NACHA batch file narrative and summary.\n\nBatch: ${batchId}\nEntry count: ${entries.length}\nTotal debit: ${totalDebit}\n\nRespond with valid JSON:\n{"fileHeader": "<text>", "batchHeader": "<text>", "entrySummary": "<text>", "batchControl": "<text>", "fileControl": "<text>", "nachaCompliant": true, "validationNotes": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_nacha_narrative`, prompt, 'You are a bank ACH file specialist. Respond only with valid JSON.', { fileHeader: `Batch ${batchId}: ${entries.length} entries`, batchHeader: `Company: ${entries[0]?.companyName || 'Unknown'}`, entrySummary: `${entries.length} entries totaling $${totalDebit.toFixed(2)}`, batchControl: `Hash: XXXXXXXXXX, Total: ${totalDebit.toFixed(2)}`, fileControl: 'File control generated', nachaCompliant: entries.length > 0, validationNotes: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/score-originator-risk', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { originatorProfile = {} } = req.body;
    const prompt = `You are a bank ODFI risk manager. Score the risk of this ACH originator and set appropriate limits.\n\nOriginator: ${JSON.stringify(originatorProfile)}\n\nRespond with valid JSON:\n{"riskScore": 0-100, "riskTier": "low|medium|high|prohibited", "dailyDebitLimit": 0, "dailyCreditLimit": 0, "exposureLimit": 0, "riskFactors": ["<text>"], "odfiObligations": ["<text>"], "monitoringFrequency": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_originator_risk`, prompt, 'You are an ODFI risk manager. Respond only with valid JSON.', { riskScore: 25, riskTier: 'low', dailyDebitLimit: 500000, dailyCreditLimit: 500000, exposureLimit: 1000000, riskFactors: [], odfiObligations: ['Know your originator', 'Monitor return rates', 'Audit originator annually'], monitoringFrequency: 'Quarterly' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/detect-unauthorized-debit', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { entry = {}, customerClaim } = req.body;
    const prompt = `You are a bank ACH dispute specialist. Assess whether this ACH debit entry was unauthorized.\n\nEntry: ${JSON.stringify(entry)}\nCustomer claim: "${customerClaim}"\n\nRespond with valid JSON:\n{"likelyUnauthorized": false, "confidence": 0-100, "returnCodeRecommendation": "<text>", "investigationSteps": ["<text>"], "authorizationCheckPoints": ["<text>"], "timelyReturnPossible": true}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_unauthorized_debit`, prompt, 'You are a bank ACH dispute specialist. Respond only with valid JSON.', { likelyUnauthorized: !!customerClaim, confidence: customerClaim ? 60 : 20, returnCodeRecommendation: customerClaim ? 'R10 - Customer Advises Unauthorized' : 'N/A', investigationSteps: ['Verify authorization records', 'Contact originator', 'Obtain ODFI contact'], authorizationCheckPoints: ['Written authorization on file', 'Prenotification sent', 'Recurring agreement signed'], timelyReturnPossible: true });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/suggest-prenotification', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { originatorType, secCode, isNewAccount } = req.body;
    const prompt = `You are a bank ACH compliance officer. Advise whether a prenotification should be sent for this ACH entry.\n\nOriginator type: ${originatorType}\nSEC code: ${secCode}\nNew account: ${isNewAccount}\n\nRespond with valid JSON:\n{"prenoteRequired": false, "prenoteRecommended": true, "prenoteCode": "<text>", "rationale": "<text>", "timing": "<text>", "riskReduction": "<text>"}`;
    const recommended = isNewAccount || secCode === 'PPD';
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_prenotification`, prompt, 'You are a bank ACH compliance officer. Respond only with valid JSON.', { prenoteRequired: false, prenoteRecommended: recommended, prenoteCode: `C${secCode || 'PPD'}`, rationale: recommended ? 'New account or consumer entry — prenote reduces return risk' : 'Established account — prenote optional', timing: '3 banking days before first live entry', riskReduction: 'Prenoting reduces R03/R04 returns by ~40%' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/classify-batch-failure', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { batchId, errorCode, errorMessage } = req.body;
    const prompt = `You are a bank ACH operations specialist. Classify this batch failure and determine recovery steps.\n\nBatch: ${batchId}\nError: ${errorCode} — "${errorMessage}"\n\nRespond with valid JSON:\n{"failureCategory": "<text>", "rootCause": "<text>", "severity": "low|medium|high|critical", "recoverySteps": ["<text>"], "resubmissionViable": true, "estimatedRecoveryTime": "<text>", "escalationRequired": false}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_batch_failure`, prompt, 'You are a bank ACH operations specialist. Respond only with valid JSON.', { failureCategory: 'Processing Error', rootCause: `Error code: ${errorCode || 'Unknown'} — ${errorMessage || 'No description'}`, severity: 'medium', recoverySteps: ['Review error details', 'Correct entry data', 'Resubmit batch if within cutoff'], resubmissionViable: true, estimatedRecoveryTime: '2-4 hours', escalationRequired: false });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/predict-settlement-delay', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { effectiveDate, secCode, submissionTime } = req.body;
    const prompt = `You are a bank ACH settlement specialist. Predict settlement delays for this ACH entry.\n\nEffective date: ${effectiveDate}\nSEC code: ${secCode}\nSubmission time: ${submissionTime}\n\nRespond with valid JSON:\n{"estimatedSettlementDate": "<date>", "delayRisk": "low|medium|high", "delayFactors": ["<text>"], "cutoffTime": "<text>", "sameDayEligible": false, "recommendations": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_settlement_delay`, prompt, 'You are a bank ACH settlement specialist. Respond only with valid JSON.', { estimatedSettlementDate: effectiveDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10), delayRisk: 'low', delayFactors: [], cutoffTime: '2:30 PM ET for next-day', sameDayEligible: parseFloat(secCode === 'WEB' ? 0 : 0) < 25000, recommendations: ['Submit before cutoff for next-day settlement'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/recommend-resubmission-strategy', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { returnedEntry = {}, returnCode } = req.body;
    const prompt = `You are a bank ACH recovery specialist. Recommend a resubmission or recovery strategy for this returned ACH entry.\n\nReturned entry: ${JSON.stringify(returnedEntry)}\nReturn code: ${returnCode}\n\nRespond with valid JSON:\n{"canResubmit": true, "resubmissionDelay": "<text>", "requiredActions": ["<text>"], "alternativeCollectionMethods": ["<text>"], "customerOutreachScript": "<text>", "writeOffThreshold": 0}`;
    const noResubmit = ['R02', 'R03', 'R04', 'R08', 'R16'].includes(returnCode);
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_resubmission`, prompt, 'You are a bank ACH recovery specialist. Respond only with valid JSON.', { canResubmit: !noResubmit, resubmissionDelay: noResubmit ? 'N/A — obtain new authorization' : '24 hours minimum', requiredActions: noResubmit ? ['Contact customer', 'Obtain new account information'] : ['Wait 24 hours', 'Verify funds available', 'Resubmit with corrected data'], alternativeCollectionMethods: ['Wire transfer', 'Check', 'Card payment'], customerOutreachScript: `We were unable to process your payment of $${returnedEntry.amount}. Please provide updated account information.`, writeOffThreshold: 50 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/validate-effective-date', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { effectiveDate, secCode, submissionDate } = req.body;
    const effDate = new Date(effectiveDate);
    const subDate = submissionDate ? new Date(submissionDate) : new Date();
    const daysDiff = Math.floor((effDate - subDate) / 86400000);
    const isWeekend = effDate.getDay() === 0 || effDate.getDay() === 6;
    const prompt = `You are a bank ACH compliance specialist. Validate this effective date for NACHA rules.\n\nEffective date: ${effectiveDate}\nSEC code: ${secCode}\nSubmission date: ${submissionDate}\nDays until effective: ${daysDiff}\nIs weekend: ${isWeekend}\n\nRespond with valid JSON:\n{"isValid": true, "issues": [], "adjustedDate": "<date>", "nachaRule": "<text>", "sameDayWindow": false, "cutoffApplicable": true}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_effective_date`, prompt, 'You are a bank ACH compliance specialist. Respond only with valid JSON.', { isValid: daysDiff >= 0 && !isWeekend, issues: isWeekend ? ['Effective date falls on weekend — will process next banking day'] : daysDiff < 0 ? ['Effective date is in the past'] : [], adjustedDate: isWeekend ? new Date(effDate.getTime() + (effDate.getDay() === 6 ? 2 : 1) * 86400000).toISOString().slice(0, 10) : effectiveDate, nachaRule: 'NACHA Operating Rules Section 2.2.2', sameDayWindow: daysDiff === 0, cutoffApplicable: true });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/summarize-ach-volume', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { period = '30d' } = req.body;
    const { data } = storeList(MODULE, { limit: 10000 });
    const totalAmt = data.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const prompt = `You are a bank ACH operations manager. Summarize ACH volume and performance metrics.\n\nPeriod: ${period}\nTotal entries: ${data.length}\nTotal amount: ${totalAmt}\nReturn count: ${data.filter(e => e.status === 'Returned').length}\n\nRespond with valid JSON:\n{"summary": "<text>", "totalEntries": 0, "totalVolume": 0, "returnRate": 0, "bySecCode": {}, "trendsNote": "<text>", "nachaComplianceStatus": "compliant|at-risk|non-compliant"}`;
    const bySecCode = {};
    data.forEach(e => { bySecCode[e.secCode || 'Unknown'] = (bySecCode[e.secCode || 'Unknown'] || 0) + 1; });
    const returnRate = data.length ? data.filter(e => e.status === 'Returned').length / data.length : 0;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_volume_summary`, prompt, 'You are an ACH operations manager. Respond only with valid JSON.', { summary: `${period} period: ${data.length} entries, $${totalAmt.toFixed(2)} total volume`, totalEntries: data.length, totalVolume: parseFloat(totalAmt.toFixed(2)), returnRate: parseFloat(returnRate.toFixed(4)), bySecCode, trendsNote: 'Historical trend data insufficient for comparison', nachaComplianceStatus: returnRate < 0.005 ? 'compliant' : returnRate < 0.01 ? 'at-risk' : 'non-compliant' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/generate-customer-notice', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { entry = {}, noticeType, reason } = req.body;
    const prompt = `You are a bank ACH communications specialist. Generate the required customer notice for this ACH situation.\n\nEntry: ${JSON.stringify(entry)}\nNotice type: ${noticeType}\nReason: ${reason}\n\nRespond with valid JSON:\n{"noticeText": "<text>", "deliveryMethod": "email|mail|both", "timing": "<text>", "regulatoryBasis": "<text>", "requiredElements": ["<text>"], "language": "en"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_customer_notice`, prompt, 'You are a bank ACH communications specialist. Respond only with valid JSON.', { noticeText: `Dear Customer, an ACH ${entry.direction || 'entry'} of $${entry.amount || 0} ${noticeType === 'return' ? 'was returned' : 'is pending'} for the following reason: ${reason || 'See account statement for details'}.`, deliveryMethod: 'both', timing: 'Within 2 banking days', regulatoryBasis: 'NACHA Operating Rules; Reg E (12 CFR Part 1005)', requiredElements: ['Amount', 'Date', 'Reason', 'Contact information'], language: 'en' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/detect-mule-pattern', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { accountId, transactions = [] } = req.body;
    const prompt = `You are a bank AML specialist focused on money mule detection. Analyze ACH patterns for money mule activity.\n\nAccount: ${accountId}\nTransactions: ${JSON.stringify(transactions.slice(0, 30))}\n\nRespond with valid JSON:\n{"muleScore": 0-100, "muleIndicators": ["<text>"], "transactionPatterns": ["<text>"], "sarRequired": false, "immediateActions": ["<text>"], "typologyCode": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_mule_pattern`, prompt, 'You are a bank AML specialist. Respond only with valid JSON.', { muleScore: 15, muleIndicators: [], transactionPatterns: [], sarRequired: false, immediateActions: [], typologyCode: 'N/A' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

module.exports = router;
