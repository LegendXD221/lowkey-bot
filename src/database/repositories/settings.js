'use strict';
const { query } = require('../pool');
async function getSettings() {
  const res = await query('SELECT * FROM bot_settings WHERE id = 1');
  return res.rows[0] || { maintenance_enabled: false, maintenance_message: 'The bot is currently under maintenance. Please try again later.', autobypass_enabled: true, default_timeout_ms: 10000 };
}
async function setMaintenance(enabled, message) {
  const res = await query(`UPDATE bot_settings SET maintenance_enabled = $1, maintenance_message = COALESCE($2, maintenance_message), updated_at = NOW() WHERE id = 1 RETURNING *`, [enabled, message || null]);
  return res.rows[0];
}
async function setAutobypassGlobal(enabled) {
  const res = await query(`UPDATE bot_settings SET autobypass_enabled = $1, updated_at = NOW() WHERE id = 1 RETURNING *`, [enabled]);
  return res.rows[0];
}
module.exports = { getSettings, setMaintenance, setAutobypassGlobal };
