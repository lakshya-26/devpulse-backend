const axios = require('axios');
const redis = require('../config/redis');
const { githubApi } = require('../config/env');

const CACHE_TTL = 60 * 60 * 24;

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
        (a, b) =>
          new Date(b.mergedAt || b.createdAt) - new Date(a.mergedAt || a.createdAt)
      );
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
  invalidateUserCache,
  invalidateCacheByType,
};
