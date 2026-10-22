'use strict';
const { query } = require('../pool');
async function setChannel(guildId, channelId, enabled, createdBy) {
  const res = await query(
    `INSERT INTO autobypass_channels (guild_id, channel_id, enabled, created_by) VALUES ($1,$2,$3,$4)
     ON CONFLICT (guild_id, channel_id) DO UPDATE SET enabled = EXCLUDED.enabled RETURNING *`,
    [String(guildId), String(channelId), enabled, String(createdBy)]);
  return res.rows[0];
}
async function isChannelEnabled(guildId, channelId) {
  const res = await query(`SELECT enabled FROM autobypass_channels WHERE guild_id = $1 AND channel_id = $2`, [String(guildId), String(channelId)]);
  if (res.rowCount === 0) return false;
  return res.rows[0].enabled === true;
}
async function listChannels() {
  return (await query(`SELECT * FROM autobypass_channels ORDER BY created_at DESC`)).rows;
}
async function removeChannel(guildId, channelId) {
  await query(`DELETE FROM autobypass_channels WHERE guild_id = $1 AND channel_id = $2`, [String(guildId), String(channelId)]);
}
module.exports = { setChannel, isChannelEnabled, listChannels, removeChannel };
