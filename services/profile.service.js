const redis = require('../config/redis');
const { User, Streak } = require('../models');
const githubService = require('./github.service');
const { CustomException } = require('../utils/errorHandler');

const PROFILE_CACHE_TTL_SEC = 60 * 60 * 24;

function toDateKey(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value.split('T')[0];
  return new Date(value).toISOString().split('T')[0];
}

/**
 * @param {string} username
 * @param {import('express').Response|null} [res]
 */
async function getPublicProfileByUsername(username, res = null) {
  const cacheKey = `profile:${username}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      if (res) res.set('X-Cache', 'HIT');
      return JSON.parse(cached);
    }

    const user = await User.findOne({ where: { username } });
    if (!user || !user.accessToken) {
      throw CustomException('User not found on DevPulse', 404);
    }

    const streak = await Streak.findOne({ where: { userId: user.id } });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const commits = await githubService.getAllCommitsByDateRange(
      user.accessToken,
      user.id,
      thirtyDaysAgo.toISOString(),
      new Date().toISOString()
    );

    const languages = await githubService.getLanguageStats(user.accessToken, user.id);

    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const yearCommits = await githubService.getAllCommitsByDateRange(
      user.accessToken,
      user.id,
      yearAgo.toISOString(),
      new Date().toISOString()
    );

    const heatmapData = {};
    yearCommits.forEach((c) => {
      const date = c.date.split('T')[0];
      heatmapData[date] = (heatmapData[date] || 0) + 1;
    });

    const profileData = {
      username: user.username,
      avatarUrl: user.avatarUrl,
      joinedDevPulse: user.createdAt,
      streak: {
        current: streak?.currentStreak || 0,
        longest: streak?.longestStreak || 0,
        lastActive: streak?.lastActiveDate ? toDateKey(streak.lastActiveDate) : null,
      },
      stats: {
        commitsLast30Days: commits.length,
        topLanguages: languages.slice(0, 5),
        recentCommits: commits.slice(0, 5).map((c) => ({
          message: c.message,
          repo: c.repo,
          date: c.date,
        })),
      },
      heatmap: heatmapData,
    };

    await redis.setex(cacheKey, PROFILE_CACHE_TTL_SEC, JSON.stringify(profileData));
    if (res) {
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);
    }

    return profileData;
  } catch (err) {
    if (err.statusCode) throw err;
    console.error('Profile fetch error:', err);
    throw CustomException('Failed to load profile', 500);
  }
}

module.exports = {
  getPublicProfileByUsername,
};
