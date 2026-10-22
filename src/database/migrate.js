'use strict';
const fs = require('fs');
const path = require('path');
const { withTransaction, closePool } = require('./pool');
const { loadEnv } = require('../config/env');
const { getLogger } = require('../utils/logger');
async function migrate() {
  loadEnv();
  const log = getLogger();
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  log.info({ migrations: files.length }, 'Database migration startup');
  await withTransaction(async (client) => {
    // Serialize startup migrations across replicas and roll back a partial run.
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('lowkey:schema-migrations'))");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    for (const file of files) {
      const id = file;
      const exists = await client.query('SELECT 1 FROM schema_migrations WHERE id = $1', [id]);
      if (exists.rowCount > 0) { log.info({ id }, 'Migration already applied'); continue; }
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      log.info({ id }, 'Applying migration');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
      log.info({ id }, 'Migration applied');
    }
  });
  log.info('Database migrations complete');
}
if (require.main === module) {
  migrate().then(async () => { console.log('Migrations complete'); await closePool(); process.exit(0); })
    .catch(async (err) => { console.error('Migration failed', err); await closePool(); process.exit(1); });
}
module.exports = { migrate };
