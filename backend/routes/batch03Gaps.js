// ============================================================
// === Batch 03 Gaps & Frontend Mounts ===
// Auto-generated Gap-feature endpoints (lean v0).
// TODO: configure credentials (set OPENROUTER_API_KEY).
// ============================================================
const express = require('express');
const router = express.Router();

let _gfReady = false;
async function ensureGapTable(pool) {
  if (_gfReady || !pool) return;
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS gap_features (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(120) NOT NULL,
      user_id INT,
      input JSONB,
      output JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    _gfReady = true;
  } catch (_) { /* tolerant of missing DB */ }
}

async function callAI(prompt) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, status: 503, error: 'AI service unavailable. Set OPENROUTER_API_KEY (TODO: configure credentials).' };
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
      }),
    });
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return { ok: r.ok, status: r.status, text, raw: data };
  } catch (e) {
    return { ok: false, status: 500, error: String(e.message || e) };
  }
}

function buildHandler(slug, label, hint) {
  return async (req, res) => {
    const body = req.body || {};
    const userId = req.user?.id || null;
    const prompt = `Feature: ${label}\nContext hint: ${hint}\nUser input:\n${JSON.stringify(body, null, 2)}\n\nProduce a concise, actionable response.`;
    const ai = await callAI(prompt);
    try {
      const pool = req.app.locals.pool || req.app.get('pool') || null;
      if (pool) {
        await ensureGapTable(pool);
        await pool.query('INSERT INTO gap_features(slug, user_id, input, output) VALUES ($1,$2,$3,$4)',
          [slug, userId, body, { text: ai.text || ai.error || null }]);
      }
    } catch (_) { /* tolerant */ }
    if (!ai.ok) return res.status(ai.status || 500).json({ error: ai.error || ai.text || `Upstream error (${ai.status})`, slug });
    res.json({ slug, label, result: ai.text });
  };
}

router.post('/gap-no-esg-screened-recommender', buildHandler('gap-ai-no-esg-screened-recommender', 'No ESG-screened recommender', 'No ESG-screened recommender'));
router.post('/gap-no-defi-yield-farming-analyser', buildHandler('gap-ai-no-defi-yield-farming-analyser', 'No DeFi yield-farming analyser', 'No DeFi yield-farming analyser'));
router.post('/gap-no-tax-form-preparation-agent-1099-schedule-d', buildHandler('gap-ai-no-tax-form-preparation-agent-1099-schedule-d', 'No tax-form preparation agent (1099/Schedule D)', 'No tax-form preparation agent (1099/Schedule D)'));
router.post('/gap-no-options-derivatives-strategy-advisor', buildHandler('gap-ai-no-options-derivatives-strategy-advisor', 'No options/derivatives strategy advisor', 'No options/derivatives strategy advisor'));
router.post('/gap-no-webhooks-broker-push-events-missing', buildHandler('gap-non-no-webhooks-broker-push-events-missing', 'No webhooks (broker push events missing)', 'No webhooks (broker push events missing)'));
router.post('/gap-no-multi-user-household-joint-account-scoping', buildHandler('gap-non-no-multi-user-household-joint-account-scoping', 'No multi-user household/joint-account scoping', 'No multi-user household/joint-account scoping'));
router.post('/gap-limited-reporting-no-schedule-d-performance-attribution', buildHandler('gap-non-limited-reporting-no-schedule-d-performance-attribution', 'Limited reporting (no Schedule D performance attribution)', 'Limited reporting (no Schedule D performance attribution)'));
router.post('/gap-no-payment-processor-for-advisory-billing', buildHandler('gap-non-no-payment-processor-for-advisory-billing', 'No payment-processor for advisory billing', 'No payment-processor for advisory billing'));
router.post('/gap-limited-multi-currency-international-account-support', buildHandler('gap-non-limited-multi-currency-international-account-support', 'Limited multi-currency / international account support', 'Limited multi-currency / international account support'));
router.post('/gap-no-fractional-share-execution-endpoint', buildHandler('gap-non-no-fractional-share-execution-endpoint', 'No fractional-share execution endpoint', 'No fractional-share execution endpoint'));

module.exports = router;
