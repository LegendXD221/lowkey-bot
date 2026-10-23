'use strict';
const { loadEnv } = require('./config/env');
const { getLogger } = require('./utils/logger');
const { createClient } = require('./client');
const { migrate } = require('./database/migrate');
const { closePool } = require('./database/pool');
const { stopHealthMonitor } = require('./services/healthMonitor');
const { startHealthServer } = require('./healthServer');

async function verifyDiscordToken(token, log) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch('https://discord.com/api/v10/gateway/bot', {
      headers: { Authorization: `Bot ${token}` },
      signal: controller.signal
    });
    if (response.status === 401) throw new Error('Discord rejected DISCORD_TOKEN (HTTP 401)');
    if (!response.ok) throw new Error(`Discord gateway preflight failed (HTTP ${response.status})`);
    log.info('Discord token preflight succeeded');
    return true;
  } catch (err) {
    if (err.message.includes('DISCORD_TOKEN') || err.message.includes('HTTP 401')) throw err;
    log.warn({ err: err.message }, 'Discord gateway preflight unavailable; continuing with gateway retry');
    return false;
  } finally {
    clearTimeout(timer);
  }
}

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
  await verifyDiscordToken(env.DISCORD_TOKEN, log);
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
