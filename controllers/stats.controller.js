const statsService = require('../services/stats.service');
const { runController } = require('../helpers/controller.helper');

async function getCommits(req, res) {
  return runController(req, res, {
    run: () => statsService.getCommitStats(req.user.id, req.query.range),
  });
}

async function getLanguages(req, res) {
  return runController(req, res, {
    run: () => statsService.getLanguageStats(req.user.id),
  });
}

async function refreshCache(req, res) {
  return runController(req, res, {
    run: () => statsService.refreshGithubCache(req.user.id),
    message: 'GitHub cache cleared for your account; the next requests will fetch live data and repopulate cache',
  });
}

async function getPrs(req, res) {
  return runController(req, res, {
    run: () => statsService.getPrStats(req.user.id, req.query.range),
  });
}

async function getStreak(req, res) {
  return runController(req, res, {
    run: () => statsService.syncStreakFromGithub(req.user.id),
    message: 'Streak updated',
  });
}

async function getContributions(req, res) {
  return runController(req, res, {
    run: () => statsService.getContributionsCalendar(req.user.id, req.query.days),
  });
}

async function getRepos(req, res) {
  return runController(req, res, {
    run: () => statsService.getRepoStats(req.user.id, req.query.range),
  });
}

module.exports = {
  getCommits,
  getLanguages,
  getPrs,
  getStreak,
  refreshCache,
  getContributions,
  getRepos,
};
