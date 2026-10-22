'use strict';

const providersRepo = require('../database/repositories/providers');
const metricsRepo = require('../database/repositories/metrics');
const circuitBreaker = require('./circuitBreaker');
const { hostMatchesPatterns } = require('../utils/serviceDetect');
const { loadEnv } = require('../config/env');
const { getLogger } = require('../utils/logger');

const log = getLogger();

async function selectProviders(targetUrl) {
  const env = loadEnv();
  const providers = await providersRepo.listProviders({ enabledOnly: true });
  if (!providers.length) return [];

  const ranked = [];
  for (const p of providers) {
    if (!hostMatchesPatterns(targetUrl, p.url_patterns)) {
      log.debug({ provider: p.name }, 'Skipped — domain pattern mismatch');
      continue;
    }
    if (!(await circuitBreaker.canRequest(p.id))) {
      log.debug({ provider: p.name }, 'Skipped — circuit open');
      continue;
    }
    const m = await metricsRepo.getMetrics(p.id);
    ranked.push({
      provider: p,
      metrics: m,
      successRate: metricsRepo.successRate(m),
      health: metricsRepo.classifyHealth(m, env),
      avgLatency: m?.average_latency_ms ?? 99999,
      priority: p.priority,
      hasPatterns: Array.isArray(p.url_patterns) && p.url_patterns.length > 0
    });
  }

  // Prefer providers with explicit domain patterns (more specific), then health, priority, latency
  const order = { HEALTHY: 0, DEGRADED: 1, DOWN: 2 };
  ranked.sort((a, b) => {
    if (a.hasPatterns !== b.hasPatterns) return a.hasPatterns ? -1 : 1;
    const ha = order[a.health] ?? 3;
    const hb = order[b.health] ?? 3;
    if (ha !== hb) return ha - hb;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.avgLatency - b.avgLatency;
  });

  return ranked.map(r => r.provider);
}

module.exports = { selectProviders };
