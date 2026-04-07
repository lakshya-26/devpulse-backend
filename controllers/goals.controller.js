const goalsService = require('../services/goals.service');
const { runController } = require('../helpers/controller.helper');

async function createGoal(req, res) {
  return runController(req, res, {
    run: () => goalsService.upsertDailyGoal(req.user.id, req.body),
    statusCode: 201,
    message: 'Goal saved',
  });
}

async function getToday(req, res) {
  return runController(req, res, {
    run: () => goalsService.getTodayGoalWithProgress(req.user.id),
  });
}

async function getHistory(req, res) {
  return runController(req, res, {
    run: () => goalsService.getGoalsHistory(req.user.id, req.query.days),
  });
}

module.exports = {
  createGoal,
  getToday,
  getHistory,
};
