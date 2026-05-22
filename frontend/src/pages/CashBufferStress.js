import React, { useState } from 'react';

export default function CashBufferStress() {
  const [form, setForm] = useState({ cashBalance: 14000, monthlyBurn: 6200, incomeVolatilityPct: 35, emergencyExpenses: 9000 });
  const [result, setResult] = useState(null);
  const submit = async () => {
    const response = await fetch('/api/cash-buffer-stress/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      body: JSON.stringify(form),
    });
    setResult(await response.json());
  };
  return (
    <div className="page">
      <h1>Cash Buffer Stress</h1>
      {Object.entries(form).map(([key, value]) => (
        <label key={key}>{key.replace(/([A-Z])/g, ' $1')}<input type="number" value={value} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} /></label>
      ))}
      <button onClick={submit}>Stress test</button>
      {result && <section><h2>{result.level.toUpperCase()} · {result.score}/100 · {result.months} months</h2><ul>{result.actions.map((action) => <li key={action}>{action}</li>)}</ul></section>}
    </div>
  );
}
