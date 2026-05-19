import React, { useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { aiRetirementProject } from '../services/api';

function RetirementProject() {
  const [form, setForm] = useState({
    currentAge: 35,
    retirementAge: 65,
    currentSavings: 50000,
    monthlyContribution: 800,
    expectedReturnPct: 7,
    targetAnnualIncome: 80000,
    lifeExpectancy: 90,
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
      const res = await aiRetirementProject({
        currentAge: Number(form.currentAge),
        retirementAge: Number(form.retirementAge),
        currentSavings: Number(form.currentSavings),
        monthlyContribution: Number(form.monthlyContribution),
        expectedReturnPct: Number(form.expectedReturnPct),
        targetAnnualIncome: Number(form.targetAnnualIncome),
        lifeExpectancy: Number(form.lifeExpectancy),
      });
      setResult(res.data);
    } catch (err) {
      const status = err.response?.status;
      if (status === 503) {
        setError('AI service is unavailable: missing OPENROUTER_API_KEY on the server.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to project retirement');
      }
    } finally {
      setLoading(false);
    }
  };

  const a = result?.analysis;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>AI Retirement Projection</h1>
        <p>Project retirement readiness and explore scenario adjustments</p>
      </div>

      <div className="card">
        <h2><Sparkles size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Inputs</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Current Age</label>
              <input type="number" min={18} max={100} value={form.currentAge}
                onChange={(e) => setForm({ ...form, currentAge: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Retirement Age</label>
              <input type="number" min={40} max={100} value={form.retirementAge}
                onChange={(e) => setForm({ ...form, retirementAge: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Current Savings ($)</label>
              <input type="number" min={0} value={form.currentSavings}
                onChange={(e) => setForm({ ...form, currentSavings: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Monthly Contribution ($)</label>
              <input type="number" min={0} value={form.monthlyContribution}
                onChange={(e) => setForm({ ...form, monthlyContribution: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Expected Annual Return (%)</label>
              <input type="number" min={0} max={20} step="0.1" value={form.expectedReturnPct}
                onChange={(e) => setForm({ ...form, expectedReturnPct: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Target Annual Income ($)</label>
              <input type="number" min={0} value={form.targetAnnualIncome}
                onChange={(e) => setForm({ ...form, targetAnnualIncome: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Life Expectancy</label>
              <input type="number" min={50} max={120} value={form.lifeExpectancy}
                onChange={(e) => setForm({ ...form, lifeExpectancy: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Projecting...' : 'Run Projection'}
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
          <p>Running retirement projection...</p>
        </div>
      )}

      {result && !loading && a && (
        <>
          <div className="card">
            <h2>Readiness: {a.readiness}</h2>
            {a.summary && <p>{a.summary}</p>}
            {a.projections && (
              <div className="form-grid">
                <div><strong>Nest Egg:</strong> ${(a.projections.nest_egg_usd || 0).toLocaleString()}</div>
                <div><strong>Annual Income (4% rule):</strong> ${(a.projections.annual_income_4pct_rule_usd || 0).toLocaleString()}</div>
                <div><strong>Shortfall/Surplus:</strong> ${(a.projections.shortfall_or_surplus_usd || 0).toLocaleString()}</div>
              </div>
            )}
          </div>
          {Array.isArray(a.scenarios) && a.scenarios.length > 0 && (
            <div className="card">
              <h3>Scenarios</h3>
              {a.scenarios.map((s, i) => (
                <div key={i} style={{ borderBottom: '1px solid var(--border)', padding: '0.5rem 0' }}>
                  <strong>{s.name}</strong> — {s.delta}
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{s.outcome}</div>
                </div>
              ))}
            </div>
          )}
          {Array.isArray(a.recommendations) && a.recommendations.length > 0 && (
            <div className="card">
              <h3>Recommendations</h3>
              <ul>{a.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}
          {a.disclaimer && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 12 }}>{a.disclaimer}</div>
          )}
        </>
      )}
    </div>
  );
}

export default RetirementProject;
