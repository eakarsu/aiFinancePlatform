import React from 'react';
import BankModule from './BankModule';

const COLUMNS = [
  { key: 'reconId', label: 'Recon ID' },
  { key: 'accountId', label: 'Account ID' },
  { key: 'period', label: 'Period' },
  { key: 'bookBalance', label: 'Book Balance' },
  { key: 'bankBalance', label: 'Bank Balance' },
  { key: 'variance', label: 'Variance' },
  { key: 'status', label: 'Status' },
];

const FIELDS = [
  { key: 'accountId', label: 'Account ID', required: true },
  { key: 'period', label: 'Period (YYYY-MM)', required: true },
  { key: 'bookBalance', label: 'Book Balance', type: 'number', required: true },
  { key: 'bankBalance', label: 'Bank Balance', type: 'number', required: true },
  { key: 'currency', label: 'Currency', type: 'select',
    options: ['USD', 'EUR', 'GBP', 'JPY', 'CAD'] },
  { key: 'reconType', label: 'Recon Type', type: 'select',
    options: ['Bank Statement', 'GL', 'Intercompany', 'Suspense', 'Nostro'] },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const ID_VERBS = [
  'detect-out-of-balance', 'suggest-clearing-entry', 'classify-suspense-item',
  'predict-resolution-time', 'generate-recon-narrative', 'summarize-exceptions',
  'score-recon-quality', 'recommend-write-off', 'detect-timing-difference',
  'validate-recon-completeness', 'suggest-control-improvement', 'generate-management-report',
  'predict-month-end-issues', 'classify-exception-root-cause', 'summarize-aging-buckets',
  'explain-variance',
];

const COLLECTION_VERBS = [];

const FILTER_FIELDS = [
  { key: 'status', label: 'Status', options: ['Open', 'In Progress', 'Completed', 'Escalated'] },
  { key: 'reconType', label: 'Type', options: ['Bank Statement', 'GL', 'Intercompany', 'Suspense', 'Nostro'] },
];

export default function BankReconciliation() {
  return (
    <BankModule
      title="Reconciliation"
      module="reconciliation"
      columns={COLUMNS}
      fields={FIELDS}
      idVerbs={ID_VERBS}
      collectionVerbs={COLLECTION_VERBS}
      filterFields={FILTER_FIELDS}
    />
  );
}
