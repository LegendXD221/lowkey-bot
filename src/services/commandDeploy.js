'use strict';

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../config/env');
const { getLogger } = require('../utils/logger');

const log = getLogger();

function withTimeout(promise, label, ms = 15000) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms); })
  ]).finally(() => clearTimeout(timer));
}

async function putWithRetry(rest, route, body, label) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await withTimeout(rest.put(route, { body }), label, 60000);
    } catch (err) {
      const retryAfter = Number(err?.rawError?.retry_after || err?.data?.retry_after || 0);
      if (attempt === 3 || retryAfter <= 0) throw err;
      const delay = Math.min(60000, Math.max(1000, Math.ceil(retryAfter * 1000)));
      log.warn({ attempt, retryAfterMs: delay, label }, 'Discord command deployment rate limited; retrying');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function loadCommandJson() {
  const commands = [];
  for (const sub of ['user', 'owner']) {
    const dir = path.join(__dirname, '../commands', sub);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
      // clear require cache so reloads pick up changes
      const full = path.join(dir, file);
      delete require.cache[require.resolve(full)];
      const cmd = require(full);
      if (cmd.data) commands.push(cmd.data.toJSON());
    }
  }
  return commands;
}

/**
 * Register slash commands with Discord.
 * - If GUILD_ID is set → guild deploy (instant)
 * - Always also deploys global (may lag up to ~1h)
 */
async function deployCommands({ guildIds = [] } = {}) {
  const env = loadEnv();
  const commands = loadCommandJson();
  if (!commands.length) {
    log.warn('No slash commands found to deploy');
    return { count: 0 };
  }

  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const targets = [...guildIds];
  if (env.GUILD_ID && !targets.includes(env.GUILD_ID)) targets.push(env.GUILD_ID);
  const failedGuildIds = [];

  const guildTargets = [...new Set(targets.filter(Boolean))];
  log.info({ guildIds: guildTargets, count: commands.length }, 'Deploying guild commands');
  for (const gid of guildTargets) {
    try {
      const data = await putWithRetry(rest, Routes.applicationGuildCommands(env.CLIENT_ID, gid), commands, `Guild command deploy ${gid}`);
      log.info({ guildId: gid, count: data.length }, 'Guild commands deployed');
    } catch (err) {
      failedGuildIds.push(gid);
      log.error({ err: err?.rawError || err.message, guildId: gid }, 'Guild command deploy failed');
    }
  }

  // Guild commands are immediate and are sufficient for installed servers. Global
  // overwrites are slow and heavily rate-limited; opt in when a global refresh is needed.
  if (process.env.SYNC_GLOBAL_COMMANDS !== 'true') {
    log.info('Global command deployment skipped; set SYNC_GLOBAL_COMMANDS=true for a global refresh');
    return { count: commands.length, failedGuildIds };
  }

  try {
    log.info({ count: commands.length }, 'Deploying global commands');
    const data = await putWithRetry(rest, Routes.applicationCommands(env.CLIENT_ID), commands, 'Global command deploy');
    log.info({ count: data.length }, 'Global commands deployed');
    return { count: data.length, failedGuildIds };
  } catch (err) {
    log.error({ err: err?.rawError || err.message }, 'Global command deploy failed');
    throw err;
  }
}

module.exports = { deployCommands, loadCommandJson };
