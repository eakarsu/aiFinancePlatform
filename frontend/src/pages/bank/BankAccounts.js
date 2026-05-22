import React from 'react';
import BankModule from './BankModule';

const COLUMNS = [
  { key: 'accountNumber', label: 'Account #' },
  { key: 'customerId', label: 'Customer ID' },
  { key: 'accountType', label: 'Type' },
  { key: 'currency', label: 'Currency' },
  { key: 'availableBalance', label: 'Balance' },
  { key: 'status', label: 'Status' },
  { key: 'openedAt', label: 'Opened', render: v => v ? new Date(v).toLocaleDateString() : '—' },
];

const FIELDS = [
  { key: 'customerId', label: 'Customer ID', required: true },
  { key: 'accountType', label: 'Account Type', type: 'select', required: true,
    options: ['Checking', 'Savings', 'Money Market', 'CD', 'Loan', 'Credit Card'] },
  { key: 'currency', label: 'Currency', type: 'select',
    options: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF'] },
  { key: 'productCode', label: 'Product Code' },
  { key: 'branchCode', label: 'Branch Code' },
  { key: 'overdraftLimit', label: 'Overdraft Limit', type: 'number' },
];

const ID_VERBS = [
  'classify-account-type', 'predict-balance-trajectory', 'detect-dormancy',
  'suggest-product-upgrade', 'score-customer-lifetime-value', 'detect-fee-anomalies',
  'generate-statement-narrative', 'predict-overdraft', 'suggest-savings-goal',
  'classify-spending', 'score-attrition-risk', 'suggest-cross-sell', 'summarize-relationship',
];

const COLLECTION_VERBS = [
  'generate-onboarding-checklist', 'validate-account-naming', 'detect-shared-pattern',
];

const FILTER_FIELDS = [
  { key: 'status', label: 'Status', options: ['Active', 'Closed', 'Pending', 'Archived'] },
  { key: 'accountType', label: 'Type', options: ['Checking', 'Savings', 'Money Market', 'CD', 'Loan', 'Credit Card'] },
];

export default function BankAccounts() {
  return (
    <BankModule
      title="Accounts"
      module="accounts"
      columns={COLUMNS}
      fields={FIELDS}
      idVerbs={ID_VERBS}
      collectionVerbs={COLLECTION_VERBS}
      filterFields={FILTER_FIELDS}
    />
  );
}
