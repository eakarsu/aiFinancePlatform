import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Bot, Sparkles } from 'lucide-react';
import { aiAssetAllocation } from '../services/api';

const COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#8BC34A', '#FF5722'];

function AssetAllocation() {
  const [form, setForm] = useState({
    riskTolerance: 'MODERATE',
    investmentGoal: 'growth',
    timeHorizon: 10,
    age: 35,
    investmentAmount: 10000
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
      const res = await aiAssetAllocation({
        riskTolerance: form.riskTolerance,
        investmentGoal: form.investmentGoal,
        timeHorizon: Number(form.timeHorizon),
        age: Number(form.age),
        investmentAmount: Number(form.investmentAmount)
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch allocation');
    } finally {
      setLoading(false);
    }
  };

  const allocation = result?.allocation || result?.data?.allocation || [];
  const chartData = Array.isArray(allocation)
    ? allocation.map((a) => ({ name: a.asset || a.assetClass || a.name, value: Number(a.percentage || a.percent || a.weight || 0) }))
    : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>AI Asset Allocation</h1>
        <p>Get an AI-recommended asset allocation based on your risk tolerance and goals</p>
      </div>

      <div className="card">
        <h2><Sparkles size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Your Profile</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Risk Tolerance</label>
              <select value={form.riskTolerance} onChange={(e) => setForm({ ...form, riskTolerance: e.target.value })}>
                <option value="CONSERVATIVE">Conservative</option>
                <option value="MODERATE">Moderate</option>
                <option value="AGGRESSIVE">Aggressive</option>
              </select>
            </div>
            <div className="form-group">
              <label>Investment Goal</label>
              <select value={form.investmentGoal} onChange={(e) => setForm({ ...form, investmentGoal: e.target.value })}>
                <option value="retirement">Retirement</option>
                <option value="growth">Wealth Growth</option>
                <option value="income">Passive Income</option>
                <option value="preservation">Capital Preservation</option>
              </select>
            </div>
            <div className="form-group">
              <label>Time Horizon (years)</label>
              <input type="number" min={1} max={50} value={form.timeHorizon}
                onChange={(e) => setForm({ ...form, timeHorizon: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Age</label>
              <input type="number" min={18} max={100} value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Investment Amount ($)</label>
              <input type="number" min={0} value={form.investmentAmount}
                onChange={(e) => setForm({ ...form, investmentAmount: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Analyzing...' : 'Get AI Allocation'}
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
          <p>Generating allocation recommendation...</p>
        </div>
      )}

      {result && !loading && (
        <>
          <div className="card">
            <h2>Recommended Allocation</h2>
            {chartData.length > 0 ? (
              <div className="recommendation-grid">
                <div className="chart-section">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}>
                        {chartData.map((entry, i) => (
                          <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="allocation-details">
                  <h3>Breakdown</h3>
                  {allocation.map((item, i) => (
                    <div key={i} className="allocation-item">
                      <div className="allocation-header">
                        <span className="allocation-asset">{item.asset || item.assetClass || item.name}</span>
                        <span className="allocation-percentage">{item.percentage || item.percent || item.weight}%</span>
                      </div>
                      {item.rationale && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.rationale}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>{JSON.stringify(result, null, 2)}</pre>
            )}
          </div>
          {result.reasoning && (
            <div className="card">
              <h3>AI Reasoning</h3>
              <p>{result.reasoning}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AssetAllocation;
