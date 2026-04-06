/**
 * Redis client URL for future caching (Step 15+).
 * @returns {string}
 */
function getRedisUrl() {
  return process.env.REDIS_URL || 'redis://127.0.0.1:6380';
}

module.exports = { getRedisUrl };
