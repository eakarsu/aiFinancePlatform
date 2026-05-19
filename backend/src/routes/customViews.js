// customViews.js — 4 endpoints for the Finance Views feature set
// VIZ: cashflow waterfall/line + account balance heatmap
// NON-VIZ: financial statement PDF (P&L / Balance Sheet) + chart-of-accounts editor
const express = require('express');
const router = express.Router();
let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch (_) { PDFDocument = null; }

// In-memory chart-of-accounts store (seeded). Survives only for process lifetime.
const ACCOUNT_CATEGORIES = [
  { id: 'assets', name: 'Assets', type: 'BALANCE_SHEET', normal: 'DEBIT' },
  { id: 'liabilities', name: 'Liabilities', type: 'BALANCE_SHEET', normal: 'CREDIT' },
  { id: 'equity', name: 'Equity', type: 'BALANCE_SHEET', normal: 'CREDIT' },
  { id: 'revenue', name: 'Revenue', type: 'INCOME_STATEMENT', normal: 'CREDIT' },
  { id: 'expenses', name: 'Expenses', type: 'INCOME_STATEMENT', normal: 'DEBIT' }
];

const MAPPING_RULES = [
  { id: 'r1', pattern: 'PAYROLL', categoryId: 'expenses', subAccount: 'Salaries' },
  { id: 'r2', pattern: 'STRIPE PAYOUT', categoryId: 'revenue', subAccount: 'Sales' },
  { id: 'r3', pattern: 'AWS', categoryId: 'expenses', subAccount: 'Cloud Infrastructure' },
  { id: 'r4', pattern: 'RENT', categoryId: 'expenses', subAccount: 'Office Rent' }
];

// Deterministic seeded cashflow series (12 months)
function seedCashflow() {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let balance = 250000;
  const series = months.map((m, i) => {
    const inflow = 80000 + (i * 4500) + ((i % 3) * 12000);
    const outflow = 62000 + (i * 3200) + ((i % 2) * 8000);
    const net = inflow - outflow;
    balance += net;
    return { period: m, inflow, outflow, net, runningBalance: balance };
  });
  return series;
}

// Seeded account balances across months (heatmap source)
function seedAccountBalances() {
  const accounts = ['Cash - Operating', 'Cash - Reserve', 'AR', 'AP', 'Loan Payable',
                    'Inventory', 'Fixed Assets', 'Retained Earnings'];
  const months = ['Q1-24','Q2-24','Q3-24','Q4-24','Q1-25','Q2-25'];
  const cells = [];
  accounts.forEach((acct, ai) => {
    months.forEach((mo, mi) => {
      // Deterministic pseudo-balance
      const base = 50000 + ai * 22500;
      const wave = Math.sin((ai + mi) * 0.9) * 18000;
      const drift = mi * 5400;
      cells.push({
        account: acct,
        period: mo,
        balance: Math.round(base + wave + drift)
      });
    });
  });
  return { accounts, periods: months, cells };
}

