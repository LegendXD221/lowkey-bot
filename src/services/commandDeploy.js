'use strict';

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../config/env');
const { getLogger } = require('../utils/logger');

const log = getLogger();

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

  for (const gid of targets.filter(Boolean)) {
    try {
      const data = await rest.put(
        Routes.applicationGuildCommands(env.CLIENT_ID, gid),
        { body: commands }
      );
      log.info({ guildId: gid, count: data.length }, 'Guild commands deployed');
    } catch (err) {
      log.error({ err: err?.rawError || err.message, guildId: gid }, 'Guild command deploy failed');
    }
  }

  try {
    const data = await rest.put(
      Routes.applicationCommands(env.CLIENT_ID),
      { body: commands }
    );
    log.info({ count: data.length }, 'Global commands deployed');
    return { count: data.length };
  } catch (err) {
    log.error({ err: err?.rawError || err.message }, 'Global command deploy failed');
    throw err;
  }
}

module.exports = { deployCommands, loadCommandJson };
