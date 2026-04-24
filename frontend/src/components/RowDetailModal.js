import React from 'react';
import { X, Edit2, Trash2 } from 'lucide-react';

const HIDDEN_KEYS = ['userId', 'password', 'twoFactorSecret'];

function formatValue(val) {
  if (val === null || val === undefined) return 'N/A';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (val instanceof Date || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val))) {
    return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return val.toLocaleString();
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(val);
}

function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/Id$/, ' ID')
    .replace(/Ai /, 'AI ')
    .trim();
}

function RowDetailModal({ open, data, title, onClose, onEdit, onDelete }) {
  if (!open || !data) return null;

  const entries = Object.entries(data).filter(([key]) => !HIDDEN_KEYS.includes(key));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content row-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="row-detail-header">
          <h2>{title || 'Details'}</h2>
          <div className="row-detail-actions">
            {onEdit && (
              <button className="btn-secondary btn-small" onClick={() => onEdit(data)}>
                <Edit2 size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Edit
              </button>
            )}
            {onDelete && (
              <button className="btn-danger btn-small" onClick={() => onDelete(data)}>
                <Trash2 size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Delete
              </button>
            )}
            <button className="btn-icon" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="row-detail-body">
          {entries.map(([key, val]) => (
            <div key={key} className="row-detail-field">
              <label>{formatKey(key)}</label>
              {typeof val === 'object' && val !== null ? (
                <pre className="row-detail-json">{formatValue(val)}</pre>
              ) : (
                <span>{formatValue(val)}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RowDetailModal;
