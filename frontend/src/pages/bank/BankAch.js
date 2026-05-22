import React from 'react';
import BankModule from './BankModule';

const COLUMNS = [
  { key: 'traceNumber', label: 'Trace #' },
  { key: 'secCode', label: 'SEC Code' },
  { key: 'amount', label: 'Amount', render: v => v != null ? `$${Number(v).toLocaleString()}` : '—' },
  { key: 'originatorId', label: 'Originator' },
  { key: 'rdfiBankName', label: 'RDFI Bank' },
  { key: 'effectiveDate', label: 'Effective Date', render: v => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'status', label: 'Status' },
];

const FIELDS = [
  { key: 'originatorId', label: 'Originator ID', required: true },
  { key: 'receiverAccountNumber', label: 'Receiver Account #', required: true },
  { key: 'receiverRoutingNumber', label: 'Receiver Routing #', required: true },
  { key: 'amount', label: 'Amount', type: 'number', required: true },
  { key: 'secCode', label: 'SEC Code', type: 'select', required: true,
    options: ['PPD', 'CCD', 'CTX', 'WEB', 'TEL', 'POP', 'RCK', 'IAT', 'ARC'] },
  { key: 'effectiveDate', label: 'Effective Date', type: 'date' },
  { key: 'description', label: 'Transaction Description' },
  { key: 'individualName', label: 'Individual Name' },
  { key: 'prenotification', label: 'Prenotification', type: 'select', options: ['true', 'false'] },
];

const ID_VERBS = [
  'validate-routing-aba', 'detect-rdfi-rejection-pattern', 'classify-sec-code',
  'predict-return-rate', 'suggest-return-reason-code', 'generate-nacha-file-narrative',
  'score-originator-risk', 'detect-unauthorized-debit', 'suggest-prenotification',
  'classify-batch-failure', 'predict-settlement-delay', 'recommend-resubmission-strategy',
  'validate-effective-date', 'summarize-ach-volume', 'generate-customer-notice',
  'detect-mule-pattern',
];

const COLLECTION_VERBS = [];

const FILTER_FIELDS = [
  { key: 'status', label: 'Status', options: ['Pending', 'Settled', 'Returned', 'Failed', 'Processing'] },
  { key: 'secCode', label: 'SEC Code', options: ['PPD', 'CCD', 'CTX', 'WEB', 'TEL', 'POP'] },
];

export default function BankAch() {
  return (
    <BankModule
      title="ACH"
      module="ach"
      columns={COLUMNS}
      fields={FIELDS}
      idVerbs={ID_VERBS}
      collectionVerbs={COLLECTION_VERBS}
      filterFields={FILTER_FIELDS}
    />
  );
}
