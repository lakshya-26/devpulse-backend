const { commonErrorHandler } = require('../utils/errorHandler');
const { sendResponse } = require('../middlewares/reqRes.middleware');

/**
 * Run an async service call and send a standard success or error response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {object} options
 * @param {() => Promise<unknown>} options.run
 * @param {number} [options.statusCode=200]
 * @param {string} [options.message='Success']
 */
async function runController(req, res, options) {
  const { run, statusCode = 200, message = 'Success' } = options;
  try {
    const data = await run();
    req.statusCode = statusCode;
    req.data = data;
    req.message = message;
    return sendResponse(req, res);
  } catch (error) {
    return commonErrorHandler(
      req,
      res,
      error.message,
      error.statusCode || 500,
      error
    );
  }
}

module.exports = {
  runController,
};
