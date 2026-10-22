'use strict';
const metricsRepo = require('../database/repositories/metrics');
const { loadEnv } = require('../config/env');
const { getLogger } = require('../utils/logger');
const log = getLogger();
async function canRequest(providerId) {
  const m = await metricsRepo.getMetrics(providerId);
  if (!m) return true;
  if (m.circuit_state === 'closed') return true;
  if (m.circuit_state === 'half_open') {
    return (m.half_open_successes || 0) < loadEnv().CIRCUIT_HALF_OPEN_MAX;
  }
  const recovered = await metricsRepo.tryHalfOpen(providerId);
  if (recovered) { log.info({ providerId }, 'Circuit half-open'); return true; }
  return false;
}
async function onSuccess(providerId, latencyMs) { await metricsRepo.recordSuccess(providerId, latencyMs); }
async function onFailure(providerId, latencyMs) { await metricsRepo.recordFailure(providerId, latencyMs); }
module.exports = { canRequest, onSuccess, onFailure };
