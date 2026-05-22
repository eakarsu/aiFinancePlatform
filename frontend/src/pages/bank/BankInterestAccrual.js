import React from 'react';
import BankModule from './BankModule';

const COLUMNS = [
  { key: 'accountId', label: 'Account ID' },
  { key: 'interestRate', label: 'Rate %' },
  { key: 'accrualBasis', label: 'Basis' },
  { key: 'dailyAccrual', label: 'Daily Accrual' },
  { key: 'periodStart', label: 'Period Start', render: v => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'periodEnd', label: 'Period End', render: v => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'status', label: 'Status' },
];

const FIELDS = [
  { key: 'accountId', label: 'Account ID', required: true },
  { key: 'interestRate', label: 'Interest Rate (%)', type: 'number', required: true },
  { key: 'accrualBasis', label: 'Day Count Convention', type: 'select',
    options: ['30/360', 'Actual/360', 'Actual/365', 'Actual/Actual'] },
  { key: 'compoundingFrequency', label: 'Compounding', type: 'select',
    options: ['Daily', 'Monthly', 'Quarterly', 'Annually', 'Simple'] },
  { key: 'periodStart', label: 'Period Start', type: 'date' },
  { key: 'periodEnd', label: 'Period End', type: 'date' },
  { key: 'promoRate', label: 'Promotional Rate (%)', type: 'number' },
  { key: 'promoEndDate', label: 'Promo End Date', type: 'date' },
];

const ID_VERBS = [
  'calculate-daily-accrual', 'suggest-rate-tier', 'predict-monthly-posting',
  'validate-day-count-convention', 'simulate-rate-change-impact', 'detect-mispost',
  'generate-accrual-journal', 'classify-promo-rate', 'predict-customer-rate-shop',
  'suggest-rate-promo', 'score-margin-erosion', 'validate-compounding',
  'summarize-accrual-period', 'generate-disclosure-text', 'explain-rate-calc',
  'predict-cd-renewal',
];

const COLLECTION_VERBS = [];

const FILTER_FIELDS = [
  { key: 'status', label: 'Status', options: ['Active', 'Posted', 'Reversed', 'Pending'] },
  { key: 'accrualBasis', label: 'Basis', options: ['30/360', 'Actual/360', 'Actual/365', 'Actual/Actual'] },
];

export default function BankInterestAccrual() {
  return (
    <BankModule
      title="Interest Accrual"
      module="interestAccrual"
      columns={COLUMNS}
      fields={FIELDS}
      idVerbs={ID_VERBS}
      collectionVerbs={COLLECTION_VERBS}
      filterFields={FILTER_FIELDS}
    />
  );
}
