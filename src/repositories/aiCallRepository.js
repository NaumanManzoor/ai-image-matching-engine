const { pool } = require('../db/pool');

async function insertCall(call) {
  await pool.query(
    `INSERT INTO ai_calls
       (kind, model, owner_type, owner_id, input_tokens, output_tokens, cost_usd, status, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      call.kind, call.model, call.ownerType, call.ownerId,
      call.inputTokens, call.outputTokens, call.costUsd, call.status, call.error,
    ]
  );
}

async function countToday() {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM ai_calls WHERE created_at >= date_trunc('day', now())`
  );
  return rows[0].n;
}

async function listRecent(limit = 100) {
  const { rows } = await pool.query(
    `SELECT id, kind, model, owner_type, owner_id, input_tokens, output_tokens,
            cost_usd::float AS cost_usd, status, error, created_at
       FROM ai_calls ORDER BY id DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

async function totals() {
  const { rows } = await pool.query(
    `SELECT kind,
            count(*)::int AS calls,
            count(*) FILTER (WHERE status = 'success')::int AS succeeded,
            count(*) FILTER (WHERE status = 'error')::int AS failed,
            coalesce(sum(input_tokens), 0)::int AS input_tokens,
            coalesce(sum(output_tokens), 0)::int AS output_tokens,
            coalesce(sum(cost_usd), 0)::float AS cost_usd
       FROM ai_calls GROUP BY kind ORDER BY kind`
  );
  return rows;
}

module.exports = { insertCall, countToday, listRecent, totals };