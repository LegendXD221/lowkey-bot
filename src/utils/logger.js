'use strict';
const pino = require('pino');
let logger = null;
function getLogger() {
  if (logger) return logger;
  // Do not force full application configuration validation during module import.
  // The main entrypoint still validates the environment before starting.
  const level = process.env.LOG_LEVEL || 'info';
  const nodeEnv = process.env.NODE_ENV || 'production';
  logger = pino({
    level,
    transport: nodeEnv === 'development' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
    redact: {
      paths: [
        'req.headers.authorization', 'headers.authorization', 'headers.Authorization',
        'headers.x-api-key', 'headers.X-API-Key', 'apiKey', 'token', 'secret',
        'password', 'secret_env_key', 'DISCORD_TOKEN', 'DATABASE_URL'
      ],
      censor: '[REDACTED]'
    }
  });
  return logger;
}
module.exports = { getLogger };
