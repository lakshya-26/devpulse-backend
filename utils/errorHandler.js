const fs = require('fs');

/**
 * Callback which executes on error
 *
 * @callback errorHandlerCallback
 * @param {import('express').Request} req - Express request object
 * @param {Error} error - Error object
 * @param {object} response - Custom response object
 */

/** @type {errorHandlerCallback | null} */
let errorHandlerCallback = null;

/**
 * Register callback for route
 * @param {errorHandlerCallback} cb - Callback
 */
function registerErrorHandlerCallback(cb) {
  errorHandlerCallback = cb;
}

const commonErrorHandler = async (
  req,
  res,
  message,
  statusCode = 422,
  error = null
) => {
  if (req.files) {
    Object.keys(req.files).forEach((file) => {
      if (req.files[file].path) {
        fs.unlink(req.files[file].path, () => {});
      }
    });
  }

  const errorMessage =
    message || error?.message || 'Something went wrong. Please try again';
  statusCode = statusCode || 400;

  req.error = error;

  const response = {
    statusCode,
    data: {},
    message: errorMessage,
  };

  if (typeof errorHandlerCallback === 'function') {
    errorHandlerCallback(req, error, JSON.parse(JSON.stringify(response)));
  }

  res.status(statusCode).json(response);
};

const CustomException = function (message, statusCode = 422) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};
CustomException.prototype = Object.create(Error.prototype);

module.exports = {
  commonErrorHandler,
  registerErrorHandlerCallback,
  CustomException,
};
