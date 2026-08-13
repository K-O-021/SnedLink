require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v) {
    // Fail fast and loud at boot rather than mysteriously later.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '8080', 10),

  // Comma-separated list, e.g. "https://sned-link.pages.dev,https://sned-link.org"
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),

  LOG_LEVEL: process.env.LOG_LEVEL || 'combined',

  required
};
