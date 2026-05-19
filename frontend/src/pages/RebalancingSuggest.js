import React, { useState } from 'react';
import { RefreshCw, Plus, Trash2, Bot } from 'lucide-react';
import { aiRebalancingSuggest } from '../services/api';

function RebalancingSuggest() {
  const [holdings, setHoldings] = useState([
    { symbol: 'VTI', assetClass: 'US Equity', value: 6000 },
    { symbol: 'BND', assetClass: 'Bonds', value: 2000 },
    { symbol: 'VXUS', assetClass: 'Intl Equity', value: 2000 }
  ]);
  const [target, setTarget] = useState([
    { assetClass: 'US Equity', percentage: 50 },
    { assetClass: 'Bonds', percentage: 30 },
    { assetClass: 'Intl Equity', percentage: 20 }
  ]);
  const [riskTolerance, setRiskTolerance] = useState('MODERATE');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateHolding = (i, field, value) => {
    const next = [...holdings];
    next[i] = { ...next[i], [field]: field === 'value' ? Number(value) : value };
    setHoldings(next);
  };

  const updateTarget = (i, field, value) => {
    const next = [...target];
    next[i] = { ...next[i], [field]: field === 'percentage' ? Number(value) : value };
    setTarget(next);
  };

  const addHolding = () => setHoldings([...holdings, { symbol: '', assetClass: '', value: 0 }]);
  const removeHolding = (i) => setHoldings(holdings.filter((_, idx) => idx !== i));
  const addTarget = () => setTarget([...target, { assetClass: '', percentage: 0 }]);
  const removeTarget = (i) => setTarget(target.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await aiRebalancingSuggest({
        holdings,
        targetAllocation: target,
        riskTolerance
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch rebalancing plan');
    } finally {
      setLoading(false);
    }
  };

  const trades = result?.trades || result?.data?.trades || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>AI Rebalancing</h1>
        <p>Get AI-driven rebalancing suggestions based on your holdings and target allocation</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <h2>Current Holdings</h2>
          {holdings.map((h, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Symbol</label>
                <input value={h.symbol} onChange={(e) => updateHolding(i, 'symbol', e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Asset Class</label>
                <input value={h.assetClass} onChange={(e) => updateHolding(i, 'assetClass', e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Value ($)</label>
                <input type="number" value={h.value} onChange={(e) => updateHolding(i, 'value', e.target.value)} />
              </div>
              <button type="button" className="btn-secondary" onClick={() => removeHolding(i)} aria-label="Remove">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="btn-secondary" onClick={addHolding}>
            <Plus size={14} /> Add Holding
          </button>
        </div>

        <div className="card">
          <h2>Target Allocation</h2>
          {target.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Asset Class</label>
                <input value={t.assetClass} onChange={(e) => updateTarget(i, 'assetClass', e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Target %</label>
                <input type="number" min={0} max={100} value={t.percentage}
                  onChange={(e) => updateTarget(i, 'percentage', e.target.value)} />
              </div>
              <button type="button" className="btn-secondary" onClick={() => removeTarget(i)} aria-label="Remove">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="btn-secondary" onClick={addTarget}>
            <Plus size={14} /> Add Target
          </button>
          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label>Risk Tolerance</label>
            <select value={riskTolerance} onChange={(e) => setRiskTolerance(e.target.value)}>
              <option value="CONSERVATIVE">Conservative</option>
              <option value="MODERATE">Moderate</option>
              <option value="AGGRESSIVE">Aggressive</option>
            </select>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          <RefreshCw size={14} /> {loading ? 'Calculating...' : 'Get Rebalancing Plan'}
        </button>
      </form>

      {error && (
        <div className="card" style={{ borderLeft: '4px solid #F44336', marginTop: '1rem' }}>
          <h3 style={{ color: '#F44336', marginTop: 0 }}>Error</h3>
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <Bot size={36} style={{ color: 'var(--text-muted)' }} />
          <p>Computing rebalancing plan...</p>
        </div>
      )}

      {result && !loading && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2>Suggested Trades</h2>
          {trades.length > 0 ? (
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Asset</th>
                  <th>Symbol</th>
                  <th>Amount ($)</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr key={i}>
                    <td><strong>{t.action || t.side}</strong></td>
                    <td>{t.assetClass || t.asset || '-'}</td>
                    <td>{t.symbol || '-'}</td>
                    <td>${Number(t.amount || t.dollarAmount || 0).toLocaleString()}</td>
                    <td>{t.reason || t.rationale || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>{JSON.stringify(result, null, 2)}</pre>
          )}
          {result.reasoning && (
            <>
              <h3>AI Reasoning</h3>
              <p>{result.reasoning}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default RebalancingSuggest;
