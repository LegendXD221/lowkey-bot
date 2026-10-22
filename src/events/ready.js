'use strict';

const { Events, ActivityType } = require('discord.js');
const { loadEmojisFromDb } = require('../services/emojiService');
const { startHealthMonitor } = require('../services/healthMonitor');
const { deployCommands } = require('../services/commandDeploy');
const { getLogger } = require('../utils/logger');

const log = getLogger();

const ACTIVITIES = [
  { name: 'links · /bypass', type: ActivityType.Watching },
  { name: '/help', type: ActivityType.Listening },
  { name: 'unlocked links', type: ActivityType.Watching },
  { name: 'failover · healthy', type: ActivityType.Playing }
];

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    log.info({ tag: client.user.tag, guilds: client.guilds.cache.size }, 'Lowkey online');

    let i = 0;
    const apply = () => {
      const a = ACTIVITIES[i % ACTIVITIES.length];
      client.user.setPresence({ activities: [a], status: 'online' });
      i++;
    };
    apply();
    setInterval(apply, 5 * 60 * 1000).unref?.();

    // Register slash commands on every boot so they appear without a separate deploy step
    try {
      const guildIds = [...client.guilds.cache.keys()];
      const result = await deployCommands({ guildIds });
      if (result.failedGuildIds?.length) log.warn({ failedGuildIds: result.failedGuildIds }, 'Slash commands partially registered');
      else log.info({ guilds: guildIds.length }, 'Slash commands registered');
    } catch (err) {
      log.error({ err: err?.message || err }, 'Command registration failed — check CLIENT_ID and token');
    }

    try {
      await loadEmojisFromDb();
      startHealthMonitor();
      client.healthServer?.setReady(true);
      log.info('Discord gateway connection established and Lowkey is ready');
    } catch (err) {
      client.healthServer?.setReady(false);
      log.error({ err }, 'Lowkey startup initialization failed');
    }
  }
};
