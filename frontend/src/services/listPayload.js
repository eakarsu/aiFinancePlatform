// Accept the list shapes returned by the paginated and legacy record routes.
// Never put an error object or pagination wrapper into array-backed UI state.
export function listPayload(payload, key = 'data') {
  const rows = Array.isArray(payload) ? payload : payload?.[key];
  const data = Array.isArray(rows) ? rows : [];
  const count = payload?.pagination?.total ?? payload?.total;
  return { data, total: Number.isFinite(Number(count)) ? Number(count) : data.length };
}
