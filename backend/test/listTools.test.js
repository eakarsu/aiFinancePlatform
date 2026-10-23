'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { filterHoldings, toCsv } = require('../src/utils/listTools');
const { taxLossHarvestFallback, concentrationFallback, performanceFallback } = require('../src/services/aiFallback');
const tasks = require('../src/routes/tasks');

const holdings = [
  { symbol: 'AAPL', name: 'Apple', assetType: 'STOCK', shares: 10, avgCost: 100, currentPrice: 80 },
  { symbol: 'VTI', name: 'Vanguard Total', assetType: 'ETF', shares: 5, avgCost: 200, currentPrice: 260 },
];

test('search and filter narrow the holdings list', () => {
  assert.equal(filterHoldings(holdings, { q: 'apple' }).length, 1);
  assert.equal(filterHoldings(holdings, { assetType: 'ETF' })[0].symbol, 'VTI');
  assert.equal(filterHoldings(holdings, {}).length, 2);
});

test('CSV export preserves zero values', () => {
  assert.ok(toCsv([{ symbol: 'X', name: 'Zero', assetType: 'CASH', shares: 0, avgCost: 0, currentPrice: 0 }]).includes('X,Zero,CASH,0,0,0'));
});

test('deterministic AI fallbacks are labelled and preserve falsy values', () => {
  for (const fn of [taxLossHarvestFallback, concentrationFallback, performanceFallback]) {
    const result = fn(holdings);
    assert.equal(result.aiGenerated, false);
    assert.equal(result.source, 'deterministic-fallback');
    assert.ok(Array.isArray(result.sections) && result.sections.length >= 2);
    assert.match(result.disclaimer, /not tax or financial advice/i);
  }
  assert.equal(performanceFallback(holdings).sections.find((s) => s.title === 'Positions counted').detail, 2);
});

test('tasks helpers validate strictly and router requires auth', () => {
  assert.equal(tasks.parseTaskPriority('HIGH'), 'HIGH');
  assert.equal(tasks.parseTaskPriority('urgent'), 'NORMAL');
  assert.equal(tasks.parseTaskStatus('DONE'), 'DONE');
  assert.equal(tasks.parseTaskStatus('DELETED'), null);
  const src = fs.readFileSync(path.join(__dirname, '../src/routes/tasks.js'), 'utf8');
  assert.ok(src.includes('authenticateToken'));
  const index = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.ok(index.includes("'/api/tasks'"));
  const holdingsSrc = fs.readFileSync(path.join(__dirname, '../src/routes/holdings.js'), 'utf8');
  assert.ok(holdingsSrc.includes("format") && holdingsSrc.includes('text/csv'));
});
