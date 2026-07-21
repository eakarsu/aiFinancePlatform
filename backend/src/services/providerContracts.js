'use strict';

const { SCOPE } = require('./tradingControls');

const CAPABILITIES = new Set([
  'market-data', 'custody-snapshot', 'paper-fill', 'corporate-action', 'custody-reconciliation',
]);
const MODES = new Set(['paper', 'licensed']);

function parseProviderContracts(raw = '') {
  if (!String(raw).trim()) return new Map();
  let definitions;
  try {
    definitions = JSON.parse(raw);
  } catch (_) {
    throw new Error('FINANCE_PROVIDER_CONTRACTS must be valid JSON');
  }
  if (!Array.isArray(definitions)) throw new Error('FINANCE_PROVIDER_CONTRACTS must be a JSON array');
  const contracts = new Map();
  for (const definition of definitions) {
    const id = String(definition?.id || '');
    const mode = String(definition?.mode || '');
    const capabilities = definition?.capabilities;
    const contractRef = String(definition?.contractRef || '');
    if (!SCOPE.test(id) || !MODES.has(mode) || !Array.isArray(capabilities)
      || capabilities.length === 0 || !capabilities.every((item) => CAPABILITIES.has(item))
      || !SCOPE.test(contractRef) || contracts.has(id)) {
      throw new Error('invalid or duplicate finance provider contract');
    }
    contracts.set(id, Object.freeze({
      id, mode, contractRef, capabilities: Object.freeze([...new Set(capabilities)]),
    }));
  }
  return contracts;
}

function providerFor(contracts, id, capability) {
  const contract = contracts.get(String(id || ''));
  if (!contract || !contract.capabilities.includes(capability)) return null;
  return contract;
}

function missingCapabilities(contracts) {
  const configured = new Set([...contracts.values()].flatMap((contract) => contract.capabilities));
  return [...CAPABILITIES].filter((capability) => !configured.has(capability));
}

module.exports = { CAPABILITIES, parseProviderContracts, providerFor, missingCapabilities };
