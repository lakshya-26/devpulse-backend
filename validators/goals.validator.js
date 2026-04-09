const { z } = require('zod');
const { validateRequest } = require('../helpers/commonFunctions.helper');

const createGoalBody = z
  .object({
    targetCommits: z.coerce.number().int().min(1).max(50),
    targetPrs: z.coerce.number().int().min(0).max(20),
    targetHours: z.coerce.number().min(0.5).max(12).optional(),
    targetCodingHours: z.coerce.number().min(0.5).max(12).optional(),
    date: z.string().optional(),
  })
  .refine((d) => d.targetHours != null || d.targetCodingHours != null, {
    message: 'targetHours is required',
    path: ['targetHours'],
  });

const historyQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
});

function createGoal(req, res, next) {
  return validateRequest(req, res, next, createGoalBody, 'body');
}

function historyQuery(req, res, next) {
  return validateRequest(req, res, next, historyQuerySchema, 'query');
}

module.exports = {
  createGoal,
  historyQuery,
};
