const { z } = require('zod');
const { validateRequest } = require('../helpers/commonFunctions.helper');

const usernameParamSchema = z.object({
  username: z
    .string()
    .min(1, 'Username is required')
    .max(39, 'Username too long')
    .regex(
      /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/,
      'Invalid GitHub username format'
    ),
});

function usernameParam(req, res, next) {
  return validateRequest(req, res, next, usernameParamSchema, 'params');
}

module.exports = {
  usernameParam,
  usernameParamSchema,
};
