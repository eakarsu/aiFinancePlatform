import React from 'react';
import BankModule from './BankModule';

const COLUMNS = [
  { key: 'messageRef', label: 'Message Ref' },
  { key: 'messageType', label: 'Type' },
  { key: 'senderBic', label: 'Sender BIC' },
  { key: 'receiverBic', label: 'Receiver BIC' },
  { key: 'amount', label: 'Amount' },
  { key: 'currency', label: 'Currency' },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Created', render: v => v ? new Date(v).toLocaleDateString() : '—' },
];

const FIELDS = [
  { key: 'messageType', label: 'Message Type', type: 'select', required: true,
    options: ['MT103', 'MT202', 'MT196', 'MT199', 'MT940', 'MT950', 'MT760'] },
  { key: 'senderBic', label: 'Sender BIC', required: true },
  { key: 'receiverBic', label: 'Receiver BIC', required: true },
  { key: 'amount', label: 'Amount', type: 'number' },
  { key: 'currency', label: 'Currency', type: 'select',
    options: ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD'] },
  { key: 'valueDate', label: 'Value Date', type: 'date' },
  { key: 'rawMessage', label: 'Raw MT Message', type: 'textarea' },
  { key: 'coverMethod', label: 'Cover Method', type: 'select',
    options: ['Cover', 'Direct', 'Serial'] },
];

const ID_VERBS = [
  'parse-mt103', 'parse-mt202', 'validate-mt-message', 'classify-message-type',
  'suggest-field-correction', 'generate-mt-response', 'detect-message-anomaly',
  'predict-non-stp-rate', 'summarize-correspondent-flows', 'recommend-routing-change',
  'score-message-quality', 'validate-bic-code', 'generate-investigation-mt196',
  'classify-cover-method', 'detect-network-issue', 'explain-rejection-reason',
];

const COLLECTION_VERBS = [];

const FILTER_FIELDS = [
  { key: 'status', label: 'Status', options: ['Queued', 'Sent', 'Received', 'Rejected', 'Acknowledged'] },
  { key: 'messageType', label: 'Message Type', options: ['MT103', 'MT202', 'MT196', 'MT199'] },
];

export default function BankSwift() {
  return (
    <BankModule
      title="SWIFT Messages"
      module="swift"
      columns={COLUMNS}
      fields={FIELDS}
      idVerbs={ID_VERBS}
      collectionVerbs={COLLECTION_VERBS}
      filterFields={FILTER_FIELDS}
    />
  );
}
