const cacheService = require('../services/cache.service');
const { runController } = require('../helpers/controller.helper');

async function getStats(req, res) {
  return runController(req, res, {
    run: () => cacheService.getUserGithubCacheStats(req.user.id),
    message: 'Success',
  });
}

module.exports = {
  getStats,
};
