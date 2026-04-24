import React from 'react';
import { AlertTriangle, Info, Trash2, X } from 'lucide-react';

const VARIANTS = {
  danger: { icon: <Trash2 size={24} />, color: '#f44336', bg: '#fef2f2' },
  warning: { icon: <AlertTriangle size={24} />, color: '#FF9800', bg: '#fff8e1' },
  info: { icon: <Info size={24} />, color: '#2196F3', bg: '#e3f2fd' }
};

function ConfirmDialog({ open, title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'danger', onConfirm, onCancel }) {
  if (!open) return null;

  const v = VARIANTS[variant] || VARIANTS.info;

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <button className="confirm-dialog-close" onClick={onCancel}><X size={18} /></button>
        <div className="confirm-dialog-icon" style={{ backgroundColor: v.bg, color: v.color }}>
          {v.icon}
        </div>
        <h3 className="confirm-dialog-title">{title}</h3>
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button className="btn-secondary" onClick={onCancel}>{cancelText}</button>
          <button
            className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
