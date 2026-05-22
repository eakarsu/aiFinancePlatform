/**
 * Core Banking API client
 * All endpoints share the same CRUD + AI verb shape.
 * Base: /api/bank/<module>
 */
import api from './api';

const bankApi = (module) => ({
  // CRUD
  list: (params) => api.get(`/bank/${module}`, { params }),
  get: (id) => api.get(`/bank/${module}/${id}`),
  create: (data) => api.post(`/bank/${module}`, data),
  update: (id, data) => api.patch(`/bank/${module}/${id}`, data),
  remove: (id) => api.delete(`/bank/${module}/${id}`),
  search: (q) => api.get(`/bank/${module}/meta/search`, { params: { q } }),
  count: (params) => api.get(`/bank/${module}/meta/count`, { params }),
  stats: () => api.get(`/bank/${module}/meta/stats`),
  exportCsv: () => api.get(`/bank/${module}/meta/export-csv`),
  importCsv: (csv) => api.post(`/bank/${module}/meta/import-csv`, { csv }),
  archive: (id) => api.post(`/bank/${module}/${id}/archive`),
  restore: (id) => api.post(`/bank/${module}/${id}/restore`),
  history: (id) => api.get(`/bank/${module}/${id}/history`),
  batchCreate: (items) => api.post(`/bank/${module}/batch`, { items }),
  batchUpdate: (updates) => api.patch(`/bank/${module}/batch`, { updates }),
  batchDelete: (ids) => api.post(`/bank/${module}/batch-delete`, { ids }),

  // AI verbs — single record (requires id)
  aiVerb: (id, verb, body = {}) =>
    api.post(`/bank/${module}/${id}/ai/${verb}`, body),

  // AI verbs — collection level (no id)
  aiCollectionVerb: (verb, body = {}) =>
    api.post(`/bank/${module}/ai/${verb}`, body),
});

export default bankApi;
