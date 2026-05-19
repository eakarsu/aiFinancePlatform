import React, { useEffect, useState } from 'react';

function colorFor(v, min, max) {
  if (max === min) return '#dbeafe';
  const t = (v - min) / (max - min); // 0..1
  // Blue-to-red gradient
  const r = Math.round(40 + t * 200);
  const g = Math.round(80 + (1 - t) * 80);
  const b = Math.round(220 - t * 180);
  return `rgb(${r}, ${g}, ${b})`;
}

function AccountBalanceHeatmap() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('http://localhost:3002/api/custom-views/account-heatmap', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.json())
      .then(j => setData(j))
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div style={{ color: 'crimson' }}>Heatmap error: {error}</div>;
  if (!data) return <div>Loading heatmap…</div>;

  const cellMap = {};
  (data.cells || []).forEach(c => { cellMap[`${c.account}|${c.period}`] = c.balance; });

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ margin: 0, marginBottom: 8 }}>Account Balance Heatmap</h3>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
        Balance by account (rows) × period (cols). Range ${data.min?.toLocaleString()} – ${data.max?.toLocaleString()}.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd' }}>Account</th>
              {data.periods.map(p => (
                <th key={p} style={{ padding: 6, borderBottom: '1px solid #ddd', fontSize: 12 }}>{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.accounts.map(a => (
              <tr key={a}>
                <td style={{ padding: 6, borderBottom: '1px solid #eee', fontWeight: 500 }}>{a}</td>
                {data.periods.map(p => {
                  const v = cellMap[`${a}|${p}`];
                  return (
                    <td
                      key={`${a}-${p}`}
                      title={`$${v?.toLocaleString()}`}
                      style={{
                        padding: '10px 8px',
                        background: colorFor(v, data.min, data.max),
                        color: '#fff',
                        textAlign: 'center',
                        fontSize: 11,
                        minWidth: 70
                      }}
                    >
                      ${(v / 1000).toFixed(0)}k
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AccountBalanceHeatmap;
