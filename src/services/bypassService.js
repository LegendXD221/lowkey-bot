'use strict';

const { selectProviders } = require('./apiRouter');
const { executeRequest } = require('./requestEngine');
const circuitBreaker = require('./circuitBreaker');
const cacheRepo = require('../database/repositories/cache');
const settingsRepo = require('../database/repositories/settings');
const { withLimit } = require('./concurrency');
const { validateUrl } = require('../security/urlValidator');
const { detectService } = require('../utils/serviceDetect');
const {
  UnsupportedUrlError,
  BypassUnavailableError,
  MaintenanceError
} = require('../utils/errors');
const { getLogger } = require('../utils/logger');

const log = getLogger();

async function bypass(rawUrl, { skipCache = false } = {}) {
  const settings = await settingsRepo.getSettings();
  if (settings.maintenance_enabled) {
    throw new MaintenanceError(settings.maintenance_message);
  }

  const { url } = validateUrl(rawUrl);
  const service = detectService(url);
  const providers = await selectProviders(url);

  if (!providers.length) {
    const all = await require('../database/repositories/providers').listProviders({ enabledOnly: true });
    if (!all.length) throw new UnsupportedUrlError();
    // all filtered out by patterns or circuits
    const anyPatterns = all.some(p => p.url_patterns && p.url_patterns.length);
    if (anyPatterns) throw new UnsupportedUrlError();
    throw new BypassUnavailableError();
  }

  if (!skipCache) {
    for (const p of providers.slice(0, 3)) {
      const cached = await cacheRepo.getCached(url, p.id);
      if (cached && cached.result) {
        log.info({ provider: p.name, cache: true, service }, 'Cache hit');
        return {
          originalUrl: url,
          resultUrl: cached.result,
          providerName: p.name,
          providerId: p.id,
          latencyMs: 0,
          fromCache: true,
          service
        };
      }
    }
  }

  const errors = [];

  for (const provider of providers) {
    let outcome;
    try {
      outcome = await withLimit(provider.id, 3, () => executeRequest(provider, url));
    } catch (err) {
      try { await circuitBreaker.onFailure(provider.id, err.latency ?? null); } catch (metricsErr) { log.error({ err: metricsErr, provider: provider.name }, 'Provider failure metric failed'); }
      errors.push({
        provider: provider.name,
        category: err.category || err.code || 'UNKNOWN',
        message: err.message
      });
      log.warn({
        provider: provider.name,
        category: err.category || err.code,
        message: err.message,
        service
      }, 'Provider failed, trying next');
      continue;
    }

    try { await circuitBreaker.onSuccess(provider.id, outcome.latency); }
    catch (err) { log.error({ err, provider: provider.name }, 'Provider success metric failed'); }
    try { await cacheRepo.setCached(url, provider.id, { result: outcome.result }); }
    catch (err) { log.warn({ err, provider: provider.name }, 'Result cache write failed'); }
    return {
      originalUrl: url,
      resultUrl: outcome.result,
      providerName: outcome.providerName,
      providerId: outcome.providerId,
      latencyMs: outcome.latency,
      httpStatus: outcome.httpStatus,
      fromCache: false,
      service
    };
  }

  if (!errors.length) throw new UnsupportedUrlError();
  throw new BypassUnavailableError();
}

module.exports = { bypass };
