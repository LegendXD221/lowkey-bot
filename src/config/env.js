'use strict';
const { z } = require('zod');
require('dotenv').config();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  CLIENT_ID: z.string().min(1),
  DATABASE_URL: z.string().url(),
  BOT_OWNER_IDS: z.string().min(1),
  BOT_STATUS_CHANNEL_ID: z.string().optional().default(''),
  GUILD_ID: z.string().optional().default(''),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DEFAULT_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(180),
  CACHE_MAX_ROWS: z.coerce.number().int().positive().default(2000),
  STORAGE_CLEANUP_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),
  HEALTH_CHECK_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
  HEALTHY_SUCCESS_RATE: z.coerce.number().min(0).max(1).default(0.85),
  DEGRADED_SUCCESS_RATE: z.coerce.number().min(0).max(1).default(0.50),
  CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  CIRCUIT_RECOVERY_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  CIRCUIT_HALF_OPEN_MAX: z.coerce.number().int().positive().default(2),
  RATE_LIMIT_USER_PER_MINUTE: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_GUILD_PER_MINUTE: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_AUTOBYPASS_PER_MINUTE: z.coerce.number().int().positive().default(5),
  MAX_RESPONSE_SIZE_BYTES: z.coerce.number().int().positive().default(1048576),
  MAX_REDIRECTS: z.coerce.number().int().min(0).max(10).default(3),
  BYPASS_API_KEY: z.string().optional().default(''),
  LINK_UNLOCK_API_KEY: z.string().optional().default(''),
  CUSTOM_API_KEY: z.string().optional().default(''),
  KEYBYPASS_KEY: z.string().optional().default('')
});

let cached = null;
const PROVIDER_SECRET_KEYS = new Set(['BYPASS_API_KEY', 'LINK_UNLOCK_API_KEY', 'CUSTOM_API_KEY', 'KEYBYPASS_KEY']);
const CUSTOM_PROVIDER_SECRET_PATTERN = /^CUSTOM_API_KEY_[A-Z0-9_]+$/;
function loadEnv() {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
    console.error('Environment validation failed:\n' + issues);
    process.exit(1);
  }
  const data = parsed.data;
  data.ownerIds = data.BOT_OWNER_IDS.split(',').map(s => s.trim()).filter(Boolean);
  if (!data.ownerIds.length) { console.error('BOT_OWNER_IDS empty'); process.exit(1); }
  cached = data;
  return cached;
}
function getSecret(envKey) {
  if (!envKey || typeof envKey !== 'string') return null;
  const key = envKey.trim();
  const testOnly = process.env.NODE_ENV === 'test' && /^TEST_[A-Z0-9_]+$/.test(key);
  if (!PROVIDER_SECRET_KEYS.has(key) && !CUSTOM_PROVIDER_SECRET_PATTERN.test(key) && !testOnly) return null;
  return process.env[key] || null;
}
module.exports = { loadEnv, getSecret, PROVIDER_SECRET_KEYS };
