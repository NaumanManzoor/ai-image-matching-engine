const { PgBoss } = require('pg-boss');

// pg-boss keeps its job queue in our own Postgres (schema "pgboss"), so no Redis is needed.
const boss = new PgBoss(process.env.DATABASE_URL);
boss.on('error', (err) => console.error('[pg-boss]', err.message));

module.exports = { boss };