const aiCalls = require('../repositories/aiCallRepository');

async function getCosts(req, res) {
  const byKind = await aiCalls.totals();
  const total = byKind.reduce(
    (t, k) => ({
      calls: t.calls + k.calls,
      failed: t.failed + k.failed,
      input_tokens: t.input_tokens + k.input_tokens,
      output_tokens: t.output_tokens + k.output_tokens,
      cost_usd: t.cost_usd + k.cost_usd,
    }),
    { calls: 0, failed: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 }
  );
  res.json({
    note: 'cost_usd is the equivalent paid-tier price; actual spend is $0 on the free tier',
    total,
    byKind,
    calls: await aiCalls.listRecent(100),
  });
}

module.exports = { getCosts };