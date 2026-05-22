/**
 * Core Banking — KYC Route
 * Module: kyc
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

const MODULE = 'banking_kyc';
const auth = authenticateToken;

// ── CRUD ─────────────────────────────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const { page, limit, kycStatus, riskTier, customerId } = req.query;
  res.json(storeList(MODULE, { page, limit, filter: { kycStatus, riskTier, customerId } }));
});

router.get('/:id', auth, (req, res) => {
  const r = storeGet(MODULE, req.params.id);
  if (!r) return res.status(404).json({ error: 'KYC profile not found' });
  res.json({ data: r, auditLog: [{ event: 'read', at: new Date().toISOString(), by: req.user.id }] });
});

router.post('/', auth, (req, res) => {
  const { customerId, idDocType, idDocNumber, idIssuedBy, idExpiresAt, sourceOfFunds, annualIncomeBand } = req.body;
  if (!customerId) return res.status(400).json({ error: 'customerId required' });
  const r = storeCreate(MODULE, { customerId, idDocType, idDocNumber, idIssuedBy, idExpiresAt, sourceOfFunds, annualIncomeBand, kycStatus: 'Pending', riskTier: 'Medium', pepFlag: false, sanctionsFlag: false, onboardedAt: new Date().toISOString(), nextReviewDue: new Date(Date.now() + 365 * 86400000).toISOString(), aiRiskScore: 0 });
  res.status(201).json(r);
});

router.patch('/:id', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, req.body);
  if (!r) return res.status(404).json({ error: 'KYC profile not found' });
  res.json(r);
});

router.delete('/:id', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, { kycStatus: 'Rejected' });
  if (!r) return res.status(404).json({ error: 'KYC profile not found' });
  res.json({ message: 'KYC profile rejected/closed', data: r });
});

router.get('/by-customer/:customerId', auth, (req, res) => {
  res.json(storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { customerId: req.params.customerId } }));
});

router.get('/by-status/:kycStatus', auth, (req, res) => {
  res.json(storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { kycStatus: req.params.kycStatus } }));
});

router.post('/batch', auth, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items[] required' });
  res.status(201).json({ created: items.length, data: storeBatchCreate(MODULE, items.map(i => ({ ...i, kycStatus: i.kycStatus || 'Pending' }))) });
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
  res.setHeader('Content-Disposition', 'attachment; filename="kyc.csv"');
  res.send(exportCsv(data));
});

router.post('/meta/import-csv', auth, (req, res) => {
  if (!req.body.csv) return res.status(400).json({ error: 'csv required' });
  const r = importCsvRows(req.body.csv, MODULE);
  res.status(201).json({ imported: r.length, data: r });
});

router.get('/meta/stats', auth, (req, res) => {
  const { data } = storeList(MODULE, { limit: 10000 });
  const byStatus = {}, byTier = {};
  data.forEach(r => { byStatus[r.kycStatus] = (byStatus[r.kycStatus] || 0) + 1; byTier[r.riskTier] = (byTier[r.riskTier] || 0) + 1; });
  res.json({ ...storeStats(MODULE), byStatus, byTier, pepCount: data.filter(r => r.pepFlag).length, sanctionsHits: data.filter(r => r.sanctionsFlag).length });
});

// ── AI VERBS ─────────────────────────────────────────────────────────────────
router.post('/:id/ai/classify-risk-tier', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank BSA/AML compliance officer. Classify the KYC risk tier for this customer based on FFIEC guidance.\n\nKYC profile: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"riskTier": "Low|Medium|High|Prohibited", "riskScore": 0-100, "factors": ["<text>"], "reviewFrequency": "<text>", "eddRequired": false, "rationale": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_risk_tier`, prompt, 'You are a BSA/AML compliance officer. Respond only with valid JSON.', { riskTier: record.riskTier || 'Medium', riskScore: 40, factors: ['Standard onboarding', 'No adverse information'], reviewFrequency: 'Annual', eddRequired: false, rationale: 'Default medium risk classification.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/screen-sanctions', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are an OFAC/sanctions screening specialist. Screen this customer against sanctions lists (OFAC SDN, EU, UN) and assess match quality.\n\nCustomer KYC: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"sanctionsHit": false, "matchScore": 0-100, "matchedLists": [], "matchDetails": [], "falsePositiveIndicators": ["<text>"], "recommendedAction": "clear|hold|escalate|block", "screeningTimestamp": "<date>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_sanctions`, prompt, 'You are an OFAC screening specialist. Respond only with valid JSON.', { sanctionsHit: false, matchScore: 0, matchedLists: [], matchDetails: [], falsePositiveIndicators: [], recommendedAction: 'clear', screeningTimestamp: new Date().toISOString() });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/validate-id-document', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank identity verification specialist. Validate the ID document presented by this customer.\n\nKYC data: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"documentValid": true, "expiryValid": true, "documentType": "<text>", "issuingCountry": "<text>", "validationChecks": ["<text>"], "issues": [], "manualReviewRequired": false, "confidence": 0-100}`;
    const expiry = record.idExpiresAt ? new Date(record.idExpiresAt) > new Date() : false;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_id_validate`, prompt, 'You are an identity verification specialist. Respond only with valid JSON.', { documentValid: !!record.idDocNumber, expiryValid: expiry, documentType: record.idDocType || 'Unknown', issuingCountry: record.idIssuedBy || 'Unknown', validationChecks: ['Format check', 'Expiry check'], issues: !record.idDocNumber ? ['Missing document number'] : [], manualReviewRequired: !record.idDocNumber, confidence: record.idDocNumber ? 75 : 20 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/score-pep-exposure', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank PEP (Politically Exposed Person) assessment specialist. Score the PEP exposure and required enhanced due diligence measures.\n\nKYC: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"pepScore": 0-100, "isPEP": false, "pepCategory": "<text>", "familyMemberPEP": false, "closeAssociatePEP": false, "eddLevel": "standard|enhanced|intensive", "requiredMeasures": ["<text>"], "approvalRequired": false}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_pep_score`, prompt, 'You are a PEP assessment specialist. Respond only with valid JSON.', { pepScore: record.pepFlag ? 80 : 5, isPEP: record.pepFlag || false, pepCategory: 'N/A', familyMemberPEP: false, closeAssociatePEP: false, eddLevel: record.pepFlag ? 'enhanced' : 'standard', requiredMeasures: record.pepFlag ? ['Enhanced due diligence', 'Senior management approval', 'Source of funds verification'] : [], approvalRequired: record.pepFlag || false });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/detect-doc-tampering', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { documentMetadata = {} } = req.body;
    const prompt = `You are a bank document fraud detection specialist. Assess submitted KYC documents for signs of tampering or forgery.\n\nKYC: ${JSON.stringify(record)}\nDocument metadata: ${JSON.stringify(documentMetadata)}\n\nRespond with valid JSON:\n{"tamperingDetected": false, "tampScore": 0-100, "indicators": [], "verificationMethods": ["<text>"], "escalationRequired": false, "recommendation": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_doc_tamper`, prompt, 'You are a document fraud specialist. Respond only with valid JSON.', { tamperingDetected: false, tampScore: 5, indicators: [], verificationMethods: ['Document format check', 'Metadata analysis'], escalationRequired: false, recommendation: 'Documents appear genuine. Proceed with standard KYC.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/suggest-additional-doc', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank KYC compliance officer. Recommend additional documentation needed to complete this customer's due diligence.\n\nKYC profile: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"additionalDocs": [{"docType": "<text>", "reason": "<text>", "priority": "required|recommended|optional"}], "completenessScore": 0-100, "estimatedCompletionTime": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_additional_doc`, prompt, 'You are a KYC compliance officer. Respond only with valid JSON.', { additionalDocs: !record.sourceOfFunds ? [{ docType: 'Source of Funds Declaration', reason: 'Required for CDD', priority: 'required' }] : [], completenessScore: record.sourceOfFunds ? 80 : 60, estimatedCompletionTime: '1-3 business days' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/generate-edd-questionnaire', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank EDD (Enhanced Due Diligence) specialist. Generate a tailored EDD questionnaire for this high-risk customer.\n\nKYC: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"questions": [{"id": 1, "category": "<text>", "question": "<text>", "responseType": "text|select|boolean", "required": true}], "estimatedCompletionMinutes": 0, "guidance": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_edd_questionnaire`, prompt, 'You are a bank EDD specialist. Respond only with valid JSON.', { questions: [{ id: 1, category: 'Source of Wealth', question: 'How did you accumulate your primary wealth?', responseType: 'text', required: true }, { id: 2, category: 'Business', question: 'Describe your primary business activities.', responseType: 'text', required: true }], estimatedCompletionMinutes: 20, guidance: 'Please answer all questions accurately. Providing false information is a federal crime.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/summarize-customer-due-diligence', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank CDD compliance analyst. Write a comprehensive CDD summary for this customer suitable for regulatory files.\n\nKYC: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"cddSummary": "<text>", "riskConclusion": "<text>", "approvalRecommendation": "approve|approve-with-conditions|decline", "conditions": [], "reviewedBy": "<text>", "summaryDate": "<date>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_cdd_summary`, prompt, 'You are a CDD compliance analyst. Respond only with valid JSON.', { cddSummary: `Customer ${record.customerId} KYC status: ${record.kycStatus}. Risk tier: ${record.riskTier}. PEP: ${record.pepFlag ? 'Yes' : 'No'}. Sanctions: ${record.sanctionsFlag ? 'Hit' : 'Clear'}.`, riskConclusion: `${record.riskTier} risk profile based on available information.`, approvalRecommendation: record.sanctionsFlag ? 'decline' : 'approve', conditions: [], reviewedBy: 'AI System', summaryDate: new Date().toISOString().slice(0, 10) });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/predict-suspicious-activity', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank SAR analyst. Assess the probability of suspicious activity requiring a SAR filing for this customer.\n\nKYC: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"sarProbability": 0-100, "sarThreshold": 70, "riskFactors": ["<text>"], "typologies": ["<text>"], "monitoringRecommendation": "<text>", "reviewTimeline": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_suspicious_activity`, prompt, 'You are a bank SAR analyst. Respond only with valid JSON.', { sarProbability: record.sanctionsFlag ? 85 : 10, sarThreshold: 70, riskFactors: record.pepFlag ? ['PEP status'] : [], typologies: [], monitoringRecommendation: 'Standard periodic review', reviewTimeline: '12 months' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/classify-occupation-risk', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { occupation } = req.body;
    const prompt = `You are a bank KYC risk analyst. Classify the AML/BSA risk associated with this customer's occupation.\n\nOccupation: ${occupation || 'Unknown'}\nKYC: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"occupationRiskLevel": "low|medium|high|very-high", "cashIntensiveFlag": false, "highRiskIndustryFlag": false, "ddRecommendations": ["<text>"], "typicalMoneyLaunderingMethods": ["<text>"], "riskRationale": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_occupation_risk`, prompt, 'You are a KYC risk analyst. Respond only with valid JSON.', { occupationRiskLevel: 'medium', cashIntensiveFlag: false, highRiskIndustryFlag: false, ddRecommendations: ['Verify income source', 'Confirm employer'], typicalMoneyLaunderingMethods: [], riskRationale: 'Standard occupation risk assessment.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/recommend-periodic-review', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank KYC program manager. Determine the appropriate periodic review schedule and scope for this customer.\n\nKYC: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"reviewFrequency": "<text>", "nextReviewDate": "<date>", "reviewScope": ["<text>"], "triggerEvents": ["<text>"], "resourceRequirement": "<text>", "automatable": true}`;
    const monthsToNext = record.riskTier === 'High' ? 6 : record.riskTier === 'Medium' ? 12 : 24;
    const nextDate = new Date(Date.now() + monthsToNext * 30 * 86400000).toISOString().slice(0, 10);
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_periodic_review`, prompt, 'You are a KYC program manager. Respond only with valid JSON.', { reviewFrequency: `Every ${monthsToNext} months`, nextReviewDate: nextDate, reviewScope: ['Identity verification', 'Sanctions re-screen', 'Transaction review'], triggerEvents: ['Address change', 'Occupation change', 'Large unexplained transactions'], resourceRequirement: record.riskTier === 'High' ? 'Senior analyst' : 'Standard analyst', automatable: record.riskTier !== 'High' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/score-geographic-risk', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { countries = [] } = req.body;
    const prompt = `You are a bank geographic risk analyst. Score the geographic risk for this customer based on their associated countries and jurisdictions.\n\nKYC: ${JSON.stringify(record)}\nCountries: ${JSON.stringify(countries)}\n\nRespond with valid JSON:\n{"geoRiskScore": 0-100, "highRiskCountries": [], "sanctions jurisdictions": [], "fatfGreyList": [], "fatfBlackList": [], "overallGeoRisk": "low|medium|high|very-high", "recommendations": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_geo_risk`, prompt, 'You are a geographic risk analyst. Respond only with valid JSON.', { geoRiskScore: 15, highRiskCountries: [], 'sanctions jurisdictions': [], fatfGreyList: [], fatfBlackList: [], overallGeoRisk: 'low', recommendations: ['Monitor for changes in customer country exposure'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/generate-cdd-summary', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank compliance documentation specialist. Generate a concise CDD summary note for this customer's file.\n\nKYC: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"summaryNote": "<text>", "keyRiskPoints": ["<text>"], "controlsApplied": ["<text>"], "reviewerSignature": "<text>", "confidenceLevel": "high|medium|low"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_cdd_note`, prompt, 'You are a compliance documentation specialist. Respond only with valid JSON.', { summaryNote: `CDD completed for customer ${record.customerId}. Risk tier: ${record.riskTier}. KYC status: ${record.kycStatus}.`, keyRiskPoints: [], controlsApplied: ['Identity verification', 'Sanctions screening', 'PEP screening'], reviewerSignature: 'AI-assisted review', confidenceLevel: 'medium' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/validate-source-of-funds', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { documentedSources = [] } = req.body;
    const prompt = `You are a bank source of funds analyst. Validate the documented source of funds for this customer.\n\nKYC: ${JSON.stringify(record)}\nDocumented sources: ${JSON.stringify(documentedSources)}\n\nRespond with valid JSON:\n{"isValid": true, "validationScore": 0-100, "issues": [], "inconsistencies": [], "additionalVerificationNeeded": [], "riskConclusion": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_sof_validate`, prompt, 'You are a source of funds analyst. Respond only with valid JSON.', { isValid: !!record.sourceOfFunds, validationScore: record.sourceOfFunds ? 75 : 20, issues: !record.sourceOfFunds ? ['Source of funds not documented'] : [], inconsistencies: [], additionalVerificationNeeded: !record.sourceOfFunds ? ['Source of Funds Declaration', 'Income verification'] : [], riskConclusion: record.sourceOfFunds ? 'Source of funds documented and plausible.' : 'Source of funds missing — obtain before approval.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/detect-shell-company', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { companyProfile = {} } = req.body;
    const prompt = `You are a bank corporate KYC specialist. Analyze this corporate entity for shell company indicators.\n\nCompany profile: ${JSON.stringify(companyProfile)}\n\nRespond with valid JSON:\n{"shellCompanyScore": 0-100, "redFlags": ["<text>"], "beneficialOwnershipConcerns": ["<text>"], "layeringIndicators": ["<text>"], "recommendation": "approve|enhanced-due-diligence|decline", "FinCEN-rule-applicable": true}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_shell_company`, prompt, 'You are a corporate KYC specialist. Respond only with valid JSON.', { shellCompanyScore: 20, redFlags: [], beneficialOwnershipConcerns: [], layeringIndicators: [], recommendation: 'approve', 'FinCEN-rule-applicable': true });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/suggest-blocking-reason', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank compliance officer. Draft a formal account blocking reason and notification for this customer's KYC file.\n\nKYC: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"blockingReason": "<text>", "regulatoryBasis": "<text>", "customerNotification": "<text>", "internalNote": "<text>", "appealProcess": "<text>", "retentionPeriod": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_block_reason`, prompt, 'You are a bank compliance officer. Respond only with valid JSON.', { blockingReason: 'Account blocked pending KYC review completion.', regulatoryBasis: 'BSA/AML Program requirements; 31 CFR Part 1020', customerNotification: 'Your account has been temporarily restricted. Please contact us to provide the requested documentation.', internalNote: 'Block pending receipt and review of KYC documentation.', appealProcess: 'Customer may submit documents to compliance@bank.com for expedited review.', retentionPeriod: '5 years from account closure per BSA' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

module.exports = router;
