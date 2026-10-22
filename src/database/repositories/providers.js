'use strict';
const { query } = require('../pool');
const { safeJsonParse } = require('../../utils/formatters');
function mapProvider(row) {
  if (!row) return null;
  let patterns = row.url_patterns;
  if (typeof patterns === 'string') patterns = safeJsonParse(patterns, []);
  if (!Array.isArray(patterns)) patterns = [];
  return {
    id: row.id, name: row.name, endpoint: row.endpoint, http_method: row.http_method,
    url_parameter: row.url_parameter, request_body_template: row.request_body_template,
    custom_headers: typeof row.custom_headers === 'string' ? safeJsonParse(row.custom_headers, {}) : (row.custom_headers || {}),
    authentication_type: row.authentication_type, secret_env_key: row.secret_env_key,
    response_format: row.response_format, response_path: row.response_path, encoding_type: row.encoding_type,
    enabled: row.enabled, priority: row.priority, timeout_ms: row.timeout_ms,
    url_patterns: patterns,
    created_at: row.created_at, updated_at: row.updated_at
  };
}
async function listProviders({ enabledOnly = false } = {}) {
  const sql = enabledOnly
    ? 'SELECT * FROM api_providers WHERE enabled = TRUE ORDER BY priority ASC, id ASC'
    : 'SELECT * FROM api_providers ORDER BY priority ASC, id ASC';
  return (await query(sql)).rows.map(mapProvider);
}
async function getProviderById(id) {
  const res = await query('SELECT * FROM api_providers WHERE id = $1', [id]);
  return res.rows[0] ? mapProvider(res.rows[0]) : null;
}
async function getProviderByName(name) {
  const res = await query('SELECT * FROM api_providers WHERE name = $1', [name]);
  return res.rows[0] ? mapProvider(res.rows[0]) : null;
}
async function createProvider(data) {
  const res = await query(
    `INSERT INTO api_providers (name, endpoint, http_method, url_parameter, request_body_template,
      custom_headers, authentication_type, secret_env_key, response_format, response_path,
      encoding_type, enabled, priority, timeout_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [data.name, data.endpoint, data.http_method || 'GET', data.url_parameter || null,
     data.request_body_template || null, JSON.stringify(data.custom_headers || {}),
     data.authentication_type || 'none', data.secret_env_key || null, data.response_format || 'json',
     data.response_path || null, data.encoding_type || 'none', data.enabled !== false,
     data.priority ?? 100, data.timeout_ms ?? 10000]
  );
  const provider = mapProvider(res.rows[0]);
  await query(`INSERT INTO api_metrics (provider_id) VALUES ($1) ON CONFLICT DO NOTHING`, [provider.id]);
  return provider;
}
async function updateProvider(id, fields) {
  const allowed = ['name','endpoint','http_method','url_parameter','request_body_template','custom_headers',
    'authentication_type','secret_env_key','response_format','response_path','encoding_type','enabled','priority','timeout_ms','url_patterns'];
  const sets = []; const values = []; let i = 1;
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${i}`);
      values.push((key === 'custom_headers' || key === 'url_patterns') ? JSON.stringify(fields[key]) : fields[key]);
      i++;
    }
  }
  if (!sets.length) return getProviderById(id);
  sets.push('updated_at = NOW()'); values.push(id);
  const res = await query(`UPDATE api_providers SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, values);
  return res.rows[0] ? mapProvider(res.rows[0]) : null;
}
async function deleteProvider(id) { await query('DELETE FROM api_providers WHERE id = $1', [id]); }
async function setEnabled(id, enabled) { return updateProvider(id, { enabled }); }
async function setPriority(id, priority) { return updateProvider(id, { priority }); }
async function setPatterns(id, patterns) {
  const arr = Array.isArray(patterns) ? patterns : [];
  return updateProvider(id, { url_patterns: arr });
}
module.exports = { listProviders, getProviderById, getProviderByName, createProvider, updateProvider, deleteProvider, setEnabled, setPriority, setPatterns, mapProvider };

