import test from 'node:test';
import assert from 'node:assert/strict';
import { runLocalSearch } from './searchEngine';
import type { CuratedRecitation, Reciter, SurahMeta } from '../types/tilawa';

const sampleReciters: Reciter[] = [
  {
    id: 'minshawi',
    nameAr: 'الشيخ محمد صديق المنشاوي',
    nameEn: 'Muhammad Siddiq Al-Minshawi',
    titleAr: 'صوت الخشوع',
    bioAr: 'أحد أعظم قراء القرآن الكريم في مصر.',
    birthYear: '1920م',
    deathYear: '1969م',
    originAr: 'سوهاج',
    photoUrl: '/images/reciters/minshawi.jpg',
    photoSource: 'Wikimedia Commons',
    featured: true,
    collections: [
      {
        id: 'minshawi-murattal',
        style: 'مرتل',
        riwayah: 'حفص عن عاصم',
        server: 'https://cdn.mp3quran.net/audio/muhammad-minshawi/r1/',
        surahTotal: 114,
        sourceName: 'MP3Quran',
      },
    ],
  },
];

const sampleSurahs: SurahMeta[] = [
  {
    number: 18,
    name: 'سُورَةُ الكَهْفِ',
    englishName: 'Al-Kahf',
    englishNameTranslation: 'The Cave',
    numberOfAyahs: 110,
    revelationType: 'Meccan',
  },
  {
    number: 12,
    name: 'سُورَةُ يُوسُفَ',
    englishName: 'Yusuf',
    englishNameTranslation: 'Joseph',
    numberOfAyahs: 111,
    revelationType: 'Meccan',
  },
];

const sampleRecitations: CuratedRecitation[] = [
  {
    id: 'minshawi-18-murattal',
    reciterId: 'minshawi',
    surahNumber: 18,
    surahNameAr: 'الكهف',
    style: 'مرتل',
    audioUrl: 'https://cdn.mp3quran.net/audio/muhammad-minshawi/r1/018.mp3',
    isAvailable: true,
  },
];

test('runLocalSearch finds reciter regardless of diacritics', () => {
  const res = runLocalSearch('المنشاوى', sampleReciters, sampleSurahs, sampleRecitations);
  assert.equal(res.reciters.length, 1);
  assert.equal(res.reciters[0].id, 'minshawi');
});

test('runLocalSearch finds surah by Arabic name or number', () => {
  const resByName = runLocalSearch('الكهف', sampleReciters, sampleSurahs, sampleRecitations);
  assert.equal(resByName.surahs.length, 1);
  assert.equal(resByName.surahs[0].number, 18);

  const resByNum = runLocalSearch('12', sampleReciters, sampleSurahs, sampleRecitations);
  assert.equal(resByNum.surahs.length, 1);
  assert.equal(resByNum.surahs[0].number, 12);
});

test('runLocalSearch returns suggestions when query is empty', () => {
  const res = runLocalSearch('', sampleReciters, sampleSurahs, sampleRecitations);
  assert.ok(res.suggestions.length > 0);
  assert.equal(res.reciters.length, 0);
});
