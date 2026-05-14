import React, { useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { aiStockRecommend } from '../services/api';

function StockRecommend() {
  const [form, setForm] = useState({
    riskProfile: 'moderate',
    sectorsCSV: 'Technology, Healthcare',
    maxRecommendations: 5,
    capitalUSD: 25000,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const sectors = form.sectorsCSV
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await aiStockRecommend({
        riskProfile: form.riskProfile,
        sectors,
        maxRecommendations: Number(form.maxRecommendations),
        capitalUSD: Number(form.capitalUSD),
      });
      setResult(res.data);
    } catch (err) {
      const status = err.response?.status;
      if (status === 503) {
        setError('AI service is unavailable: missing OPENROUTER_API_KEY on the server.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to fetch recommendations');
      }
    } finally {
      setLoading(false);
    }
  };

  const recs = result?.analysis?.recommendations || result?.recommendations || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>AI Stock Recommendations</h1>
        <p>Get AI-curated stock and ETF picks based on your risk profile</p>
      </div>

      <div className="card">
        <h2><Sparkles size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Your Profile</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Risk Profile</label>
              <select value={form.riskProfile} onChange={(e) => setForm({ ...form, riskProfile: e.target.value })}>
                <option value="conservative">Conservative</option>
                <option value="moderate">Moderate</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>
            <div className="form-group">
              <label>Preferred Sectors (comma-separated)</label>
              <input type="text" value={form.sectorsCSV}
                onChange={(e) => setForm({ ...form, sectorsCSV: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Max Recommendations</label>
              <input type="number" min={1} max={20} value={form.maxRecommendations}
                onChange={(e) => setForm({ ...form, maxRecommendations: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Capital Available ($)</label>
              <input type="number" min={0} value={form.capitalUSD}
                onChange={(e) => setForm({ ...form, capitalUSD: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Analyzing...' : 'Get Recommendations'}
          </button>
        </form>
      </div>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid #F44336' }}>
          <h3 style={{ color: '#F44336', marginTop: 0 }}>Error</h3>
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <Bot size={36} style={{ color: 'var(--text-muted)' }} />
          <p>Generating stock recommendations...</p>
        </div>
      )}

      {result && !loading && (
        <>
          <div className="card">
            <h2>Recommended Stocks</h2>
            {result?.analysis?.summary && <p>{result.analysis.summary}</p>}
            {recs.length > 0 ? (
              <div>
                {recs.map((r, i) => (
                  <div key={i} style={{ borderBottom: '1px solid var(--border)', padding: '1rem 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{r.ticker} — {r.company}</strong>
                      <span>{r.suggested_weight_pct}%</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.sector}</div>
                    <p style={{ marginTop: 6 }}>{r.thesis || r.rationale}</p>
                    {Array.isArray(r.risk_factors) && r.risk_factors.length > 0 && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Risk factors: {r.risk_factors.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>{JSON.stringify(result, null, 2)}</pre>
            )}
            {result?.analysis?.disclaimer && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 12 }}>
                {result.analysis.disclaimer}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default StockRecommend;
