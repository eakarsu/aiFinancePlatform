import React, { useState } from 'react';

function FinancialStatementPDF() {
  const [period, setPeriod] = useState('YTD-2025');
  const [status, setStatus] = useState(null);
  const [working, setWorking] = useState(false);

  const url = `http://localhost:3002/api/custom-views/statement-pdf?period=${encodeURIComponent(period)}`;

  const open = async () => {
    setWorking(true);
    setStatus(null);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/pdf')) {
        const blob = await r.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank', 'noopener');
        setStatus(`PDF generated (${(blob.size / 1024).toFixed(1)} KB). Opened in new tab.`);
      } else {
        const j = await r.json();
        setStatus(`JSON fallback: net income $${j.totals?.netIncome?.toLocaleString?.() ?? 'n/a'}`);
      }
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ margin: 0, marginBottom: 8 }}>Financial Statement PDF</h3>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
        Generates a single PDF containing the Profit & Loss and Balance Sheet
        for the chosen reporting period.
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13 }}>Period</label>
        <select value={period} onChange={e => setPeriod(e.target.value)} style={{ padding: 6 }}>
          <option value="YTD-2025">YTD-2025</option>
          <option value="Q1-2025">Q1-2025</option>
          <option value="Q4-2024">Q4-2024</option>
          <option value="FY-2024">FY-2024</option>
        </select>
        <button
          onClick={open}
          disabled={working}
          style={{
            background: '#2563eb', color: '#fff', border: 'none',
            padding: '8px 14px', borderRadius: 4, cursor: 'pointer'
          }}
        >
          {working ? 'Generating…' : 'Generate PDF'}
        </button>
        <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>direct link</a>
      </div>
      {status && <div style={{ marginTop: 10, fontSize: 13 }}>{status}</div>}
    </div>
  );
}

export default FinancialStatementPDF;
