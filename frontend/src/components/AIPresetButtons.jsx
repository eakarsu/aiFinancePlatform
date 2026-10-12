import React from 'react';

export default function AIPresetButtons({ presets, onSelect }) {
  return <div className="ai-preset-bar" aria-label="Sample scenarios">
    <div><strong>Sample scenarios</strong><p>Fill the inputs to explore a complete example. Review before generating.</p></div>
    <div>{presets.map(({ label, value }) => <button key={label} type="button" className="btn btn-secondary" onClick={() => onSelect(value)}>{label}</button>)}</div>
  </div>;
}
