/**
 * BankModule — generic List / Detail / Create-Edit / AI-Verbs panel
 * Used by all 11 Core Banking feature pages.
 *
 * Props:
 *   title        string       e.g. "Accounts"
 *   module       string       e.g. "accounts"
 *   columns      Array<{key,label,render?}>  columns for the list table
 *   fields       Array<{key,label,type?,options?,required?}>  form fields
 *   idVerbs      string[]     AI verbs that need a record id  (POST /:id/ai/<verb>)
 *   collectionVerbs string[]  AI verbs with no id            (POST /ai/<verb>)
 *   filterFields Array<{key,label,options?}>   optional filter dropdowns
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Route, Routes } from 'react-router-dom';
import {
  Search, Plus, RefreshCw, Download, Trash2, Edit2,
  Eye, ChevronLeft, ChevronRight, Bot, X, CheckCircle,
  AlertTriangle, Loader, Clock
} from 'lucide-react';
import bankApi from '../../services/bankApi';

/* ─── tiny helpers ─────────────────────────────────────────────── */
function Badge({ value }) {
  if (value === undefined || value === null) return <span className="bank-badge bank-badge--neutral">—</span>;
  const v = String(value).toLowerCase();
  const cls =
    ['active', 'approved', 'completed', 'success', 'open', 'verified'].includes(v) ? 'bank-badge--success' :
    ['closed', 'rejected', 'failed', 'cancelled', 'inactive'].includes(v) ? 'bank-badge--danger' :
    ['pending', 'processing', 'review', 'draft'].includes(v) ? 'bank-badge--warning' : 'bank-badge--neutral';
  return <span className={`bank-badge ${cls}`}>{value}</span>;
}

function Spinner() {
  return <Loader size={18} className="bank-spinner" />;
}

