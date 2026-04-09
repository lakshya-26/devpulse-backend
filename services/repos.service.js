const githubService = require('./github.service');
const { loadUserWithGithub } = require('./stats.service');

/**
 * @param {string} userId
 * @param {string} repoName - short repository name
 * @param {import('express').Response|null} [res]
 */
async function getRepoStats(userId, repoName, res = null) {
  const user = await loadUserWithGithub(userId);
  return githubService.getRepoDeepStats(user.accessToken, userId, repoName, res);
}

module.exports = {
  getRepoStats,
};
