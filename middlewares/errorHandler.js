const { commonErrorHandler } = require('../utils/errorHandler');

/**
 * Express error-handling middleware (4 arguments).
 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode =
    typeof err.statusCode === 'number' ? err.statusCode : 500;
  const message =
    statusCode !== 500
      ? err.message
      : 'Something went wrong. Please try again';

  return commonErrorHandler(req, res, message, statusCode, err);
}

module.exports = { errorHandler };
