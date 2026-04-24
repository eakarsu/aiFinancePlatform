import React from 'react';

function SkeletonBlock({ width = '100%', height = '16px', style = {} }) {
  return (
    <div
      className="skeleton-block"
      style={{ width, height, borderRadius: '6px', ...style }}
    />
  );
}

function LoadingSkeleton({ variant = 'card', count = 3 }) {
  if (variant === 'table-row') {
    return (
      <div className="skeleton-table">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton-row">
            <SkeletonBlock width="24px" height="24px" style={{ borderRadius: '4px' }} />
            <SkeletonBlock width="30%" height="14px" />
            <SkeletonBlock width="20%" height="14px" />
            <SkeletonBlock width="15%" height="14px" />
            <SkeletonBlock width="10%" height="14px" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'detail-panel') {
    return (
      <div className="skeleton-detail">
        <SkeletonBlock width="60%" height="24px" style={{ marginBottom: '16px' }} />
        <SkeletonBlock width="100%" height="14px" style={{ marginBottom: '8px' }} />
        <SkeletonBlock width="90%" height="14px" style={{ marginBottom: '8px' }} />
        <SkeletonBlock width="80%" height="14px" style={{ marginBottom: '24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <SkeletonBlock width="40%" height="10px" style={{ marginBottom: '4px' }} />
              <SkeletonBlock width="70%" height="16px" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: card variant
  return (
    <div className="skeleton-cards">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-card-header">
            <SkeletonBlock width="40%" height="18px" />
            <SkeletonBlock width="36px" height="36px" style={{ borderRadius: '50%' }} />
          </div>
          <SkeletonBlock width="70%" height="12px" style={{ marginTop: '12px' }} />
          <div className="skeleton-card-details">
            <SkeletonBlock width="30%" height="11px" />
            <SkeletonBlock width="25%" height="11px" />
            <SkeletonBlock width="20%" height="11px" />
          </div>
          <SkeletonBlock width="80px" height="22px" style={{ marginTop: '10px', borderRadius: '12px' }} />
        </div>
      ))}
    </div>
  );
}

export default LoadingSkeleton;