// 1. GET /api/custom-views/cashflow — VIZ data for waterfall + line chart
router.get('/cashflow', (req, res) => {
  try {
    const series = seedCashflow();
    const totals = series.reduce((acc, p) => {
      acc.inflow += p.inflow;
      acc.outflow += p.outflow;
      acc.net += p.net;
      return acc;
    }, { inflow: 0, outflow: 0, net: 0 });
    res.status(200).json({
      ok: true,
      view: 'cashflow',
      generatedAt: new Date().toISOString(),
      series,
      totals,
      endingBalance: series[series.length - 1].runningBalance
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. GET /api/custom-views/account-heatmap — VIZ data for balance heatmap
router.get('/account-heatmap', (req, res) => {
  try {
    const data = seedAccountBalances();
    const values = data.cells.map(c => c.balance);
    res.status(200).json({
      ok: true,
      view: 'account-heatmap',
      ...data,
      min: Math.min(...values),
      max: Math.max(...values)
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. GET /api/custom-views/statement-pdf — NON-VIZ: PDF P&L + Balance Sheet
router.get('/statement-pdf', (req, res) => {
  try {
    const period = req.query.period || 'YTD-2025';
    // Seeded P&L
    const pnl = {
      revenue: [
        { line: 'Product Sales', amount: 1240000 },
        { line: 'Service Revenue', amount: 380000 },
        { line: 'Other Income', amount: 22000 }
      ],
      expenses: [
        { line: 'Cost of Goods Sold', amount: 510000 },
        { line: 'Salaries & Wages', amount: 460000 },
        { line: 'Rent & Utilities', amount: 84000 },
        { line: 'Cloud Infrastructure', amount: 96000 },
        { line: 'Marketing', amount: 72000 },
        { line: 'Other Operating', amount: 38000 }
      ]
    };
    const bs = {
      assets: [
        { line: 'Cash & Equivalents', amount: 412000 },
        { line: 'Accounts Receivable', amount: 188000 },
        { line: 'Inventory', amount: 245000 },
        { line: 'Fixed Assets (net)', amount: 530000 }
      ],
      liabilitiesEquity: [
        { line: 'Accounts Payable', amount: 132000 },
        { line: 'Short-term Debt', amount: 95000 },
        { line: 'Long-term Debt', amount: 360000 },
        { line: 'Retained Earnings', amount: 788000 }
      ]
    };

    const totalRev = pnl.revenue.reduce((a, b) => a + b.amount, 0);
    const totalExp = pnl.expenses.reduce((a, b) => a + b.amount, 0);
    const netIncome = totalRev - totalExp;
    const totalAssets = bs.assets.reduce((a, b) => a + b.amount, 0);
    const totalLE = bs.liabilitiesEquity.reduce((a, b) => a + b.amount, 0);

    if (!PDFDocument) {
      // Graceful fallback: return JSON if pdfkit unavailable
      return res.status(200).json({
        ok: true, format: 'json-fallback', period,
        pnl, balanceSheet: bs, totals: { totalRev, totalExp, netIncome, totalAssets, totalLE }
      });
    }

    const doc = new PDFDocument({ size: 'LETTER', margin: 48 });
    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="financial-statement-${period}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).text('Financial Statement', { align: 'center' });
    doc.fontSize(11).fillColor('#555').text(`Period: ${period}`, { align: 'center' });
    doc.moveDown();
    doc.fillColor('#000').fontSize(14).text('Profit & Loss', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).text('Revenue', { continued: false });
    pnl.revenue.forEach(r => doc.text(`   ${r.line}`, { continued: true })
                              .text(`$${r.amount.toLocaleString()}`, { align: 'right' }));
    doc.moveDown(0.3);
    doc.text(`Total Revenue`, { continued: true })
       .text(`$${totalRev.toLocaleString()}`, { align: 'right' });
    doc.moveDown(0.5);
    doc.text('Expenses');
    pnl.expenses.forEach(r => doc.text(`   ${r.line}`, { continued: true })
                                .text(`$${r.amount.toLocaleString()}`, { align: 'right' }));
    doc.text(`Total Expenses`, { continued: true })
       .text(`$${totalExp.toLocaleString()}`, { align: 'right' });
    doc.moveDown(0.3);
    doc.fontSize(12).text(`Net Income: $${netIncome.toLocaleString()}`);
    doc.addPage();
    doc.fontSize(14).text('Balance Sheet', { underline: true });
    doc.moveDown(0.5).fontSize(11).text('Assets');
    bs.assets.forEach(r => doc.text(`   ${r.line}`, { continued: true })
                              .text(`$${r.amount.toLocaleString()}`, { align: 'right' }));
    doc.text(`Total Assets`, { continued: true })
       .text(`$${totalAssets.toLocaleString()}`, { align: 'right' });
    doc.moveDown(0.5).text('Liabilities & Equity');
    bs.liabilitiesEquity.forEach(r => doc.text(`   ${r.line}`, { continued: true })
                                       .text(`$${r.amount.toLocaleString()}`, { align: 'right' }));
    doc.text(`Total L+E`, { continued: true })
       .text(`$${totalLE.toLocaleString()}`, { align: 'right' });
    doc.end();
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. GET /api/custom-views/chart-of-accounts — NON-VIZ: COA + mapping rules
//    Also supports POST/PUT/DELETE on the same path with a `op` body field.
router.get('/chart-of-accounts', (req, res) => {
  res.status(200).json({
    ok: true,
    view: 'chart-of-accounts',
    categories: ACCOUNT_CATEGORIES,
    rules: MAPPING_RULES,
    supportedOps: ['add-category', 'remove-category', 'add-rule', 'update-rule', 'remove-rule']
  });
});

router.post('/chart-of-accounts', express.json(), (req, res) => {
  try {
    const { op, payload } = req.body || {};
    if (op === 'add-category') {
      if (!payload || !payload.name) return res.status(400).json({ ok: false, error: 'name required' });
      const id = payload.id || payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (ACCOUNT_CATEGORIES.find(c => c.id === id)) return res.status(409).json({ ok: false, error: 'duplicate id' });
      ACCOUNT_CATEGORIES.push({ id, name: payload.name, type: payload.type || 'INCOME_STATEMENT', normal: payload.normal || 'DEBIT' });
    } else if (op === 'remove-category') {
      const idx = ACCOUNT_CATEGORIES.findIndex(c => c.id === payload.id);
      if (idx >= 0) ACCOUNT_CATEGORIES.splice(idx, 1);
    } else if (op === 'add-rule') {
      if (!payload || !payload.pattern || !payload.categoryId) return res.status(400).json({ ok: false, error: 'pattern + categoryId required' });
      const id = 'r' + (MAPPING_RULES.length + 1) + '-' + Date.now().toString(36);
      MAPPING_RULES.push({ id, pattern: payload.pattern, categoryId: payload.categoryId, subAccount: payload.subAccount || '' });
    } else if (op === 'update-rule') {
      const rule = MAPPING_RULES.find(r => r.id === payload.id);
      if (rule) Object.assign(rule, payload);
    } else if (op === 'remove-rule') {
      const idx = MAPPING_RULES.findIndex(r => r.id === payload.id);
      if (idx >= 0) MAPPING_RULES.splice(idx, 1);
    } else {
      return res.status(400).json({ ok: false, error: 'unknown op' });
    }
    res.status(200).json({ ok: true, categories: ACCOUNT_CATEGORIES, rules: MAPPING_RULES });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
