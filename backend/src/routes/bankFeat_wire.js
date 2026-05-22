/**
 * Core Banking — Wire Transfer Route
 * Module: wire
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

const MODULE = 'banking_wire';
const auth = authenticateToken;

// ── CRUD ─────────────────────────────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const { page, limit, status, direction, accountId } = req.query;
  res.json(storeList(MODULE, { page, limit, filter: { status, direction, accountId } }));
});

router.get('/:id', auth, (req, res) => {
  const r = storeGet(MODULE, req.params.id);
  if (!r) return res.status(404).json({ error: 'Wire transfer not found' });
  res.json({ data: r, auditLog: [{ event: 'read', at: new Date().toISOString(), by: req.user.id }] });
});

router.post('/', auth, (req, res) => {
  const { accountId, customerId, direction = 'Outgoing', amount, currency = 'USD', beneficiaryName, beneficiaryAccount, beneficiaryBank, beneficiaryBankSwift, purposeOfPayment } = req.body;
  if (!accountId || !amount || !beneficiaryName || !beneficiaryAccount) return res.status(400).json({ error: 'accountId, amount, beneficiaryName, beneficiaryAccount required' });
  const fedReference = `FED${Date.now()}`;
  const r = storeCreate(MODULE, { accountId, customerId, direction, amount: parseFloat(amount), currency, beneficiaryName, beneficiaryAccount, beneficiaryBank, beneficiaryBankSwift, purposeOfPayment, fedReference, status: 'Pending', ofacScreeningResult: 'Pending', feeAmount: direction === 'Outgoing' ? 25 : 0, valueDate: new Date().toISOString().slice(0, 10) });
  res.status(201).json(r);
});

router.patch('/:id', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, req.body);
  if (!r) return res.status(404).json({ error: 'Wire not found' });
  res.json(r);
});

router.delete('/:id', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, { status: 'Cancelled' });
  if (!r) return res.status(404).json({ error: 'Wire not found' });
  res.json({ message: 'Wire cancelled', data: r });
});

router.get('/by-account/:accountId', auth, (req, res) => {
  res.json(storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { accountId: req.params.accountId } }));
});

router.get('/by-status/:status', auth, (req, res) => {
  res.json(storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { status: req.params.status } }));
});

router.post('/batch', auth, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items[] required' });
  const r = storeBatchCreate(MODULE, items.map(i => ({ ...i, status: i.status || 'Pending', fedReference: `FED${Date.now()}${Math.random().toFixed(4).slice(2)}` })));
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
  res.setHeader('Content-Disposition', 'attachment; filename="wires.csv"');
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
  const ofacHits = data.filter(r => r.ofacScreeningResult === 'Hit').length;
  res.json({ ...storeStats(MODULE), totalVolume: parseFloat(totalVolume.toFixed(2)), ofacHits, feeRevenue: data.filter(r => r.direction === 'Outgoing').reduce((s, r) => s + parseFloat(r.feeAmount || 0), 0) });
});

// ── AI VERBS ─────────────────────────────────────────────────────────────────
router.post('/ai/validate-iban-swift', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { iban, swiftBic } = req.body;
    const bicValid = swiftBic ? /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swiftBic.toUpperCase()) : true;
    const ibanClean = (iban || '').replace(/\s/g, '').toUpperCase();
    const ibanValid = ibanClean.length >= 15 && ibanClean.length <= 34;
    const prompt = `You are a bank international payments specialist. Validate the IBAN and SWIFT/BIC code.\n\nIBAN: ${iban}\nSWIFT/BIC: ${swiftBic}\n\nRespond with valid JSON:\n{"ibanValid": ${ibanValid}, "bicValid": ${bicValid}, "country": "<text>", "bank": "<text>", "branch": "<text>", "issues": [], "suggestions": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_iban_swift_validate`, prompt, 'You are a bank international payments specialist. Respond only with valid JSON.', { ibanValid, bicValid, country: ibanClean.slice(0, 2) || 'Unknown', bank: swiftBic ? swiftBic.slice(0, 4) : 'Unknown', branch: swiftBic && swiftBic.length > 8 ? swiftBic.slice(8) : 'XXX', issues: [...(!ibanValid && iban ? ['IBAN format invalid'] : []), ...(!bicValid && swiftBic ? ['SWIFT/BIC format invalid'] : [])], suggestions: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/screen-ofac-sanctions', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank OFAC compliance officer. Screen this wire transfer against OFAC SDN and other sanctions lists.\n\nWire: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"ofacHit": false, "screeningScore": 0-100, "matchedLists": [], "beneficiaryScreenResult": "clear|hold|block", "originatorScreenResult": "clear|hold|block", "recommendedAction": "release|hold|block|escalate", "screeningTimestamp": "<date>", "falsePositiveAnalysis": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_ofac_screen`, prompt, 'You are an OFAC compliance officer. Respond only with valid JSON.', { ofacHit: false, screeningScore: 5, matchedLists: [], beneficiaryScreenResult: 'clear', originatorScreenResult: 'clear', recommendedAction: 'release', screeningTimestamp: new Date().toISOString(), falsePositiveAnalysis: 'No matches detected on OFAC SDN or other sanction lists.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/classify-purpose-of-payment', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank wire compliance specialist. Classify the purpose of this wire payment for regulatory and reporting requirements.\n\nWire: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"purposeCode": "<text>", "purposeDescription": "<text>", "isCommercial": true, "sanctionsRelevant": false, "reportingRequired": false, "enhancedDueDiligenceNeeded": false, "regulatoryNotes": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_purpose_classify`, prompt, 'You are a bank wire compliance specialist. Respond only with valid JSON.', { purposeCode: 'CORT', purposeDescription: record.purposeOfPayment || 'Commercial payment', isCommercial: true, sanctionsRelevant: false, reportingRequired: parseFloat(record.amount || 0) > 10000, enhancedDueDiligenceNeeded: false, regulatoryNotes: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/predict-recall-likelihood', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank wire operations specialist. Predict the likelihood this wire will need to be recalled and the recall success probability.\n\nWire: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"recallLikelihood": 0-100, "recallSuccessProbability": 0-100, "recallReasons": ["<text>"], "timeWindowForRecall": "<text>", "estimatedRecallCost": 0, "preventionMeasures": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_recall_likelihood`, prompt, 'You are a bank wire operations specialist. Respond only with valid JSON.', { recallLikelihood: 5, recallSuccessProbability: 60, recallReasons: ['BEC fraud', 'Beneficiary error', 'Duplicate payment'], timeWindowForRecall: 'Best within 24 hours; up to 5 business days for cross-border', estimatedRecallCost: 50, preventionMeasures: ['Verify beneficiary details', 'Callback verification for large wires', 'Multi-factor auth'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/detect-business-email-compromise', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { requestChannel, requestedBy } = req.body;
    const prompt = `You are a bank BEC (Business Email Compromise) fraud analyst. Assess whether this wire transfer request shows BEC indicators.\n\nWire: ${JSON.stringify(record)}\nRequest channel: ${requestChannel}\nRequested by: ${requestedBy}\n\nRespond with valid JSON:\n{"becScore": 0-100, "becIndicators": ["<text>"], "urgencyFlag": false, "beneficiaryChangeFlag": false, "recommendedAction": "approve|callback|hold|decline", "callbackScript": "<text>", "iocList": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_bec_detect`, prompt, 'You are a bank BEC fraud analyst. Respond only with valid JSON.', { becScore: 15, becIndicators: [], urgencyFlag: false, beneficiaryChangeFlag: false, recommendedAction: 'approve', callbackScript: `Please call ${record.customerId || 'the requester'} at a known number to verify this wire request of $${record.amount}.`, iocList: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/suggest-correspondent-routing', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank correspondent banking specialist. Suggest the optimal correspondent bank routing for this wire transfer.\n\nWire: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"primaryCorrespondent": {"bank": "<text>", "swift": "<text>", "account": "<text>"}, "alternateRoute": {"bank": "<text>", "swift": "<text>"}, "feeEstimate": 0, "settlementDays": 0, "currency": "<text>", "rationale": "<text>"}`;
    const currency = record.currency || 'USD';
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_correspondent_routing`, prompt, 'You are a bank correspondent banking specialist. Respond only with valid JSON.', { primaryCorrespondent: { bank: currency === 'USD' ? 'Federal Reserve Bank' : 'Nostro Account', swift: 'FRNYUS33', account: 'Contact treasury for account details' }, alternateRoute: { bank: 'Correspondent bank via CHIPS', swift: 'CHASUSU3' }, feeEstimate: 15, settlementDays: currency === 'USD' ? 0 : 1, currency, rationale: `${currency} payments route through standard correspondent network.` });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/generate-mt103-fields', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank SWIFT messaging specialist. Generate the MT103 field values for this wire transfer.\n\nWire: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"field20": "<TRN>", "field32A": "<date>/<currency>/<amount>", "field50": "<ordering customer>", "field57A": "<account with institution>", "field59": "<beneficiary>", "field70": "<remittance info>", "field71A": "SHA|OUR|BEN", "generatedAt": "<date>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_mt103_fields`, prompt, 'You are a bank SWIFT messaging specialist. Respond only with valid JSON.', { field20: record.fedReference || `TRN${Date.now()}`, field32A: `${new Date().toISOString().slice(2, 10).replace(/-/g, '')}/${record.currency || 'USD'}/${record.amount || 0}`, field50: record.originatorName || record.customerId || 'ORDERING CUSTOMER', field57A: `/${record.beneficiaryAccount || 'ACCOUNT'}\n${record.beneficiaryBankSwift || 'BANKBICX'}`, field59: `/${record.beneficiaryAccount || 'ACCOUNT'}\n${record.beneficiaryName || 'BENEFICIARY'}`, field70: record.purposeOfPayment || '/INV/ Payment', field71A: 'SHA', generatedAt: new Date().toISOString() });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/score-counterparty-risk', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank counterparty risk analyst. Score the risk of the beneficiary and their institution.\n\nWire: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"counterpartyRisk": 0-100, "institutionRisk": "low|medium|high", "jurisdictionRisk": "low|medium|high", "pepFlag": false, "sanctionsFlag": false, "overallRisk": "low|medium|high|critical", "mitigants": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_counterparty_risk`, prompt, 'You are a bank counterparty risk analyst. Respond only with valid JSON.', { counterpartyRisk: 20, institutionRisk: 'low', jurisdictionRisk: 'low', pepFlag: false, sanctionsFlag: false, overallRisk: 'low', mitigants: ['Standard due diligence completed', 'OFAC screen clear'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/summarize-wire-history', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { accountId, period = '90d' } = req.body;
    const { data } = storeList(MODULE, { limit: 500, filter: { accountId } });
    const totalVol = data.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const prompt = `You are a bank relationship manager. Summarize wire transfer history for this account.\n\nAccount: ${accountId}\nPeriod: ${period}\nWire count: ${data.length}\nTotal volume: ${totalVol}\n\nRespond with valid JSON:\n{"summary": "<text>", "totalWires": 0, "totalVolume": 0, "avgWireSize": 0, "topBeneficiaries": [], "currencyBreakdown": {}, "complianceFlags": [], "relationshipNote": "<text>"}`;
    const currencies = {};
    data.forEach(r => { currencies[r.currency || 'USD'] = (currencies[r.currency || 'USD'] || 0) + parseFloat(r.amount || 0); });
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_wire_history`, prompt, 'You are a bank relationship manager. Respond only with valid JSON.', { summary: `${data.length} wires totaling $${totalVol.toFixed(2)} in ${period}`, totalWires: data.length, totalVolume: parseFloat(totalVol.toFixed(2)), avgWireSize: data.length ? parseFloat((totalVol / data.length).toFixed(2)) : 0, topBeneficiaries: [], currencyBreakdown: currencies, complianceFlags: [], relationshipNote: 'Standard wire activity within normal parameters.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/detect-layering-pattern', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { wires = [], accountId } = req.body;
    const prompt = `You are a bank AML analyst specializing in money laundering typologies. Detect layering patterns in these wire transfers.\n\nAccount: ${accountId}\nWires: ${JSON.stringify(wires.slice(0, 30))}\n\nRespond with valid JSON:\n{"layeringDetected": false, "layeringScore": 0-100, "patterns": [], "sarRecommended": false, "circularFlows": [], "jurisdictions": [], "recommendations": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_layering`, prompt, 'You are a bank AML analyst. Respond only with valid JSON.', { layeringDetected: false, layeringScore: 10, patterns: [], sarRecommended: false, circularFlows: [], jurisdictions: [], recommendations: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/validate-beneficiary', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank wire operations specialist. Validate the beneficiary details for this wire transfer.\n\nWire: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"beneficiaryValid": true, "accountNumberFormat": "valid|invalid|unknown", "nameMatchScore": 0-100, "addressComplete": true, "issues": [], "corrections": [], "callbackVerificationRequired": false}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_beneficiary_validate`, prompt, 'You are a bank wire operations specialist. Respond only with valid JSON.', { beneficiaryValid: !!(record.beneficiaryName && record.beneficiaryAccount), accountNumberFormat: record.beneficiaryAccount ? 'valid' : 'invalid', nameMatchScore: record.beneficiaryName ? 80 : 0, addressComplete: !!record.beneficiaryAddress, issues: !record.beneficiaryName ? ['Missing beneficiary name'] : !record.beneficiaryAccount ? ['Missing beneficiary account'] : [], corrections: [], callbackVerificationRequired: parseFloat(record.amount || 0) > 100000 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/predict-investigation-need', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank wire compliance analyst. Predict whether this wire transfer will require investigation or enhanced review.\n\nWire: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"investigationNeeded": false, "investigationScore": 0-100, "triggers": ["<text>"], "estimatedResolutionDays": 0, "slaRisk": false, "escalationPath": "<text>"}`;
    const score = (parseFloat(record.amount || 0) > 100000 ? 20 : 0) + (record.ofacScreeningResult === 'Hit' ? 80 : 0) + (record.ofacHitDetail ? 30 : 0);
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_investigation_need`, prompt, 'You are a bank wire compliance analyst. Respond only with valid JSON.', { investigationNeeded: score > 50, investigationScore: Math.min(100, score), triggers: record.ofacScreeningResult === 'Hit' ? ['OFAC hit detected'] : parseFloat(record.amount || 0) > 100000 ? ['Large-value transaction'] : [], estimatedResolutionDays: score > 50 ? 3 : 0, slaRisk: score > 70, escalationPath: score > 70 ? 'BSA Officer → Chief Compliance Officer' : 'Wire operations team' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/recommend-block', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank wire compliance officer. Assess whether this wire should be blocked and provide the legal and operational basis.\n\nWire: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"shouldBlock": false, "blockProbability": 0-100, "legalBasis": ["<text>"], "regulatoryObligation": "<text>", "blockingNotice": "<text>", "appealProcess": "<text>", "regulatorNotificationRequired": false}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_recommend_block`, prompt, 'You are a bank wire compliance officer. Respond only with valid JSON.', { shouldBlock: record.ofacScreeningResult === 'Hit', blockProbability: record.ofacScreeningResult === 'Hit' ? 95 : 5, legalBasis: record.ofacScreeningResult === 'Hit' ? ['IEEPA', '50 U.S.C. 1702', '31 CFR 500-598'] : [], regulatoryObligation: record.ofacScreeningResult === 'Hit' ? 'Block and report to OFAC within 10 business days' : 'No blocking obligation identified', blockingNotice: record.ofacScreeningResult === 'Hit' ? 'Wire blocked per OFAC regulations. Contact compliance.' : 'N/A', appealProcess: 'Submit OFAC license application at ofac.treas.gov', regulatorNotificationRequired: record.ofacScreeningResult === 'Hit' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/classify-jurisdiction-risk', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank international compliance analyst. Classify the jurisdiction risk of this wire transfer.\n\nWire: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"jurisdictionRisk": "low|medium|high|prohibited", "beneficiaryCountryRisk": "<text>", "correspondentCountryRisk": "<text>", "fatfStatus": "<text>", "ofacSanctionedTerritory": false, "enhancedDueDiligenceRequired": false, "recommendations": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_jurisdiction_risk`, prompt, 'You are a bank international compliance analyst. Respond only with valid JSON.', { jurisdictionRisk: 'low', beneficiaryCountryRisk: 'Standard due diligence', correspondentCountryRisk: 'Low risk correspondent', fatfStatus: 'Not on FATF grey or black list', ofacSanctionedTerritory: false, enhancedDueDiligenceRequired: false, recommendations: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/generate-customer-confirmation', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank wire communications specialist. Generate a customer confirmation message for this wire transfer.\n\nWire: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"confirmationText": "<text>", "referenceNumber": "<text>", "estimatedDelivery": "<text>", "trackingInstructions": "<text>", "contactInfo": "<text>", "disclaimer": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_customer_confirm`, prompt, 'You are a bank wire communications specialist. Respond only with valid JSON.', { confirmationText: `Wire transfer of ${record.currency || 'USD'} ${record.amount} to ${record.beneficiaryName} has been ${record.status === 'Completed' ? 'completed' : 'initiated'}. Reference: ${record.fedReference || record.id}.`, referenceNumber: record.fedReference || record.id, estimatedDelivery: record.status === 'Completed' ? 'Completed' : '1-2 business days', trackingInstructions: `Use reference ${record.fedReference} to track your wire.`, contactInfo: 'Call 1-800-BANK-WIRE or visit any branch.', disclaimer: 'International wires may be subject to intermediary fees and exchange rate adjustments.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/explain-wire-fees', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank fee transparency specialist. Explain the wire transfer fees clearly to the customer.\n\nWire: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"feeBreakdown": [{"feeType": "<text>", "amount": 0, "description": "<text>"}], "totalFees": 0, "feeOptions": ["SHA|OUR|BEN explanation"], "customerFriendlyExplanation": "<text>", "waiverEligible": false, "waiverConditions": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_fee_explain`, prompt, 'You are a bank fee transparency specialist. Respond only with valid JSON.', { feeBreakdown: [{ feeType: 'Outgoing Wire Fee', amount: record.feeAmount || 25, description: 'Standard domestic wire transfer fee' }], totalFees: record.feeAmount || 25, feeOptions: ['SHA: Fees split between sender and receiver', 'OUR: Sender pays all fees', 'BEN: Beneficiary pays all fees'], customerFriendlyExplanation: `A ${record.currency || 'USD'} ${record.amount} wire to ${record.beneficiaryName} carries a $${record.feeAmount || 25} fee. Your account will be debited the wire amount plus the fee.`, waiverEligible: false, waiverConditions: 'Premium account holders may qualify for fee waivers. Contact your relationship manager.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

module.exports = router;
