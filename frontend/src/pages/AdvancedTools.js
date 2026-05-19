import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  aiFraudDetect, aiBillNegotiate, aiAgenticAdvice, aiBehavioralNudge,
  aiEsppRsuOptimize, aiYodleeAggregate, aiMxAggregate, aiEsgScreen, aiDefiYield
} from '../services/api';

const tabs = [
  { key: 'fraud', label: 'Fraud Detect (AI)' },
  { key: 'bill', label: 'Bill Negotiator (AI)' },
  { key: 'agentic', label: 'Agentic Advisor' },
  { key: 'nudge', label: 'Behavioral Nudges' },
  { key: 'espp', label: 'ESPP/RSU Optimize' },
  { key: 'yodlee', label: 'Yodlee (creds)' },
  { key: 'mx', label: 'MX (creds)' },
  { key: 'esg', label: 'ESG Screen (creds)' },
  { key: 'defi', label: 'DeFi Yield (creds)' },
];

function AdvancedTools() {
  const [tab, setTab] = useState('fraud');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Fraud detect
  const [fraudJson, setFraudJson] = useState(JSON.stringify([
    { id: 't1', amount: 25, merchant: 'Coffee Shop', mcc: '5814' },
    { id: 't2', amount: 9500, merchant: 'Unknown LLC', mcc: '6051' }
  ], null, 2));
  const [fraudBaseline, setFraudBaseline] = useState(JSON.stringify({ avgTransactionUSD: 80, country: 'US' }, null, 2));

  // Bill negotiator
  const [bnProvider, setBnProvider] = useState('Comcast');
  const [bnBill, setBnBill] = useState(120);
  const [bnType, setBnType] = useState('internet');
  const [bnTenure, setBnTenure] = useState(36);
  const [bnComp, setBnComp] = useState('AT&T fiber $70/mo');

  // Agentic
  const [agGoals, setAgGoals] = useState(JSON.stringify([
    { name: 'Buy home', amount: 100000, deadlineYears: 3 },
    { name: 'Retirement', amount: 1500000, deadlineYears: 25 }
  ], null, 2));
  const [agPortfolio, setAgPortfolio] = useState(JSON.stringify({ stocks: 60, bonds: 30, cash: 10 }, null, 2));

  // Nudges
  const [nudgeBeh, setNudgeBeh] = useState(JSON.stringify({ overspentCategories: ['dining'], missedSavings: true }, null, 2));
  const [nudgeEmotion, setNudgeEmotion] = useState('Recently feeling FOMO about crypto');

  // ESPP/RSU
  const [esppPlan, setEsppPlan] = useState(JSON.stringify({ discountPct: 15, lookback: true, employerTicker: 'XYZ' }, null, 2));
  const [rsuGrants, setRsuGrants] = useState(JSON.stringify([{ id: 'g1', shares: 200, vestDate: '2026-01-15', ticker: 'XYZ' }], null, 2));
  const [salary, setSalary] = useState(180000);
  const [taxBracket, setTaxBracket] = useState(35);

  const parseJson = (str, label) => {
    try { return JSON.parse(str); } catch (e) { throw new Error(`${label}: invalid JSON — ${e.message}`); }
  };

  const run = async (fn) => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fn();
      setResult(res.data);
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      if (status === 503 && data?.missing) {
        setError(`Service unavailable: missing env var(s): ${data.missing}`);
      } else if (status === 503) {
        setError(data?.error || 'AI service unavailable: missing OPENROUTER_API_KEY');
      } else {
        setError(data?.error || err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Advanced AI Tools</h1>
        <p>Apply pass 5 backlog: agentic advisor, fraud detect, bill negotiator, ESPP/RSU, ESG/DeFi (cred-gated)</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {tabs.map(t => (
            <button key={t.key} type="button"
              onClick={() => { setTab(t.key); setError(null); setResult(null); }}
              style={{
                padding: '8px 14px', borderRadius: 6, border: '1px solid #ccc',
                background: tab === t.key ? '#1a73e8' : '#f5f5f5',
                color: tab === t.key ? '#fff' : '#333', cursor: 'pointer'
              }}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === 'fraud' && (
        <div className="card">
          <h2><Sparkles size={18} /> Fraud Detection</h2>
          <div className="form-group">
            <label>Transactions JSON</label>
            <textarea value={fraudJson} onChange={e => setFraudJson(e.target.value)} rows={8} style={{ width: '100%', fontFamily: 'monospace' }} />
          </div>
          <div className="form-group">
            <label>User baseline JSON</label>
            <textarea value={fraudBaseline} onChange={e => setFraudBaseline(e.target.value)} rows={4} style={{ width: '100%', fontFamily: 'monospace' }} />
          </div>
          <button disabled={loading} onClick={() => run(async () => aiFraudDetect({ transactions: parseJson(fraudJson, 'tx'), userBaseline: parseJson(fraudBaseline, 'baseline') }))}>{loading ? 'Scoring...' : 'Detect'}</button>
        </div>
      )}

      {tab === 'bill' && (
        <div className="card">
          <h2><Sparkles size={18} /> Bill Negotiator</h2>
          <div className="form-grid">
            <div className="form-group"><label>Provider</label><input value={bnProvider} onChange={e => setBnProvider(e.target.value)} /></div>
            <div className="form-group"><label>Bill type</label><input value={bnType} onChange={e => setBnType(e.target.value)} /></div>
            <div className="form-group"><label>Current bill USD/mo</label><input type="number" value={bnBill} onChange={e => setBnBill(e.target.value)} /></div>
            <div className="form-group"><label>Tenure months</label><input type="number" value={bnTenure} onChange={e => setBnTenure(e.target.value)} /></div>
            <div className="form-group"><label>Competitor offer</label><input value={bnComp} onChange={e => setBnComp(e.target.value)} /></div>
          </div>
          <button disabled={loading} onClick={() => run(async () => aiBillNegotiate({ provider: bnProvider, billType: bnType, currentBillUSD: Number(bnBill), tenureMonths: Number(bnTenure), competitorOffer: bnComp }))}>{loading ? 'Drafting...' : 'Generate Plan'}</button>
        </div>
      )}

      {tab === 'agentic' && (
        <div className="card">
          <h2><Sparkles size={18} /> Agentic Advisor</h2>
          <div className="form-group">
            <label>Goals JSON</label>
            <textarea value={agGoals} onChange={e => setAgGoals(e.target.value)} rows={6} style={{ width: '100%', fontFamily: 'monospace' }} />
          </div>
          <div className="form-group">
            <label>Portfolio JSON</label>
            <textarea value={agPortfolio} onChange={e => setAgPortfolio(e.target.value)} rows={4} style={{ width: '100%', fontFamily: 'monospace' }} />
          </div>
          <button disabled={loading} onClick={() => run(async () => aiAgenticAdvice({ goals: parseJson(agGoals, 'goals'), portfolio: parseJson(agPortfolio, 'portfolio') }))}>{loading ? 'Planning...' : 'Generate Plan'}</button>
        </div>
      )}

      {tab === 'nudge' && (
        <div className="card">
          <h2><Sparkles size={18} /> Behavioral Nudges</h2>
          <div className="form-group">
            <label>Recent behavior JSON</label>
            <textarea value={nudgeBeh} onChange={e => setNudgeBeh(e.target.value)} rows={4} style={{ width: '100%', fontFamily: 'monospace' }} />
          </div>
          <div className="form-group">
            <label>Emotional context</label>
            <input value={nudgeEmotion} onChange={e => setNudgeEmotion(e.target.value)} style={{ width: '100%' }} />
          </div>
          <button disabled={loading} onClick={() => run(async () => aiBehavioralNudge({ recentBehavior: parseJson(nudgeBeh, 'behavior'), emotionalContext: nudgeEmotion }))}>{loading ? 'Generating...' : 'Get Nudges'}</button>
        </div>
      )}

      {tab === 'espp' && (
        <div className="card">
          <h2><Sparkles size={18} /> ESPP / RSU Optimize</h2>
          <div className="form-group">
            <label>ESPP plan JSON</label>
            <textarea value={esppPlan} onChange={e => setEsppPlan(e.target.value)} rows={4} style={{ width: '100%', fontFamily: 'monospace' }} />
          </div>
          <div className="form-group">
            <label>RSU grants JSON</label>
            <textarea value={rsuGrants} onChange={e => setRsuGrants(e.target.value)} rows={4} style={{ width: '100%', fontFamily: 'monospace' }} />
          </div>
          <div className="form-grid">
            <div className="form-group"><label>Salary</label><input type="number" value={salary} onChange={e => setSalary(e.target.value)} /></div>
            <div className="form-group"><label>Tax bracket %</label><input type="number" value={taxBracket} onChange={e => setTaxBracket(e.target.value)} /></div>
          </div>
          <button disabled={loading} onClick={() => run(async () => aiEsppRsuOptimize({ esppPlan: parseJson(esppPlan, 'esppPlan'), rsuGrants: parseJson(rsuGrants, 'rsuGrants'), currentSalary: Number(salary), taxBracketPct: Number(taxBracket) }))}>{loading ? 'Optimizing...' : 'Optimize'}</button>
        </div>
      )}

      {tab === 'yodlee' && (
        <div className="card">
          <h2><Sparkles size={18} /> Yodlee Aggregation</h2>
          <p>Requires <code>YODLEE_API_URL</code>, <code>YODLEE_CLIENT_ID</code>, <code>YODLEE_SECRET</code>.</p>
          <button disabled={loading} onClick={() => run(() => aiYodleeAggregate({}))}>{loading ? 'Calling...' : 'Probe Yodlee'}</button>
        </div>
      )}
      {tab === 'mx' && (
        <div className="card">
          <h2><Sparkles size={18} /> MX Aggregation</h2>
          <p>Requires <code>MX_API_URL</code>, <code>MX_CLIENT_ID</code>, <code>MX_API_KEY</code>.</p>
          <button disabled={loading} onClick={() => run(() => aiMxAggregate({}))}>{loading ? 'Calling...' : 'Probe MX'}</button>
        </div>
      )}
      {tab === 'esg' && (
        <div className="card">
          <h2><Sparkles size={18} /> ESG Screening</h2>
          <p>Requires <code>ESG_API_URL</code>, <code>ESG_API_KEY</code>.</p>
          <button disabled={loading} onClick={() => run(() => aiEsgScreen({}))}>{loading ? 'Calling...' : 'Probe ESG'}</button>
        </div>
      )}
      {tab === 'defi' && (
        <div className="card">
          <h2><Sparkles size={18} /> DeFi Yield</h2>
          <p>Requires <code>DEFI_DATA_URL</code>, <code>DEFI_API_KEY</code>.</p>
          <button disabled={loading} onClick={() => run(() => aiDefiYield({}))}>{loading ? 'Calling...' : 'Probe DeFi'}</button>
        </div>
      )}

      {error && <div className="card" style={{ background: '#fdecea', color: '#b71c1c', borderLeft: '4px solid #b71c1c' }}>{error}</div>}
      {result && (
        <div className="card">
          <h3>Result</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 600, overflow: 'auto' }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default AdvancedTools;
