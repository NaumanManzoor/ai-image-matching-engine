const config = require('../config');
const aiCalls = require('../repositories/aiCallRepository');

class BudgetExceededError extends Error {}

function priceFor(kind, inputTokens, outputTokens) {
  if (kind === 'embed') return (inputTokens / 1e6) * config.PRICE_EMBED_PER_1M;
  return (inputTokens / 1e6) * config.PRICE_INPUT_PER_1M
       + (outputTokens / 1e6) * config.PRICE_OUTPUT_PER_1M;
}

// Wraps every AI call: checks the daily budget, runs the call, and logs one ai_calls row
// whether the call succeeds or fails. `fn` must return { result, usage }.
async function trackCall({ kind, model, ownerType = null, ownerId = null }, fn) {
  const usedToday = await aiCalls.countToday();
  if (usedToday >= config.DAILY_CALL_BUDGET) {
    throw new BudgetExceededError(
      `Daily AI call budget reached (${usedToday}/${config.DAILY_CALL_BUDGET}); call refused`
    );
  }

  try {
    const { result, usage } = await fn();
    const inputTokens = usage?.promptTokenCount ?? 0;
    // Thinking tokens are billed as output, so they count toward cost.
    const outputTokens = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
    await aiCalls.insertCall({
      kind, model, ownerType, ownerId, inputTokens, outputTokens,
      costUsd: priceFor(kind, inputTokens, outputTokens),
      status: 'success', error: null,
    });
    return result;
  } catch (err) {
    await aiCalls.insertCall({
      kind, model, ownerType, ownerId, inputTokens: 0, outputTokens: 0,
      costUsd: 0, status: 'error', error: String(err.message).slice(0, 500),
    });
    throw err;
  }
}

module.exports = { trackCall, BudgetExceededError };