function formatVal(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/* ─── AI Result Renderer ────────────────────────────────────────── */
function AiResult({ data }) {
  if (!data) return null;
  if (typeof data !== 'object') {
    return <pre className="bank-ai-pre">{String(data)}</pre>;
  }
  return (
    <div className="bank-ai-result">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="bank-ai-row">
          <span className="bank-ai-key">{k}</span>
          <span className="bank-ai-val">
            {Array.isArray(v)
              ? v.length === 0 ? '—' : v.map((item, i) =>
                  typeof item === 'object'
                    ? <pre key={i} className="bank-ai-sub">{JSON.stringify(item, null, 2)}</pre>
                    : <span key={i} className="bank-ai-tag">{String(item)}</span>
                )
              : typeof v === 'object' && v !== null
                ? <pre className="bank-ai-sub">{JSON.stringify(v, null, 2)}</pre>
                : <strong>{formatVal(v)}</strong>}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── AI Verbs Panel ────────────────────────────────────────────── */
function AiVerbsPanel({ module, recordId, idVerbs, collectionVerbs }) {
  const client = bankApi(module);
  const [activeVerb, setActiveVerb] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async (verb, isCollection) => {
    setActiveVerb(verb);
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      let res;
      if (isCollection) {
        res = await client.aiCollectionVerb(verb);
      } else {
        if (!recordId) { setError('Select a record first'); setLoading(false); return; }
        res = await client.aiVerb(recordId, verb);
      }
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const verbLabel = (v) => v.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="bank-ai-panel">
      <div className="bank-ai-panel-header">
        <Bot size={18} />
        <span>AI Verbs</span>
        {recordId && <span className="bank-ai-record-id">ID: {recordId}</span>}
      </div>

      {idVerbs.length > 0 && (
        <>
          <div className="bank-ai-section-label">Record Actions {!recordId && <em>(select a record)</em>}</div>
          <div className="bank-ai-buttons">
            {idVerbs.map(v => (
              <button
                key={v}
                className={`bank-ai-btn${activeVerb === v ? ' bank-ai-btn--active' : ''}`}
                onClick={() => run(v, false)}
                disabled={loading}
                title={v}
              >
                {loading && activeVerb === v ? <Spinner /> : <Bot size={12} />}
                {verbLabel(v)}
              </button>
            ))}
          </div>
        </>
      )}

      {collectionVerbs.length > 0 && (
        <>
          <div className="bank-ai-section-label" style={{ marginTop: '12px' }}>Collection Actions</div>
          <div className="bank-ai-buttons">
            {collectionVerbs.map(v => (
              <button
                key={v}
                className={`bank-ai-btn bank-ai-btn--collection${activeVerb === v ? ' bank-ai-btn--active' : ''}`}
                onClick={() => run(v, true)}
                disabled={loading}
                title={v}
              >
                {loading && activeVerb === v ? <Spinner /> : <Bot size={12} />}
                {verbLabel(v)}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <div className="bank-ai-error">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {result && (
        <div className="bank-ai-output">
          <div className="bank-ai-output-header">
            <CheckCircle size={14} style={{ color: 'var(--success)' }} />
            <span>{verbLabel(activeVerb)}</span>
            {result.poweredBy && <span className="bank-ai-model">{result.poweredBy}</span>}
            {result.processingTime && <span className="bank-ai-time">{result.processingTime}ms</span>}
            <button className="bank-ai-close" onClick={() => setResult(null)}><X size={12} /></button>
          </div>
          <AiResult data={result.analysis || result} />
        </div>
      )}
    </div>
  );
}

/* ─── Create / Edit Form ────────────────────────────────────────── */
function BankForm({ module, fields, title, onSaved, editRecord }) {
  const client = bankApi(module);
  const navigate = useNavigate();
  const [form, setForm] = useState(() => {
    const init = {};
    fields.forEach(f => { init[f.key] = editRecord ? (editRecord[f.key] ?? '') : ''; });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {};
      fields.forEach(f => { if (form[f.key] !== '') payload[f.key] = form[f.key]; });
      if (editRecord) {
        await client.update(editRecord.id, payload);
      } else {
        await client.create(payload);
      }
      if (onSaved) onSaved();
      else navigate(-1);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bank-form-page">
      <div className="bank-form-header">
        <button className="bank-back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} /> Back
        </button>
        <h2>{editRecord ? `Edit ${title}` : `New ${title}`}</h2>
      </div>
      <div className="bank-form-card">
        {error && <div className="bank-error-banner"><AlertTriangle size={14} /> {error}</div>}
        <form onSubmit={handleSubmit} className="bank-form">
          {fields.map(f => (
            <div key={f.key} className="bank-field">
              <label className="bank-label">
                {f.label} {f.required && <span className="bank-required">*</span>}
              </label>
              {f.type === 'select' ? (
                <select
                  className="bank-input"
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  required={f.required}
                >
                  <option value="">Select…</option>
                  {f.options.map(o => (
                    <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  className="bank-input bank-textarea"
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  required={f.required}
                  rows={3}
                />
              ) : (
                <input
                  className="bank-input"
                  type={f.type || 'text'}
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  required={f.required}
                  placeholder={f.placeholder || ''}
                />
              )}
            </div>
          ))}
          <div className="bank-form-actions">
            <button type="button" className="bank-btn bank-btn--secondary" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="bank-btn bank-btn--primary" disabled={saving}>
              {saving ? <Spinner /> : null}
              {editRecord ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Detail Page ───────────────────────────────────────────────── */
function BankDetail({ module, title, idVerbs, collectionVerbs }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = bankApi(module);
  const [record, setRecord] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('fields');

  useEffect(() => {
    setLoading(true);
    Promise.all([client.get(id), client.history(id)])
      .then(([r, h]) => {
        setRecord(r.data.data || r.data);
        setHistory(h.data.data || []);
      })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [id, module]);

  if (loading) return <div className="bank-loading"><Spinner /> Loading…</div>;
  if (error) return <div className="bank-page-error"><AlertTriangle size={16} /> {error}</div>;
  if (!record) return null;

  return (
    <div className="bank-detail-page">
      <div className="bank-detail-header">
        <button className="bank-back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} /> Back
        </button>
        <h2>{title} Detail</h2>
        <span className="bank-detail-id"># {record.id}</span>
      </div>

      <div className="bank-detail-layout">
        <div className="bank-detail-main">
          <div className="bank-tab-bar">
            {['fields', 'history'].map(t => (
              <button
                key={t}
                className={`bank-tab${tab === t ? ' bank-tab--active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'history' ? <Clock size={14} /> : <Eye size={14} />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === 'fields' && (
            <div className="bank-fields-grid">
              {Object.entries(record).filter(([k]) => k !== '__v').map(([k, v]) => (
                <div key={k} className="bank-field-row">
                  <span className="bank-field-key">{k}</span>
                  <span className="bank-field-val">
                    {k === 'status' ? <Badge value={v} /> : formatVal(v)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === 'history' && (
            <div className="bank-history">
              {history.length === 0
                ? <div className="bank-empty">No history available.</div>
                : history.map((h, i) => (
                  <div key={i} className="bank-history-row">
                    <Clock size={12} />
                    <span className="bank-history-event">{h.event || h.action}</span>
                    <span className="bank-history-at">{h.at || h.createdAt}</span>
                    <span className="bank-history-by">{h.by || h.user}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        <div className="bank-detail-aside">
          <AiVerbsPanel
            module={module}
            recordId={id}
            idVerbs={idVerbs}
            collectionVerbs={collectionVerbs}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── List Page ─────────────────────────────────────────────────── */
function BankList({ module, title, columns, idVerbs, collectionVerbs, filterFields = [] }) {
  const navigate = useNavigate();
  const client = bankApi(module);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit, ...filters };
      if (search) params.q = search;
      const res = await client.list(params);
      const payload = res.data;
      setRows(payload.data || payload);
      setTotal(payload.total || (payload.data || payload).length);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, filters, module]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    client.stats().then(r => setStats(r.data)).catch(() => {});
  }, [module]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await client.remove(id);
      load();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const handleBatchDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} records?`)) return;
    try {
      await client.batchDelete(selectedIds);
      setSelectedIds([]);
      load();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const handleExport = async () => {
    try {
      const res = await client.exportCsv();
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${module}-export.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : rows.map(r => r.id));
  };

  const toggleOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="bank-list-page">
      {/* Header */}
      <div className="bank-list-header">
        <div>
          <h1 className="bank-list-title">{title}</h1>
          {stats && (
            <div className="bank-stats-row">
              {Object.entries(stats).slice(0, 4).map(([k, v]) => (
                <span key={k} className="bank-stat-chip">
                  <strong>{typeof v === 'number' ? v.toLocaleString() : v}</strong> {k}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="bank-header-actions">
          <button className="bank-btn bank-btn--secondary" onClick={load} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button className="bank-btn bank-btn--secondary" onClick={handleExport} title="Export CSV">
            <Download size={15} /> Export
          </button>
          <button className="bank-btn bank-btn--primary" onClick={() => navigate(`/bank/${module}/new`)}>
            <Plus size={15} /> New
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bank-toolbar">
        <div className="bank-search-wrap">
          <Search size={15} className="bank-search-icon" />
          <input
            className="bank-search"
            placeholder={`Search ${title}…`}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button className="bank-search-clear" onClick={() => { setSearch(''); setPage(1); }}>
              <X size={14} />
            </button>
          )}
        </div>

        {filterFields.map(ff => (
          <select
            key={ff.key}
            className="bank-filter-select"
            value={filters[ff.key] || ''}
            onChange={e => { setFilters(p => ({ ...p, [ff.key]: e.target.value || undefined })); setPage(1); }}
          >
            <option value="">All {ff.label}</option>
            {ff.options.map(o => (
              <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
            ))}
          </select>
        ))}

        {selectedIds.length > 0 && (
          <button className="bank-btn bank-btn--danger" onClick={handleBatchDelete}>
            <Trash2 size={14} /> Delete {selectedIds.length}
          </button>
        )}
      </div>

      {error && <div className="bank-error-banner"><AlertTriangle size={14} /> {error}</div>}

      {/* Layout: Table + AI panel */}
      <div className="bank-content-layout">
        <div className="bank-table-wrap">
          {loading ? (
            <div className="bank-loading"><Spinner /> Loading…</div>
          ) : rows.length === 0 ? (
            <div className="bank-empty">
              No records found.{' '}
              <button className="bank-link" onClick={() => navigate(`/bank/${module}/new`)}>
                Create one
              </button>
            </div>
          ) : (
            <table className="bank-table">
              <thead>
                <tr>
                  <th className="bank-th bank-th--check">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                  {columns.map(c => <th key={c.key} className="bank-th">{c.label}</th>)}
                  <th className="bank-th bank-th--actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr
                    key={row.id}
                    className={`bank-tr${selectedRecord?.id === row.id ? ' bank-tr--selected' : ''}`}
                    onClick={() => setSelectedRecord(row)}
                  >
                    <td className="bank-td bank-td--check" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleOne(row.id)}
                      />
                    </td>
                    {columns.map(c => (
                      <td key={c.key} className="bank-td">
                        {c.render
                          ? c.render(row[c.key], row)
                          : c.key === 'status'
                            ? <Badge value={row[c.key]} />
                            : formatVal(row[c.key])}
                      </td>
                    ))}
                    <td className="bank-td bank-td--actions" onClick={e => e.stopPropagation()}>
                      <button
                        className="bank-icon-btn"
                        title="View"
                        onClick={() => navigate(`/bank/${module}/${row.id}`)}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        className="bank-icon-btn"
                        title="Edit"
                        onClick={() => navigate(`/bank/${module}/${row.id}/edit`)}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="bank-icon-btn bank-icon-btn--danger"
                        title="Delete"
                        onClick={() => handleDelete(row.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bank-pagination">
              <span className="bank-pagination-info">
                {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </span>
              <button
                className="bank-page-btn"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 6, page - 3)) + i;
                return (
                  <button
                    key={p}
                    className={`bank-page-btn${p === page ? ' bank-page-btn--active' : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                className="bank-page-btn"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* AI Panel — shows for selected record */}
        <div className="bank-side-panel">
          <AiVerbsPanel
            module={module}
            recordId={selectedRecord?.id}
            idVerbs={idVerbs}
            collectionVerbs={collectionVerbs}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Edit wrapper ──────────────────────────────────────────────── */
function BankEdit({ module, fields, title }) {
  const { id } = useParams();
  const client = bankApi(module);
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get(id)
      .then(r => setRecord(r.data.data || r.data))
      .catch(() => navigate(-1))
      .finally(() => setLoading(false));
  }, [id, module]);

  if (loading) return <div className="bank-loading"><Spinner /> Loading…</div>;
  if (!record) return null;

  return (
    <BankForm
      module={module}
      fields={fields}
      title={title}
      editRecord={record}
    />
  );
}

/* ─── Main BankModule component — renders sub-routes ────────────── */
function BankModule({ title, module, columns, fields, idVerbs, collectionVerbs, filterFields }) {
  return (
    <Routes>
      <Route
        index
        element={
          <BankList
            module={module}
            title={title}
            columns={columns}
            idVerbs={idVerbs}
            collectionVerbs={collectionVerbs}
            filterFields={filterFields}
          />
        }
      />
      <Route
        path="new"
        element={<BankForm module={module} fields={fields} title={title} />}
      />
      <Route
        path=":id"
        element={
          <BankDetail
            module={module}
            title={title}
            idVerbs={idVerbs}
            collectionVerbs={collectionVerbs}
          />
        }
      />
      <Route
        path=":id/edit"
        element={<BankEdit module={module} fields={fields} title={title} />}
      />
    </Routes>
  );
}

export default BankModule;
