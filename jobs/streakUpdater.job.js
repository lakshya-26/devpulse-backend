const cron = require('node-cron');
const { Op } = require('sequelize');
const { User, Streak } = require('../models');
const githubService = require('../services/github.service');

function getTodayRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
    dateStr: start.toISOString().split('T')[0],
  };
}

function isYesterday(dateStr) {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return dateStr === yesterday.toISOString().split('T')[0];
}

function toDayKey(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value.split('T')[0];
  return new Date(value).toISOString().split('T')[0];
}

function utcMidnightDate(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

async function updateStreakForUser(user) {
  try {
    const { from, to, dateStr } = getTodayRange();

    const commits = await githubService.getAllCommitsByDateRange(
      user.accessToken,
      user.id,
      from,
      to,
      null
    );

    const committedToday = commits.length > 0;

    const [streak] = await Streak.findOrCreate({
      where: { userId: user.id },
      defaults: {
        userId: user.id,
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
      },
    });

    const prevLastActive = toDayKey(streak.lastActiveDate);
    const todayStr = dateStr;

    if (committedToday) {
      if (prevLastActive === null) {
        await streak.update({
          currentStreak: 1,
          longestStreak: Math.max(streak.longestStreak, 1),
          lastActiveDate: utcMidnightDate(todayStr),
        });
        console.log(`[StreakJob] ${user.username}: Started new streak (1 day)`);
      } else if (isYesterday(prevLastActive)) {
        const newStreak = streak.currentStreak + 1;
        await streak.update({
          currentStreak: newStreak,
          longestStreak: Math.max(streak.longestStreak, newStreak),
          lastActiveDate: utcMidnightDate(todayStr),
        });
        console.log(`[StreakJob] ${user.username}: Streak extended to ${newStreak} days`);
      } else if (prevLastActive === todayStr) {
        console.log(`[StreakJob] ${user.username}: Already updated today, skipping`);
      } else {
        await streak.update({
          currentStreak: 1,
          longestStreak: streak.longestStreak,
          lastActiveDate: utcMidnightDate(todayStr),
        });
        console.log(`[StreakJob] ${user.username}: Streak reset to 1 (gap detected)`);
      }
    } else if (
      prevLastActive &&
      !isYesterday(prevLastActive) &&
      prevLastActive !== todayStr
    ) {
      await streak.update({ currentStreak: 0 });
      console.log(`[StreakJob] ${user.username}: Streak broken — reset to 0`);
    } else {
      console.log(`[StreakJob] ${user.username}: No commits today yet`);
    }

    await githubService.invalidateCacheByType(user.id, 'streak');

    await streak.reload();

    return {
      username: user.username,
      committedToday,
      currentStreak: streak.currentStreak,
    };
  } catch (err) {
    console.error(`[StreakJob] Failed for user ${user.username}:`, err.message);
    return { username: user.username, error: err.message };
  }
}

async function runStreakUpdateJob() {
  console.log(`[StreakJob] Starting at ${new Date().toISOString()}`);
  const startTime = Date.now();

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeUsers = await User.findAll({
      where: {
        updatedAt: { [Op.gte]: thirtyDaysAgo },
        accessToken: { [Op.ne]: null },
      },
    });

    console.log(`[StreakJob] Processing ${activeUsers.length} active users`);

    const results = [];
    for (const user of activeUsers) {
      const result = await updateStreakForUser(user);
      results.push(result);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const committed = results.filter((r) => r.committedToday).length;
    const errors = results.filter((r) => r.error).length;

    console.log(`[StreakJob] Completed in ${duration}s`);
    console.log(
      `[StreakJob] Results: ${committed}/${activeUsers.length} committed today, ${errors} errors`
    );
  } catch (err) {
    console.error('[StreakJob] Fatal error:', err);
  }
}

function scheduleStreakJob() {
  cron.schedule('1 0 * * *', runStreakUpdateJob, {
    timezone: 'UTC',
  });

  console.log('[StreakJob] Scheduled — runs daily at 00:01 UTC');

  return { runNow: runStreakUpdateJob };
}

module.exports = { scheduleStreakJob, runStreakUpdateJob };
