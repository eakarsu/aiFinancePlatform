import React from 'react';
import CashflowChart from '../components/customViews/CashflowChart';
import AccountBalanceHeatmap from '../components/customViews/AccountBalanceHeatmap';
import FinancialStatementPDF from '../components/customViews/FinancialStatementPDF';
import ChartOfAccountsEditor from '../components/customViews/ChartOfAccountsEditor';

function CustomViewsPage() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header>
        <h1 style={{ margin: 0 }}>Finance Views</h1>
        <p style={{ margin: '4px 0 0', color: '#666' }}>
          Cashflow analytics, balance heatmaps, statement export, and chart-of-accounts management.
        </p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <CashflowChart />
        <AccountBalanceHeatmap />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <FinancialStatementPDF />
        <ChartOfAccountsEditor />
      </section>
    </div>
  );
}

export default CustomViewsPage;
