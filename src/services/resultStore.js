'use strict';

/** Short-lived in-memory store so copy buttons work without exposing a raw URL field. */
const store = new Map(); // messageId -> { url, expires }
const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 5000;
const pruneHandle = setInterval(prune, 5 * 60 * 1000);
if (pruneHandle.unref) pruneHandle.unref();

function prune() {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expires < now) store.delete(k);
  }
  if (store.size > MAX_ENTRIES) {
    const sorted = [...store.entries()].sort((a, b) => a[1].expires - b[1].expires);
    for (let i = 0; i < sorted.length - MAX_ENTRIES; i++) store.delete(sorted[i][0]);
  }
}

function set(messageId, url) {
  if (!messageId || !url) return;
  store.set(String(messageId), { url: String(url), expires: Date.now() + TTL_MS });
  if (store.size % 50 === 0) prune();
}

function get(messageId) {
  const e = store.get(String(messageId));
  if (!e) return null;
  if (e.expires < Date.now()) {
    store.delete(String(messageId));
    return null;
  }
  return e.url;
}

function clear() {
  store.clear();
}

module.exports = { set, get, clear };
