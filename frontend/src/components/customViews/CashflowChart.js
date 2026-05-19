import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

function CashflowChart() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('http://localhost:3002/api/custom-views/cashflow', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => r.json())
      .then(j => setData(j))
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div style={{ color: 'crimson' }}>Cashflow error: {error}</div>;
  if (!data) return <div>Loading cashflow…</div>;

  const series = (data.series || []).map(p => ({
    period: p.period,
    Inflow: p.inflow,
    Outflow: -Math.abs(p.outflow), // waterfall-style negative bar
    Net: p.net,
    Balance: p.runningBalance
  }));

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ margin: 0, marginBottom: 8 }}>Cashflow Waterfall + Running Balance</h3>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
        Inflow / Outflow bars with cumulative balance line. Ending balance:{' '}
        <strong>${(data.endingBalance || 0).toLocaleString()}</strong>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={series}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="Inflow" stackId="a" fill="#16a34a" />
          <Bar dataKey="Outflow" stackId="a" fill="#dc2626" />
          <Line type="monotone" dataKey="Balance" stroke="#2563eb" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default CashflowChart;
