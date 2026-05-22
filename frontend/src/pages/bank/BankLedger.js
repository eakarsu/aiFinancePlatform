import React from 'react';
import BankModule from './BankModule';

const COLUMNS = [
  { key: 'journalId', label: 'Journal ID' },
  { key: 'accountCode', label: 'Account Code' },
  { key: 'description', label: 'Description' },
  { key: 'debit', label: 'Debit' },
  { key: 'credit', label: 'Credit' },
  { key: 'period', label: 'Period' },
  { key: 'status', label: 'Status' },
];

const FIELDS = [
  { key: 'journalId', label: 'Journal ID', required: true },
  { key: 'accountCode', label: 'GL Account Code', required: true },
  { key: 'description', label: 'Description', type: 'textarea', required: true },
  { key: 'debit', label: 'Debit Amount', type: 'number' },
  { key: 'credit', label: 'Credit Amount', type: 'number' },
  { key: 'period', label: 'Period (YYYY-MM)' },
  { key: 'currency', label: 'Currency', type: 'select',
    options: ['USD', 'EUR', 'GBP', 'JPY', 'CAD'] },
  { key: 'reference', label: 'Reference' },
];

const ID_VERBS = [
  'validate-journal-balance', 'suggest-account-coding', 'detect-out-of-period',
  'reconcile-subledger', 'generate-trial-balance', 'classify-transaction-gl',
  'predict-period-close-risk', 'suggest-adjusting-entries', 'detect-fraud-pattern',
  'summarize-variance', 'generate-audit-trail', 'suggest-allocation-rules',
  'validate-cutoff', 'explain-balance-movement', 'score-data-quality',
];

const COLLECTION_VERBS = ['predict-month-end-load'];

const FILTER_FIELDS = [
  { key: 'status', label: 'Status', options: ['Posted', 'Draft', 'Reversed', 'Pending'] },
];

export default function BankLedger() {
  return (
    <BankModule
      title="Ledger"
      module="ledger"
      columns={COLUMNS}
      fields={FIELDS}
      idVerbs={ID_VERBS}
      collectionVerbs={COLLECTION_VERBS}
      filterFields={FILTER_FIELDS}
    />
  );
}
