import React from 'react';
import BankModule from './BankModule';

const COLUMNS = [
  { key: 'customerId', label: 'Customer ID' },
  { key: 'fullName', label: 'Full Name' },
  { key: 'riskTier', label: 'Risk Tier' },
  { key: 'kycStatus', label: 'KYC Status', render: (v) => {
    const map = { approved: 'Approved', pending: 'Pending', rejected: 'Rejected' };
    return map[v] || v;
  }},
  { key: 'idDocumentType', label: 'ID Type' },
  { key: 'reviewDate', label: 'Review Date', render: v => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'status', label: 'Status' },
];

const FIELDS = [
  { key: 'customerId', label: 'Customer ID', required: true },
  { key: 'fullName', label: 'Full Name', required: true },
  { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'idDocumentType', label: 'ID Document Type', type: 'select',
    options: ['Passport', 'National ID', 'Driver License', 'Residence Permit'] },
  { key: 'idDocumentNumber', label: 'ID Document Number' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'sourceOfFunds', label: 'Source of Funds', type: 'select',
    options: ['Employment', 'Business', 'Investment', 'Inheritance', 'Other'] },
  { key: 'jurisdiction', label: 'Jurisdiction' },
  { key: 'pepFlag', label: 'PEP Flag', type: 'select', options: ['true', 'false'] },
];

const ID_VERBS = [
  'classify-risk-tier', 'screen-sanctions', 'validate-id-document', 'score-pep-exposure',
  'detect-doc-tampering', 'suggest-additional-doc', 'generate-edd-questionnaire',
  'summarize-customer-due-diligence', 'predict-suspicious-activity', 'classify-occupation-risk',
  'recommend-periodic-review', 'score-geographic-risk', 'generate-cdd-summary',
  'validate-source-of-funds', 'detect-shell-company', 'suggest-blocking-reason',
];

const COLLECTION_VERBS = [];

const FILTER_FIELDS = [
  { key: 'status', label: 'Status', options: ['Active', 'Pending', 'Rejected', 'Expired'] },
  { key: 'riskTier', label: 'Risk Tier', options: ['Low', 'Medium', 'High', 'Prohibited'] },
];

export default function BankKyc() {
  return (
    <BankModule
      title="KYC"
      module="kyc"
      columns={COLUMNS}
      fields={FIELDS}
      idVerbs={ID_VERBS}
      collectionVerbs={COLLECTION_VERBS}
      filterFields={FILTER_FIELDS}
    />
  );
}
