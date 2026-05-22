/**
 * Banking helper utilities shared across all bankFeat_*.js routes.
 *
 * Architecture: write-through cache.
 *   - An in-process Map mirrors each Prisma table for synchronous reads/writes.
 *   - Every mutating operation also fires an async Prisma upsert/delete so data
 *     persists across restarts.
 *   - On first access to a module, all existing rows are loaded from Prisma into
 *     the cache (lazy hydration).
 *
 * This keeps the exported function signatures 100% synchronous so the route
 * files (which call storeCreate, storeGet, etc. without await) need no changes.
 */

const { randomUUID } = require('crypto');
const { callOpenRouter } = require('../services/openrouter');
const { parseAIJson } = require('./parseAIJson');

// ---------------------------------------------------------------------------
// Module → Prisma model name
// ---------------------------------------------------------------------------
const MODULE_MODEL = {
  banking_accounts:       'bankAccount',
  banking_ledger:         'glEntry',
  banking_transactions:   'bankTransaction',
  banking_interest:       'interestAccrual',
  banking_kyc:            'kycProfile',
  banking_cards:          'cardIssuance',
  banking_ach:            'achBatch',
  banking_wire:           'wireTransfer',
  banking_swift:          'swiftMessage',
  banking_reconciliation: 'reconciliationItem',
  banking_regulatory:     'regReport',
};

// ---------------------------------------------------------------------------
// Prisma singleton (lazy — avoids circular-require at module load time)
// ---------------------------------------------------------------------------
let _prisma = null;
function getPrisma() {
  if (_prisma) return _prisma;
  try {
    // index.js creates the singleton and sets it on app; we grab it from the
    // shared module cache if available.
    _prisma = require('../lib/prisma');
    if (_prisma) return _prisma;
  } catch (_) {}
  const { PrismaClient } = require('@prisma/client');
  _prisma = new PrismaClient();
  return _prisma;
}

function prismaModel(module) {
  const name = MODULE_MODEL[module];
  if (!name) throw new Error(`Unknown banking module: ${module}`);
  const p = getPrisma();
  if (!p[name]) throw new Error(`Prisma model missing: ${name}`);
  return p[name];
}

// ---------------------------------------------------------------------------
// In-process write-through cache  with eager hydration
// ---------------------------------------------------------------------------
const _cache = new Map();           // module → Map(id → record)
const _hydratePromise = new Map();  // module → Promise (resolves when loaded)

function _ensureCache(module) {
  if (!_cache.has(module)) _cache.set(module, new Map());
}

/**
 * Kick off hydration for a module if not already started.
 * Returns a Promise that resolves when the initial load completes.
 * Subsequent calls return the same promise (already resolved).
 */
function _startHydration(module) {
  if (_hydratePromise.has(module)) return _hydratePromise.get(module);
  _ensureCache(module);
  const p = (async () => {
    try {
      const model = prismaModel(module);
      const rows = await model.findMany({ take: 2000, orderBy: { createdAt: 'asc' } });
      const store = _cache.get(module);
      rows.forEach(r => store.set(r.id, _serialise(r)));
    } catch (err) {
      console.error(`[bankingHelpers] hydration failed for ${module}:`, err.message);
      // Remove so next request retries
      _hydratePromise.delete(module);
    }
  })();
  _hydratePromise.set(module, p);
  return p;
}

/**
 * Pre-hydrate all banking modules at boot time so the very first request
 * to any banking endpoint sees persisted data immediately.
 */
function _preHydrateAll() {
  for (const module of Object.keys(MODULE_MODEL)) {
    _startHydration(module);
  }
}

function _getStore(module) {
  _ensureCache(module);
  // Kick off hydration if not started; don't block the sync call
  if (!_hydratePromise.has(module)) _startHydration(module);
  return _cache.get(module);
}

// ---------------------------------------------------------------------------
// Serialise Prisma Date objects to ISO strings (routes expect strings)
// ---------------------------------------------------------------------------
function _serialise(record) {
  if (!record) return null;
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Async Prisma write helpers (fire-and-forget, never block the route)
// ---------------------------------------------------------------------------
function _asyncUpsert(module, record) {
  try {
    const model = prismaModel(module);
    const { id, createdAt, updatedAt, ...rest } = record;
    // Convert ISO strings back to Date objects for Prisma
    const data = {};
    for (const [k, v] of Object.entries(rest)) {
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
        data[k] = new Date(v);
      } else {
        data[k] = v;
      }
    }
    model.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    }).catch(err => console.error(`[bankingHelpers] upsert error [${module}]:`, err.message));
  } catch (err) {
    console.error(`[bankingHelpers] _asyncUpsert setup error [${module}]:`, err.message);
  }
}

function _asyncDelete(module, id) {
  try {
    prismaModel(module)
      .delete({ where: { id } })
      .catch(err => console.error(`[bankingHelpers] delete error [${module}]:`, err.message));
  } catch (err) {
    console.error(`[bankingHelpers] _asyncDelete setup error [${module}]:`, err.message);
  }
}

// ---------------------------------------------------------------------------
// CRUD helpers — all synchronous (return plain values, not Promises)
// ---------------------------------------------------------------------------

