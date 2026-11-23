import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAyahConnectionQuiz,
  buildEveryAyahUrl,
  buildTahfeezQuiz,
  calculateTahfeezStats,
  clampAyahRange,
  computeEchoDelayMs,
  computeStreakDays,
  evaluateVoiceRecitation,
  extractPageSurahRange,
  maskAyahWords,
} from './tahfeezHelpers';
import type { AyahItem } from '../types/tilawa';

test('buildEveryAyahUrl builds zero-padded 6-digit ayah URLs and rejects invalid bounds', () => {
  assert.equal(
    buildEveryAyahUrl('Husary_Muallim_128kbps', 1, 1),
    'https://everyayah.com/data/Husary_Muallim_128kbps/001001.mp3'
  );
  assert.equal(
    buildEveryAyahUrl('Minshawy_Murattal_128kbps', 2, 255),
    'https://everyayah.com/data/Minshawy_Murattal_128kbps/002255.mp3'
  );
  assert.equal(buildEveryAyahUrl('Husary_Muallim_128kbps', 0, 1), '');
  assert.equal(buildEveryAyahUrl('Husary_Muallim_128kbps', 115, 1), '');
  assert.equal(buildEveryAyahUrl('', 1, 1), '');
});

test('clampAyahRange keeps start and end within surah ayah bounds', () => {
  assert.deepEqual(clampAyahRange(0, 99, 7), { start: 1, end: 7 });
  assert.deepEqual(clampAyahRange(5, 3, 7), { start: 5, end: 5 });
  assert.deepEqual(clampAyahRange(2, 6, 7), { start: 2, end: 6 });
});

test('maskAyahWords applies full, first-two, keywords, and hidden modes accurately', () => {
  const sample = 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ';
  assert.equal(maskAyahWords(sample, 'full').every((t) => !t.masked), true);
  assert.equal(maskAyahWords(sample, 'hidden').every((t) => t.masked), true);

  const firstTwo = maskAyahWords(sample, 'first-two');
  assert.deepEqual(
    firstTwo.map((t) => t.masked),
    [false, false, true, true]
  );

  const keywords = maskAyahWords(sample, 'keywords', 2);
  assert.equal(keywords[0].masked, false); // cue word stays visible
  assert.equal(keywords.some((t) => t.masked), true);
});

test('computeEchoDelayMs handles off, fixed presets, and proportional auto delay', () => {
  assert.equal(computeEchoDelayMs('كلمة', 'off'), 0);
  assert.equal(computeEchoDelayMs('كلمة', '3s'), 3000);
  assert.equal(computeEchoDelayMs('كلمة', '5s'), 5000);

  const shortDelay = computeEchoDelayMs('بِسْمِ ٱللَّهِ', 'auto');
  const longText = Array.from({ length: 25 }, () => 'كلمة').join(' ');
  const longDelay = computeEchoDelayMs(longText, 'auto');
  assert.ok(shortDelay >= 2200 && shortDelay < longDelay);
  assert.equal(longDelay, 8500);
});

test('buildTahfeezQuiz creates 4-choice questions containing the exact missing word', () => {
  const ayahs: AyahItem[] = [
    {
      number: 1,
      numberInSurah: 1,
      text: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      surahNumber: 1,
      surahName: 'سُورَةُ ٱلْفَاتِحَةِ',
      juz: 1,
      page: 1,
    },
    {
      number: 2,
      numberInSurah: 2,
      text: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
      surahNumber: 1,
      surahName: 'سُورَةُ ٱلْفَاتِحَةِ',
      juz: 1,
      page: 1,
    },
  ];
  const quiz = buildTahfeezQuiz(ayahs, 5);
  assert.equal(quiz.length, 2);
  for (const q of quiz) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    assert.equal(q.options.includes(q.missingWord), true);
  }
});

