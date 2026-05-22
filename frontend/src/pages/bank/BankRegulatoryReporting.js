import React from 'react';
import BankModule from './BankModule';

const COLUMNS = [
  { key: 'reportType', label: 'Report Type' },
  { key: 'regulatorCode', label: 'Regulator' },
  { key: 'period', label: 'Period' },
  { key: 'filingDeadline', label: 'Deadline', render: v => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'submittedAt', label: 'Submitted', render: v => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'status', label: 'Status' },
];

const FIELDS = [
  { key: 'reportType', label: 'Report Type', type: 'select', required: true,
    options: ['SAR', 'CTR', 'Call Report', 'Reg D', 'CRA', 'HMDA', 'BSA', 'FATCA', 'FBAR'] },
  { key: 'regulatorCode', label: 'Regulator Code', type: 'select', required: true,
    options: ['FDIC', 'OCC', 'Federal Reserve', 'FinCEN', 'CFPB', 'SEC', 'CFTC'] },
  { key: 'period', label: 'Period (YYYY-MM)' },
  { key: 'filingDeadline', label: 'Filing Deadline', type: 'date' },
  { key: 'reportingEntityId', label: 'Reporting Entity ID' },
  { key: 'narrativeText', label: 'Narrative', type: 'textarea' },
  { key: 'jurisdiction', label: 'Jurisdiction' },
];

const ID_VERBS = [
  'classify-bsa-priority', 'draft-sar-narrative', 'draft-ctr',
  'suggest-reportable-threshold', 'validate-ffiec-call-data', 'predict-examiner-findings',
  'summarize-aml-program-effectiveness', 'generate-compliance-attestation',
  'score-regulatory-risk', 'detect-reporting-gaps', 'classify-currency-event',
  'draft-reg-d-violation-notice', 'generate-board-report', 'validate-cra-data',
  'summarize-fincen-feedback', 'suggest-program-enhancement',
];

const COLLECTION_VERBS = [];

const FILTER_FIELDS = [
  { key: 'status', label: 'Status', options: ['Draft', 'Submitted', 'Accepted', 'Rejected', 'Amended'] },
  { key: 'reportType', label: 'Type', options: ['SAR', 'CTR', 'Call Report', 'Reg D', 'CRA', 'HMDA'] },
];

export default function BankRegulatoryReporting() {
  return (
    <BankModule
      title="Regulatory Reporting"
      module="regulatoryReporting"
      columns={COLUMNS}
      fields={FIELDS}
      idVerbs={ID_VERBS}
      collectionVerbs={COLLECTION_VERBS}
      filterFields={FILTER_FIELDS}
    />
  );
}
