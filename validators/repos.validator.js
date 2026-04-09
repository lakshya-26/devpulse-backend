const { z } = require('zod');
const { validateRequest } = require('../helpers/commonFunctions.helper');

const repoNameParamSchema = z.object({
  repoName: z
    .string()
    .min(1, 'Repository name required')
    .max(200, 'Repository name too long')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid repository name'),
});

function repoNameParam(req, res, next) {
  return validateRequest(req, res, next, repoNameParamSchema, 'params');
}

module.exports = {
  repoNameParam,
  repoNameParamSchema,
};
