import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeListeningStreakDays,
  computeUserProgressLevel,
  DEFAULT_LISTENER_STATS,
  evaluateCertificates,
  recordListeningTick,
  recordPageRead,
  recordTahfeezSession,
  sanitizeListenerStats,
  toggleMemorizedJuz,
} from './certificateHelpers';

test('recordListeningTick increments seconds, active days, and unique surah keys', () => {
  let s = { ...DEFAULT_LISTENER_STATS };
  s = recordListeningTick(s, 30, '2026-11-19', 'minshawi_1');
  s = recordListeningTick(s, 45, '2026-11-19', 'minshawi_1');
  s = recordListeningTick(s, 25, '2026-11-20', 'bahtimi_19');
  assert.equal(s.totalListeningSeconds, 100);
  assert.deepEqual(s.activeDays, ['2026-11-19', '2026-11-20']);
  assert.deepEqual(s.listenedSurahKeys, ['minshawi_1', 'bahtimi_19']);
});

test('recordPageRead and recordTahfeezSession track unique Mushaf pages and tahfeez mastery', () => {
  let s = { ...DEFAULT_LISTENER_STATS };
  s = recordPageRead(s, 1, '2026-11-19');
  s = recordPageRead(s, 2, '2026-11-19');
  s = recordPageRead(s, 1, '2026-11-19');
  s = recordPageRead(s, 999, '2026-11-19');
  s = recordTahfeezSession(s, '2026-11-20');
  assert.deepEqual(s.activePagesRead, [1, 2]);
  assert.equal(s.tahfeezSessionsCompleted, 1);
  assert.deepEqual(s.activeDays, ['2026-11-19', '2026-11-20']);
});

test('toggleMemorizedJuz toggles Juz numbers within 1..30 cleanly', () => {
  let s = { ...DEFAULT_LISTENER_STATS };
  s = toggleMemorizedJuz(s, 30);
  s = toggleMemorizedJuz(s, 1);
  assert.deepEqual(s.verifiedMemorizedJuzs, [1, 30]);
  s = toggleMemorizedJuz(s, 30);
  assert.deepEqual(s.verifiedMemorizedJuzs, [1]);
  assert.deepEqual(toggleMemorizedJuz(s, 99).verifiedMemorizedJuzs, [1]);
});

test('computeListeningStreakDays counts consecutive trailing days', () => {
  assert.equal(computeListeningStreakDays([]), 0);
  assert.equal(computeListeningStreakDays(['2026-11-15', '2026-11-18', '2026-11-19', '2026-11-20']), 3);
});

test('computeUserProgressLevel calculates XP and levels accurately', () => {
  const lvl1 = computeUserProgressLevel({
    stats: { ...DEFAULT_LISTENER_STATS },
    memorizedAyahsCount: 0,
    completedSurahsCount: 0,
    historyCount: 0,
    completedKhatmahsCount: 0,
  });
  assert.equal(lvl1.level, 1);
  assert.equal(lvl1.xp, 0);
  assert.equal(lvl1.nextLevel, 2);
  assert.equal(lvl1.xpToNextLevel, 120);

  const lvl2 = computeUserProgressLevel({
    stats: sanitizeListenerStats({
      verifiedMemorizedJuzs: [30], // 180 XP -> Level 2 (>= 120, < 300)
    }),
    memorizedAyahsCount: 0,
    completedSurahsCount: 0,
    historyCount: 0,
    completedKhatmahsCount: 0,
  });
  assert.equal(lvl2.level, 2);
  assert.equal(lvl2.xp, 180);
});

test('evaluateCertificates requires BOTH activity goal and required level to earn each certificate', () => {
  const locked = evaluateCertificates({
    stats: { ...DEFAULT_LISTENER_STATS },
    memorizedAyahsCount: 14,
    completedSurahsCount: 0,
    historyCount: 1,
    completedKhatmahsCount: 0,
  });
  assert.equal(locked.length, 4);
  assert.equal(locked.every((c) => !c.earned), true);

  // User checked 1 memorized Juz (180 XP -> Level 2), so Juz activity is met,
  // but Juz certificate requires Level 3 (300 XP) -> MUST stay locked until Level 3!
  const juzActivityButLowLevel = evaluateCertificates({
    stats: sanitizeListenerStats({
      verifiedMemorizedJuzs: [30],
    }),
    memorizedAyahsCount: 0,
    completedSurahsCount: 0,
    historyCount: 0,
    completedKhatmahsCount: 0,
  });
  assert.equal(juzActivityButLowLevel[0].activityGoalMet, true);
  assert.equal(juzActivityButLowLevel[0].levelMet, false);
  assert.equal(juzActivityButLowLevel[0].requiredLevel, 3);
  assert.equal(juzActivityButLowLevel[0].currentLevel, 2);
  assert.equal(juzActivityButLowLevel[0].earned, false);

  const unlockedAll = evaluateCertificates({
    stats: sanitizeListenerStats({
      recipientName: 'أحمد محمد',
      totalListeningSeconds: 950,
      activeDays: ['2026-11-18', '2026-11-19', '2026-11-20'],
      listenedSurahKeys: ['a', 'b', 'c', 'd', 'e'],
      verifiedMemorizedJuzs: [30],
      activePagesRead: Array.from({ length: 20 }, (_, i) => i + 1),
      tahfeezSessionsCompleted: 5,
    }),
    memorizedAyahsCount: 50,
    completedSurahsCount: 2,
    historyCount: 5,
    completedKhatmahsCount: 1,
  });
  assert.equal(unlockedAll.length, 4);
  assert.equal(unlockedAll.every((c) => c.earned), true);
  assert.equal(unlockedAll[0].progressPercent, 100);
});
