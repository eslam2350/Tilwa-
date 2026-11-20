import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_KHATMAH_STATE,
  TOTAL_MUSHAF_PAGES,
  clampMushafPage,
  clampTargetDays,
  computeKhatmahStats,
  markTodayWirdCompleted,
} from './khatmahHelpers';

test('computeKhatmahStats calculates daily quota and remaining pages for 30-day Khatmah', () => {
  const stats = computeKhatmahStats(DEFAULT_KHATMAH_STATE);
  assert.equal(stats.dailyQuota, 21); // ceil(604 / 30)
  assert.equal(stats.todayEndPage, 21);
  assert.equal(stats.pagesRemaining, TOTAL_MUSHAF_PAGES);
  assert.equal(stats.progressPercent, 0);
});

test('markTodayWirdCompleted advances page, increments streak on consecutive day, and completes Khatmah at 604', () => {
  const day1 = markTodayWirdCompleted(DEFAULT_KHATMAH_STATE, '2026-11-17');
  assert.equal(day1.currentPage, 22);
  assert.equal(day1.streakDays, 1);

  const day1Repeat = markTodayWirdCompleted(day1, '2026-11-17');
  assert.equal(day1Repeat.streakDays, 1);

  const day2 = markTodayWirdCompleted(day1Repeat, '2026-11-18');
  assert.equal(day2.streakDays, 2);

  const nearEnd = markTodayWirdCompleted(
    {
      ...day2,
      currentPage: 595,
    },
    '2026-11-19'
  );
  assert.equal(nearEnd.completedKhatmahs, 1);
  assert.equal(nearEnd.currentPage, 1);
  assert.equal(nearEnd.streakDays, 3);
});

test('clamp helpers safely bound page numbers and target days', () => {
  assert.equal(clampMushafPage(-5), 1);
  assert.equal(clampMushafPage(999), 604);
  assert.equal(clampTargetDays(1), 3);
  assert.equal(clampTargetDays(900), 365);
});
