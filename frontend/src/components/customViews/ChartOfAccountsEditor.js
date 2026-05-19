import React, { useEffect, useState } from 'react';

const API = 'http://localhost:3002/api/custom-views/chart-of-accounts';

function ChartOfAccountsEditor() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);

  const [newCat, setNewCat] = useState({ name: '', type: 'INCOME_STATEMENT', normal: 'DEBIT' });
  const [newRule, setNewRule] = useState({ pattern: '', categoryId: '', subAccount: '' });

  const load = async () => {
    try {
      const r = await fetch(API);
      const j = await r.json();
      setState(j);
      if (j.categories?.length && !newRule.categoryId) {
        setNewRule(r => ({ ...r, categoryId: j.categories[0].id }));
      }
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const post = async (op, payload) => {
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op, payload })
      });
      const j = await r.json();
      setState(j);
    } catch (e) { setError(e.message); }
  };

  if (error) return <div style={{ color: 'crimson' }}>COA error: {error}</div>;
  if (!state) return <div>Loading chart of accounts…</div>;

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ margin: 0, marginBottom: 8 }}>Chart of Accounts & Mapping Rules</h3>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
        CRUD over account categories and the rules that map transaction descriptions to them.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Categories */}
        <div>
          <h4 style={{ margin: '6px 0' }}>Categories ({state.categories.length})</h4>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Name</th><th align="left">Type</th><th align="left">Normal</th><th></th>
              </tr>
            </thead>
            <tbody>
              {state.categories.map(c => (
                <tr key={c.id} style={{ borderTop: '1px solid #eee' }}>
                  <td>{c.name}</td>
                  <td style={{ fontSize: 11, color: '#666' }}>{c.type}</td>
                  <td style={{ fontSize: 11, color: '#666' }}>{c.normal}</td>
                  <td>
                    <button onClick={() => post('remove-category', { id: c.id })}
                            style={{ fontSize: 11 }}>delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input placeholder="Name" value={newCat.name}
              onChange={e => setNewCat({ ...newCat, name: e.target.value })} style={{ flex: 1, padding: 4 }} />
            <select value={newCat.type} onChange={e => setNewCat({ ...newCat, type: e.target.value })}>
              <option>INCOME_STATEMENT</option>
              <option>BALANCE_SHEET</option>
            </select>
            <select value={newCat.normal} onChange={e => setNewCat({ ...newCat, normal: e.target.value })}>
              <option>DEBIT</option>
              <option>CREDIT</option>
            </select>
            <button onClick={() => { post('add-category', newCat); setNewCat({ name: '', type: 'INCOME_STATEMENT', normal: 'DEBIT' }); }}>
              Add
            </button>
          </div>
        </div>

        {/* Rules */}
        <div>
          <h4 style={{ margin: '6px 0' }}>Mapping Rules ({state.rules.length})</h4>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th align="left">Pattern</th><th align="left">Category</th><th align="left">Sub</th><th></th>
              </tr>
            </thead>
            <tbody>
              {state.rules.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid #eee' }}>
                  <td><code>{r.pattern}</code></td>
                  <td>{r.categoryId}</td>
                  <td>{r.subAccount}</td>
                  <td>
                    <button onClick={() => post('remove-rule', { id: r.id })}
                            style={{ fontSize: 11 }}>delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input placeholder="Pattern (e.g. UBER)" value={newRule.pattern}
              onChange={e => setNewRule({ ...newRule, pattern: e.target.value })} style={{ flex: 1, padding: 4 }} />
            <select value={newRule.categoryId}
                    onChange={e => setNewRule({ ...newRule, categoryId: e.target.value })}>
              {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input placeholder="Sub-account" value={newRule.subAccount}
              onChange={e => setNewRule({ ...newRule, subAccount: e.target.value })} style={{ width: 130, padding: 4 }} />
            <button onClick={() => { post('add-rule', newRule); setNewRule({ pattern: '', categoryId: newRule.categoryId, subAccount: '' }); }}>
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChartOfAccountsEditor;
