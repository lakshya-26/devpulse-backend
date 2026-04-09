const axios = require('axios');
const redis = require('../config/redis');
const { githubApi } = require('../config/env');
const { CustomException } = require('../utils/errorHandler');

const CACHE_TTL = 60 * 60 * 24;
const REPO_DEEP_STATS_TTL = 60 * 60 * 24;

async function withCache(key, ttl, fetchFn, res = null) {
  try {
    const cached = await redis.get(key);
    if (cached) {
      if (res) {
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', key);
        res.set('X-Cache-TTL', String(await redis.ttl(key)));
      }
      return JSON.parse(cached);
    }

    if (res) {
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', key);
    }

    const data = await fetchFn();
    await redis.setex(key, ttl, JSON.stringify(data));
    return data;
  } catch (redisErr) {
    console.error('Redis error, falling back to live fetch:', redisErr.message);
    if (res) res.set('X-Cache', 'ERROR');
    return fetchFn();
  }
}

function githubRequest(accessToken, endpoint, params = {}) {
  return axios.get(`${githubApi}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
    params,
  });
}

/** Stable cache segment: UTC calendar dates only (not full ISO — `toISOString()` changes every ms). */
function utcDayKey(isoOrDate) {
  const d =
    typeof isoOrDate === 'string' || typeof isoOrDate === 'number'
      ? new Date(isoOrDate)
      : isoOrDate;
  if (!d || Number.isNaN(d.getTime())) return 'invalid';
  return d.toISOString().slice(0, 10);
}

function commitsKeySegment(repoFullName, from, to) {
  return `${repoFullName}:${utcDayKey(from)}:${utcDayKey(to)}`;
}

function allCommitsCacheKey(userId, from, to) {
  return `github:allcommits:${userId}:${utcDayKey(from)}:${utcDayKey(to)}`;
}

function allPrsCacheKey(userId, from, to) {
  return `github:allprs:${userId}:${utcDayKey(from)}:${utcDayKey(to)}`;
}

async function getUserRepos(accessToken, userId, res = null) {
  const cacheKey = `github:repos:${userId}`;

  return withCache(
    cacheKey,
    CACHE_TTL,
    async () => {
      const repos = [];
      let page = 1;

      while (true) {
        const { data } = await githubRequest(accessToken, '/user/repos', {
          per_page: 100,
          page,
          sort: 'pushed',
          affiliation: 'owner,collaborator',
        });

        repos.push(...data);

        if (data.length < 100) break;
        page += 1;
      }

      return repos.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        language: r.language,
        stargazers: r.stargazers_count,
        pushedAt: r.pushed_at,
        url: r.html_url,
      }));
    },
    res
  );
}

async function getCommitsByDateRange(accessToken, userId, repoFullName, from, to, res = null) {
  const rangeSeg = commitsKeySegment(repoFullName, from, to);
  const cacheKey = `github:commits:${userId}:${rangeSeg}`;

  return withCache(
    cacheKey,
    CACHE_TTL,
    async () => {
      const commits = [];
      let page = 1;

      while (true) {
        try {
          const { data } = await githubRequest(accessToken, `/repos/${repoFullName}/commits`, {
            since: from,
            until: to,
            per_page: 100,
            page,
          });

          commits.push(...data);
          if (data.length < 100) break;
          page += 1;
        } catch (err) {
          if (err.response?.status === 409 || err.response?.status === 404) break;
          throw err;
        }
      }

      return commits.map((c) => ({
        sha: c.sha,
        message: c.commit.message,
        date: c.commit.author.date,
        author: c.commit.author.name,
        url: c.html_url,
      }));
    },
    res
  );
}

async function getAllCommitsByDateRange(accessToken, userId, from, to, res = null) {
  const cacheKey = allCommitsCacheKey(userId, from, to);

  return withCache(
    cacheKey,
    CACHE_TTL,
    async () => {
      const repos = await getUserRepos(accessToken, userId, res);

      const results = await Promise.allSettled(
        repos.map((repo) =>
          getCommitsByDateRange(accessToken, userId, repo.fullName, from, to, res)
        )
      );

      const allCommits = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          result.value.forEach((commit) => {
            allCommits.push({ ...commit, repo: repos[index].name });
          });
        }
      });

      return allCommits.sort((a, b) => new Date(b.date) - new Date(a.date));
    },
    res
  );
}

async function getPullRequests(accessToken, userId, repoFullName, state, res = null) {
  const cacheKey = `github:prs:${userId}:${repoFullName}:${state}`;

  return withCache(
    cacheKey,
    CACHE_TTL,
    async () => {
      const prs = [];
      let page = 1;

      while (true) {
        try {
          const { data } = await githubRequest(accessToken, `/repos/${repoFullName}/pulls`, {
            state,
            per_page: 100,
            page,
            sort: 'updated',
          });

          prs.push(...data);
          if (data.length < 100) break;
          page += 1;
        } catch (err) {
          if (err.response?.status === 404) break;
          throw err;
        }
      }

      return prs.map((pr) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        merged: pr.merged_at !== null,
        createdAt: pr.created_at,
        mergedAt: pr.merged_at,
        closedAt: pr.closed_at,
        url: pr.html_url,
      }));
    },
    res
  );
}

async function getAllPullRequestsInRange(accessToken, userId, from, to, res = null) {
  const cacheKey = allPrsCacheKey(userId, from, to);

  return withCache(
    cacheKey,
    CACHE_TTL,
    async () => {
      const repos = await getUserRepos(accessToken, userId, res);
      const fromMs = new Date(from).getTime();
      const toMs = new Date(to).getTime();

      const results = await Promise.allSettled(
        repos.map((repo) => getPullRequests(accessToken, userId, repo.fullName, 'all', res))
      );

      const all = [];
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        result.value.forEach((pr) => {
          const candidate = pr.mergedAt || pr.closedAt || pr.createdAt;
          if (!candidate) return;
          const ms = new Date(candidate).getTime();
          if (ms >= fromMs && ms <= toMs) {
            all.push({ ...pr, repo: repos[index].name });
          }
        });
      });

      return all.sort(
        (a, b) => new Date(b.mergedAt || b.createdAt) - new Date(a.mergedAt || a.createdAt)
      );
    },
    res
  );
}

function repoDeepStatsCacheKey(userId, fullName) {
  return `github:repoStats:${userId}:${fullName.replace(/\//g, '|')}`;
}

/**
 * Single-repo deep stats (90d commits window for charts; PRs and languages are repo-wide lists).
 * @param {string} accessToken
 * @param {string} userId
 * @param {string} repoShortName - short name (matches {@link getUserRepos} .name)
 * @param {import('express').Response|null} [res]
 */
async function getRepoDeepStats(accessToken, userId, repoShortName, res = null) {
  const repos = await getUserRepos(accessToken, userId, null);
  const repo = repos.find((r) => r.name === repoShortName);
  if (!repo) {
    throw CustomException(`Repository "${repoShortName}" not found in your account`, 404);
  }

  const full = repo.fullName;
  const cacheKey = repoDeepStatsCacheKey(userId, full);

  return withCache(
    cacheKey,
    REPO_DEEP_STATS_TTL,
    async () => {
      const [{ data: repoMeta }, { data: langBytes }] = await Promise.all([
        githubRequest(accessToken, `/repos/${full}`),
        githubRequest(accessToken, `/repos/${full}/languages`),
      ]);

      const to = new Date().toISOString();
      const from = new Date();
      from.setUTCDate(from.getUTCDate() - 90);

      const [commits, prs] = await Promise.all([
        getCommitsByDateRange(accessToken, userId, full, from.toISOString(), to, null),
        getPullRequests(accessToken, userId, full, 'all', null),
      ]);

      const byDate = {};
      commits.forEach((c) => {
        const d = c.date.split('T')[0];
        byDate[d] = (byDate[d] || 0) + 1;
      });
      const commitsPerDay = Object.keys(byDate)
        .sort((a, b) => a.localeCompare(b))
        .map((date) => ({ date, count: byDate[date] }));

      let contributors = 0;
      let page = 1;
      while (true) {
        const { data } = await githubRequest(accessToken, `/repos/${full}/contributors`, {
          per_page: 100,
          page,
        });
        contributors += data.length;
        if (data.length < 100) break;
        page += 1;
      }

      const openPRs = prs.filter((p) => p.state === 'open').length;
      const mergedPRs = prs.filter((p) => p.merged).length;

      const languages = Object.entries(langBytes || {})
        .map(([language, bytes]) => ({ language, bytes: Number(bytes) || 0 }))
        .sort((a, b) => b.bytes - a.bytes);

      const recentCommits = commits.slice(0, 25).map((c) => ({
        message: (c.message || '').split('\n')[0].slice(0, 160),
        author: c.author,
        date: c.date,
        sha: c.sha,
        url: c.url,
      }));

      const prHistory = prs.slice(0, 30).map((p) => ({
        number: p.number,
        title: p.title,
        state: p.state,
        merged: p.merged,
        createdAt: p.createdAt,
        mergedAt: p.mergedAt,
        url: p.url,
      }));

      return {
        repoName: repo.name,
        fullName: repo.fullName,
        private: !!repoMeta.private,
        description: repoMeta.description || null,
        language: repoMeta.language,
        stars: repoMeta.stargazers_count,
        forks: repoMeta.forks_count,
        totalCommits: commits.length,
        contributors,
        openPRs,
        mergedPRs,
        languages,
        commitsPerDay,
        recentCommits,
        prHistory,
      };
    },
    res
  );
}

async function getLanguageStats(accessToken, userId, res = null) {
  const cacheKey = `github:languages:${userId}`;

  return withCache(
    cacheKey,
    CACHE_TTL,
    async () => {
      const repos = await getUserRepos(accessToken, userId, res);
      const langCount = {};

      repos.forEach((repo) => {
        if (repo.language) {
          langCount[repo.language] = (langCount[repo.language] || 0) + 1;
        }
      });

      return Object.entries(langCount)
        .sort(([, a], [, b]) => b - a)
        .map(([language, count]) => ({ language, count }));
    },
    res
  );
}

async function invalidateUserCache(userId) {
  const patterns = [
    `github:repos:${userId}`,
    `github:commits:${userId}:*`,
    `github:allcommits:${userId}:*`,
    `github:allprs:${userId}:*`,
    `github:prs:${userId}:*`,
    `github:languages:${userId}`,
    `github:streak:${userId}`,
    `github:repoStats:${userId}:*`,
    `stats:compare:${userId}:*`,
  ];

  let totalDeleted = 0;
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        totalDeleted += keys.length;
      }
    } else {
      const deleted = await redis.del(pattern);
      totalDeleted += Number(deleted) || 0;
    }
  }

  console.log(`Cache invalidated: ${totalDeleted} keys for user ${userId}`);
  return totalDeleted;
}

async function invalidateCacheByType(userId, type) {
  const keys = await redis.keys(`github:${type}:${userId}:*`);
  if (keys.length > 0) await redis.del(...keys);
  await redis.del(`github:${type}:${userId}`);
}

module.exports = {
  getUserRepos,
  getCommitsByDateRange,
  getAllCommitsByDateRange,
  getPullRequests,
  getAllPullRequestsInRange,
  getLanguageStats,
  getRepoDeepStats,
  invalidateUserCache,
  invalidateCacheByType,
};
