'use strict';
const dns = require('node:dns');
const { loadEnv } = require('./config/env');
const { getLogger } = require('./utils/logger');
const { createClient } = require('./client');
const { migrate } = require('./database/migrate');
const { closePool } = require('./database/pool');
const { stopHealthMonitor } = require('./services/healthMonitor');
const { startHealthServer } = require('./healthServer');

// Some cloud runtimes advertise IPv6 DNS answers without a usable IPv6 route.
// Discord Gateway then appears to hang before the WebSocket handshake completes.
// Prefer IPv4 while retaining normal DNS fallback behavior.
if (typeof dns.setDefaultResultOrder === 'function') dns.setDefaultResultOrder('ipv4first');

async function main() {
  const env = loadEnv();
  const log = getLogger();
  log.info({ env: env.NODE_ENV }, 'Starting Lowkey');
  const health = startHealthServer();
  try {
    await migrate();
    const client = createClient();
    client.healthServer = health;
    let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, 'Shutting down');
    health.stop();
    stopHealthMonitor();
    try { client.destroy(); } catch (err) { log.warn({ err }, 'Client shutdown failed'); }
    try { await closePool(); } catch (err) { log.error({ err }, 'Database shutdown failed'); }
    process.exitCode = 0;
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => log.error({ err }, 'Unhandled rejection'));
  client.on('shardDisconnect', () => health.setReady(false));
  log.info('Connecting to Discord gateway');
  let connected = false;
  for (let attempt = 1; !connected; attempt++) {
    let loginTimer;
    try {
      await Promise.race([
        client.login(env.DISCORD_TOKEN),
        new Promise((_, reject) => {
          loginTimer = setTimeout(() => reject(new Error('Discord gateway login timed out after 45 seconds')), 45_000);
        })
      ]);
      connected = true;
      log.info({ attempt }, 'Discord gateway login accepted; waiting for ready event');
    } catch (err) {
      log.warn({ attempt, err: err?.message || String(err) }, 'Discord gateway login attempt failed');
      try { client.destroy(); } catch (destroyErr) { log.warn({ err: destroyErr }, 'Discord client reset failed'); }
      const delayMs = Math.min(60_000, attempt * 5_000);
      log.info({ retryInMs: delayMs }, 'Will retry Discord gateway login');
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } finally {
      if (loginTimer) clearTimeout(loginTimer);
    }
  }
  } catch (err) {
    health.stop();
    throw err;
  }
}
main().catch(async (err) => {
  console.error('Fatal startup error', err);
  try { await closePool(); } catch (closeErr) { console.error('Database shutdown error', closeErr); }
  process.exitCode = 1;
});
