const redis = require('../config/redis');

const CACHE_TYPES = ['repos', 'commits', 'allcommits', 'prs', 'languages', 'streak'];

/**
 * @param {string} userId
 */
async function getUserGithubCacheStats(userId) {
  const stats = {};

  for (const type of CACHE_TYPES) {
    const keys = await redis.keys(`github:${type}:${userId}*`);
    stats[type] = {
      cached: keys.length > 0,
      keys: keys.length,
      ttl: keys.length > 0 ? await redis.ttl(keys[0]) : null,
    };
  }

  return { userId, cacheStats: stats };
}

module.exports = {
  getUserGithubCacheStats,
};
