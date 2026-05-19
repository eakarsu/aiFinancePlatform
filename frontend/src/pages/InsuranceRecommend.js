import React, { useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { aiInsuranceRecommend } from '../services/api';

function InsuranceRecommend() {
  const [form, setForm] = useState({
    age: 35,
    dependents: 2,
    annualIncome: 80000,
    existingPoliciesCSV: 'auto, renters',
    goalsCSV: 'income replacement, dependent support',
    healthStatus: 'good',
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
      const res = await aiInsuranceRecommend({
        age: Number(form.age),
        dependents: Number(form.dependents),
        annualIncome: Number(form.annualIncome),
        existingPolicies: form.existingPoliciesCSV.split(',').map((s) => s.trim()).filter(Boolean),
        goals: form.goalsCSV.split(',').map((s) => s.trim()).filter(Boolean),
        healthStatus: form.healthStatus,
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

  const recs = result?.analysis?.recommendations || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>AI Insurance Recommendations</h1>
        <p>Get AI guidance on coverage gaps and product recommendations</p>
      </div>

      <div className="card">
        <h2><Sparkles size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Your Situation</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Age</label>
              <input type="number" min={18} max={100} value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Dependents</label>
              <input type="number" min={0} max={20} value={form.dependents}
                onChange={(e) => setForm({ ...form, dependents: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Annual Income ($)</label>
              <input type="number" min={0} value={form.annualIncome}
                onChange={(e) => setForm({ ...form, annualIncome: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Existing Policies (comma-separated)</label>
              <input type="text" value={form.existingPoliciesCSV}
                onChange={(e) => setForm({ ...form, existingPoliciesCSV: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Goals (comma-separated)</label>
              <input type="text" value={form.goalsCSV}
                onChange={(e) => setForm({ ...form, goalsCSV: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Health Status</label>
              <select value={form.healthStatus} onChange={(e) => setForm({ ...form, healthStatus: e.target.value })}>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="average">Average</option>
                <option value="poor">Poor</option>
              </select>
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
          <p>Generating insurance recommendations...</p>
        </div>
      )}

      {result && !loading && (
        <>
          <div className="card">
            <h2>Recommended Coverage</h2>
            {result?.analysis?.summary && <p>{result.analysis.summary}</p>}
            {recs.length > 0 ? (
              <div>
                {recs.map((r, i) => (
                  <div key={i} style={{ borderBottom: '1px solid var(--border)', padding: '1rem 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{r.product}</strong>
                      <span style={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>{r.priority}</span>
                    </div>
                    <div>Suggested coverage: ${(r.suggested_coverage_usd || 0).toLocaleString()}</div>
                    <p style={{ marginTop: 6 }}>{r.rationale}</p>
                    {Array.isArray(r.providers_to_quote) && r.providers_to_quote.length > 0 && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Quote: {r.providers_to_quote.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>{JSON.stringify(result, null, 2)}</pre>
            )}
            {Array.isArray(result?.analysis?.coverage_gaps) && result.analysis.coverage_gaps.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <strong>Coverage Gaps:</strong>
                <ul>{result.analysis.coverage_gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
              </div>
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

export default InsuranceRecommend;