function storeCreate(module, data) {
  const store = _getStore(module);
  const id = randomUUID();
  const now = new Date().toISOString();
  const record = {
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
    deletedAt: data.deletedAt !== undefined ? data.deletedAt : null,
  };
  store.set(id, record);
  _asyncUpsert(module, record);
  return record;
}

function storeGet(module, id) {
  return _getStore(module).get(String(id)) || null;
}

function storeUpdate(module, id, data) {
  const store = _getStore(module);
  const existing = store.get(String(id));
  if (!existing) return null;
  const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
  store.set(String(id), updated);
  _asyncUpsert(module, updated);
  return updated;
}

function storeDelete(module, id) {
  const store = _getStore(module);
  const existing = store.get(String(id));
  if (!existing) return null;
  store.delete(String(id));
  _asyncDelete(module, String(id));
  return existing;
}

function storeList(module, { page = 1, limit = 20, filter = {} } = {}) {
  const store = _getStore(module);
  let records = Array.from(store.values()).filter(r => !r.deletedAt);
  for (const [k, v] of Object.entries(filter)) {
    if (v !== undefined && v !== null && v !== '') {
      records = records.filter(r =>
        String(r[k] || '').toLowerCase().includes(String(v).toLowerCase())
      );
    }
  }
  const total = records.length;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const data = records.slice((pageNum - 1) * pageSize, pageNum * pageSize);
  return { data, total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) };
}

function storeCount(module, filter = {}) {
  return storeList(module, { page: 1, limit: 999999, filter }).total;
}

function storeSearch(module, q) {
  const store = _getStore(module);
  const records = Array.from(store.values()).filter(r => !r.deletedAt);
  if (!q) return records;
  const lower = String(q).toLowerCase();
  return records.filter(r => JSON.stringify(r).toLowerCase().includes(lower));
}

function storeArchive(module, id) {
  return storeUpdate(module, id, { deletedAt: new Date().toISOString(), status: 'Archived' });
}

function storeRestore(module, id) {
  return storeUpdate(module, id, { deletedAt: null });
}

function storeHistory(module, id) {
  const rec = storeGet(module, id);
  return rec ? [rec] : [];
}

function storeBatchCreate(module, items) {
  return items.map(item => storeCreate(module, item));
}

function storeBatchUpdate(module, updates) {
  return updates.map(({ id, data }) => storeUpdate(module, id, data)).filter(Boolean);
}

function storeBatchDelete(module, ids) {
  return ids.map(id => storeDelete(module, id)).filter(Boolean);
}

function storeStats(module) {
  const store = _getStore(module);
  const all = Array.from(store.values());
  const active = all.filter(r => !r.deletedAt);
  return { total: all.length, active: active.length, deleted: all.length - active.length };
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function exportCsv(records) {
  if (!records.length) return '';
  const headers = Object.keys(records[0]);
  const rows = records.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','));
  return [headers.join(','), ...rows].join('\n');
}

function importCsvRows(csvText, module) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return storeCreate(module, obj);
  });
}

// ---------------------------------------------------------------------------
// AI helper
// ---------------------------------------------------------------------------

async function aiCall(prisma, userId, module, prompt, systemMsg, fallback, temperature = 0.3) {
  const start = Date.now();
  let result, modelUsed;
  try {
    const raw = await callOpenRouter(prompt, systemMsg, { temperature });
    const parsed = parseAIJson(raw);
    if (!parsed) throw new Error('No JSON in AI response');
    result = parsed;
    modelUsed = 'openrouter';
  } catch (err) {
    const msg = (err && err.message) || '';
    if (/OPENROUTER_API_KEY/i.test(msg)) {
      throw Object.assign(
        new Error('AI service unavailable: OPENROUTER_API_KEY is not configured'),
        { statusCode: 503 }
      );
    }
    console.error(`AI call failed [${module}]:`, msg);
    result = fallback;
    modelUsed = 'local_fallback';
  }
  const processingTime = Date.now() - start;
  try {
    await prisma.aIAnalysisLog.create({
      data: {
        module,
        userId: userId || null,
        inputData: { prompt_length: prompt.length },
        outputData: result,
        modelUsed,
        confidence: modelUsed === 'openrouter' ? 82 : 55,
        processingTime,
      },
    });
  } catch (_) {}
  return { result, modelUsed, processingTime };
}

// ---------------------------------------------------------------------------
// Allow index.js to inject the already-created Prisma singleton so the helpers
// reuse the same connection pool instead of creating a second one.
// After injection, immediately pre-hydrate all modules so the first request
// to any banking endpoint sees persisted data.
// ---------------------------------------------------------------------------

function setPrisma(instance) {
  _prisma = instance;
  _preHydrateAll();
}

// ---------------------------------------------------------------------------
// Exports (identical to original)
// ---------------------------------------------------------------------------

module.exports = {
  storeCreate, storeGet, storeUpdate, storeDelete, storeList,
  storeCount, storeSearch, storeArchive, storeRestore, storeHistory,
  storeBatchCreate, storeBatchUpdate, storeBatchDelete,
  storeStats, exportCsv, importCsvRows, aiCall,
  setPrisma,
};
