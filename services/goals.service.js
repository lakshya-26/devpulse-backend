const { Op } = require('sequelize');
const { DailyGoal } = require('../models');
const { CustomException } = require('../utils/errorHandler');
const githubService = require('./github.service');
const { loadUserWithGithub } = require('./stats.service');

function startOfUtcDay(input = new Date()) {
  const x = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(x.getTime())) {
    throw CustomException('Invalid date', 422);
  }
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

function toNumberHours(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 2) / 2;
}

/**
 * @param {string} userId
 * @param {{ targetCommits?: number, targetPrs?: number, targetHours?: number, targetCodingHours?: number, date?: string }} payload
 */
async function upsertDailyGoal(userId, payload) {
  const hoursRaw =
    payload.targetHours ?? payload.targetCodingHours ?? 0;
  const targetCodingHours = toNumberHours(hoursRaw);

  const { targetCommits = 0, targetPrs = 0, date: dateRaw } = payload;

  if (targetCommits < 0 || targetPrs < 0 || targetCodingHours < 0) {
    throw CustomException('Targets must be non-negative', 422);
  }
  if (targetCodingHours > 24) {
    throw CustomException('Target coding hours cannot exceed 24', 422);
  }

  const day = dateRaw ? startOfUtcDay(new Date(dateRaw)) : startOfUtcDay();

  const [goal, created] = await DailyGoal.findOrCreate({
    where: { userId, date: day },
    defaults: {
      targetCommits,
      targetPrs,
      targetCodingHours,
    },
  });

  if (!created) {
    await goal.update({ targetCommits, targetPrs, targetCodingHours });
  }

  await goal.reload();
  return { goal };
}

/**
 * @param {string} userId
 */
async function getTodayGoalWithProgress(userId) {
  const day = startOfUtcDay();
  const goal = await DailyGoal.findOne({
    where: { userId, date: day },
  });

  const user = await loadUserWithGithub(userId);
  const start = day.toISOString();
  const end = new Date().toISOString();

  const [commits, prs] = await Promise.all([
    githubService.getAllCommitsByDateRange(user.accessToken, userId, start, end),
    githubService.getAllPullRequestsInRange(user.accessToken, userId, start, end),
  ]);

  return {
    goal,
    progress: {
      commitsToday: commits.length,
      prsToday: prs.length,
      hoursToday: null,
    },
    date: day.toISOString().slice(0, 10),
  };
}

/**
 * @param {string} userId
 * @param {string|number} daysQuery
 */
async function getGoalsHistory(userId, daysQuery) {
  const days = Math.min(90, Math.max(1, parseInt(String(daysQuery || '7'), 10) || 7));
  const end = startOfUtcDay();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const goals = await DailyGoal.findAll({
    where: {
      userId,
      date: { [Op.between]: [start, end] },
    },
    order: [['date', 'ASC']],
  });

  const user = await loadUserWithGithub(userId);
  const fromIso = start.toISOString();
  const endDay = new Date(end);
  endDay.setUTCDate(endDay.getUTCDate() + 1);
  const toIso = endDay.toISOString();

  const [commits, prs] = await Promise.all([
    githubService.getAllCommitsByDateRange(user.accessToken, userId, fromIso, toIso),
    githubService.getAllPullRequestsInRange(user.accessToken, userId, fromIso, toIso),
  ]);

  const commitsByDate = {};
  commits.forEach((c) => {
    const d = c.date.split('T')[0];
    commitsByDate[d] = (commitsByDate[d] || 0) + 1;
  });
  const prsByDate = {};
  prs.forEach((p) => {
    const raw = p.mergedAt || p.closedAt || p.createdAt;
    if (!raw) return;
    const d = raw.split('T')[0];
    prsByDate[d] = (prsByDate[d] || 0) + 1;
  });

  const goalByKey = {};
  goals.forEach((g) => {
    goalByKey[g.date.toISOString().slice(0, 10)] = g;
  });

  const rows = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    const g = goalByKey[key];
    const ca = commitsByDate[key] || 0;
    const pa = prsByDate[key] || 0;
    const tc = g ? Number(g.targetCommits) : null;
    const tp = g ? Number(g.targetPrs) : null;
    const th = g ? Number(g.targetCodingHours) : null;
    let met = null;
    if (g != null) {
      const commitsOk = tc == null || ca >= tc;
      const prsOk = tp == null || pa >= tp;
      met = commitsOk && prsOk;
    }
    rows.push({
      date: key,
      targetCommits: tc,
      targetPrs: tp,
      targetCodingHours: th,
      commitsActual: ca,
      prsActual: pa,
      met,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { days, items: rows };
}

module.exports = {
  upsertDailyGoal,
  getTodayGoalWithProgress,
  getGoalsHistory,
  startOfUtcDay,
};
