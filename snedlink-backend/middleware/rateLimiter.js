const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate-limited', message: 'Too many requests. Please slow down and try again shortly.' } }
});

// Tighter limit specifically on account-creation endpoints — these hit
// Firebase Auth and shouldn't be hammered even by a legitimate admin's
// buggy script.
const accountCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate-limited', message: 'Too many account-creation requests. Please wait a few minutes.' } }
});

module.exports = { apiLimiter, accountCreationLimiter };
