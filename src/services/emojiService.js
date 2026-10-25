'use strict';
const fs = require('fs');
const path = require('path');
const { query } = require('../database/pool');
const { setCustomEmojis } = require('../utils/embeds');
const { getLogger } = require('../utils/logger');
const log = getLogger();
const DEFAULT_KEYS = [
  { key: 'success', file: 'success.gif', name: 'lowkey_success', animated: true },
  { key: 'error', file: 'error.gif', name: 'lowkey_error', animated: true },
  { key: 'warning', file: 'warning.gif', name: 'lowkey_warning', animated: true },
  { key: 'info', file: 'info.gif', name: 'lowkey_info', animated: true },
  { key: 'unlock', file: 'unlock.gif', name: 'lowkey_unlock', animated: true },
  { key: 'link', file: 'link.gif', name: 'lowkey_link', animated: true },
  { key: 'health', file: 'health.gif', name: 'lowkey_health', animated: true },
  { key: 'degraded', file: 'degraded.gif', name: 'lowkey_degraded', animated: true },
  { key: 'down', file: 'down.gif', name: 'lowkey_down', animated: true },
  { key: 'disabled', file: 'disabled.gif', name: 'lowkey_disabled', animated: true },
  { key: 'gear', file: 'gear.gif', name: 'lowkey_gear', animated: true },
  { key: 'chart', file: 'chart.gif', name: 'lowkey_chart', animated: true }
];
async function loadEmojisFromDb() {
  try {
    const res = await query('SELECT emoji_key, emoji_id, name, animated FROM custom_emojis');
    const map = {};
    for (const row of res.rows) map[row.emoji_key] = `<${row.animated ? 'a' : ''}:${row.name}:${row.emoji_id}>`;
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
  if (!fs.existsSync(assetsDir)) return { ok: false, message: 'No emoji assets found in assets/emojis', results };
  const me = guild.members.me;
  if (me && !me.permissions.has('ManageGuildExpressions') && !me.permissions.has('ManageEmojisAndStickers')) {
    return { ok: false, message: 'Bot needs **Manage Expressions** (or Manage Emojis) permission in this server.', results };
  }
  const existing = await guild.emojis.fetch();
  let available = Math.max(0, (guild.premiumTier >= 3 ? 500 : guild.premiumTier >= 2 ? 150 : guild.premiumTier >= 1 ? 100 : 50) - existing.size);
  for (const def of DEFAULT_KEYS) {
    const filePath = path.join(assetsDir, def.file);
    if (!fs.existsSync(filePath)) { results.push({ key: def.key, status: 'missing_asset' }); continue; }
    let found = existing.find(e => e.name === def.name);
    if (found && Boolean(found.animated) !== Boolean(def.animated)) {
      try {
        await found.delete('Replacing static Lowkey emoji with animated version');
        existing.delete(found.id);
        available++;
        await query('DELETE FROM custom_emojis WHERE emoji_key = $1', [def.key]);
        found = null;
      } catch (err) {
        await query('DELETE FROM custom_emojis WHERE emoji_key = $1', [def.key]).catch(() => {});
        results.push({ key: def.key, status: 'failed', error: `Could not replace old emoji: ${err.message}` });
        continue;
      }
    }
    if (found) {
      await query(`INSERT INTO custom_emojis (emoji_key, emoji_id, guild_id, name, animated)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (emoji_key) DO UPDATE SET emoji_id = $2, guild_id = $3, name = $4, animated = $5`,
      [def.key, found.id, guild.id, def.name, Boolean(found.animated)]);
      results.push({ key: def.key, status: 'exists', id: found.id, animated: Boolean(found.animated) });
      continue;
    }
    if (available <= 0) { results.push({ key: def.key, status: 'no_slots' }); continue; }
    try {
      const emoji = await guild.emojis.create({ attachment: filePath, name: def.name });
      available--;
      await query(`INSERT INTO custom_emojis (emoji_key, emoji_id, guild_id, name, animated)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (emoji_key) DO UPDATE SET emoji_id = $2, guild_id = $3, name = $4, animated = $5`,
      [def.key, emoji.id, guild.id, def.name, Boolean(emoji.animated)]);
      results.push({ key: def.key, status: 'created', id: emoji.id, animated: Boolean(emoji.animated) });
    } catch (err) {
      results.push({ key: def.key, status: 'failed', error: err.message });
    }
  }
  await loadEmojisFromDb();
  return { ok: true, results };
}
async function getEmojiStatus() {
  const res = await query('SELECT emoji_key, emoji_id, guild_id, name, animated FROM custom_emojis ORDER BY emoji_key');
  return res.rows;
}
module.exports = { loadEmojisFromDb, setupEmojis, getEmojiStatus, DEFAULT_KEYS };
