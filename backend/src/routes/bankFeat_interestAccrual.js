/**
 * Core Banking — Interest Accrual Route
 * Module: interestAccrual
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

const MODULE = 'banking_interest';
const auth = authenticateToken;

// ── CRUD ─────────────────────────────────────────────────────────────────────

// 1. List (paginated + filtered)
router.get('/', auth, (req, res) => {
  const { page, limit, postingStatus, rateType, accountId } = req.query;
  const result = storeList(MODULE, { page, limit, filter: { postingStatus, rateType, accountId } });
  res.json(result);
});

// 2. Get by ID
router.get('/:id', auth, (req, res) => {
  const record = storeGet(MODULE, req.params.id);
  if (!record) return res.status(404).json({ error: 'Accrual record not found' });
  res.json({ data: record, auditLog: [{ event: 'read', at: new Date().toISOString(), by: req.user.id }] });
});

// 3. Create
router.post('/', auth, (req, res) => {
  const { accountId, accrualDate, principal, rate, dayCount = 1, rateType = 'Fixed', dayCountConvention = 'Actual365' } = req.body;
  if (!accountId || !principal || !rate) return res.status(400).json({ error: 'accountId, principal, and rate required' });
  const accrualAmount = (parseFloat(principal) * parseFloat(rate) / 100 / 365) * parseInt(dayCount);
  const record = storeCreate(MODULE, {
    accountId, accrualDate: accrualDate || new Date().toISOString(),
    principal: parseFloat(principal), rate: parseFloat(rate),
    dayCount: parseInt(dayCount), accrualAmount: parseFloat(accrualAmount.toFixed(6)),
    rateType, dayCountConvention, postingStatus: 'Pending', ytdAccrued: 0,
  });
  res.status(201).json(record);
});

// 4. Update
router.patch('/:id', auth, (req, res) => {
  const record = storeUpdate(MODULE, req.params.id, req.body);
  if (!record) return res.status(404).json({ error: 'Accrual record not found' });
  res.json(record);
});

// 5. Soft-delete (status = 'Reversed')
router.delete('/:id', auth, (req, res) => {
  const record = storeUpdate(MODULE, req.params.id, { postingStatus: 'Reversed' });
  if (!record) return res.status(404).json({ error: 'Accrual record not found' });
  res.json({ message: 'Accrual reversed', data: record });
});

// 6. List by account
router.get('/by-account/:accountId', auth, (req, res) => {
  const result = storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { accountId: req.params.accountId } });
  res.json(result);
});

// 7. List by rate type
router.get('/by-rate-type/:rateType', auth, (req, res) => {
  const result = storeList(MODULE, { page: req.query.page, limit: req.query.limit, filter: { rateType: req.params.rateType } });
  res.json(result);
});

// 8. Batch create
router.post('/batch', auth, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'items[] required' });
  const records = storeBatchCreate(MODULE, items.map(i => ({
    ...i, postingStatus: i.postingStatus || 'Pending',
    accrualAmount: i.accrualAmount || parseFloat(((parseFloat(i.principal || 0) * parseFloat(i.rate || 0) / 100 / 365) * (i.dayCount || 1)).toFixed(6)),
  })));
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
  if (!record) return res.status(404).json({ error: 'Accrual not found' });
  res.json({ message: 'Archived', data: record });
});

// 14. Restore
router.post('/:id/restore', auth, (req, res) => {
  const record = storeRestore(MODULE, req.params.id);
  if (!record) return res.status(404).json({ error: 'Accrual not found' });
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
  res.setHeader('Content-Disposition', 'attachment; filename="interest_accruals.csv"');
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
  const totalAccrued = data.reduce((s, r) => s + parseFloat(r.accrualAmount || 0), 0);
  const byRateType = {};
  data.forEach(r => { byRateType[r.rateType] = (byRateType[r.rateType] || 0) + parseFloat(r.accrualAmount || 0); });
  res.json({ ...storeStats(MODULE), totalAccrued: parseFloat(totalAccrued.toFixed(2)), byRateType });
});

// ── AI VERBS ─────────────────────────────────────────────────────────────────

// AI-1: calculate-daily-accrual
router.post('/ai/calculate-daily-accrual', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { principal, rate, dayCountConvention = 'Actual365', rateType = 'Fixed', compoundingFreq = 'Daily' } = req.body;
    const actualAmount = (parseFloat(principal || 0) * parseFloat(rate || 0) / 100) / 365;
    const prompt = `You are a bank interest calculation specialist. Calculate the precise daily interest accrual and explain the methodology.\n\nPrincipal: ${principal}\nRate: ${rate}%\nDay count: ${dayCountConvention}\nRate type: ${rateType}\nCompounding: ${compoundingFreq}\n\nRespond with valid JSON:\n{"dailyAccrual": 0, "annualAmount": 0, "effectiveRate": 0, "apyCalculated": 0, "methodology": "<text>", "dayCountFactor": 0, "compoundingImpact": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_daily_accrual`, prompt, 'You are a bank interest calculation specialist. Respond only with valid JSON.', { dailyAccrual: parseFloat(actualAmount.toFixed(6)), annualAmount: parseFloat((actualAmount * 365).toFixed(2)), effectiveRate: parseFloat(rate || 0), apyCalculated: parseFloat(rate || 0), methodology: `${dayCountConvention} convention applied to ${rateType} rate`, dayCountFactor: 1 / 365, compoundingImpact: 'Minimal for daily accrual' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-2: suggest-rate-tier
router.post('/ai/suggest-rate-tier', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { balance, accountType, marketRate, customerTenureMonths } = req.body;
    const prompt = `You are a bank pricing analyst. Suggest the appropriate interest rate tier for this deposit account.\n\nBalance: ${balance}\nAccount type: ${accountType}\nMarket rate: ${marketRate}%\nCustomer tenure: ${customerTenureMonths} months\n\nRespond with valid JSON:\n{"suggestedRate": 0, "tierName": "<text>", "tierMinBalance": 0, "tierMaxBalance": 0, "rationale": "<text>", "competitivePosition": "<text>", "marginImpact": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_rate_tier`, prompt, 'You are a bank pricing analyst. Respond only with valid JSON.', { suggestedRate: parseFloat(marketRate || 0.5), tierName: 'Standard', tierMinBalance: 0, tierMaxBalance: 999999, rationale: 'Standard market-aligned rate.', competitivePosition: 'At market', marginImpact: 'Neutral' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-3: predict-monthly-posting
router.post('/ai/predict-monthly-posting', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { accountId, months = 3 } = req.body;
    const { data: accruals } = storeList(MODULE, { limit: 365, filter: { accountId } });
    const avgDaily = accruals.length ? accruals.reduce((s, a) => s + parseFloat(a.accrualAmount || 0), 0) / accruals.length : 0;
    const prompt = `You are a bank interest accounting specialist. Predict interest posting amounts for the next ${months} months.\n\nAccount: ${accountId}\nAverage daily accrual: ${avgDaily}\nHistorical accruals count: ${accruals.length}\n\nRespond with valid JSON:\n{"predictions": [{"month": 1, "estimatedPosting": 0, "assumption": "<text>"}], "totalPredicted": 0, "confidenceLevel": 0-100, "keyAssumptions": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_monthly_predict`, prompt, 'You are a bank interest accounting specialist. Respond only with valid JSON.', { predictions: Array.from({ length: months }, (_, i) => ({ month: i + 1, estimatedPosting: parseFloat((avgDaily * 30).toFixed(2)), assumption: 'Constant rate and balance assumed' })), totalPredicted: parseFloat((avgDaily * 30 * months).toFixed(2)), confidenceLevel: accruals.length > 30 ? 80 : 40, keyAssumptions: ['Rate unchanged', 'Balance stable', 'No early termination'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-4: validate-day-count-convention
router.post('/ai/validate-day-count-convention', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { convention, productType, jurisdiction = 'US' } = req.body;
    const prompt = `You are a bank treasury specialist. Validate the day count convention for this product type and jurisdiction.\n\nConvention: ${convention}\nProduct: ${productType}\nJurisdiction: ${jurisdiction}\n\nRespond with valid JSON:\n{"isValid": true, "isStandard": true, "standardForProduct": "<text>", "issues": [], "regulatoryRequirements": ["<text>"], "recommendation": "<text>", "examples": ["<text>"]}`;
    const validConventions = ['Actual360', 'Actual365', '30_360', 'ActualActual'];
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_day_count_validate`, prompt, 'You are a bank treasury specialist. Respond only with valid JSON.', { isValid: validConventions.includes(convention), isStandard: true, standardForProduct: productType === 'MoneyMarket' ? 'Actual360' : 'Actual365', issues: [], regulatoryRequirements: ['FASB ASC 310'], recommendation: `Use ${productType === 'MoneyMarket' ? 'Actual/360' : 'Actual/365'} for ${productType} products in ${jurisdiction}`, examples: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-5: simulate-rate-change-impact
router.post('/ai/simulate-rate-change-impact', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { currentRate, newRate, totalDeposits, scenarios = [] } = req.body;
    const rateChange = (parseFloat(newRate || 0) - parseFloat(currentRate || 0));
    const annualImpact = parseFloat(totalDeposits || 0) * rateChange / 100;
    const prompt = `You are a bank ALM (Asset-Liability Management) analyst. Simulate the impact of a rate change on interest expense and net interest margin.\n\nCurrent rate: ${currentRate}%\nNew rate: ${newRate}%\nTotal deposits: ${totalDeposits}\nRate change: ${rateChange}%\n\nRespond with valid JSON:\n{"annualImpact": 0, "monthlyImpact": 0, "nimEffect": "<text>", "scenarios": [{"name": "<text>", "rateMove": 0, "impact": 0}], "hedgingConsiderations": ["<text>"], "breakEvenPoint": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_rate_impact`, prompt, 'You are a bank ALM analyst. Respond only with valid JSON.', { annualImpact: parseFloat(annualImpact.toFixed(2)), monthlyImpact: parseFloat((annualImpact / 12).toFixed(2)), nimEffect: rateChange > 0 ? 'Margin compression' : 'Margin expansion', scenarios: [{ name: '+25bps', rateMove: 0.25, impact: parseFloat((parseFloat(totalDeposits || 0) * 0.0025).toFixed(2)) }, { name: '+50bps', rateMove: 0.5, impact: parseFloat((parseFloat(totalDeposits || 0) * 0.005).toFixed(2)) }], hedgingConsiderations: ['Consider interest rate swaps', 'Review FHLB advance rates'], breakEvenPoint: 'N/A' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-6: detect-mispost
router.post('/ai/detect-mispost', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { accruals = [] } = req.body;
    const prompt = `You are a bank interest operations analyst. Detect misposts and errors in these interest accrual records.\n\nAccruals: ${JSON.stringify(accruals.slice(0, 30))}\n\nRespond with valid JSON:\n{"misposts": [], "totalMispostAmount": 0, "errorTypes": ["<text>"], "correctionJournals": [], "rootCauses": ["<text>"], "preventionRecommendations": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_mispost`, prompt, 'You are a bank interest operations analyst. Respond only with valid JSON.', { misposts: [], totalMispostAmount: 0, errorTypes: [], correctionJournals: [], rootCauses: [], preventionRecommendations: [] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-7: generate-accrual-journal
router.post('/ai/generate-accrual-journal', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { periodCode, accruals = [] } = req.body;
    const totalAccrual = accruals.reduce((s, a) => s + parseFloat(a.accrualAmount || 0), 0);
    const prompt = `You are a bank accounting specialist. Generate the accounting journal entries for these interest accruals.\n\nPeriod: ${periodCode}\nAccruals: ${JSON.stringify(accruals.slice(0, 20))}\nTotal accrual: ${totalAccrual}\n\nRespond with valid JSON:\n{"journalEntries": [{"glCode": "<code>", "description": "<text>", "debit": 0, "credit": 0}], "totalDebit": 0, "totalCredit": 0, "isBalanced": true, "postingDate": "<date>", "approvalRequired": false}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_accrual_journal`, prompt, 'You are a bank accounting specialist. Respond only with valid JSON.', { journalEntries: [{ glCode: '51000', description: 'Interest Expense — Deposits', debit: parseFloat(totalAccrual.toFixed(2)), credit: 0 }, { glCode: '21000', description: 'Accrued Interest Payable', debit: 0, credit: parseFloat(totalAccrual.toFixed(2)) }], totalDebit: parseFloat(totalAccrual.toFixed(2)), totalCredit: parseFloat(totalAccrual.toFixed(2)), isBalanced: true, postingDate: new Date().toISOString().slice(0, 10), approvalRequired: totalAccrual > 10000 });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-8: classify-promo-rate
router.post('/:id/ai/classify-promo-rate', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank product specialist. Classify whether this interest rate is a promotional rate and identify associated compliance requirements.\n\nAccrual record: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"isPromoRate": false, "promoType": "<text>", "promoExpiryDate": null, "standardRateAfterPromo": 0, "requiredDisclosures": ["<text>"], "reg-z-applicable": false, "complianceNotes": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_promo_classify`, prompt, 'You are a bank product specialist. Respond only with valid JSON.', { isPromoRate: record.rateType === 'Promo', promoType: record.rateType === 'Promo' ? 'Introductory' : 'N/A', promoExpiryDate: record.promoRateExpiry || null, standardRateAfterPromo: 0, requiredDisclosures: ['Reg Z Truth in Savings'], 'reg-z-applicable': true, complianceNotes: 'Review Regulation DD/Z disclosure requirements.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-9: predict-customer-rate-shop
router.post('/:id/ai/predict-customer-rate-shop', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { marketCompetitorRates = [] } = req.body;
    const prompt = `You are a bank deposit retention analyst. Predict the likelihood this customer will shop for a better rate based on their account profile and market rates.\n\nAccrual record: ${JSON.stringify(record)}\nCompetitor rates: ${JSON.stringify(marketCompetitorRates)}\n\nRespond with valid JSON:\n{"rateShoppingProbability": 0-100, "retentionRisk": "low|medium|high", "rateGap": 0, "retentionActions": ["<text>"], "counterOffer": {"suggestedRate": 0, "estimatedRetentionLift": 0}}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_rate_shop`, prompt, 'You are a bank deposit retention analyst. Respond only with valid JSON.', { rateShoppingProbability: 25, retentionRisk: 'low', rateGap: 0, retentionActions: ['Proactive outreach', 'Rate match offer'], counterOffer: { suggestedRate: parseFloat(record.rate || 0) + 0.25, estimatedRetentionLift: 30 } });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-10: suggest-rate-promo
router.post('/ai/suggest-rate-promo', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { targetSegment, competitorRates = [], fundingNeed, duration } = req.body;
    const prompt = `You are a bank marketing and pricing strategist. Design an interest rate promotion to attract deposits.\n\nTarget segment: ${targetSegment}\nFunding need: ${fundingNeed}\nDuration: ${duration}\nCompetitor rates: ${JSON.stringify(competitorRates)}\n\nRespond with valid JSON:\n{"promoRate": 0, "promoName": "<text>", "eligibilityCriteria": ["<text>"], "minimumDeposit": 0, "maximumDeposit": 0, "durationDays": 0, "rolloverRate": 0, "estimatedFundsRaised": 0, "interestCost": 0, "disclosures": ["<text>"]}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_rate_promo`, prompt, 'You are a bank marketing and pricing strategist. Respond only with valid JSON.', { promoRate: 5.0, promoName: 'High-Yield Savings Promo', eligibilityCriteria: ['New deposits only', 'Minimum $1,000'], minimumDeposit: 1000, maximumDeposit: 250000, durationDays: 90, rolloverRate: 4.0, estimatedFundsRaised: 0, interestCost: 0, disclosures: ['APY accurate as of date shown', 'Rate subject to change'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-11: score-margin-erosion
router.post('/ai/score-margin-erosion', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { depositRates = [], loanRates = [], marketIndex } = req.body;
    const avgDeposit = depositRates.length ? depositRates.reduce((s, r) => s + r, 0) / depositRates.length : 0;
    const avgLoan = loanRates.length ? loanRates.reduce((s, r) => s + r, 0) / loanRates.length : 0;
    const nim = avgLoan - avgDeposit;
    const prompt = `You are a bank ALM analyst. Score the net interest margin erosion risk.\n\nAverage deposit rate: ${avgDeposit}%\nAverage loan rate: ${avgLoan}%\nCurrent NIM: ${nim}%\nMarket index: ${marketIndex}%\n\nRespond with valid JSON:\n{"marginErosionScore": 0-100, "currentNim": 0, "targetNim": 0, "erosionTrend": "improving|stable|declining", "keyDrivers": ["<text>"], "hedgingRecommendations": ["<text>"], "outlook": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_margin_erosion`, prompt, 'You are a bank ALM analyst. Respond only with valid JSON.', { marginErosionScore: Math.max(0, 100 - nim * 20), currentNim: parseFloat(nim.toFixed(2)), targetNim: 3.5, erosionTrend: nim < 2 ? 'declining' : nim < 3 ? 'stable' : 'improving', keyDrivers: [], hedgingRecommendations: [], outlook: 'Monitor rate environment closely.' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-12: validate-compounding
router.post('/ai/validate-compounding', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { nominalRate, apy, compoundingFreq, productType } = req.body;
    const n = { Daily: 365, Monthly: 12, Quarterly: 4, SemiAnnual: 2, Annual: 1 }[compoundingFreq] || 12;
    const calculatedApy = Math.pow(1 + parseFloat(nominalRate || 0) / 100 / n, n) - 1;
    const provided = parseFloat(apy || 0) / 100;
    const { result, modelUsed, processingTime } = await aiCall(req.app.get('prisma'), req.user.id, `${MODULE}_compounding_validate`, `Validate: nominal ${nominalRate}%, APY ${apy}%, freq ${compoundingFreq}. Respond with valid JSON: {"isValid":true,"calculatedApy":0,"providedApy":0,"difference":0,"issue":"<text or null>","regulatoryNote":"<text>"}`, 'You are a bank mathematician. Respond only with valid JSON.', { isValid: Math.abs(calculatedApy - provided) < 0.0005, calculatedApy: parseFloat((calculatedApy * 100).toFixed(4)), providedApy: parseFloat(apy || 0), difference: parseFloat(((calculatedApy - provided) * 100).toFixed(4)), issue: Math.abs(calculatedApy - provided) > 0.0005 ? 'APY does not match nominal rate and compounding frequency' : null, regulatoryNote: 'Truth in Savings Act (Reg DD) requires accurate APY disclosure' });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-13: summarize-accrual-period
router.post('/ai/summarize-accrual-period', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { periodCode } = req.body;
    const { data } = storeList(MODULE, { limit: 10000, filter: { periodCode } });
    const totalAccrued = data.reduce((s, r) => s + parseFloat(r.accrualAmount || 0), 0);
    const prompt = `You are a bank interest accounting manager. Summarize the interest accrual activity for this period.\n\nPeriod: ${periodCode}\nTotal accrued: ${totalAccrued}\nRecord count: ${data.length}\n\nRespond with valid JSON:\n{"periodSummary": "<text>", "totalAccrued": 0, "recordCount": 0, "avgDailyAccrual": 0, "byRateType": {}, "highlights": ["<text>"], "exceptions": ["<text>"], "nextActions": ["<text>"]}`;
    const byRateType = {};
    data.forEach(r => { byRateType[r.rateType] = (byRateType[r.rateType] || 0) + parseFloat(r.accrualAmount || 0); });
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_period_summary`, prompt, 'You are a bank interest accounting manager. Respond only with valid JSON.', { periodSummary: `Period ${periodCode}: ${data.length} accrual records, total $${totalAccrued.toFixed(2)}`, totalAccrued: parseFloat(totalAccrued.toFixed(2)), recordCount: data.length, avgDailyAccrual: data.length ? parseFloat((totalAccrued / data.length).toFixed(6)) : 0, byRateType, highlights: [], exceptions: [], nextActions: ['Post accruals to GL', 'Review variance report'] });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-14: generate-disclosure-text
router.post('/ai/generate-disclosure-text', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const { productType, rate, apy, compoundingFreq, minBalance, fees = [] } = req.body;
    const prompt = `You are a bank compliance officer specializing in Truth in Savings (Regulation DD). Generate the required interest rate disclosure text for this deposit product.\n\nProduct: ${productType}\nRate: ${rate}%\nAPY: ${apy}%\nCompounding: ${compoundingFreq}\nMinimum balance: ${minBalance}\nFees: ${JSON.stringify(fees)}\n\nRespond with valid JSON:\n{"disclosureText": "<text>", "regDDCompliant": true, "requiredElements": ["<text>"], "missingElements": [], "consumerFriendlyVersion": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_disclosure_text`, prompt, 'You are a bank compliance officer. Respond only with valid JSON.', { disclosureText: `${productType}: ${rate}% interest rate. Annual Percentage Yield (APY): ${apy}%. Interest is compounded ${compoundingFreq} and credited monthly. Minimum balance to open account: $${minBalance || 0}. Fees may reduce earnings.`, regDDCompliant: true, requiredElements: ['Interest rate', 'APY', 'Compounding frequency', 'Minimum balance', 'Effect of fees'], missingElements: [], consumerFriendlyVersion: `Earn ${apy}% APY on your ${productType}.` });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-15: explain-rate-calc
router.post('/:id/ai/explain-rate-calc', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const prompt = `You are a bank customer education specialist. Explain in plain language how the interest was calculated for this accrual record.\n\nAccrual record: ${JSON.stringify(record)}\n\nRespond with valid JSON:\n{"plainLanguageExplanation": "<text>", "formula": "<text>", "stepByStep": ["<text>"], "customerFacing": "<text>", "glossary": {"<term>": "<definition>"}}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_rate_explain`, prompt, 'You are a bank customer education specialist. Respond only with valid JSON.', { plainLanguageExplanation: `Your interest was calculated using your balance of $${record.principal} at a ${record.rate}% annual rate for ${record.dayCount} day(s).`, formula: 'Interest = Principal × Rate/100 / 365 × Days', stepByStep: [`Principal: $${record.principal}`, `Annual rate: ${record.rate}%`, `Days: ${record.dayCount}`, `Result: $${record.accrualAmount}`], customerFacing: `You earned $${record.accrualAmount} in interest today.`, glossary: { APY: 'Annual Percentage Yield — the effective annual rate including compounding', 'Day Count': 'The number of days for which interest is calculated' } });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

// AI-16: predict-cd-renewal
router.post('/:id/ai/predict-cd-renewal', auth, async (req, res) => {
  try {
    const prisma = req.app.get('prisma');
    const record = storeGet(MODULE, req.params.id) || req.body;
    const { marketRateForecast, customerHistory } = req.body;
    const prompt = `You are a bank deposit product specialist. Predict whether this CD customer will renew at maturity and at what terms.\n\nCurrent accrual: ${JSON.stringify(record)}\nMarket rate forecast: ${marketRateForecast}%\nCustomer history: ${JSON.stringify(customerHistory)}\n\nRespond with valid JSON:\n{"renewalProbability": 0-100, "predictedNewTerm": "<text>", "predictedNewAmount": 0, "retentionScore": 0-100, "earlyWithdrawalRisk": 0-100, "recommendedOutreachTiming": "<text>", "offerRecommendation": "<text>"}`;
    const { result, modelUsed, processingTime } = await aiCall(prisma, req.user.id, `${MODULE}_cd_renewal`, prompt, 'You are a bank deposit product specialist. Respond only with valid JSON.', { renewalProbability: 65, predictedNewTerm: '12 months', predictedNewAmount: parseFloat(record.principal || 0), retentionScore: 65, earlyWithdrawalRisk: 15, recommendedOutreachTiming: '30 days before maturity', offerRecommendation: `Offer ${parseFloat(record.rate || 0) + 0.25}% for renewal to exceed current market.` });
    res.json({ analysis: result, poweredBy: modelUsed, processingTime });
  } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

module.exports = router;
