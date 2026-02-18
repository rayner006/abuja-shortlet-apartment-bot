const logger = require('./logger');

/**
 * Express Global Error Handler
 * Usage: app.use(errorHandler);
 */
function errorHandler(err, req, res, next) {
  logger.error('Unhandled Error:', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    params: req.params,
    query: req.query
  });

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Something went wrong'
        : err.message,
  });
}

/**
 * 404 Not Found Middleware
 * Usage: app.use(notFoundHandler);
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
