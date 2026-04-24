import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function Pagination({ total, offset, limit, onPageChange, onLimitChange }) {
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  if (total <= limit && offset === 0) return null;

  const goToPage = (page) => {
    const newOffset = (page - 1) * limit;
    onPageChange(newOffset);
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="pagination">
      <div className="pagination-info">
        Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
      </div>
      <div className="pagination-controls">
        <button
          className="pagination-btn"
          disabled={currentPage === 1}
          onClick={() => goToPage(currentPage - 1)}
        >
          <ChevronLeft size={14} />
        </button>
        {getPageNumbers().map(page => (
          <button
            key={page}
            className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
            onClick={() => goToPage(page)}
          >
            {page}
          </button>
        ))}
        <button
          className="pagination-btn"
          disabled={currentPage === totalPages}
          onClick={() => goToPage(currentPage + 1)}
        >
          <ChevronRight size={14} />
        </button>
      </div>
      {onLimitChange && (
        <div className="pagination-limit">
          <select value={limit} onChange={e => onLimitChange(parseInt(e.target.value))}>
            <option value={10}>10/page</option>
            <option value={25}>25/page</option>
            <option value={50}>50/page</option>
          </select>
        </div>
      )}
    </div>
  );
}

export default Pagination;
