import React from 'react';
import { Trash2, X } from 'lucide-react';

function BulkActions({ selectedCount, onDelete, onClear }) {
  if (selectedCount === 0) return null;

  return (
    <div className="bulk-actions-bar">
      <span className="bulk-actions-count">{selectedCount} selected</span>
      <div className="bulk-actions-buttons">
        <button className="btn-danger btn-small" onClick={onDelete}>
          <Trash2 size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          Delete Selected
        </button>
        <button className="btn-icon" onClick={onClear} title="Clear selection">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export default BulkActions;
