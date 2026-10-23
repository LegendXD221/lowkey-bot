'use strict';
const { Pool } = require('pg');
const { loadEnv } = require('../config/env');
const { getLogger } = require('../utils/logger');
const log = getLogger();
let pool = null;
function getPool() {
  if (pool) return pool;
  const env = loadEnv();
  pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
    max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000
  });
  pool.on('error', (err) => log.error({ err }, 'Unexpected PostgreSQL pool error'));
  return pool;
}
async function query(text, params = []) {
  const p = getPool();
  const start = Date.now();
  try {
    const res = await p.query(text, params);
    if (Date.now() - start > 1000) log.warn({ duration: Date.now() - start }, 'Slow query');
    return res;
  } catch (err) {
    log.error({ err, text: text.slice(0, 80) }, 'Query failed');
    throw err;
  }
}
async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (rollbackErr) { log.error({ err: rollbackErr }, 'Transaction rollback failed'); }
    throw err;
  } finally { client.release(); }
}
async function checkConnectivity() {
  try { await query('SELECT 1'); return true; } catch { return false; }
}
async function closePool() { if (pool) { await pool.end(); pool = null; } }
module.exports = { getPool, query, withTransaction, checkConnectivity, closePool };
