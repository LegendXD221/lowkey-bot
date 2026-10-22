'use strict';

const { query } = require('../database/pool');
const { loadEnv } = require('../config/env');
const { getLogger } = require('../utils/logger');

const log = getLogger();

/**
 * Keep Neon free-tier (≈1 GB) healthy:
 * - purge expired bypass_cache
 * - enforce hard row cap on bypass_cache (oldest expires first)
 * - delete stale rate_limit_buckets (> 10 minutes)
 * - VACUUM ANALYZE lightly when significant deletes occur
 */
async function runCleanup() {
  const env = loadEnv();
  const maxRows = env.CACHE_MAX_ROWS || 2000;
  let deleted = 0;

  // 1) expired cache
  const exp = await query('DELETE FROM bypass_cache WHERE expires_at <= NOW()');
  deleted += exp.rowCount || 0;

  // 2) hard cap — keep newest-by-expires_at
  const over = await query(
    `WITH doomed AS (
       SELECT ctid FROM bypass_cache
       ORDER BY expires_at ASC
       OFFSET $1
     )
     DELETE FROM bypass_cache b
     USING doomed d
     WHERE b.ctid = d.ctid`,
    [maxRows]
  );
  deleted += over.rowCount || 0;

  // 3) stale rate-limit windows
  const rl = await query(
    `DELETE FROM rate_limit_buckets
     WHERE window_start < NOW() - INTERVAL '10 minutes'`
  );
  deleted += rl.rowCount || 0;

  if (deleted > 50) {
    try {
      await query('VACUUM (ANALYZE) bypass_cache');
      await query('VACUUM (ANALYZE) rate_limit_buckets');
    } catch (err) {
      // Neon may restrict VACUUM frequency; non-fatal
      log.debug({ err: err.message }, 'VACUUM skipped');
    }
  }

  if (deleted > 0) {
    log.info({ deleted, maxRows }, 'Storage cleanup');
  }
  return { deleted, maxRows };
}

async function storageStats() {
  const cache = await query('SELECT COUNT(*)::int AS n, COALESCE(pg_total_relation_size(\'bypass_cache\'),0)::bigint AS bytes FROM bypass_cache');
  const rates = await query('SELECT COUNT(*)::int AS n FROM rate_limit_buckets');
  const metrics = await query('SELECT COUNT(*)::int AS n FROM api_metrics');
  const providers = await query('SELECT COUNT(*)::int AS n FROM api_providers');
  const channels = await query('SELECT COUNT(*)::int AS n FROM autobypass_channels');

  // approximate DB size (Neon / Postgres)
  let dbBytes = null;
  try {
    const s = await query('SELECT pg_database_size(current_database())::bigint AS bytes');
    dbBytes = Number(s.rows[0].bytes);
  } catch (_) {}

  return {
    cacheRows: cache.rows[0].n,
    cacheBytes: Number(cache.rows[0].bytes),
    rateBuckets: rates.rows[0].n,
    metricsRows: metrics.rows[0].n,
    providers: providers.rows[0].n,
    channels: channels.rows[0].n,
    dbBytes
  };
}

function formatBytes(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

module.exports = { runCleanup, storageStats, formatBytes };
