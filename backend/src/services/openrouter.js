/**
 * Centralized OpenRouter caller for the AI Finance Platform.
 *
 * Replaces ~15 inline copy-pastes of `callOpenRouter` across route files.
 * - Reads API key + model from env (default: anthropic/claude-3-5-sonnet-20241022).
 * - Returns the assistant message string.
 * - Throws on transport / API errors so callers can apply per-route fallbacks.
 * - No partial-API-key logging (audit flagged the leaked-prefix log).
 */

async function callOpenRouter(prompt, systemPrompt = '', opts = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
  const max_tokens = opts.max_tokens ?? 8000;
  const temperature = opts.temperature ?? 0.3;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      max_tokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter API error: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

module.exports = { callOpenRouter };
