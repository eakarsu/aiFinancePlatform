import React from 'react';
import { Inbox } from 'lucide-react';

function EmptyState({ icon, title = 'No data found', description = 'There are no items to display.', actionLabel, onAction }) {
  return (
    <div className="empty-state-container">
      <div className="empty-state-icon">
        {icon || <Inbox size={48} />}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      {actionLabel && onAction && (
        <button className="btn-primary" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}

export default EmptyState;
