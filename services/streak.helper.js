/**
 * @param {string} isoDateKey — YYYY-MM-DD
 * @param {number} deltaDays
 */
function addCalendarDays(isoDateKey, deltaDays) {
  const [y, m, d] = isoDateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

/** @param {Iterable<string>} commitIsoDates — full ISO strings from GitHub */
function collectUtcDateKeys(commitIsoDates) {
  /** @type {Set<string>} */
  const set = new Set();
  for (const iso of commitIsoDates) {
    set.add(iso.split('T')[0]);
  }
  return set;
}

/**
 * Longest run of consecutive UTC calendar days present in the set.
 * @param {Set<string>} dateKeys
 */
function computeLongestStreak(dateKeys) {
  if (dateKeys.size === 0) return 0;
  const days = [...dateKeys].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    if (prev === null) {
      run = 1;
    } else if (addCalendarDays(prev, 1) === day) {
      run += 1;
    } else if (day === prev) {
      continue;
    } else {
      run = 1;
    }
    prev = day;
    longest = Math.max(longest, run);
  }
  return longest;
}

/**
 * Count consecutive days with activity walking backward from endKey (inclusive).
 * @param {string} endKey YYYY-MM-DD
 * @param {Set<string>} dateKeys
 */
function countStreakEndingAt(endKey, dateKeys) {
  let count = 0;
  let key = endKey;
  while (dateKeys.has(key)) {
    count += 1;
    key = addCalendarDays(key, -1);
  }
  return count;
}

/**
 * @param {Set<string>} dateKeys
 * @param {string} todayKey YYYY-MM-DD UTC
 */
function computeCurrentStreak(dateKeys, todayKey) {
  if (dateKeys.size === 0) return 0;
  const yesterdayKey = addCalendarDays(todayKey, -1);
  if (dateKeys.has(todayKey)) {
    return countStreakEndingAt(todayKey, dateKeys);
  }
  if (dateKeys.has(yesterdayKey)) {
    return countStreakEndingAt(yesterdayKey, dateKeys);
  }
  return 0;
}

/** @param {Set<string>} dateKeys */
function latestActivityKey(dateKeys) {
  if (dateKeys.size === 0) return null;
  return [...dateKeys].sort().pop();
}

module.exports = {
  addCalendarDays,
  collectUtcDateKeys,
  computeLongestStreak,
  computeCurrentStreak,
  latestActivityKey,
};
