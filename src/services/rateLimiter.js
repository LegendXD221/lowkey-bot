'use strict';
const { query } = require('../database/pool');
const { loadEnv } = require('../config/env');
const { RateLimitError } = require('../utils/errors');
async function checkRateLimit(bucketKey, limitPerMinute) {
  const res = await query(
    `INSERT INTO rate_limit_buckets (bucket_key, count, window_start) VALUES ($1, 1, NOW())
     ON CONFLICT (bucket_key) DO UPDATE SET
       count = CASE WHEN rate_limit_buckets.window_start < NOW() - INTERVAL '1 minute' THEN 1 ELSE rate_limit_buckets.count + 1 END,
       window_start = CASE WHEN rate_limit_buckets.window_start < NOW() - INTERVAL '1 minute' THEN NOW() ELSE rate_limit_buckets.window_start END
     RETURNING count, window_start`, [bucketKey]);
  const row = res.rows[0];
  if (row.count > limitPerMinute) {
    const started = new Date(row.window_start).getTime();
    const retryAfter = Math.max(1, Math.ceil(60 - (Date.now() - started) / 1000));
    throw new RateLimitError(`Rate limit exceeded. Try again in about ${retryAfter}s.`, retryAfter);
  }
  return row.count;
}
async function checkUser(userId) { return checkRateLimit(`user:${userId}`, loadEnv().RATE_LIMIT_USER_PER_MINUTE); }
async function checkGuild(guildId) { return checkRateLimit(`guild:${guildId}`, loadEnv().RATE_LIMIT_GUILD_PER_MINUTE); }
async function checkAutobypass(channelId, userId) { return checkRateLimit(`auto:${channelId}:${userId}`, loadEnv().RATE_LIMIT_AUTOBYPASS_PER_MINUTE); }
module.exports = { checkUser, checkGuild, checkAutobypass, checkRateLimit };
