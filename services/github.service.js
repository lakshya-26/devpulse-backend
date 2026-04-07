const axios = require('axios');
const redis = require('../config/redis');
const { githubApi } = require('../config/env');

const CACHE_TTL = 60 * 15;

/**
 * Wrap GitHub-backed fetches: read Redis, else run fetcher.
 * Only writes Redis when we actually choose to persist (default: yes), so failed aggregates
 * do not poison the cache with empty fallbacks.
 *
 * Return `fetchFn()` as plain data to always persist (when not nullish).
 * Return `{ value, persist: false }` to skip SET after a run that did not get usable GitHub data.
 *
 * @param {string} key
 * @param {number} ttlSeconds
 * @param {() => Promise<unknown | { value: unknown, persist?: boolean }>} fetchFn
 */
async function withCache(key, ttlSeconds, fetchFn) {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  const raw = await fetchFn();

  let value;
  let shouldPersist = true;
  if (
    raw != null &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Object.prototype.hasOwnProperty.call(raw, 'value')
  ) {
    value = raw.value;
    shouldPersist = raw.persist !== false;
  } else {
    value = raw;
  }

  if (shouldPersist && value !== undefined && value !== null) {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  }

  return value;
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

async function getUserRepos(accessToken, userId) {
  const cacheKey = `github:repos:${userId}`;

  return withCache(cacheKey, CACHE_TTL, async () => {
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
      page++;
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
  });
}

/**
 * Per-repo commits for a time window. `cacheScope` is a stable label (7d, 30d, streak, …) — no dates in the Redis key; TTL handles expiry.
 */
async function getCommitsByDateRange(accessToken, userId, repoFullName, from, to, cacheScope) {
  const cacheKey = `github:commits:${userId}:${repoFullName}:${cacheScope}`;

  return withCache(cacheKey, CACHE_TTL, async () => {
    const commits = [];
    let page = 1;

    while (true) {
      try {
        const { data } = await githubRequest(
          accessToken,
          `/repos/${repoFullName}/commits`,
          { since: from, until: to, per_page: 100, page }
        );

        commits.push(...data);
        if (data.length < 100) break;
        page++;
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
  });
}

/**
 * @param {string} cacheScope - e.g. 7d, 30d, 90d, d365, spark, streak, goals-today, goals-history-7
 */
async function getAllCommitsByDateRange(accessToken, userId, from, to, cacheScope) {
  const cacheKey = `github:allcommits:${userId}:${cacheScope}`;

  return withCache(cacheKey, CACHE_TTL, async () => {
    const repos = await getUserRepos(accessToken, userId);

    const results = await Promise.allSettled(
      repos.map((repo) =>
        getCommitsByDateRange(accessToken, userId, repo.fullName, from, to, cacheScope)
      )
    );

    const allCommits = [];
    let fulfilledRepos = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        fulfilledRepos += 1;
        result.value.forEach((commit) => {
          allCommits.push({ ...commit, repo: repos[index].name });
        });
      }
    });

    const value = allCommits.sort((a, b) => new Date(b.date) - new Date(a.date));
    const gotGithubData = repos.length === 0 || fulfilledRepos > 0;
    return { value, persist: gotGithubData };
  });
}

async function getPullRequests(accessToken, userId, repoFullName, state = 'all') {
  const cacheKey = `github:prs:${userId}:${repoFullName}:${state}`;

  return withCache(cacheKey, CACHE_TTL, async () => {
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
        page++;
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
  });
}

async function getAllPullRequestsInRange(accessToken, userId, from, to, cacheScope) {
  const cacheKey = `github:allprs:${userId}:${cacheScope}`;

  return withCache(cacheKey, CACHE_TTL, async () => {
    const repos = await getUserRepos(accessToken, userId);
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();

    const results = await Promise.allSettled(
      repos.map((repo) => getPullRequests(accessToken, userId, repo.fullName, 'all'))
    );

    const all = [];
    let fulfilledRepos = 0;
    results.forEach((result, index) => {
      if (result.status !== 'fulfilled') return;
      fulfilledRepos += 1;
      result.value.forEach((pr) => {
        const candidate = pr.mergedAt || pr.closedAt || pr.createdAt;
        if (!candidate) return;
        const ms = new Date(candidate).getTime();
        if (ms >= fromMs && ms <= toMs) {
          all.push({ ...pr, repo: repos[index].name });
        }
      });
    });

    const value = all.sort(
      (a, b) =>
        new Date(b.mergedAt || b.createdAt) - new Date(a.mergedAt || a.createdAt)
    );
    const gotGithubData = repos.length === 0 || fulfilledRepos > 0;
    return { value, persist: gotGithubData };
  });
}

async function getLanguageStats(accessToken, userId) {
  const cacheKey = `github:languages:${userId}`;

  return withCache(cacheKey, CACHE_TTL, async () => {
    const repos = await getUserRepos(accessToken, userId);
    const langCount = {};

    repos.forEach((repo) => {
      if (repo.language) {
        langCount[repo.language] = (langCount[repo.language] || 0) + 1;
      }
    });

    return Object.entries(langCount)
      .sort(([, a], [, b]) => b - a)
      .map(([language, count]) => ({ language, count }));
  });
}

/**
 * Deletes every GitHub cache entry for this user (repos, commits, PRs, languages, all scopes).
 * Called after "Refresh" so the next request repopulates Redis from live GitHub APIs.
 */
async function invalidateUserCache(userId) {
  const keys = await redis.keys(`github:*${userId}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

module.exports = {
  getUserRepos,
  getCommitsByDateRange,
  getAllCommitsByDateRange,
  getPullRequests,
  getAllPullRequestsInRange,
  getLanguageStats,
  invalidateUserCache,
};
