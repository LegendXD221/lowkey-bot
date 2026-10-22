'use strict';
const { query } = require('../pool');
async function getMetrics(providerId) {
  const res = await query('SELECT * FROM api_metrics WHERE provider_id = $1', [providerId]);
  return res.rows[0] || null;
}
async function getAllMetrics() {
  const res = await query(`SELECT m.*, p.name, p.enabled, p.priority FROM api_metrics m JOIN api_providers p ON p.id = m.provider_id ORDER BY p.priority ASC`);
  return res.rows;
}
async function recordSuccess(providerId, latencyMs) {
  await query(
    `INSERT INTO api_metrics (provider_id, total_requests, successful_requests, consecutive_failures,
      average_latency_ms, last_latency_ms, last_success_at, circuit_state, half_open_successes, updated_at)
     VALUES ($1, 1, 1, 0, $2, $2, NOW(), 'closed', 0, NOW())
     ON CONFLICT (provider_id) DO UPDATE SET
       total_requests = api_metrics.total_requests + 1,
       successful_requests = api_metrics.successful_requests + 1,
       consecutive_failures = 0,
       average_latency_ms = CASE WHEN api_metrics.successful_requests = 0 THEN $2
         ELSE (api_metrics.average_latency_ms * api_metrics.successful_requests + $2) / (api_metrics.successful_requests + 1) END,
       last_latency_ms = $2, last_success_at = NOW(),
       circuit_state = CASE WHEN api_metrics.circuit_state = 'half_open' THEN 'closed' ELSE api_metrics.circuit_state END,
       half_open_successes = CASE WHEN api_metrics.circuit_state = 'half_open' THEN api_metrics.half_open_successes + 1 ELSE 0 END,
       updated_at = NOW()`, [providerId, latencyMs]);
}
async function recordFailure(providerId, latencyMs = null) {
  const env = require('../../config/env').loadEnv();
  await query(
    `INSERT INTO api_metrics (provider_id, total_requests, failed_requests, consecutive_failures,
      last_latency_ms, last_failure_at, circuit_state, circuit_opened_at, updated_at)
     VALUES ($1, 1, 1, 1, $2, NOW(), 'closed', NULL, NOW())
     ON CONFLICT (provider_id) DO UPDATE SET
       total_requests = api_metrics.total_requests + 1,
       failed_requests = api_metrics.failed_requests + 1,
       consecutive_failures = api_metrics.consecutive_failures + 1,
       last_latency_ms = COALESCE($2, api_metrics.last_latency_ms),
       last_failure_at = NOW(),
       circuit_state = CASE WHEN api_metrics.consecutive_failures + 1 >= $3 THEN 'open' ELSE api_metrics.circuit_state END,
       circuit_opened_at = CASE WHEN api_metrics.consecutive_failures + 1 >= $3 AND api_metrics.circuit_state <> 'open' THEN NOW() ELSE api_metrics.circuit_opened_at END,
       half_open_successes = 0, updated_at = NOW()`,
    [providerId, latencyMs, env.CIRCUIT_FAILURE_THRESHOLD]);
}
async function setCircuitState(providerId, state) {
  await query(`UPDATE api_metrics SET circuit_state = $2,
    circuit_opened_at = CASE WHEN $2 = 'open' THEN NOW() ELSE circuit_opened_at END,
    half_open_successes = CASE WHEN $2 = 'half_open' THEN 0 ELSE half_open_successes END,
    updated_at = NOW() WHERE provider_id = $1`, [providerId, state]);
}
async function resetHealth(providerId) {
  await query(`UPDATE api_metrics SET
    circuit_state = 'closed',
    circuit_opened_at = NULL,
    consecutive_failures = 0,
    half_open_successes = 0,
    updated_at = NOW()
    WHERE provider_id = $1`, [providerId]);
}
async function tryHalfOpen(providerId) {
  const env = require('../../config/env').loadEnv();
  const res = await query(
    `UPDATE api_metrics SET circuit_state = 'half_open', half_open_successes = 0, updated_at = NOW()
     WHERE provider_id = $1 AND circuit_state = 'open' AND circuit_opened_at IS NOT NULL
       AND circuit_opened_at < NOW() - ($2 || ' milliseconds')::interval RETURNING *`,
    [providerId, String(env.CIRCUIT_RECOVERY_TIMEOUT_MS)]);
  return res.rows[0] || null;
}
function successRate(row) {
  if (!row || !row.total_requests) return 0;
  return Number(row.successful_requests) / Number(row.total_requests);
}
function classifyHealth(row, env) {
  if (!row) return 'DOWN';
  if (row.circuit_state === 'open') return 'DOWN';
  const rate = successRate(row);
  if (row.total_requests < 3) return 'HEALTHY';
  if (rate >= env.HEALTHY_SUCCESS_RATE) return 'HEALTHY';
  if (rate >= env.DEGRADED_SUCCESS_RATE) return 'DEGRADED';
  return 'DOWN';
}
module.exports = { getMetrics, getAllMetrics, recordSuccess, recordFailure, setCircuitState, resetHealth, tryHalfOpen, successRate, classifyHealth };
