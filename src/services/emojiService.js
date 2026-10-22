'use strict';

const fs = require('fs');
const path = require('path');
const { query } = require('../database/pool');
const { setCustomEmojis } = require('../utils/embeds');
const { getLogger } = require('../utils/logger');

const log = getLogger();

const DEFAULT_KEYS = [
  { key: 'success', file: 'success.png', name: 'lowkey_success' },
  { key: 'error', file: 'error.png', name: 'lowkey_error' },
  { key: 'warning', file: 'warning.png', name: 'lowkey_warning' },
  { key: 'info', file: 'info.png', name: 'lowkey_info' },
  { key: 'unlock', file: 'unlock.png', name: 'lowkey_unlock' },
  { key: 'link', file: 'link.png', name: 'lowkey_link' },
  { key: 'health', file: 'health.png', name: 'lowkey_health' },
  { key: 'degraded', file: 'degraded.png', name: 'lowkey_degraded' },
  { key: 'down', file: 'down.png', name: 'lowkey_down' },
  { key: 'disabled', file: 'disabled.png', name: 'lowkey_disabled' },
  { key: 'gear', file: 'gear.png', name: 'lowkey_gear' },
  { key: 'chart', file: 'chart.png', name: 'lowkey_chart' }
];

async function loadEmojisFromDb() {
  try {
    const res = await query('SELECT emoji_key, emoji_id, name FROM custom_emojis');
    const map = {};
    for (const row of res.rows) {
      map[row.emoji_key] = `<:${row.name}:${row.emoji_id}>`;
    }
    setCustomEmojis(map);
    log.info({ count: Object.keys(map).length }, 'Custom emojis loaded');
    return map;
  } catch (err) {
    log.warn({ err }, 'Could not load custom emojis');
    return {};
  }
}

async function setupEmojis(guild) {
  const assetsDir = path.join(__dirname, '../../assets/emojis');
  const results = [];

  if (!fs.existsSync(assetsDir)) {
    return { ok: false, message: 'No emoji assets found in assets/emojis', results };
  }

  // Discord: Manage Emojis permission required; 50 emoji slots on free guilds
  const me = guild.members.me;
  if (me && !me.permissions.has('ManageGuildExpressions') && !me.permissions.has('ManageEmojisAndStickers')) {
    return {
      ok: false,
      message: 'Bot needs **Manage Expressions** (or Manage Emojis) permission in this server.',
      results
    };
  }

  const existing = await guild.emojis.fetch();
  let available = Math.max(0, (guild.premiumTier >= 3 ? 500 : guild.premiumTier >= 2 ? 150 : guild.premiumTier >= 1 ? 100 : 50) - existing.size);

  for (const def of DEFAULT_KEYS) {
    const filePath = path.join(assetsDir, def.file);
    if (!fs.existsSync(filePath)) {
      results.push({ key: def.key, status: 'missing_asset' });
      continue;
    }

    const found = existing.find(e => e.name === def.name);
    if (found) {
      await query(
        `INSERT INTO custom_emojis (emoji_key, emoji_id, guild_id, name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (emoji_key) DO UPDATE SET emoji_id = $2, guild_id = $3, name = $4`,
        [def.key, found.id, guild.id, def.name]
      );
      results.push({ key: def.key, status: 'exists', id: found.id });
      continue;
    }

    if (available <= 0) {
      results.push({ key: def.key, status: 'no_slots' });
      continue;
    }

    try {
      const emoji = await guild.emojis.create({ attachment: filePath, name: def.name });
      available--;
      await query(
        `INSERT INTO custom_emojis (emoji_key, emoji_id, guild_id, name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (emoji_key) DO UPDATE SET emoji_id = $2, guild_id = $3, name = $4`,
        [def.key, emoji.id, guild.id, def.name]
      );
      results.push({ key: def.key, status: 'created', id: emoji.id });
    } catch (err) {
      results.push({ key: def.key, status: 'failed', error: err.message });
    }
  }

  await loadEmojisFromDb();
  return { ok: true, results };
}

async function getEmojiStatus() {
  const res = await query('SELECT emoji_key, emoji_id, guild_id, name FROM custom_emojis ORDER BY emoji_key');
  return res.rows;
}

module.exports = { loadEmojisFromDb, setupEmojis, getEmojiStatus, DEFAULT_KEYS };
