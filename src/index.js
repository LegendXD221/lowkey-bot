'use strict';
const { loadEnv } = require('./config/env');
const { getLogger } = require('./utils/logger');
const { createClient } = require('./client');
const { migrate } = require('./database/migrate');
const { closePool } = require('./database/pool');
const { stopHealthMonitor } = require('./services/healthMonitor');
const { startHealthServer } = require('./healthServer');
async function main() {
  const env = loadEnv();
  const log = getLogger();
  log.info({ env: env.NODE_ENV }, 'Starting Lowkey');
  const health = startHealthServer();
  try {
    await migrate();
    const client = createClient();
    client.once('ready', () => health.setReady(true));
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
  await client.login(env.DISCORD_TOKEN);
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
