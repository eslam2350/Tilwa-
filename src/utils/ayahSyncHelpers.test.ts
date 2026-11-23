import assert from 'node:assert/strict';
import test from 'node:test';
import type { AyahItem } from '../types/tilawa';
import {
  buildSurahAyahTimeline,
  computeAyahRecitationWeight,
  findActiveAyahSegmentIndex,
} from './ayahSyncHelpers.ts';

const SAMPLE_SURAH_2: AyahItem[] = [
  {
    number: 8,
    numberInSurah: 1,
    text: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ',
    surahNumber: 2,
    surahName: 'سُورَةُ البَقَرَةِ',
    juz: 1,
    page: 2,
  },
  {
    number: 9,
    numberInSurah: 2,
    text: 'ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ',
    surahNumber: 2,
    surahName: 'سُورَةُ البَقَرَةِ',
    juz: 1,
    page: 2,
  },
  {
    number: 10,
    numberInSurah: 3,
    text: 'ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَٰهُمْ يُنفِقُونَ',
    surahNumber: 2,
    surahName: 'سُورَةُ البَقَرَةِ',
    juz: 1,
    page: 2,
  },
];

test('computeAyahRecitationWeight gives longer verses higher weights while preserving minimum Madd floor', () => {
  const shortWeight = computeAyahRecitationWeight('الٓمٓ');
  const longWeight = computeAyahRecitationWeight(
    'ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَٰهُمْ يُنفِقُونَ'
  );
  assert.ok(shortWeight >= 18);
  assert.ok(longWeight > shortWeight);
});

test('buildSurahAyahTimeline creates contiguous non-overlapping segments covering [0, duration]', () => {
  const segments = buildSurahAyahTimeline(SAMPLE_SURAH_2, 2, 120);
  assert.equal(segments.length, 3);
  assert.equal(segments[0].startTime, 0);
  assert.equal(segments[2].endTime, 120);
  assert.equal(segments[0].cleanText, 'الٓمٓ');

  for (let i = 0; i < segments.length; i++) {
    assert.ok(segments[i].endTime > segments[i].startTime);
    if (i > 0) {
      assert.equal(segments[i].startTime, segments[i - 1].endTime);
    }
  }
});

test('findActiveAyahSegmentIndex maps playback timestamps accurately across segments and boundaries', () => {
  const segments = buildSurahAyahTimeline(SAMPLE_SURAH_2, 2, 100);
  assert.equal(findActiveAyahSegmentIndex([], 10), -1);
  assert.equal(findActiveAyahSegmentIndex(segments, 0), 0);
  assert.equal(findActiveAyahSegmentIndex(segments, segments[1].startTime + 0.5), 1);
  assert.equal(findActiveAyahSegmentIndex(segments, segments[2].startTime + 0.5), 2);
  assert.equal(findActiveAyahSegmentIndex(segments, 999), 2);
});

test('buildSurahAyahTimeline handles zero or unknown duration gracefully without NaN', () => {
  const segments = buildSurahAyahTimeline(SAMPLE_SURAH_2, 2, 0);
  assert.equal(segments.length, 3);
  assert.equal(findActiveAyahSegmentIndex(segments, 12), 0);
});
