import React from 'react';
import BankModule from './BankModule';

const COLUMNS = [
  { key: 'cardNumber', label: 'Card Number' },
  { key: 'customerId', label: 'Customer ID' },
  { key: 'cardType', label: 'Card Type' },
  { key: 'network', label: 'Network' },
  { key: 'creditLimit', label: 'Credit Limit' },
  { key: 'expiryDate', label: 'Expiry', render: v => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'status', label: 'Status' },
];

const FIELDS = [
  { key: 'customerId', label: 'Customer ID', required: true },
  { key: 'accountId', label: 'Account ID', required: true },
  { key: 'cardType', label: 'Card Type', type: 'select', required: true,
    options: ['Debit', 'Credit', 'Prepaid', 'Virtual', 'Corporate'] },
  { key: 'network', label: 'Network', type: 'select',
    options: ['Visa', 'Mastercard', 'Amex', 'Discover', 'UnionPay'] },
  { key: 'creditLimit', label: 'Credit Limit', type: 'number' },
  { key: 'currency', label: 'Currency', type: 'select',
    options: ['USD', 'EUR', 'GBP', 'JPY', 'CAD'] },
  { key: 'embossedName', label: 'Embossed Name' },
  { key: 'contactless', label: 'Contactless', type: 'select', options: ['true', 'false'] },
];

const ID_VERBS = [
  'classify-issuance-risk', 'predict-activation-rate', 'detect-fraudulent-application',
  'suggest-credit-limit', 'generate-card-design-recommendation', 'predict-spend-pattern',
  'classify-decline-reason', 'detect-skimming-pattern', 'suggest-replacement-strategy',
  'generate-fraud-alert-template', 'score-chargeback-risk', 'predict-renewal',
  'recommend-card-product', 'validate-pin-policy', 'detect-velocity-anomaly',
  'summarize-account-card-history',
];

const COLLECTION_VERBS = [];

const FILTER_FIELDS = [
  { key: 'status', label: 'Status', options: ['Active', 'Blocked', 'Expired', 'Pending', 'Cancelled'] },
  { key: 'cardType', label: 'Type', options: ['Debit', 'Credit', 'Prepaid', 'Virtual', 'Corporate'] },
];

export default function BankCardIssuance() {
  return (
    <BankModule
      title="Card Issuance"
      module="cardIssuance"
      columns={COLUMNS}
      fields={FIELDS}
      idVerbs={ID_VERBS}
      collectionVerbs={COLLECTION_VERBS}
      filterFields={FILTER_FIELDS}
    />
  );
}
