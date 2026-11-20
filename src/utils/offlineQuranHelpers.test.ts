import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOfflineQuranIndex,
  searchOfflineQuran,
  type CompactUthmaniRecord,
} from './offlineQuranHelpers';

const sampleRecords: CompactUthmaniRecord[] = [
  {
    n: 1,
    i: 1,
    s: 1,
    sn: 'سُورَةُ ٱلْفَاتِحَةِ',
    t: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    j: 1,
    p: 1,
    h: 1,
    sj: false,
  },
  {
    n: 2,
    i: 2,
    s: 1,
    sn: 'سُورَةُ ٱلْفَاتِحَةِ',
    t: 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
    j: 1,
    p: 1,
    h: 1,
    sj: false,
  },
  {
    n: 2828,
    i: 35,
    s: 24,
    sn: 'سُورَةُ النُّورِ',
    t: 'ٱللَّهُ نُورُ ٱلسَّمَٰوَٰتِ وَٱلْأَرْضِ',
    j: 18,
    p: 354,
    h: 141,
    sj: false,
  },
  {
    n: 10,
    i: 3,
    s: 2,
    sn: 'سُورَةُ البَقَرَةِ',
    t: 'وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَٰهُمْ يُنفِقُونَ',
    j: 1,
    p: 2,
    h: 1,
    sj: false,
  },
];

test('buildOfflineQuranIndex indexes ayahs by surah, page, and juz', () => {
  const index = buildOfflineQuranIndex(sampleRecords);
  assert.equal(index.bySurah.get(1)?.length, 2);
  assert.equal(index.byPage.get(354)?.length, 1);
  assert.equal(index.byJuz.get(18)?.[0]?.surahNumber, 24);
});

test('searchOfflineQuran matches verses without requiring diacritics', () => {
  const index = buildOfflineQuranIndex(sampleRecords);
  const res = searchOfflineQuran(index, 'الله نور السماوات');
  assert.equal(res.length, 1);
  assert.equal(res[0].surahNumber, 24);
  assert.equal(res[0].numberInSurah, 35);

  const prayerRes = searchOfflineQuran(index, 'يقيمون الصلاة');
  assert.equal(prayerRes.length, 1);
  assert.equal(prayerRes[0].surahNumber, 2);
});
