import React from 'react';
import BankModule from './BankModule';

const COLUMNS = [
  { key: 'wireReference', label: 'Reference' },
  { key: 'amount', label: 'Amount', render: (v, row) => v != null ? `${row.currency || 'USD'} ${Number(v).toLocaleString()}` : '—' },
  { key: 'beneficiaryName', label: 'Beneficiary' },
  { key: 'beneficiaryBic', label: 'BIC' },
  { key: 'purposeOfPayment', label: 'Purpose' },
  { key: 'valueDate', label: 'Value Date', render: v => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'status', label: 'Status' },
];

const FIELDS = [
  { key: 'senderAccountId', label: 'Sender Account ID', required: true },
  { key: 'beneficiaryName', label: 'Beneficiary Name', required: true },
  { key: 'beneficiaryIban', label: 'Beneficiary IBAN' },
  { key: 'beneficiaryBic', label: 'Beneficiary BIC/SWIFT', required: true },
  { key: 'beneficiaryBankName', label: 'Beneficiary Bank Name' },
  { key: 'amount', label: 'Amount', type: 'number', required: true },
  { key: 'currency', label: 'Currency', type: 'select',
    options: ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'] },
  { key: 'purposeOfPayment', label: 'Purpose of Payment' },
  { key: 'valueDate', label: 'Value Date', type: 'date' },
  { key: 'correspondentBic', label: 'Correspondent BIC' },
];

const ID_VERBS = [
  'validate-iban-swift', 'screen-ofac-sanctions', 'classify-purpose-of-payment',
  'predict-recall-likelihood', 'detect-business-email-compromise', 'suggest-correspondent-routing',
  'generate-mt103-fields', 'score-counterparty-risk', 'summarize-wire-history',
  'detect-layering-pattern', 'validate-beneficiary', 'predict-investigation-need',
  'recommend-block', 'classify-jurisdiction-risk', 'generate-customer-confirmation',
  'explain-wire-fees',
];

const COLLECTION_VERBS = [];

const FILTER_FIELDS = [
  { key: 'status', label: 'Status', options: ['Pending', 'Settled', 'Recalled', 'Rejected', 'Processing', 'Blocked'] },
  { key: 'currency', label: 'Currency', options: ['USD', 'EUR', 'GBP', 'JPY', 'CHF'] },
];

export default function BankWire() {
  return (
    <BankModule
      title="Wire Transfers"
      module="wire"
      columns={COLUMNS}
      fields={FIELDS}
      idVerbs={ID_VERBS}
      collectionVerbs={COLLECTION_VERBS}
      filterFields={FILTER_FIELDS}
    />
  );
}
