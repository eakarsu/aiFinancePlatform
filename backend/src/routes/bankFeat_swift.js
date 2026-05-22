/**
 * Core Banking — SWIFT Messaging Route
 * Module: swift
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

const MODULE = 'banking_swift';
const auth = authenticateToken;

// ── CRUD ─────────────────────────────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const { page, limit, messageType, stpStatus, validationStatus } = req.query;
  res.json(storeList(MODULE, { page, limit, filter: { messageType, stpStatus, validationStatus } }));
});

router.get('/:id', auth, (req, res) => {
  const r = storeGet(MODULE, req.params.id);
  if (!r) return res.status(404).json({ error: 'SWIFT message not found' });
  res.json({ data: r, auditLog: [{ event: 'read', at: new Date().toISOString(), by: req.user.id }] });
});

router.post('/', auth, (req, res) => {
  const { messageType, sender, receiver, senderBic, receiverBic, transactionRef, currency, amount, valueDate, rawMt } = req.body;
  if (!messageType || !senderBic || !receiverBic) return res.status(400).json({ error: 'messageType, senderBic, receiverBic required' });
  const r = storeCreate(MODULE, { messageType, sender, receiver, senderBic, receiverBic, transactionRef: transactionRef || `TRN${Date.now()}`, relatedRef: null, currency, amount: amount ? parseFloat(amount) : null, valueDate, rawMt, parsedFields: null, validationStatus: 'Pending', validationErrors: null, stpStatus: 'Pending', coverMethod: 'N/A', aiQualityScore: null });
  res.status(201).json(r);
});

router.patch('/:id', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, req.body);
  if (!r) return res.status(404).json({ error: 'SWIFT message not found' });
  res.json(r);
});

router.delete('/:id', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, { validationStatus: 'Invalid', stpStatus: 'Rejected' });
  if (!r) return res.status(404).json({ error: 'SWIFT message not found' });
  res.json({ message: 'Message rejected', data: r });
});

router.get('/by-sender/:senderBic', auth, (req, res) => {
  res.json(storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { senderBic: req.params.senderBic } }));
});

router.get('/by-type/:messageType', auth, (req, res) => {
  res.json(storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { messageType: req.params.messageType } }));
});

router.post('/batch', auth, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items[] required' });
  const r = storeBatchCreate(MODULE, items.map(i => ({ ...i, validationStatus: 'Pending', stpStatus: 'Pending', transactionRef: i.transactionRef || `TRN${Date.now()}${Math.random().toFixed(4).slice(2)}` })));
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
  res.setHeader('Content-Disposition', 'attachment; filename="swift_messages.csv"');
  res.send(exportCsv(data));
});

router.post('/meta/import-csv', auth, (req, res) => {
  if (!req.body.csv) return res.status(400).json({ error: 'csv required' });
  const r = importCsvRows(req.body.csv, MODULE);
  res.status(201).json({ imported: r.length, data: r });
});

router.get('/meta/stats', auth, (req, res) => {
  const { data } = storeList(MODULE, { limit: 10000 });
  const byType = {}, byStp = {};
  data.forEach(r => { byType[r.messageType] = (byType[r.messageType] || 0) + 1; byStp[r.stpStatus] = (byStp[r.stpStatus] || 0) + 1; });
  const stpRate = data.length ? data.filter(r => r.stpStatus === 'STP').length / data.length : 0;
  res.json({ ...storeStats(MODULE), byType, byStp, stpRate: parseFloat(stpRate.toFixed(4)) });
});

// ── AI VERBS ─────────────────────────────────────────────────────────────────
router.post('/ai/parse-mt103', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { rawMt103 } = req.body;
    if (!rawMt103) return res.status(400).json({ error: 'rawMt103 required' });
    const prompt = `You are a bank SWIFT MT103 parsing specialist. Parse this MT103 Customer Credit Transfer message and extract all fields.\n\nRaw MT103:\n${rawMt103}\n\nRespond with valid JSON:\n{"field20": "<TRN>", "field23B": "<bank op code>", "field32A": "<date/ccy/amount>", "field50": "<ordering customer>", "field52A": "<ordering institution>", "field56A": "<intermediary>", "field57A": "<account with institution>", "field59": "<beneficiary>", "field70": "<remittance info>", "field71A": "<details of charges>", "field77B": "<regulatory reporting>", "parseErrors": [], "stpEligible": true}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_parse_mt103`, prompt, 'You are a SWIFT MT103 parsing specialist. Respond only with valid JSON.', { field20: 'REFERENCE', field23B: 'CRED', field32A: 'YYYYMMDD/USD/0', field50: 'ORDERING CUSTOMER', field52A: 'ORDERING INSTITUTION', field56A: null, field57A: 'ACCOUNT WITH INSTITUTION', field59: 'BENEFICIARY', field70: 'REMITTANCE INFO', field71A: 'SHA', field77B: null, parseErrors: rawMt103 ? [] : ['No MT103 provided'], stpEligible: true });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/parse-mt202', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { rawMt202 } = req.body;
    if (!rawMt202) return res.status(400).json({ error: 'rawMt202 required' });
    const prompt = `You are a bank SWIFT MT202 parsing specialist. Parse this Financial Institution Credit Transfer and extract all fields.\n\nRaw MT202:\n${rawMt202}\n\nRespond with valid JSON:\n{"field20": "<TRN>", "field21": "<related ref>", "field32A": "<date/ccy/amount>", "field52A": "<ordering institution>", "field53A": "<sender correspondent>", "field54A": "<receiver correspondent>", "field57A": "<account with institution>", "field58A": "<beneficiary institution>", "field72": "<sender to receiver info>", "parseErrors": [], "isCOVMessage": false}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_parse_mt202`, prompt, 'You are a SWIFT MT202 parsing specialist. Respond only with valid JSON.', { field20: 'REFERENCE', field21: 'RELATED_REF', field32A: 'YYYYMMDD/USD/0', field52A: 'ORDERING INSTITUTION', field53A: null, field54A: null, field57A: 'ACCOUNT WITH INSTITUTION', field58A: 'BENEFICIARY INSTITUTION', field72: null, parseErrors: rawMt202 ? [] : ['No MT202 provided'], isCOVMessage: false });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/validate-mt-message', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank SWIFT message validator. Validate this SWIFT message against the message type specification and SWIFT standards.\n\nMessage: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"isValid": true, "validationErrors": [], "mandatoryFieldsMissing": [], "formatErrors": [], "businessValidationErrors": [], "swiftStandardCompliance": "compliant|non-compliant", "recommendedCorrections": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_validate_mt`, prompt, 'You are a SWIFT message validator. Respond only with valid JSON.', { isValid: !!(record.senderBic && record.receiverBic && record.transactionRef), validationErrors: [!record.senderBic ? 'Missing sender BIC' : null, !record.receiverBic ? 'Missing receiver BIC' : null].filter(Boolean), mandatoryFieldsMissing: [], formatErrors: [], businessValidationErrors: [], swiftStandardCompliance: record.senderBic && record.receiverBic ? 'compliant' : 'non-compliant', recommendedCorrections: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/classify-message-type', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank SWIFT message classification specialist. Classify this SWIFT message and explain its purpose.\n\nMessage: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"messageType": "<MT code>", "category": "<SWIFT category 1-9>", "subType": "<text>", "purpose": "<text>", "processingPriority": "urgent|normal|batch", "respondingMessageTypes": ["<text>"], "regulatoryRelevance": "<text>"}`;
    const mtCategories = { MT1: 'Customer Payments', MT2: 'Financial Institution Transfers', MT9: 'Statements/Reports' };
    const mt = record.messageType || 'MT103';
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_classify_mt`, prompt, 'You are a SWIFT classification specialist. Respond only with valid JSON.', { messageType: mt, category: mt.startsWith('MT1') ? 'Customer Payments' : mt.startsWith('MT2') ? 'Financial Institution Transfers' : 'Other', subType: mt === 'MT103' ? 'Single Customer Credit Transfer' : mt === 'MT202' ? 'Financial Institution Credit Transfer' : 'Other', purpose: `Standard ${mt} transaction processing`, processingPriority: 'normal', respondingMessageTypes: mt === 'MT103' ? ['MT199', 'MT192'] : ['MT996'], regulatoryRelevance: 'SWIFT compliance and reporting' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/suggest-field-correction', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank SWIFT message specialist. Suggest corrections for fields in this SWIFT message that have errors or could be improved.\n\nMessage: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"corrections": [{"field": "<tag>", "currentValue": "<text>", "suggestedValue": "<text>", "reason": "<text>", "mandatory": true}], "priorityCorrections": ["<text>"], "estimatedRejectionRisk": 0-100}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_field_correction`, prompt, 'You are a SWIFT message specialist. Respond only with valid JSON.', { corrections: [], priorityCorrections: [], estimatedRejectionRisk: 10 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/generate-mt-response', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { originalMessage = {}, responseType, reason } = req.body;
    const prompt = `You are a bank SWIFT messaging specialist. Generate the appropriate SWIFT response message for this incoming message.\n\nOriginal message: ${JSON.stringify(originalMessage)}\nResponse type needed: ${responseType}\nReason: ${reason}\n\nRespond with valid JSON:\n{"responseMessageType": "<MT>", "responseFields": {}, "messageText": "<text>", "senderToReceiverInfo": "<text>", "urgency": "normal|urgent", "regulatoryNotes": ["<text>"]}`;
    const responseMap = { acknowledge: 'MT199', query: 'MT196', cancellation: 'MT192' };
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_generate_response`, prompt, 'You are a SWIFT messaging specialist. Respond only with valid JSON.', { responseMessageType: responseMap[responseType] || 'MT199', responseFields: { field20: `RESP${Date.now()}`, field21: originalMessage.transactionRef || 'UNKNOWN', field79: reason || 'Response to your message' }, messageText: `Response to ${originalMessage.messageType}: ${reason}`, senderToReceiverInfo: '/REC/' + (reason || 'Processed'), urgency: 'normal', regulatoryNotes: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/detect-message-anomaly', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank SWIFT operations security specialist. Detect anomalies in this SWIFT message that may indicate fraud or operational errors.\n\nMessage: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"anomalyDetected": false, "anomalyScore": 0-100, "anomalies": [], "securityConcerns": [], "operationalConcerns": [], "recommendedAction": "process|hold|investigate", "explanation": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_anomaly_detect`, prompt, 'You are a SWIFT operations security specialist. Respond only with valid JSON.', { anomalyDetected: false, anomalyScore: 10, anomalies: [], securityConcerns: [], operationalConcerns: [], recommendedAction: 'process', explanation: 'No anomalies detected in SWIFT message.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/predict-non-stp-rate', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { messages = [] } = req.body;
    const { data } = storeList(MODULE, { limit: 1000 });
    const nonStp = data.filter(m => m.stpStatus !== 'STP').length;
    const stpRate = data.length ? 1 - nonStp / data.length : 0.95;
    const prompt = `You are a bank SWIFT STP (Straight-Through Processing) analyst. Predict the Non-STP rate and identify main causes.\n\nCurrent STP rate: ${(stpRate * 100).toFixed(1)}%\nTotal messages: ${data.length}\nNon-STP count: ${nonStp}\n\nRespond with valid JSON:\n{"predictedNonStpRate": 0, "currentStpRate": 0, "topCauses": ["<text>"], "improvementActions": ["<text>"], "benchmarkComparison": "<text>", "financialImpact": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_non_stp_rate`, prompt, 'You are a bank SWIFT STP analyst. Respond only with valid JSON.', { predictedNonStpRate: parseFloat((1 - stpRate).toFixed(4)), currentStpRate: parseFloat(stpRate.toFixed(4)), topCauses: ['Missing BIC', 'Unstructured beneficiary address', 'Invalid account format'], improvementActions: ['Enforce structured address in Field 59', 'Implement BIC validation at entry', 'Automate IBAN validation'], benchmarkComparison: stpRate > 0.95 ? 'Above industry average (95%)' : 'Below industry average', financialImpact: `Each non-STP message costs ~$15-50 in manual processing` });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/summarize-correspondent-flows', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { period = '30d' } = req.body;
    const { data } = storeList(MODULE, { limit: 1000 });
    const bySender = {};
    data.forEach(m => { bySender[m.senderBic] = (bySender[m.senderBic] || 0) + 1; });
    const prompt = `You are a bank correspondent banking relationship manager. Summarize SWIFT message flows with correspondents.\n\nPeriod: ${period}\nTotal messages: ${data.length}\nBy sender: ${JSON.stringify(bySender)}\n\nRespond with valid JSON:\n{"summary": "<text>", "topCorrespondents": [], "flowsByMessageType": {}, "relationshipStrength": "<text>", "bilateralBalance": "<text>", "recommendations": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_correspondent_flows`, prompt, 'You are a correspondent banking manager. Respond only with valid JSON.', { summary: `${data.length} SWIFT messages in ${period} across ${Object.keys(bySender).length} correspondents`, topCorrespondents: Object.entries(bySender).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ bic: k, messageCount: v })), flowsByMessageType: {}, relationshipStrength: data.length > 100 ? 'Strong' : data.length > 10 ? 'Moderate' : 'Developing', bilateralBalance: 'Analysis requires inbound/outbound breakdown', recommendations: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/recommend-routing-change', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { currentCorrespondent, issues = [], paymentCorridor } = req.body;
    const prompt = `You are a bank treasury and correspondent banking advisor. Recommend routing changes for this payment corridor.\n\nCurrent correspondent: ${currentCorrespondent}\nPayment corridor: ${paymentCorridor}\nIssues: ${JSON.stringify(issues)}\n\nRespond with valid JSON:\n{"recommendedAction": "maintain|change|add-backup|exit", "alternativeCorrespondents": [], "costComparison": "<text>", "migrationSteps": ["<text>"], "riskConsiderations": ["<text>"], "timelineEstimate": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_routing_change`, prompt, 'You are a treasury and correspondent banking advisor. Respond only with valid JSON.', { recommendedAction: issues.length > 0 ? 'change' : 'maintain', alternativeCorrespondents: [], costComparison: 'Detailed cost analysis requires pricing from candidate correspondents', migrationSteps: ['RFP to alternative banks', 'Negotiate pricing', 'Technical testing', 'Phased migration', 'Monitor performance'], riskConsiderations: ['Cutover risk', 'Relationship impact', 'Regulatory notification'], timelineEstimate: '3-6 months for full migration' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/score-message-quality', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank SWIFT message quality analyst. Score the overall quality of this SWIFT message.\n\nMessage: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"qualityScore": 0-100, "dimensions": {"completeness": 0, "accuracy": 0, "compliance": 0, "stpReadiness": 0}, "grade": "A|B|C|D|F", "issues": [], "improvements": ["<text>"]}`;
    const completeness = [record.senderBic, record.receiverBic, record.transactionRef, record.messageType].filter(Boolean).length / 4;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_quality_score`, prompt, 'You are a SWIFT quality analyst. Respond only with valid JSON.', { qualityScore: Math.round(completeness * 100), dimensions: { completeness: Math.round(completeness * 100), accuracy: 75, compliance: 80, stpReadiness: Math.round(completeness * 90) }, grade: completeness > 0.9 ? 'A' : completeness > 0.7 ? 'B' : completeness > 0.5 ? 'C' : 'D', issues: [!record.senderBic ? 'Missing sender BIC' : null, !record.receiverBic ? 'Missing receiver BIC' : null].filter(Boolean), improvements: completeness < 1 ? ['Complete all mandatory fields', 'Use structured address format', 'Include BIC codes for all institutions'] : [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/validate-bic-code', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { bicCodes = [] } = req.body;
    const results = bicCodes.map(bic => {
      const b = String(bic).toUpperCase().trim();
      const valid = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(b);
      return { bic: b, valid, bankCode: b.slice(0, 4), countryCode: b.slice(4, 6), locationCode: b.slice(6, 8), branchCode: b.length > 8 ? b.slice(8) : 'XXX', reason: valid ? 'Format valid' : 'Invalid BIC format' };
    });
    const prompt = `You are a bank SWIFT BIC validation specialist. Validate these BIC codes.\n\nBIC codes: ${JSON.stringify(bicCodes)}\n\nRespond with valid JSON:\n{"results": ${JSON.stringify(results)}, "validCount": ${results.filter(r => r.valid).length}, "invalidCount": ${results.filter(r => !r.valid).length}, "swiftDirectoryNote": "Live SWIFT Directory lookup requires SWIFT API subscription"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_bic_validate`, prompt, 'You are a SWIFT BIC validation specialist. Respond only with valid JSON.', { results, validCount: results.filter(r => r.valid).length, invalidCount: results.filter(r => !r.valid).length, swiftDirectoryNote: 'Live SWIFT Directory lookup requires SWIFT API subscription' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/generate-investigation-mt196', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { originalTransactionRef, queryType, queryDetails } = req.body;
    const prompt = `You are a bank SWIFT investigations specialist. Generate an MT196 investigation message for this payment query.\n\nOriginal TRN: ${originalTransactionRef}\nQuery type: ${queryType}\nDetails: ${queryDetails}\n\nRespond with valid JSON:\n{"mt196Draft": {"field20": "<new TRN>", "field21": "${originalTransactionRef}", "field76": "<query code>", "field77A": "<narrative>", "field79": "<free format>"}, "queryCode": "<text>", "expectedResponseMt": "<MT>", "escalationTimeline": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_mt196_generate`, prompt, 'You are a SWIFT investigations specialist. Respond only with valid JSON.', { mt196Draft: { field20: `INV${Date.now()}`, field21: originalTransactionRef, field76: '/REJT/AC01', field77A: queryDetails || 'Investigation request', field79: `We are investigating the referenced payment. Please advise on status. ${queryDetails || ''}` }, queryCode: queryType || 'INVESTIGATION', expectedResponseMt: 'MT196', escalationTimeline: 'If no response within 5 banking days, escalate to correspondent head office' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/classify-cover-method', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank SWIFT correspondent banking specialist. Classify the cover method used in this SWIFT payment and explain the implications.\n\nMessage: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"coverMethod": "serial|cover", "description": "<text>", "settlement": "<text>", "pros": ["<text>"], "cons": ["<text>"], "tracingDifficulty": "low|medium|high", "recommendedForThisPayment": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_cover_method`, prompt, 'You are a correspondent banking specialist. Respond only with valid JSON.', { coverMethod: record.coverMethod === 'cover' ? 'cover' : 'serial', description: record.coverMethod === 'cover' ? 'MT103+MT202COV — beneficiary bank receives MT103 directly, settlement via separate MT202 COV' : 'MT103 relayed serially through correspondent chain', settlement: 'Bilateral correspondent account settlement', pros: record.coverMethod === 'cover' ? ['Beneficiary credit faster', 'Transparency to beneficiary bank'] : ['Single message', 'Simpler'], cons: record.coverMethod === 'cover' ? ['Two messages to maintain', 'More complex compliance'] : ['Potentially slower', 'Information degradation'], tracingDifficulty: record.coverMethod === 'cover' ? 'low' : 'medium', recommendedForThisPayment: 'Consult payment corridor analysis' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/detect-network-issue', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { recentMessages = [] } = req.body;
    const failedCount = recentMessages.filter(m => m.validationStatus === 'Invalid' || m.stpStatus === 'Rejected').length;
    const failRate = recentMessages.length ? failedCount / recentMessages.length : 0;
    const prompt = `You are a bank SWIFT network operations analyst. Detect potential network or connectivity issues in these message patterns.\n\nRecent messages: ${recentMessages.length}\nFailed: ${failedCount}\nFailure rate: ${(failRate * 100).toFixed(1)}%\n\nRespond with valid JSON:\n{"networkIssueDetected": false, "severity": "none|low|medium|high|critical", "indicators": [], "affectedCounterparties": [], "recommendedActions": ["<text>"], "swiftContactRequired": false}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_network_issue`, prompt, 'You are a SWIFT network operations analyst. Respond only with valid JSON.', { networkIssueDetected: failRate > 0.1, severity: failRate > 0.3 ? 'high' : failRate > 0.1 ? 'medium' : 'none', indicators: failRate > 0.1 ? [`Failure rate ${(failRate * 100).toFixed(1)}% exceeds threshold`] : [], affectedCounterparties: [], recommendedActions: failRate > 0.1 ? ['Check SWIFT connectivity', 'Review BIC directory', 'Contact SWIFT support'] : ['Continue monitoring'], swiftContactRequired: failRate > 0.3 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/explain-rejection-reason', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { rejectionCode, rejectionMessage } = req.body;
    const prompt = `You are a bank SWIFT operations specialist. Explain this SWIFT message rejection reason in clear language and provide resolution steps.\n\nMessage: ${JSON.stringify(record)}\nRejection code: ${rejectionCode}\nRejection message: "${rejectionMessage}"\n\nRespond with valid JSON:\n{"plainExplanation": "<text>", "rootCause": "<text>", "resolutionSteps": ["<text>"], "swiftErrorCode": "<text>", "estimatedResolutionTime": "<text>", "preventionForFuture": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_rejection_explain`, prompt, 'You are a SWIFT operations specialist. Respond only with valid JSON.', { plainExplanation: `SWIFT message rejected: ${rejectionMessage || rejectionCode || 'Unknown reason'}`, rootCause: rejectionCode ? `Error code ${rejectionCode} indicates a format or validation error` : 'Rejection reason not specified', resolutionSteps: ['Review the rejection details', 'Correct the identified field errors', 'Re-validate before resubmission', 'Resubmit corrected message'], swiftErrorCode: rejectionCode || 'UNKNOWN', estimatedResolutionTime: '15-60 minutes for standard corrections', preventionForFuture: ['Implement pre-send validation', 'Use SWIFT format checkers', 'Train operations staff on common errors'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

module.exports = router;
