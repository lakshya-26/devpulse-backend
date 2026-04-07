const { commonErrorHandler } = require('../utils/errorHandler');

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @param {import('zod').ZodType} schema
 * @param {'body' | 'query' | 'params'} [source='body']
 */
function validateRequest(req, res, next, schema, source = 'body') {
  const src =
    source === 'query' ? req.query : source === 'params' ? req.params : req.body;
  const parsed = schema.safeParse(src);
  if (!parsed.success) {
    const message =
      parsed.error.issues.map((i) => i.message).join('; ') || 'Validation failed';
    return commonErrorHandler(req, res, message, 422, parsed.error);
  }
  return next();
}

module.exports = {
  validateRequest,
};
