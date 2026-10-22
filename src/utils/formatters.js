'use strict';
const crypto = require('crypto');
function normalizeUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    parsed.username = ''; parsed.password = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) parsed.port = '';
    return parsed.toString();
  } catch { return null; }
}
function hashUrl(url) { return crypto.createHash('sha256').update(url).digest('hex'); }
function extractUrls(text) {
  if (!text || typeof text !== 'string') return [];
  const re = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const matches = text.match(re) || [];
  const seen = new Set(); const out = [];
  for (const m of matches) {
    const cleaned = m.replace(/[.,;:!?)]+$/, '');
    const norm = normalizeUrl(cleaned);
    if (norm && !seen.has(norm)) { seen.add(norm); out.push(norm); }
  }
  return out;
}
function formatLatency(ms) {
  if (ms == null || Number.isNaN(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
function formatPercent(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}
function truncate(str, max = 100) {
  if (!str) return '';
  const s = String(str);
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}
function safeJsonParse(str, fallback = null) {
  if (str == null) return fallback;
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch { return fallback; }
}
function deepGet(obj, path) {
  if (!path || !obj) return undefined;
  const parts = String(path).split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) { if (cur == null) return undefined; cur = cur[p]; }
  return cur;
}
module.exports = { normalizeUrl, hashUrl, extractUrls, formatLatency, formatPercent, truncate, safeJsonParse, deepGet };
