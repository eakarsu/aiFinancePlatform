# Audit Apply Notes — aiFinancePlatform

Audit source: `_AUDIT/reports/batch_03.md` (#26).

## Original recommendations

Missing AI counterparts:
- `/asset-allocation` — recommend allocation based on risk tolerance, goals
- `/rebalancing-suggest` — when and how to rebalance
- `/budget-optimize` — suggest budget adjustments based on spending
- `/stock-recommend` — recommend stocks based on risk profile
- `/insurance-recommend` — recommend insurance products
- `/retirement-project` — project retirement readiness
- `/fraud-detect` — detect fraudulent transactions
- `/bill-negotiate` — negotiate bill reductions with providers

Missing non-AI features: multi-account aggregation, reporting, alerts config, goals.

Custom features: agentic advisor, real-time monitoring, crypto, ESG, behavioral coaching, ESPP/RSU.

## Implementations applied

1. `POST /api/ai/asset-allocation` — risk-tolerance-driven asset allocation with AI primary path and a static lookup fallback. Persists to `AIAnalysisLog`.
2. `POST /api/ai/rebalancing-suggest` — bucketizes user holdings, computes drift vs. target allocation, calls AI for trades, and falls back to a deterministic dollar-delta calculation if AI fails.
3. `POST /api/ai/budget-optimize` — accepts income + monthly expenses, asks AI for cut/reallocation suggestions, falls back to a "trim top-3 categories by 10%" heuristic.

All three use the existing `callOpenRouter`/`parseAIJson` plumbing, the existing `aiRateLimit` middleware (auto-applied via `app.use('/api/ai', aiRateLimit)`), and `authenticateToken`. Syntax-checked via `node --check`.

## Backlog (prioritized)

### High value, mechanical
- `/stock-recommend` — already have stockScreener.js, wrap with AI scorer.
- `/insurance-recommend` — extend `insuranceOptimizer.js` with an AI scorer endpoint.
- `/retirement-project` — extend `retirementPlanner.js` with an AI projection endpoint.

### Needs product decision
- `/fraud-detect` AI version — current `fraudDetection.js` is rule-based; deciding feature signals + label source needs product input.
- `/bill-negotiate` — needs partner integrations (Truebill/Rocket Money equivalent).

### Needs creds / external
- Multi-account aggregation beyond Plaid (Yodlee, MX) — credentials.
- Crypto portfolio + DeFi yield — needs on-chain provider.
- ESG screening — needs ESG data feed (MSCI, Sustainalytics).

### Larger custom features
- Agentic advisor (multi-step planning over portfolios, goals, taxes).
- Behavioral nudges / push notifications channel.
- ESPP/RSU optimizer.

## Apply pass 3 (frontend)

FE already wired. `frontend/src/App.js` imports and routes 21 dedicated pages including `AssetAllocation.js`, `RebalancingSuggest.js`, `BudgetOptimize.js` — the three endpoints implemented in pass 2. JWT handled via `context/AuthContext` and `services/api.js` (axios with Bearer token from storage). No FE changes needed in pass 3. Action: LEFT-AS-IS.

## Apply pass 4 (mechanical backlog)

Implemented all three "high value, mechanical" backlog items:

| # | Endpoint | BE | FE page | Sidebar |
|---|----------|----|---------|---------|
| 1 | `POST /api/ai/stock-recommend` | `backend/src/routes/ai.js` | `pages/StockRecommend.js` | "AI Stock Picks" |
| 2 | `POST /api/ai/insurance-recommend` | `backend/src/routes/ai.js` | `pages/InsuranceRecommend.js` | "AI Insurance" |
| 3 | `POST /api/ai/retirement-project` | `backend/src/routes/ai.js` | `pages/RetirementProject.js` | "AI Retirement" |

Each BE endpoint reuses `callOpenRouter` + `parseAIJson` and includes a deterministic local fallback when AI errors are non-key-related. New `isMissingKeyError` helper detects missing-key throws from `services/openrouter.js` and returns `503 {"error":"AI service unavailable: OPENROUTER_API_KEY is not configured"}`. Logs to `aIAnalysisLog` consistent with existing endpoints. `aiRateLimit` (already mounted at `/api/ai`) applies. New helpers `aiStockRecommend`, `aiInsuranceRecommend`, `aiRetirementProject` added to `services/api.js`. JWT via existing axios interceptor. Routes registered in `App.js`. Sidebar items added to "Planning" section. `node --check` OK; FE Babel parse OK on all changed/new files.
