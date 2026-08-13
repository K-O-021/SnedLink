/* server.js
   ─────────────────────────────────────────────────────────────────────────
   SNED-LINK+ backend entry point. Boots an Express app wired with:
   Helmet, CORS, Morgan access logs, JSON body parsing, global + per-route
   rate limiting, all API routes, and centralized error handling.
   ───────────────────────────────────────────────────────────────────────── */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
require('./config/firebase'); // boot-time check: throws early if creds are missing
const logger = require('./utils/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const eventRoutes = require('./routes/eventRoutes');
const recordsRoutes = require('./routes/recordsRoutes');
const activationRoutes = require('./routes/activationRoutes');

const app = express();

// Render/Railway/Fly/etc. sit behind a proxy — needed for correct client
// IPs in rate limiting and logs.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : true,
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(env.LOG_LEVEL));
app.use('/api', apiLimiter);

app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teachers', activationRoutes.teacherRouter); // POST /api/teachers/activate — public
app.use('/api/parents', activationRoutes.parentRouter); // POST /api/parents/verify-activation, /api/parents/activate — public
app.use('/api', eventRoutes); // /api/alerts, /api/notifications, /api/parent-requests
app.use('/api/behavior-logs', recordsRoutes.behaviorLogs);
app.use('/api/ieps', recordsRoutes.ieps);
app.use('/api/assessments', recordsRoutes.assessments);
app.use('/api/reports', recordsRoutes.reports);

app.use(notFound);
app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`SNED-LINK+ backend listening on port ${env.PORT} (${env.NODE_ENV})`);
});

module.exports = app;
