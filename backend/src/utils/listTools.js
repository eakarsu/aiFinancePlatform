'use strict';
// Pure list helpers for holdings: search/filter + CSV export. No I/O.

const HOLDING_COLUMNS = ['symbol', 'name', 'assetType', 'shares', 'avgCost', 'currentPrice'];

function filterHoldings(rows, { q = '', assetType = '' } = {}) {
  const needle = String(q || '').trim().toLowerCase();
  return (rows || []).filter((row) => {
    if (assetType && row.assetType !== assetType) return false;
    if (!needle) return true;
    return [row.symbol, row.name, row.assetType, row.portfolio && row.portfolio.name]
      .some((value) => String(value ?? '').toLowerCase().includes(needle));
  });
}

function toCsv(rows, columns = HOLDING_COLUMNS) {
  const esc = (value) => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };
  return [columns.join(','), ...(rows || []).map((row) => columns.map((col) => esc(row[col])).join(','))].join('\n');
}

module.exports = { filterHoldings, toCsv, HOLDING_COLUMNS };
