'use strict';
const dns = require('dns').promises;
const net = require('net');
const { isPrivateHost } = require('./urlValidator');
const { loadEnv } = require('../config/env');

function isPrivateIp(ip) {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return true;
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] >= 224) return true; // multicast and reserved space
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) return true;
    if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7));
    return false;
  }
  return true;
}
async function resolveAndCheck(hostname) {
  if (isPrivateHost(hostname)) throw new Error('Blocked: private or metadata host');
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  for (const a of addresses) {
    if (isPrivateIp(a.address)) throw new Error(`Blocked: resolved to private address ${a.address}`);
  }
  return addresses;
}
async function assertSafeUrl(urlString) {
  let parsed;
  try { parsed = new URL(urlString); } catch { throw new Error('Invalid URL'); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Only HTTP/HTTPS allowed');
  await resolveAndCheck(parsed.hostname);
  return true;
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
module.exports = { resolveAndCheck, isPrivateIp, assertSafeUrl, createSafeAxiosConfig };
