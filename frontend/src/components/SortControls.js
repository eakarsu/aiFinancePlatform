import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

function SortControls({ columns, sortBy, sortOrder, onSort }) {
  const handleSort = (field) => {
    if (sortBy === field) {
      onSort(field, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(field, 'asc');
    }
  };

  return (
    <div className="sort-controls">
      {columns.map(col => (
        <button
          key={col.field}
          className={`sort-btn ${sortBy === col.field ? 'active' : ''}`}
          onClick={() => handleSort(col.field)}
          title={`Sort by ${col.label}`}
        >
          {col.label}
          {sortBy === col.field ? (
            sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
          ) : (
            <ArrowUpDown size={12} className="sort-icon-inactive" />
          )}
        </button>
      ))}
    </div>
  );
}

export default SortControls;
