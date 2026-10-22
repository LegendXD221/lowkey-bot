'use strict';
const { query } = require('../pool');
const { hashUrl } = require('../../utils/formatters');
const { loadEnv } = require('../../config/env');

async function getCached(url, providerId) {
  const h = hashUrl(url);
  const res = await query(
    `SELECT result_json FROM bypass_cache
     WHERE normalized_url_hash = $1 AND provider_id = $2 AND expires_at > NOW()`,
    [h, providerId]
  );
  if (res.rowCount === 0) return null;
  return res.rows[0].result_json;
}

async function setCached(url, providerId, result) {
  const env = loadEnv();
  const h = hashUrl(url);
  // store minimal payload only
  const payload = typeof result === 'string'
    ? { result }
    : { result: result?.result || result };
  // hard length guard — never cache huge strings
  const raw = JSON.stringify(payload);
  if (raw.length > 4096) return; // skip caching oversized results
  await query(
    `INSERT INTO bypass_cache (normalized_url_hash, provider_id, result_json, expires_at)
     VALUES ($1, $2, $3, NOW() + ($4 || ' seconds')::interval)
     ON CONFLICT (normalized_url_hash, provider_id) DO UPDATE SET
       result_json = EXCLUDED.result_json,
       expires_at = EXCLUDED.expires_at`,
    [h, providerId, raw, String(env.CACHE_TTL_SECONDS)]
  );
}

async function clearCache() {
  await query('DELETE FROM bypass_cache');
}

async function purgeExpired() {
  await query('DELETE FROM bypass_cache WHERE expires_at <= NOW()');
}

async function countRows() {
  const res = await query('SELECT COUNT(*)::int AS n FROM bypass_cache');
  return res.rows[0].n;
}

module.exports = { getCached, setCached, clearCache, purgeExpired, countRows };
