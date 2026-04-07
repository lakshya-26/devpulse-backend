const { z } = require('zod');
const { validateRequest } = require('../helpers/commonFunctions.helper');

const commitsQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d']).optional(),
});

const contributionsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(366).optional(),
});

function commitsQuery(req, res, next) {
  return validateRequest(req, res, next, commitsQuerySchema, 'query');
}

function prsQuery(req, res, next) {
  return validateRequest(req, res, next, commitsQuerySchema, 'query');
}

function reposQuery(req, res, next) {
  return validateRequest(req, res, next, commitsQuerySchema, 'query');
}

function contributionsQuery(req, res, next) {
  return validateRequest(req, res, next, contributionsQuerySchema, 'query');
}

module.exports = {
  commitsQuery,
  prsQuery,
  reposQuery,
  contributionsQuery,
};
