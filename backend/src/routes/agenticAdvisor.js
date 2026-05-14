// Agentic advisor: NL goal → allocation, picks, tax-optimised strategy.
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { callOpenRouter } = require('../services/openrouter');
const { parseAIJson } = require('../utils/parseAIJson');

// POST /api/agentic-advisor/plan { goal, time_horizon_years, risk_tolerance, monthly_contribution }
router.post('/plan', authenticateToken, async (req, res) => {
  try {
    const { goal, time_horizon_years, risk_tolerance, monthly_contribution } = req.body || {};
    if (!goal) return res.status(400).json({ error: 'goal required' });
    const system = 'Senior financial advisor. Output JSON {"allocation":{"stocks":pct,"bonds":pct,"cash":pct,"alternatives":pct},"picks":["..."],"tax_strategy":"...","rationale":"..."}.';
    let parsed;
    try {
      const raw = await callOpenRouter(JSON.stringify({ goal, time_horizon_years, risk_tolerance, monthly_contribution }), system);
      parsed = parseAIJson(raw) || { raw };
    } catch (e) {
      return res.status(503).json({ error: 'LLM unavailable' });
    }
    return res.json({ goal, plan: parsed });
  } catch (e) {
    return res.status(500).json({ error: 'plan failed' });
  }
});

module.exports = router;
