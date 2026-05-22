import React from 'react';
import BankModule from './BankModule';

const COLUMNS = [
  { key: 'transactionId', label: 'Txn ID' },
  { key: 'accountId', label: 'Account' },
  { key: 'amount', label: 'Amount', render: (v, row) => v != null ? `${row.currency || 'USD'} ${Number(v).toLocaleString()}` : '—' },
  { key: 'type', label: 'Type' },
  { key: 'mcc', label: 'MCC' },
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Date', render: v => v ? new Date(v).toLocaleDateString() : '—' },
];

const FIELDS = [
  { key: 'accountId', label: 'Account ID', required: true },
  { key: 'amount', label: 'Amount', type: 'number', required: true },
  { key: 'type', label: 'Type', type: 'select', required: true,
    options: ['Debit', 'Credit', 'Transfer', 'Fee', 'Reversal', 'Interest'] },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'mcc', label: 'MCC Code' },
  { key: 'currency', label: 'Currency', type: 'select',
    options: ['USD', 'EUR', 'GBP', 'JPY', 'CAD'] },
  { key: 'routingNumber', label: 'Routing Number' },
  { key: 'counterpartyAccount', label: 'Counterparty Account' },
];

const ID_VERBS = [
  'detect-fraud', 'classify-mcc', 'suggest-categorization', 'predict-reversal-risk',
  'score-aml-risk', 'detect-structuring', 'generate-receipt-description',
  'validate-routing-numbers', 'predict-settlement-time', 'summarize-customer-spending',
  'suggest-fee-waiver', 'detect-duplicate', 'classify-purpose',
  'score-velocity-risk', 'recommend-decline', 'generate-narrative',
];

const COLLECTION_VERBS = [];

const FILTER_FIELDS = [
  { key: 'status', label: 'Status', options: ['Completed', 'Pending', 'Failed', 'Reversed', 'Processing'] },
  { key: 'type', label: 'Type', options: ['Debit', 'Credit', 'Transfer', 'Fee', 'Reversal', 'Interest'] },
];

export default function BankTransactions() {
  return (
    <BankModule
      title="Transactions"
      module="transactions"
      columns={COLUMNS}
      fields={FIELDS}
      idVerbs={ID_VERBS}
      collectionVerbs={COLLECTION_VERBS}
      filterFields={FILTER_FIELDS}
    />
  );
}
