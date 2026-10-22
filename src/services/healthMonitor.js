'use strict';

const metricsRepo = require('../database/repositories/metrics');
const providersRepo = require('../database/repositories/providers');
const { checkConnectivity } = require('../database/pool');
const settingsRepo = require('../database/repositories/settings');
const { loadEnv } = require('../config/env');
const { getLogger } = require('../utils/logger');
const storageCleanup = require('./storageCleanup');

const log = getLogger();
let intervalHandle = null;
let cleanupHandle = null;
let initialCleanupHandle = null;
let healthTickRunning = false;
let cleanupRunning = false;

async function collectStatus() {
  const env = loadEnv();
  const providers = await providersRepo.listProviders();
  const metrics = await metricsRepo.getAllMetrics();
  const metricsMap = new Map(metrics.map(m => [m.provider_id, m]));
  const settings = await settingsRepo.getSettings();
  const dbOk = await checkConnectivity();
  let healthy = 0, degraded = 0, down = 0, disabled = 0, latencySum = 0, latencyCount = 0;
  const detail = [];
  for (const p of providers) {
    if (!p.enabled) {
      disabled++;
      detail.push({ name: p.name, state: 'DISABLED', successRate: 0, avgLatency: null });
      continue;
    }
    const m = metricsMap.get(p.id);
    const state = metricsRepo.classifyHealth(m, env);
    if (state === 'HEALTHY') healthy++;
    else if (state === 'DEGRADED') degraded++;
    else down++;
    const rate = metricsRepo.successRate(m);
    const avg = m?.average_latency_ms ?? null;
    if (avg != null) { latencySum += avg; latencyCount++; }
    detail.push({
      name: p.name,
      state,
      successRate: rate,
      avgLatency: avg,
      circuit: m?.circuit_state || 'closed',
      total: m?.total_requests || 0
    });
  }
  return {
    total: providers.length,
    enabled: providers.filter(p => p.enabled).length,
    healthy, degraded, down, disabled,
    avgLatency: latencyCount ? latencySum / latencyCount : null,
    dbOk,
    maintenance: settings.maintenance_enabled,
    providers: detail
  };
}

function startHealthMonitor() {
  const env = loadEnv();
  if (intervalHandle) return;

  intervalHandle = setInterval(async () => {
    if (healthTickRunning) return;
    healthTickRunning = true;
    try {
      await require('./cacheService').purgeExpired();
      const metrics = await metricsRepo.getAllMetrics();
      for (const m of metrics) {
        if (m.circuit_state === 'open') await metricsRepo.tryHalfOpen(m.provider_id);
      }
    } catch (err) {
      log.error({ err }, 'Health monitor tick failed');
    } finally {
      healthTickRunning = false;
    }
  }, env.HEALTH_CHECK_INTERVAL_SECONDS * 1000);
  if (intervalHandle.unref) intervalHandle.unref();

  const cleanupEvery = (env.STORAGE_CLEANUP_INTERVAL_SECONDS || 300) * 1000;
  cleanupHandle = setInterval(async () => {
    if (cleanupRunning) return;
    cleanupRunning = true;
    try {
      await storageCleanup.runCleanup();
    } catch (err) {
      log.error({ err }, 'Storage cleanup failed');
    } finally {
      cleanupRunning = false;
    }
  }, cleanupEvery);
  if (cleanupHandle.unref) cleanupHandle.unref();

  // run once shortly after boot
  initialCleanupHandle = setTimeout(() => storageCleanup.runCleanup().catch((err) => {
    log.warn({ err: err?.message || err }, 'Initial storage cleanup failed');
  }), 15000);
  if (initialCleanupHandle.unref) initialCleanupHandle.unref();

  log.info('Health monitor + storage cleanup started');
}

function stopHealthMonitor() {
  if (intervalHandle) { clearInterval(intervalHandle); intervalHandle = null; }
  if (cleanupHandle) { clearInterval(cleanupHandle); cleanupHandle = null; }
  if (initialCleanupHandle) { clearTimeout(initialCleanupHandle); initialCleanupHandle = null; }
}

module.exports = { collectStatus, startHealthMonitor, stopHealthMonitor };
