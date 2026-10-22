'use strict';
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getLogger } = require('./utils/logger');
const log = getLogger();
function createClient() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel]
  });
  client.commands = new Collection();
  for (const sub of ['user', 'owner']) {
    const dir = path.join(__dirname, 'commands', sub);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
      const cmd = require(path.join(dir, file));
      if (cmd.data && cmd.execute) client.commands.set(cmd.data.name, cmd);
    }
  }
  const eventsDir = path.join(__dirname, 'events');
  for (const file of fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'))) {
    const event = require(path.join(eventsDir, file));
    if (event.once) client.once(event.name, (...args) => event.execute(...args));
    else client.on(event.name, (...args) => event.execute(...args));
  }
  log.info({ commands: client.commands.size }, 'Client configured');
  return client;
}
module.exports = { createClient };
