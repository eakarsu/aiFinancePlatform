import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, FileJson } from 'lucide-react';

function ExportButton({ onExport }) {
  const [open, setOpen] = useState(false);

  const handleExport = (format) => {
    setOpen(false);
    onExport(format);
  };

  return (
    <div className="export-button-wrapper">
      <button className="btn-secondary btn-small" onClick={() => setOpen(!open)}>
        <Download size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
        Export
      </button>
      {open && (
        <>
          <div className="export-backdrop" onClick={() => setOpen(false)} />
          <div className="export-dropdown">
            <button onClick={() => handleExport('json')}>
              <FileJson size={14} /> JSON
            </button>
            <button onClick={() => handleExport('csv')}>
              <FileSpreadsheet size={14} /> CSV
            </button>
            <button onClick={() => handleExport('pdf')}>
              <FileText size={14} /> PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default ExportButton;
