const redis = require('../config/redis');
const { User, Streak } = require('../models');
const githubService = require('./github.service');
const { CustomException } = require('../utils/errorHandler');
const streakHelper = require('./streak.helper');

const STREAK_LOOKBACK_DAYS = 400;

const ALLOWED_RANGES = new Set(['7d', '30d', '90d']);

/**
 * @param {string} [range]
 */
function resolveDateRange(range) {
  const key = ALLOWED_RANGES.has(range) ? range : '7d';
  const to = new Date().toISOString();
  const from = new Date();
  if (key === '7d') from.setDate(from.getDate() - 7);
  else if (key === '30d') from.setDate(from.getDate() - 30);
  else if (key === '90d') from.setDate(from.getDate() - 90);
  return { from: from.toISOString(), to, range: key };
}

async function loadUserWithGithub(userId) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw CustomException('User not found', 404);
  }
  if (!user.accessToken) {
    throw CustomException('GitHub account not linked — sign in again with GitHub', 403);
  }
  return user;
}

/**
 * @param {string} userId
 * @param {string} [rangeQuery]
 * @param {import('express').Response|null} [res]
 */
async function getCommitStats(userId, rangeQuery, res = null) {
  const { from, to, range } = resolveDateRange(rangeQuery);
  const user = await loadUserWithGithub(userId);

  const commits = await githubService.getAllCommitsByDateRange(
    user.accessToken,
    userId,
    from,
    to,
    res
  );

  const byDate = {};
  const byDateMessages = {};
  const byRepoCount = {};
  commits.forEach((c) => {
    const date = c.date.split('T')[0];
    byDate[date] = (byDate[date] || 0) + 1;
    if (!byDateMessages[date]) byDateMessages[date] = [];
    if (byDateMessages[date].length < 3) {
      const line = (c.message || '').split('\n')[0].slice(0, 120);
      byDateMessages[date].push(line);
    }
    byRepoCount[c.repo] = (byRepoCount[c.repo] || 0) + 1;
  });

  const repos = await githubService.getUserRepos(user.accessToken, userId, res);
  const langByRepo = Object.fromEntries(repos.map((r) => [r.name, r.language]));

  let topRepo = null;
  Object.entries(byRepoCount).forEach(([name, count]) => {
    if (!topRepo || count > topRepo.commits) {
      topRepo = { name, commits: count, language: langByRepo[name] || null };
    }
  });

  return {
    range,
    total: commits.length,
    byDate,
    byDateMessages,
    topRepo,
    recent: commits.slice(0, 10),
    items: commits,
  };
}

/**
 * @param {string} userId
 * @param {import('express').Response|null} [res]
 */
async function getLanguageStats(userId, res = null) {
  const user = await loadUserWithGithub(userId);
  return githubService.getLanguageStats(user.accessToken, userId, res);
}

/**
 * @param {string} userId
 */
async function refreshGithubCache(userId) {
  const user = await loadUserWithGithub(userId);
  await githubService.invalidateUserCache(userId);
  if (user.username) {
    await redis.del(`profile:${user.username}`);
  }
  return { refreshed: true };
}

/**
 * @param {string} userId
 * @param {string} [rangeQuery]
 * @param {import('express').Response|null} [res]
 */
async function getPrStats(userId, rangeQuery, res = null) {
  const { from, to, range } = resolveDateRange(rangeQuery);
  const user = await loadUserWithGithub(userId);

  const prs = await githubService.getAllPullRequestsInRange(
    user.accessToken,
    userId,
    from,
    to,
    res
  );

  const byDate = {};
  prs.forEach((pr) => {
    const raw = pr.mergedAt || pr.closedAt || pr.createdAt;
    if (!raw) return;
    const date = raw.split('T')[0];
    byDate[date] = (byDate[date] || 0) + 1;
  });

  return {
    range,
    total: prs.length,
    byDate,
    recent: prs.slice(0, 15),
    items: prs,
  };
}

/**
 * @param {string} userId
 * @param {string|number} [daysQuery]
 * @param {import('express').Response|null} [res]
 */
