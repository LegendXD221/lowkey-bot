'use strict';
const net = require('net');
const { InvalidUrlError } = require('../utils/errors');
const { normalizeUrl } = require('../utils/formatters');
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i, /^metadata\.google\.internal$/i
];
function ipv6ToBigInt(ip) {
  let value = ip.toLowerCase().split('%')[0];
  if (value.includes('.')) {
    const lastColon = value.lastIndexOf(':');
    const octets = value.slice(lastColon + 1).split('.').map(Number);
    if (octets.length !== 4 || octets.some(o => !Number.isInteger(o) || o < 0 || o > 255)) return null;
    value = `${value.slice(0, lastColon)}:${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  const sections = value.split('::');
  if (sections.length > 2) return null;
  const left = sections[0] ? sections[0].split(':') : [];
  const right = sections[1] ? sections[1].split(':') : [];
  const total = left.length + right.length;
  if (total > 8 || (sections.length === 1 && total !== 8)) return null;
  const words = [...left, ...Array(8 - total).fill('0'), ...right].map(part => Number.parseInt(part, 16));
  if (words.some(word => !Number.isInteger(word) || word < 0 || word > 0xffff)) return null;
  return words.reduce((acc, word) => (acc << 16n) | BigInt(word), 0n);
}
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    return parts[0] === 0 || parts[0] === 10 || parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) || (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) ||
      (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) ||
      (parts[0] === 198 && parts[1] >= 18 && parts[1] <= 19) ||
      (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) ||
      (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) || parts[0] >= 224;
  }
  if (!net.isIPv6(ip)) return true;
  const value = ipv6ToBigInt(ip);
  if (value == null) return true;
  const inCidr = (base, prefix) => {
    const mask = ((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix);
    return (value & mask) === (ipv6ToBigInt(base) & mask);
  };
  if (inCidr('::', 128) || inCidr('::1', 128) || inCidr('fc00::', 7) || inCidr('fe80::', 10) ||
      inCidr('ff00::', 8) || inCidr('2001:db8::', 32) || inCidr('2001:10::', 28) || inCidr('2001:2::', 48)) return true;
  if ((value >> 32n) === 0xffffn) {
    const v4 = [24n, 16n, 8n, 0n].map(shift => Number((value >> shift) & 255n)).join('.');
    return isPrivateIp(v4);
  }
  return false;
}
function isPrivateHost(hostname) {
  if (!hostname) return true;
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (net.isIPv4(host) || net.isIPv6(host)) return isPrivateIp(host);
  return PRIVATE_HOST_PATTERNS.some(re => re.test(host)) || host === '0.0.0.0';
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
module.exports = { validateUrl, isValidPublicUrl, isPrivateHost, isPrivateIp };
