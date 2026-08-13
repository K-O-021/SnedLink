const { AppError } = require('../utils/AppError');
const logger = require('../utils/logger');

// 404 handler — mounted after all routes.
function notFound(req, res, next) {
  next(new AppError(404, 'not-found', `No route: ${req.method} ${req.originalUrl}`));
}

// Final error handler — mounted last. Express recognizes it as an error
// handler specifically because it takes 4 arguments.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err instanceof AppError ? err.status : (err.status || 500);
  const code = err instanceof AppError ? err.code : (err.code || 'internal');
  const message = status >= 500
    ? 'Something went wrong on our end. Please try again.'
    : err.message;

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${status} ${code}: ${err.message}\n${err.stack}`);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${status} ${code}: ${err.message}`);
  }

  res.status(status).json({ error: { code, message } });
}

module.exports = { notFound, errorHandler };
