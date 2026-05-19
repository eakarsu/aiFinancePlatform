// === Batch 03 Gaps & Frontend Mounts ===
// Auto-generated frontend page (lean v0). Wires Custom Feature Suggestions
// and Gap endpoints (AI counterparts + non-AI features) to backend routes.
import React, { useState } from 'react';

const API_BASE = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) || 'http://localhost:4000/api';

const FEATURES = [
  { kind: 'cfs', slug: 'cf-agentic-advisor', label: 'Agentic advisor', desc: 'NL goal → allocation, picks, tax-optimised strategy', endpoint: '/cf-agentic-advisor' },
  { kind: 'cfs', slug: 'cf-real-time-monitoring', label: 'Real-time monitoring', desc: 'Stream market, auto-execute TLH and rebalance', endpoint: '/cf-real-time-monitoring' },
  { kind: 'cfs', slug: 'cf-defi-portfolio', label: 'DeFi portfolio', desc: 'Yield-farming + on-chain holdings', endpoint: '/cf-defi-portfolio' },
  { kind: 'cfs', slug: 'cf-esg-screening', label: 'ESG screening', desc: 'Filter by ESG scores, impact tracking', endpoint: '/cf-esg-screening' },
  { kind: 'cfs', slug: 'cf-behavioural-coaching', label: 'Behavioural coaching', desc: 'Nudges against emotional trades', endpoint: '/cf-behavioural-coaching' },
  { kind: 'cfs', slug: 'cf-fractional-shares', label: 'Fractional shares', desc: 'Lower diversification barrier', endpoint: '/cf-fractional-shares' },
  { kind: 'cfs', slug: 'cf-espp-rsu-optimiser', label: 'ESPP/RSU optimiser', desc: 'Employer stock plan helper', endpoint: '/cf-espp-rsu-optimiser' },
  { kind: 'gap-ai', slug: 'gap-ai-no-esg-screened-recommender', label: 'No ESG-screened recommender', desc: 'No ESG-screened recommender', endpoint: '/gap-no-esg-screened-recommender' },
  { kind: 'gap-ai', slug: 'gap-ai-no-defi-yield-farming-analyser', label: 'No DeFi yield-farming analyser', desc: 'No DeFi yield-farming analyser', endpoint: '/gap-no-defi-yield-farming-analyser' },
  { kind: 'gap-ai', slug: 'gap-ai-no-tax-form-preparation-agent-1099-schedule-d', label: 'No tax-form preparation agent (1099/Schedule D)', desc: 'No tax-form preparation agent (1099/Schedule D)', endpoint: '/gap-no-tax-form-preparation-agent-1099-schedule-d' },
  { kind: 'gap-ai', slug: 'gap-ai-no-options-derivatives-strategy-advisor', label: 'No options/derivatives strategy advisor', desc: 'No options/derivatives strategy advisor', endpoint: '/gap-no-options-derivatives-strategy-advisor' },
  { kind: 'gap-non', slug: 'gap-non-no-webhooks-broker-push-events-missing', label: 'No webhooks (broker push events missing)', desc: 'No webhooks (broker push events missing)', endpoint: '/gap-no-webhooks-broker-push-events-missing' },
  { kind: 'gap-non', slug: 'gap-non-no-multi-user-household-joint-account-scoping', label: 'No multi-user household/joint-account scoping', desc: 'No multi-user household/joint-account scoping', endpoint: '/gap-no-multi-user-household-joint-account-scoping' },
  { kind: 'gap-non', slug: 'gap-non-limited-reporting-no-schedule-d-performance-attribution', label: 'Limited reporting (no Schedule D performance attribution)', desc: 'Limited reporting (no Schedule D performance attribution)', endpoint: '/gap-limited-reporting-no-schedule-d-performance-attribution' },
  { kind: 'gap-non', slug: 'gap-non-no-payment-processor-for-advisory-billing', label: 'No payment-processor for advisory billing', desc: 'No payment-processor for advisory billing', endpoint: '/gap-no-payment-processor-for-advisory-billing' },
  { kind: 'gap-non', slug: 'gap-non-limited-multi-currency-international-account-support', label: 'Limited multi-currency / international account support', desc: 'Limited multi-currency / international account support', endpoint: '/gap-limited-multi-currency-international-account-support' },
  { kind: 'gap-non', slug: 'gap-non-no-fractional-share-execution-endpoint', label: 'No fractional-share execution endpoint', desc: 'No fractional-share execution endpoint', endpoint: '/gap-no-fractional-share-execution-endpoint' },
];

function authHeaders() {
  const t = (typeof window !== 'undefined') ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export default function Batch03Features() {
  const [active, setActive] = useState(FEATURES[0]?.slug);
  const [input, setInput] = useState('');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const current = FEATURES.find(f => f.slug === active) || FEATURES[0];

  async function run() {
    if (!current) return;
    setLoading(true); setError(null);
    try {
      let parsed;
      try { parsed = input ? JSON.parse(input) : {}; } catch { parsed = { input }; }
      const r = await fetch(`${API_BASE}${current.endpoint}`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(parsed)
      });
      let body; try { body = await r.json(); } catch { body = { raw: await r.text() }; }
      if (!r.ok) setError(body.error || `HTTP ${r.status}`);
      setResults(prev => ({ ...prev, [current.slug]: body }));
    } catch (e) {
      setError(String(e.message || e));
    } finally { setLoading(false); }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ marginTop: 0 }}>Batch 03 Features <small style={{ color: '#64748b', fontWeight: 400 }}>(aiFinancePlatform)</small></h2>
      <p style={{ color: '#475569', maxWidth: 720 }}>
        Audit-driven AI counterparts, non-AI feature gaps, and custom feature suggestions.
        Backend endpoints prefixed <code>/api/cf-*</code> (custom features) and <code>/api/gap-*</code> (gap fills).
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0' }}>
        {FEATURES.map(f => (
          <button key={f.slug} onClick={() => setActive(f.slug)}
            style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #cbd5e1',
                     background: active === f.slug ? '#1e40af' : '#f8fafc',
                     color: active === f.slug ? 'white' : '#0f172a', cursor: 'pointer', fontSize: 12 }}>
            <span style={{ opacity: 0.7, marginRight: 4 }}>[{f.kind}]</span>{f.label}
          </button>
        ))}
      </div>
      {current && (
        <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: 8 }}>
            <strong>{current.label}</strong>
            <div style={{ color: '#475569', fontSize: 13 }}>{current.desc}</div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>POST <code>{current.endpoint}</code></div>
          </div>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            placeholder='Optional JSON input (e.g. {"query":"..."})'
            style={{ width: '100%', minHeight: 80, padding: 8, fontFamily: 'monospace', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }} />
          <div style={{ marginTop: 8 }}>
            <button onClick={run} disabled={loading}
              style={{ padding: '8px 16px', background: '#1e40af', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Running…' : 'Run'}
            </button>
          </div>
          {error && (<div style={{ marginTop: 12, padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: 13 }}>{error}</div>)}
          {results[current.slug] && (
            <pre style={{ marginTop: 12, padding: 10, background: '#0b1020', color: '#cbd5e1', borderRadius: 4, overflow: 'auto', maxHeight: 360, fontSize: 12 }}>
              {typeof results[current.slug] === 'string' ? results[current.slug] : JSON.stringify(results[current.slug], null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
