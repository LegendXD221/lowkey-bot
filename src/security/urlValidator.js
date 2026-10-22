'use strict';
const net = require('net');
const { InvalidUrlError } = require('../utils/errors');
const { normalizeUrl } = require('../utils/formatters');
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i, /^127\.\d+\.\d+\.\d+$/, /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/, /^192\.168\.\d+\.\d+$/, /^0\.0\.0\.0$/,
  /^\[::1\]$/, /^169\.254\.\d+\.\d+$/, /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\.\d+\.\d+$/,
  /^metadata\.google\.internal$/i, /^169\.254\.169\.254$/
];
function isPrivateHost(hostname) {
  if (!hostname) return true;
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (net.isIPv4(host)) {
    const parts = host.split('.').map(Number);
    if (parts[0] === 0 || parts[0] === 10 || parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && (parts[1] === 168 || (parts[1] === 0 && parts[2] === 0))) return true;
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] >= 224) return true;
  }
  if (net.isIPv6(host)) {
    if (host === '::' || host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true;
    const mapped = host.match(/^(?:::ffff:|0:0:0:0:0:ffff:)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (mapped) {
      const first = Number.parseInt(mapped[1], 16);
      const second = Number.parseInt(mapped[2], 16);
      return isPrivateHost(`${first >>> 8}.${first & 255}.${second >>> 8}.${second & 255}`);
    }
  }
  return PRIVATE_HOST_PATTERNS.some(re => re.test(host));
}
function validateUrl(raw) {
  if (!raw || typeof raw !== 'string') throw new InvalidUrlError();
  const trimmed = raw.trim();
  if (trimmed.length > 2048) throw new InvalidUrlError();
  if (/^https?:\/\/[^/]*@/i.test(trimmed)) throw new InvalidUrlError();
  let parsed;
  try { parsed = new URL(trimmed); } catch { throw new InvalidUrlError(); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new InvalidUrlError();
  if (isPrivateHost(parsed.hostname)) throw new InvalidUrlError();
  const normalized = normalizeUrl(trimmed);
  if (!normalized) throw new InvalidUrlError();
  return { url: normalized, parsed };
}
function isValidPublicUrl(raw) { try { validateUrl(raw); return true; } catch { return false; } }
module.exports = { validateUrl, isValidPublicUrl, isPrivateHost };
