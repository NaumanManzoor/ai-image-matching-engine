const config = require('./config');
const express = require('express');
const { ZodError } = require('zod');
const { pool } = require('./db/pool');
const routes = require('./routes');
const { startJobs } = require('./jobs');
const { NotReadyError, NotFoundError } = require('./services/matchingService');

const app = express();
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

app.use(routes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler: bad input -> 400, everything else -> 500 (never leaks a stack trace).
app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Invalid request',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
  if (err instanceof NotReadyError) return res.status(409).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function main() {
  await startJobs();
  app.listen(config.PORT, () => console.log(`Server running on http://localhost:${config.PORT}`));
}

main().catch((err) => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});