async function getContributionsCalendar(userId, daysQuery, res = null) {
  const days = Math.min(366, Math.max(1, parseInt(String(daysQuery ?? '365'), 10) || 365));
  const to = new Date().toISOString();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - (days - 1));

  const user = await loadUserWithGithub(userId);
  const commits = await githubService.getAllCommitsByDateRange(
    user.accessToken,
    userId,
    from.toISOString(),
    to,
    res
  );

  const byDate = {};
  commits.forEach((c) => {
    const date = c.date.split('T')[0];
    byDate[date] = (byDate[date] || 0) + 1;
  });

  return { days, byDate };
}

/**
 * @param {string} userId
 * @param {string} [rangeQuery]
 * @param {import('express').Response|null} [res]
 */
async function getRepoStats(userId, rangeQuery, res = null) {
  const { from, to, range } = resolveDateRange(rangeQuery);
  const user = await loadUserWithGithub(userId);

  const [repos, commits] = await Promise.all([
    githubService.getUserRepos(user.accessToken, userId, res),
    githubService.getAllCommitsByDateRange(user.accessToken, userId, from, to, res),
  ]);

  const sparkTo = new Date().toISOString();
  const sparkFrom = new Date();
  sparkFrom.setUTCDate(sparkFrom.getUTCDate() - 6);

  const sparkCommits = await githubService.getAllCommitsByDateRange(
    user.accessToken,
    userId,
    sparkFrom.toISOString(),
    sparkTo,
    res
  );

  const byRepoCount = {};
  commits.forEach((c) => {
    byRepoCount[c.repo] = (byRepoCount[c.repo] || 0) + 1;
  });

  const sparkByRepoDate = {};
  sparkCommits.forEach((c) => {
    const d = c.date.split('T')[0];
    if (!sparkByRepoDate[c.repo]) sparkByRepoDate[c.repo] = {};
    sparkByRepoDate[c.repo][d] = (sparkByRepoDate[c.repo][d] || 0) + 1;
  });

  const dates = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  return {
    range,
    repos: repos.map((r) => ({
      name: r.name,
      fullName: r.fullName,
      private: r.private,
      language: r.language,
      stars: r.stargazers,
      pushedAt: r.pushedAt,
      commitsInRange: byRepoCount[r.name] || 0,
      sparkWeek: dates.map((dt) => sparkByRepoDate[r.name]?.[dt] || 0),
    })),
  };
}

/**
 * Refresh streak from GitHub commits and persist {@link Streak}.
 * @param {string} userId
 * @param {import('express').Response|null} [res]
 */
async function syncStreakFromGithub(userId, res = null) {
  const user = await loadUserWithGithub(userId);
  const to = new Date().toISOString();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - STREAK_LOOKBACK_DAYS);

  const commits = await githubService.getAllCommitsByDateRange(
    user.accessToken,
    userId,
    from.toISOString(),
    to,
    res
  );

  const dateKeys = streakHelper.collectUtcDateKeys(commits.map((c) => c.date));
  const todayKey = new Date().toISOString().slice(0, 10);
  const currentStreak = streakHelper.computeCurrentStreak(dateKeys, todayKey);
  const windowLongest = streakHelper.computeLongestStreak(dateKeys);
  const lastKey = streakHelper.latestActivityKey(dateKeys);
  const lastActiveDate = lastKey ? new Date(`${lastKey}T12:00:00.000Z`) : null;

  let row = await Streak.findOne({ where: { userId } });
  if (!row) {
    row = await Streak.create({
      userId,
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
    });
  }

  const longestStreak = Math.max(row.longestStreak, windowLongest, currentStreak);

  await row.update({
    currentStreak,
    longestStreak,
    lastActiveDate: lastActiveDate || row.lastActiveDate,
  });

  await row.reload();

  return {
    currentStreak: row.currentStreak,
    longestStreak: row.longestStreak,
    lastActiveDate: row.lastActiveDate,
    daysWithCommitsInWindow: dateKeys.size,
  };
}

module.exports = {
  getCommitStats,
  getLanguageStats,
  getPrStats,
  getContributionsCalendar,
  getRepoStats,
  syncStreakFromGithub,
  refreshGithubCache,
  resolveDateRange,
  loadUserWithGithub,
};
