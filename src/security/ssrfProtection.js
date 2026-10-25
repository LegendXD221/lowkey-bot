'use strict';
const dns = require('dns').promises;
const { isPrivateHost, isPrivateIp } = require('./urlValidator');
const { loadEnv } = require('../config/env');

async function resolveAndCheck(hostname) {
  if (isPrivateHost(hostname)) throw new Error('Blocked: private or metadata host');
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (err) {
    const wrapped = new Error(`DNS lookup failed for ${hostname}`);
    wrapped.code = err.code;
    throw wrapped;
  }
  if (!addresses.length) throw new Error(`DNS lookup returned no addresses for ${hostname}`);
  for (const address of addresses) {
    if (isPrivateIp(address.address)) throw new Error(`Blocked: resolved to private address ${address.address}`);
  }
  return addresses;
}

async function assertSafeUrl(urlString) {
  let parsed;
  try { parsed = new URL(urlString); } catch { throw new Error('Invalid URL'); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Only HTTP/HTTPS allowed');
  return resolveAndCheck(parsed.hostname);
}

function createPinnedLookup(addresses) {
  return (hostname, options, callback) => {
    const family = options?.family || 0;
    const matching = addresses.filter(address => !family || address.family === family);
    const selected = matching[0] || addresses[0];
    if (!selected) return callback(new Error(`No validated address for ${hostname}`));
    if (options?.all) return callback(null, matching.length ? matching : [selected]);
    return callback(null, selected.address, selected.family);
  };
}

function createSafeAxiosConfig(baseConfig = {}) {
  const env = loadEnv();
  return {
    ...baseConfig,
    maxRedirects: env.MAX_REDIRECTS,
    maxContentLength: env.MAX_RESPONSE_SIZE_BYTES,
    maxBodyLength: env.MAX_RESPONSE_SIZE_BYTES,
    timeout: baseConfig.timeout || env.DEFAULT_TIMEOUT_MS,
    validateStatus: () => true
  };
}
module.exports = { resolveAndCheck, isPrivateIp, assertSafeUrl, createPinnedLookup, createSafeAxiosConfig };
