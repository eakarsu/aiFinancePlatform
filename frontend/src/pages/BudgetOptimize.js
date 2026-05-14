import React, { useState } from 'react';
import { Wallet, Plus, Trash2, Bot } from 'lucide-react';
import { aiBudgetOptimize } from '../services/api';

function BudgetOptimize() {
  const [income, setIncome] = useState(5000);
  const [expenses, setExpenses] = useState([
    { category: 'Housing', amount: 1500 },
    { category: 'Food', amount: 600 },
    { category: 'Transportation', amount: 400 },
    { category: 'Entertainment', amount: 300 },
    { category: 'Subscriptions', amount: 150 }
  ]);
  const [savingsGoal, setSavingsGoal] = useState(1000);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateExpense = (i, field, value) => {
    const next = [...expenses];
    next[i] = { ...next[i], [field]: field === 'amount' ? Number(value) : value };
    setExpenses(next);
  };

  const addExpense = () => setExpenses([...expenses, { category: '', amount: 0 }]);
  const removeExpense = (i) => setExpenses(expenses.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await aiBudgetOptimize({
        monthlyIncome: Number(income),
        monthlyExpenses: expenses,
        savingsGoal: Number(savingsGoal)
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to optimize budget');
    } finally {
      setLoading(false);
    }
  };

  const suggestions = result?.suggestions || result?.data?.suggestions || result?.recommendations || [];
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>AI Budget Optimizer</h1>
        <p>Get AI suggestions for cuts and reallocations to hit your savings goal</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <h2><Wallet size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Income & Goals</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Monthly Income ($)</label>
              <input type="number" min={0} value={income} onChange={(e) => setIncome(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Monthly Savings Goal ($)</label>
              <input type="number" min={0} value={savingsGoal} onChange={(e) => setSavingsGoal(e.target.value)} />
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.85rem' }}>
            Total expenses: ${totalExpenses.toLocaleString()} &middot; Net: ${(Number(income) - totalExpenses).toLocaleString()}
          </p>
        </div>

        <div className="card">
          <h2>Monthly Expenses</h2>
          {expenses.map((ex, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Category</label>
                <input value={ex.category} onChange={(e) => updateExpense(i, 'category', e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Amount ($)</label>
                <input type="number" min={0} value={ex.amount}
                  onChange={(e) => updateExpense(i, 'amount', e.target.value)} />
              </div>
              <button type="button" className="btn-secondary" onClick={() => removeExpense(i)} aria-label="Remove">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="btn-secondary" onClick={addExpense}>
            <Plus size={14} /> Add Category
          </button>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Optimizing...' : 'Optimize My Budget'}
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
          <p>Optimizing your budget...</p>
        </div>
      )}

      {result && !loading && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2>Suggestions</h2>
          {Array.isArray(suggestions) && suggestions.length > 0 ? (
            <ul style={{ paddingLeft: '1.25rem' }}>
              {suggestions.map((s, i) => (
                <li key={i} style={{ marginBottom: '0.75rem' }}>
                  {typeof s === 'string' ? s : (
                    <>
                      <strong>{s.category || s.area || 'Suggestion'}:</strong>{' '}
                      {s.action || s.recommendation || s.suggestion} {s.amount ? <em>(save ${Number(s.amount).toLocaleString()})</em> : null}
                      {s.rationale && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.rationale}</div>}
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>{JSON.stringify(result, null, 2)}</pre>
          )}
          {result.summary && (
            <>
              <h3>Summary</h3>
              <p>{result.summary}</p>
            </>
          )}
          {result.projectedSavings !== undefined && (
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              Projected monthly savings: ${Number(result.projectedSavings).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default BudgetOptimize;