test('calculateTahfeezStats counts unique memorized ayahs and completed surahs', () => {
  const stats = calculateTahfeezStats(
    {
      '1': [1, 2, 3, 4, 5, 6, 7, 7], // duplicate 7 should be deduplicated -> complete!
      '112': [1, 2], // partial
    },
    [
      { number: 1, numberOfAyahs: 7 },
      { number: 112, numberOfAyahs: 4 },
    ],
    6236
  );
  assert.equal(stats.memorizedAyahs, 9);
  assert.equal(stats.completedSurahs, 1);
  assert.equal(stats.percentage, 0.1);
});

test('buildAyahConnectionQuiz builds 4-option next-ayah questions and returns empty when < 2 ayahs', () => {
  const ayahs: AyahItem[] = [
    {
      number: 1,
      numberInSurah: 1,
      text: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      surahNumber: 1,
      surahName: 'سُورَةُ ٱلْفَاتِحَةِ',
      juz: 1,
      page: 1,
    },
    {
      number: 2,
      numberInSurah: 2,
      text: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
      surahNumber: 1,
      surahName: 'سُورَةُ ٱلْفَاتِحَةِ',
      juz: 1,
      page: 1,
    },
    {
      number: 3,
      numberInSurah: 3,
      text: 'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      surahNumber: 1,
      surahName: 'سُورَةُ ٱلْفَاتِحَةِ',
      juz: 1,
      page: 1,
    },
  ];
  assert.deepEqual(buildAyahConnectionQuiz([ayahs[0]], 3), []);

  const quiz = buildAyahConnectionQuiz(ayahs, 4);
  assert.equal(quiz.length, 2);
  assert.equal(quiz[0].promptAyahNumberInSurah, 1);
  assert.equal(quiz[0].nextAyahNumberInSurah, 2);
  for (const q of quiz) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    assert.equal(q.options.includes(q.nextAyahText), true);
  }
});

test('computeStreakDays computes consecutive streaks up to reference date or yesterday', () => {
  assert.equal(computeStreakDays([], '2026-11-22'), 0);
  assert.equal(
    computeStreakDays(['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-22'], '2026-11-22'),
    3
  );
  assert.equal(computeStreakDays(['2026-11-19', '2026-11-21'], '2026-11-22'), 1);
  assert.equal(computeStreakDays(['2026-11-15'], '2026-11-22'), 0);
});

test('evaluateVoiceRecitation compares spoken Arabic transcript accurately against Uthmani text', () => {
  const resExact = evaluateVoiceRecitation(
    'الحمد لله رب العالمين',
    'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ'
  );
  assert.equal(resExact.accuracy, 100);
  assert.equal(resExact.matchedWords, 4);

  const resPartial = evaluateVoiceRecitation(
    'الحمد لله العالمين',
    'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ'
  );
  assert.equal(resPartial.matchedWords, 3);
  assert.equal(resPartial.accuracy, 75);
});

test('extractPageSurahRange maps Mushaf page ayahs to surah and start/end ayah bounds', () => {
  const samplePage: AyahItem[] = [
    { number: 6222, numberInSurah: 1, text: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ', surahNumber: 112, surahName: 'الإخلاص', juz: 30, page: 604 },
    { number: 6225, numberInSurah: 4, text: 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ', surahNumber: 112, surahName: 'الإخلاص', juz: 30, page: 604 },
    { number: 6226, numberInSurah: 1, text: 'قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ', surahNumber: 113, surahName: 'الفلق', juz: 30, page: 604 },
  ];
  const mapped = extractPageSurahRange(samplePage);
  assert.equal(mapped?.surahNumber, 112);
  assert.equal(mapped?.startAyah, 1);
  assert.equal(mapped?.endAyah, 4);
  assert.equal(mapped?.surahSegments.length, 2);

  const mappedPref = extractPageSurahRange(samplePage, 113);
  assert.equal(mappedPref?.surahNumber, 113);
  assert.equal(mappedPref?.startAyah, 1);
  assert.equal(mappedPref?.endAyah, 1);
});


