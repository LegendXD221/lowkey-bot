'use strict';

require('dotenv').config();
const { deployCommands, loadCommandJson } = require('./services/commandDeploy');
const { loadEnv } = require('./config/env');

async function main() {
  loadEnv();
  const commands = loadCommandJson();
  console.log(`Loaded ${commands.length} commands:`);
  for (const c of commands) console.log(`  /${c.name}`);

  const guildId = process.argv[2] || process.env.GUILD_ID || '';
  const guildIds = guildId ? [guildId] : [];
  const result = await deployCommands({ guildIds });
  console.log(`Deploy finished (${result.count} global).`);
  if (!guildId) {
    console.log('Tip: for instant appear in one server: node src/deploy-commands.js YOUR_GUILD_ID');
  }
}

main().catch((err) => {
  console.error('Deploy failed:', err?.rawError || err);
  process.exit(1);
});
