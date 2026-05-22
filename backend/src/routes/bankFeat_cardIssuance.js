/**
 * Core Banking — Card Issuance Route
 * Module: cardIssuance
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

const MODULE = 'banking_cards';
const auth = authenticateToken;

// ── CRUD ─────────────────────────────────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const { page, limit, cardStatus, cardType, accountId } = req.query;
  res.json(storeList(MODULE, { page, limit, filter: { cardStatus, cardType, accountId } }));
});

router.get('/:id', auth, (req, res) => {
  const r = storeGet(MODULE, req.params.id);
  if (!r) return res.status(404).json({ error: 'Card not found' });
  const masked = { ...r }; // never return full PAN in real implementation
  res.json({ data: masked, auditLog: [{ event: 'read', at: new Date().toISOString(), by: req.user.id }] });
});

router.post('/', auth, (req, res) => {
  const { accountId, customerId, cardType, network = 'Visa', embossedName, creditLimit = 0 } = req.body;
  if (!accountId || !customerId || !cardType) return res.status(400).json({ error: 'accountId, customerId, and cardType required' });
  const last4 = String(Math.floor(Math.random() * 9000) + 1000);
  const now = new Date();
  const r = storeCreate(MODULE, { accountId, customerId, cardType, network, embossedName, last4, creditLimit, availableCredit: creditLimit, cardStatus: 'PendingActivation', issuedAt: now.toISOString(), expiryMonth: now.getMonth() + 1, expiryYear: now.getFullYear() + 4, pinFailCount: 0, contactless: true, virtualCard: false, aiIssuanceRisk: 0 });
  res.status(201).json(r);
});

router.patch('/:id', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, req.body);
  if (!r) return res.status(404).json({ error: 'Card not found' });
  res.json(r);
});

router.delete('/:id', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, { cardStatus: 'Cancelled' });
  if (!r) return res.status(404).json({ error: 'Card not found' });
  res.json({ message: 'Card cancelled', data: r });
});

router.get('/by-account/:accountId', auth, (req, res) => {
  res.json(storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { accountId: req.params.accountId } }));
});

router.get('/by-customer/:customerId', auth, (req, res) => {
  res.json(storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { customerId: req.params.customerId } }));
});

router.post('/batch', auth, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items[] required' });
  const r = storeBatchCreate(MODULE, items.map(i => ({ ...i, cardStatus: i.cardStatus || 'PendingActivation', last4: String(Math.floor(Math.random() * 9000) + 1000) })));
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
  res.setHeader('Content-Disposition', 'attachment; filename="cards.csv"');
  res.send(exportCsv(data));
});

router.post('/meta/import-csv', auth, (req, res) => {
  if (!req.body.csv) return res.status(400).json({ error: 'csv required' });
  const r = importCsvRows(req.body.csv, MODULE);
  res.status(201).json({ imported: r.length, data: r });
});

router.get('/meta/stats', auth, (req, res) => {
  const { data } = storeList(MODULE, { limit: 10000 });
  const byStatus = {}, byType = {};
  data.forEach(r => { byStatus[r.cardStatus] = (byStatus[r.cardStatus] || 0) + 1; byType[r.cardType] = (byType[r.cardType] || 0) + 1; });
  res.json({ ...storeStats(MODULE), byStatus, byType });
});

// ── Special card operations ───────────────────────────────────────────────────
router.post('/:id/activate', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, { cardStatus: 'Active', activatedAt: new Date().toISOString() });
  if (!r) return res.status(404).json({ error: 'Card not found' });
  res.json({ message: 'Card activated', data: r });
});

router.post('/:id/block', auth, (req, res) => {
  const { blockReason } = req.body;
  const r = storeUpdate(MODULE, req.params.id, { cardStatus: 'Blocked', blockedAt: new Date().toISOString(), blockReason });
  if (!r) return res.status(404).json({ error: 'Card not found' });
  res.json({ message: 'Card blocked', data: r });
});

router.post('/:id/pin-reset', auth, (req, res) => {
  const r = storeUpdate(MODULE, req.params.id, { pinFailCount: 0 });
  if (!r) return res.status(404).json({ error: 'Card not found' });
  res.json({ message: 'PIN reset initiated', data: r });
});

// ── AI VERBS ─────────────────────────────────────────────────────────────────
router.post('/:id/ai/classify-issuance-risk', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank card risk analyst. Classify the risk level of issuing this card and recommend controls.\n\nCard: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"issuanceRisk": 0-100, "riskLevel": "low|medium|high", "riskFactors": ["<text>"], "requiredControls": ["<text>"], "recommendedLimit": 0, "approvalRecommendation": "approve|approve-with-conditions|decline"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_issuance_risk`, prompt, 'You are a card risk analyst. Respond only with valid JSON.', { issuanceRisk: 20, riskLevel: 'low', riskFactors: [], requiredControls: ['Standard fraud monitoring'], recommendedLimit: record.creditLimit || 2000, approvalRecommendation: 'approve' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/predict-activation-rate', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { batchId, cardType, channel = 'Mail' } = req.body;
    const { data } = storeList(MODULE, { limit: 1000 });
    const activatedCount = data.filter(c => c.cardStatus === 'Active').length;
    const totalCount = data.length;
    const historicalRate = totalCount ? activatedCount / totalCount : 0.7;
    const prompt = `You are a card product analyst. Predict the activation rate for newly issued cards.\n\nBatch: ${batchId}\nCard type: ${cardType}\nChannel: ${channel}\nHistorical activation rate: ${(historicalRate * 100).toFixed(1)}%\n\nRespond with valid JSON:\n{"predictedActivationRate": 0, "activationWindow": "<text>", "dropOffPoints": ["<text>"], "optimizationTactics": ["<text>"], "revenueImpact": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_activation_rate`, prompt, 'You are a card product analyst. Respond only with valid JSON.', { predictedActivationRate: parseFloat((historicalRate * 100).toFixed(1)), activationWindow: '30 days', dropOffPoints: ['Delivery delay', 'Forgotten card'], optimizationTactics: ['Welcome email', 'Activation reminder SMS'], revenueImpact: 'Each 1% activation improvement generates meaningful interchange revenue' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/detect-fraudulent-application', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { application = {} } = req.body;
    const prompt = `You are a bank card application fraud analyst. Detect fraudulent card application indicators.\n\nApplication: ${JSON.stringify(application)}\n\nRespond with valid JSON:\n{"fraudScore": 0-100, "isFraudulent": false, "indicators": ["<text>"], "syntheticIdentityFlag": false, "velocityFlag": false, "recommendation": "approve|review|decline", "explanation": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_fraud_app`, prompt, 'You are a card fraud analyst. Respond only with valid JSON.', { fraudScore: 10, isFraudulent: false, indicators: [], syntheticIdentityFlag: false, velocityFlag: false, recommendation: 'approve', explanation: 'Application appears legitimate.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/suggest-credit-limit', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { creditScore, annualIncome, existingDebt } = req.body;
    const prompt = `You are a bank credit underwriter. Recommend an appropriate credit limit for this card based on the customer's financial profile.\n\nCard: ${JSON.stringify(record)}\nCredit score: ${creditScore}\nAnnual income: ${annualIncome}\nExisting debt: ${existingDebt}\n\nRespond with valid JSON:\n{"recommendedLimit": 0, "minLimit": 0, "maxLimit": 0, "dtiRatio": 0, "underwritingRationale": "<text>", "approvalConditions": [], "reviewDate": "<date>"}`;
    const income = parseFloat(annualIncome || 0);
    const recommended = Math.min(income * 0.1, creditScore > 750 ? 25000 : creditScore > 650 ? 10000 : 2000);
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_credit_limit`, prompt, 'You are a bank credit underwriter. Respond only with valid JSON.', { recommendedLimit: parseFloat(recommended.toFixed(2)), minLimit: 500, maxLimit: parseFloat((recommended * 1.5).toFixed(2)), dtiRatio: income > 0 ? parseFloat((parseFloat(existingDebt || 0) / income).toFixed(2)) : 0, underwritingRationale: 'Based on income multiple and credit score.', approvalConditions: [], reviewDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10) });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/generate-card-design-recommendation', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { customerSegment, cardType, brandGuidelines = {} } = req.body;
    const prompt = `You are a bank card product design consultant. Recommend card design elements and features for this customer segment.\n\nSegment: ${customerSegment}\nCard type: ${cardType}\nBrand: ${JSON.stringify(brandGuidelines)}\n\nRespond with valid JSON:\n{"designRecommendations": ["<text>"], "materialOptions": ["<text>"], "securityFeatures": ["<text>"], "digitalFeatures": ["<text>"], "productionCostEstimate": "<text>", "differentiationScore": 0-100}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_design_rec`, prompt, 'You are a card design consultant. Respond only with valid JSON.', { designRecommendations: ['Metal card for premium tier', 'Custom artwork for personalization'], materialOptions: ['Standard PVC', 'Metal', 'Recycled material'], securityFeatures: ['EMV chip', 'Contactless', 'Dynamic CVV'], digitalFeatures: ['Apple Pay', 'Google Pay', 'Virtual card'], productionCostEstimate: '$5-25 per card depending on material', differentiationScore: 75 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/predict-spend-pattern', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank card analytics specialist. Predict spending patterns and behavior for this card.\n\nCard: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"predictedMonthlySpend": 0, "topMerchantCategories": [], "avgTransactionSize": 0, "weeklyPattern": "<text>", "seasonalPeaks": ["<text>"], "revenueProjection": {"interchange": 0, "interestIncome": 0, "fees": 0}}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_spend_pattern`, prompt, 'You are a card analytics specialist. Respond only with valid JSON.', { predictedMonthlySpend: parseFloat((parseFloat(record.creditLimit || 0) * 0.3).toFixed(2)), topMerchantCategories: ['Groceries', 'Gas', 'Dining'], avgTransactionSize: 75, weeklyPattern: 'Higher weekend spend', seasonalPeaks: ['November-December holiday season'], revenueProjection: { interchange: parseFloat((parseFloat(record.creditLimit || 0) * 0.3 * 0.02).toFixed(2)), interestIncome: 0, fees: 0 } });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/classify-decline-reason', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { declineCode, transactionAmount, merchantName, cardStatus } = req.body;
    const prompt = `You are a bank card authorization specialist. Classify and explain the decline reason for this transaction.\n\nDecline code: ${declineCode}\nAmount: ${transactionAmount}\nMerchant: ${merchantName}\nCard status: ${cardStatus}\n\nRespond with valid JSON:\n{"category": "insufficient-funds|fraud-block|card-expired|limit-exceeded|technical|other", "customerExplanation": "<text>", "internalReason": "<text>", "actionable": true, "suggestedResolution": "<text>", "contactRequired": false}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_decline_reason`, prompt, 'You are a card authorization specialist. Respond only with valid JSON.', { category: 'other', customerExplanation: 'Your card was declined. Please contact your bank for more information.', internalReason: `Decline code: ${declineCode || 'Unknown'}`, actionable: true, suggestedResolution: 'Contact card services', contactRequired: true });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/detect-skimming-pattern', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { transactions = [], cardIds = [] } = req.body;
    const prompt = `You are a bank card skimming fraud analyst. Detect patterns that indicate card skimming attacks.\n\nTransactions: ${JSON.stringify(transactions.slice(0, 50))}\nAffected cards: ${JSON.stringify(cardIds)}\n\nRespond with valid JSON:\n{"skimmingDetected": false, "confidence": 0-100, "compromisedTerminals": [], "affectedCardCount": 0, "patternDescription": "<text>", "immediateActions": ["<text>"], "forensicFindings": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_skimming`, prompt, 'You are a card fraud analyst. Respond only with valid JSON.', { skimmingDetected: false, confidence: 85, compromisedTerminals: [], affectedCardCount: 0, patternDescription: 'No skimming patterns detected in transaction set.', immediateActions: [], forensicFindings: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/suggest-replacement-strategy', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { replacementReason } = req.body;
    const prompt = `You are a bank card operations specialist. Develop a replacement strategy for this compromised or expired card.\n\nCard: ${JSON.stringify(record)}\nReason: ${replacementReason}\n\nRespond with valid JSON:\n{"strategy": "<text>", "deliveryMethod": "<text>", "timeline": "<text>", "interimMeasures": ["<text>"], "communicationPlan": "<text>", "estimatedCost": 0, "customerImpact": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_replacement`, prompt, 'You are a card operations specialist. Respond only with valid JSON.', { strategy: 'Issue replacement card via expedited mail', deliveryMethod: 'Overnight courier', timeline: '1-3 business days', interimMeasures: ['Enable virtual card', 'Increase mobile wallet limits'], communicationPlan: 'SMS and email notification upon dispatch', estimatedCost: 15, customerImpact: 'Minimal disruption with virtual card fallback' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/generate-fraud-alert-template', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { alertType, cardId, transactionDetails = {} } = req.body;
    const prompt = `You are a bank fraud communications specialist. Generate customer-facing fraud alert templates.\n\nAlert type: ${alertType}\nCard: ${cardId}\nTransaction: ${JSON.stringify(transactionDetails)}\n\nRespond with valid JSON:\n{"smsTemplate": "<text>", "emailSubject": "<text>", "emailBody": "<text>", "pushNotification": "<text>", "callScript": "<text>", "urgencyLevel": "low|medium|high"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_fraud_alert`, prompt, 'You are a fraud communications specialist. Respond only with valid JSON.', { smsTemplate: `BANK ALERT: Unusual activity on card ending ${transactionDetails.last4 || 'XXXX'}. Amount: $${transactionDetails.amount || 0}. Reply YES if authorized, NO to block.`, emailSubject: 'Important: Suspicious Activity Detected on Your Card', emailBody: `We detected unusual activity on your account. Please review the transaction and contact us immediately if unauthorized.`, pushNotification: 'Suspicious card activity detected. Tap to review.', callScript: 'Hello, this is [Bank] fraud prevention calling regarding activity on your account...', urgencyLevel: 'high' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/score-chargeback-risk', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { transaction = {} } = req.body;
    const prompt = `You are a bank dispute management specialist. Score the chargeback risk for this card transaction.\n\nCard: ${JSON.stringify(record)}\nTransaction: ${JSON.stringify(transaction)}\n\nRespond with valid JSON:\n{"chargebackRisk": 0-100, "riskDrivers": ["<text>"], "merchantRisk": "low|medium|high", "preventionActions": ["<text>"], "expectedChargebackRate": 0, "revenueAtRisk": 0}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_chargeback_risk`, prompt, 'You are a dispute management specialist. Respond only with valid JSON.', { chargebackRisk: 10, riskDrivers: [], merchantRisk: 'low', preventionActions: ['Clear merchant descriptor', 'Easy return policy'], expectedChargebackRate: 0.005, revenueAtRisk: parseFloat(transaction.amount || 0) });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/predict-renewal', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank card lifecycle analyst. Predict whether this card should be renewed and what terms to offer.\n\nCard: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"renewalRecommendation": "renew|upgrade|downgrade|cancel", "confidence": 0-100, "rationale": "<text>", "newLimit": 0, "newRewardsOffer": "<text>", "retentionRisk": "<text>", "profitabilityScore": 0-100}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_renewal`, prompt, 'You are a card lifecycle analyst. Respond only with valid JSON.', { renewalRecommendation: 'renew', confidence: 75, rationale: 'Card in good standing, no adverse indicators.', newLimit: record.creditLimit || 2000, newRewardsOffer: '1.5% cash back for first year', retentionRisk: 'low', profitabilityScore: 65 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/recommend-card-product', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { customerProfile = {} } = req.body;
    const prompt = `You are a bank card product advisor. Recommend the best card product for this customer.\n\nCustomer profile: ${JSON.stringify(customerProfile)}\n\nRespond with valid JSON:\n{"recommendedProduct": "<text>", "secondaryOption": "<text>", "annualFee": 0, "apr": 0, "rewardsStructure": "<text>", "keyBenefits": ["<text>"], "approvalLikelihood": 0-100, "pitch": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_product_rec`, prompt, 'You are a card product advisor. Respond only with valid JSON.', { recommendedProduct: 'Everyday Rewards Visa', secondaryOption: 'Cash Back Mastercard', annualFee: 0, apr: 19.99, rewardsStructure: '1.5% on all purchases, 3% on groceries', keyBenefits: ['No annual fee', 'Travel insurance', 'Purchase protection'], approvalLikelihood: 75, pitch: 'Earn rewards on every purchase with no annual fee.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/validate-pin-policy', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { pinPolicy = {} } = req.body;
    const prompt = `You are a bank card security specialist. Validate this PIN policy against PCI DSS requirements and industry standards.\n\nPIN policy: ${JSON.stringify(pinPolicy)}\n\nRespond with valid JSON:\n{"pciCompliant": true, "issues": [], "recommendations": ["<text>"], "pinLength": 4, "lockoutThreshold": 3, "pciReference": "<text>", "riskScore": 0-100}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_pin_policy`, prompt, 'You are a card security specialist. Respond only with valid JSON.', { pciCompliant: (pinPolicy.length || 4) >= 4 && (pinPolicy.lockout || 3) <= 3, issues: [], recommendations: ['Enforce PIN change on first use', 'Block sequential digits'], pinLength: pinPolicy.length || 4, lockoutThreshold: pinPolicy.lockout || 3, pciReference: 'PCI PTS POI v5.x', riskScore: 15 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/ai/detect-velocity-anomaly', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { cardId, transactions = [] } = req.body;
    const last1h = transactions.filter(t => Date.now() - new Date(t.timestamp).getTime() < 3600000);
    const prompt = `You are a bank card velocity fraud analyst. Analyze transaction velocity for this card and detect anomalies.\n\nCard: ${cardId}\nAll transactions: ${transactions.length}\nLast-hour transactions: ${last1h.length}\nTotal amount last hour: ${last1h.reduce((s, t) => s + parseFloat(t.amount || 0), 0)}\n\nRespond with valid JSON:\n{"velocityAnomaly": false, "velocityScore": 0-100, "txCountLastHour": 0, "amountLastHour": 0, "normalProfile": "<text>", "recommendedAction": "allow|alert|block", "explanation": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_velocity_anomaly`, prompt, 'You are a card velocity fraud analyst. Respond only with valid JSON.', { velocityAnomaly: last1h.length > 10, velocityScore: Math.min(100, last1h.length * 8), txCountLastHour: last1h.length, amountLastHour: last1h.reduce((s, t) => s + parseFloat(t.amount || 0), 0), normalProfile: '1-5 transactions per hour', recommendedAction: last1h.length > 10 ? 'alert' : 'allow', explanation: `${last1h.length} transactions in the last hour.` });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

router.post('/:id/ai/summarize-account-card-history', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank relationship manager. Summarize this card account's history and usage for relationship management purposes.\n\nCard: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"summary": "<text>", "tenureMonths": 0, "lifetimeSpend": 0, "avgMonthlySpend": 0, "utilizationRate": 0, "incidentHistory": ["<text>"], "keyMilestones": ["<text>"], "relationshipValue": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_history_summary`, prompt, 'You are a bank relationship manager. Respond only with valid JSON.', { summary: `Card ${record.last4 || 'XXXX'} issued ${record.issuedAt || 'unknown'}. Status: ${record.cardStatus}.`, tenureMonths: 0, lifetimeSpend: 0, avgMonthlySpend: 0, utilizationRate: record.creditLimit ? parseFloat(((record.creditLimit - (record.availableCredit || 0)) / record.creditLimit).toFixed(2)) : 0, incidentHistory: [], keyMilestones: ['Card issued', record.activatedAt ? 'Card activated' : 'Pending activation'], relationshipValue: 'Standard' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

module.exports = router;
