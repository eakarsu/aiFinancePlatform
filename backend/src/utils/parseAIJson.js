/**
 * Centralized 3-strategy JSON parser for AI responses.
 *
 * Replaces the duplicate `repairJSON` helpers scattered across ~10 route files.
 *
 * Strategies tried in order:
 *   1. Direct JSON.parse on the full input
 *   2. Extract first {...} block via regex and parse
 *   3. Repair truncated/unclosed JSON: close brackets/braces, strip trailing commas
 *
 * Returns parsed object/array or null if all strategies fail.
 */
function parseAIJson(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. Direct
  try { return JSON.parse(text); } catch (_) {}

  // 2. First {...} block
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch (_) {}

  // 3. Repair (close unclosed brackets/braces/strings, drop trailing commas)
  try {
    const m = text.match(/\{[\s\S]*\}?/);
    if (!m) return null;
    let fixed = m[0].replace(/,\s*$/, '');
    const opens = { '{': 0, '[': 0 };
    const closes = { '}': '{', ']': '[' };
    let inString = false;
    let escape = false;
    for (const ch of fixed) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{' || ch === '[') opens[ch]++;
      if (ch === '}' || ch === ']') opens[closes[ch]]--;
    }
    if (inString) fixed += '"';
    for (let i = 0; i < opens['[']; i++) fixed += ']';
    for (let i = 0; i < opens['{']; i++) fixed += '}';
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(fixed);
  } catch (_) {
    return null;
  }
}

module.exports = { parseAIJson };
