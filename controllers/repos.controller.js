const reposService = require('../services/repos.service');
const { runController } = require('../helpers/controller.helper');

async function getRepoStats(req, res) {
  return runController(req, res, {
    run: () => reposService.getRepoStats(req.user.id, req.params.repoName, res),
    message: 'Success',
  });
}

module.exports = {
  getRepoStats,
};
