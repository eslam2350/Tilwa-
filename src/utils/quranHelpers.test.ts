import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCollectionTracks,
  buildSurahAudioUrl,
  clampFontSize,
  cycleRepeatMode,
  formatHizbLabel,
  formatSurahDisplayName,
  formatTimeSeconds,
  getDefaultPlayableSurahNumber,
  getNextSurahNumber,
  isSurahAvailableInCollection,
  normalizeArabic,
  sanitizeFirestoreId,
  shuffleTracks,
  stripLeadingBismillah,
  toArabicDigits,
} from './quranHelpers';
import type { AudioTrack, Reciter } from '../types/tilawa';

test('normalizeArabic strips tashkeel and normalizes letters', () => {
  assert.equal(normalizeArabic('سُورَةُ الْفَاتِحَةِ'), 'سوره الفاتحه');
  assert.equal(normalizeArabic('أحمد إبراهيم'), 'احمد ابراهيم');
  assert.equal(normalizeArabic('مُحَمَّدٌ صِدِّيق المِنْشَاوِي'), 'محمد صديق المنشاوي');
});

test('formatTimeSeconds formats minutes and hours properly', () => {
  assert.equal(formatTimeSeconds(0), '00:00');
  assert.equal(formatTimeSeconds(65), '01:05');
  assert.equal(formatTimeSeconds(3661), '01:01:01');
  assert.equal(formatTimeSeconds(-5), '00:00');
});

test('toArabicDigits converts western numerals to Arabic-Indic', () => {
  assert.equal(toArabicDigits(1), '١');
  assert.equal(toArabicDigits(114), '١١٤');
  assert.equal(toArabicDigits(286), '٢٨٦');
});

test('buildSurahAudioUrl pads surah numbers to 3 digits', () => {
  assert.equal(
    buildSurahAudioUrl('https://cdn.mp3quran.net/audio/muhammad-minshawi/r1/', 1),
    'https://cdn.mp3quran.net/audio/muhammad-minshawi/r1/001.mp3'
  );
  assert.equal(
    buildSurahAudioUrl('https://cdn.mp3quran.net/audio/muhammad-minshawi/r1', 18),
    'https://cdn.mp3quran.net/audio/muhammad-minshawi/r1/018.mp3'
  );
  assert.equal(buildSurahAudioUrl('https://example.com', 115), '');
});

test('isSurahAvailableInCollection respects missingSurahs list', () => {
  const col = {
    id: 'minshawi-1967',
    style: 'حفل إذاعي' as const,
    riwayah: 'حفص عن عاصم',
    server: 'https://cdn.mp3quran.net/audio/muhammad-minshawi/r4/',
    surahTotal: 110,
    missingSurahs: [16, 23, 24, 35],
    sourceName: 'MP3Quran',
  };
  assert.equal(isSurahAvailableInCollection(col, 1), true);
  assert.equal(isSurahAvailableInCollection(col, 16), false);
  assert.equal(isSurahAvailableInCollection(col, 24), false);
  assert.equal(isSurahAvailableInCollection(col, 36), true);
});

test('clampFontSize bounds Mushaf text size safely', () => {
  assert.equal(clampFontSize(10), 18);
  assert.equal(clampFontSize(28), 28);
  assert.equal(clampFontSize(80), 46);
});

test('getNextSurahNumber wraps around 1..114 cleanly', () => {
  assert.equal(getNextSurahNumber(1, 'next'), 2);
  assert.equal(getNextSurahNumber(114, 'next'), 1);
  assert.equal(getNextSurahNumber(1, 'prev'), 114);
  assert.equal(getNextSurahNumber(18, 'prev'), 17);
});

test('sanitizeFirestoreId ensures valid Firestore path IDs', () => {
  assert.equal(sanitizeFirestoreId('minshawi:18/murattal'), 'minshawi_18_murattal');
  assert.match(sanitizeFirestoreId('test!@#$id'), /^[a-zA-Z0-9_-]+$/);
});

test('stripLeadingBismillah removes embedded Bismillah for surahs > 1 except Tawbah', () => {
  const raw = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ';
  assert.equal(stripLeadingBismillah(raw, 2, 1), 'الٓمٓ');
  assert.equal(stripLeadingBismillah('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', 1, 1), 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ');
});

test('cycleRepeatMode transitions off -> all -> one -> off', () => {
  assert.equal(cycleRepeatMode('off'), 'all');
  assert.equal(cycleRepeatMode('all'), 'one');
  assert.equal(cycleRepeatMode('one'), 'off');
});

test('shuffleTracks keeps anchor track first and excludes unavailable tracks', () => {
  const tracks: AudioTrack[] = [1, 2, 3, 4, 5].map((n) => ({
    id: `t_${n}`,
    reciterId: 'minshawi',
    reciterName: 'المنشاوي',
    reciterPhoto: '/images/reciters/minshawi.jpg',
    surahNumber: n,
    surahName: `سورة ${n}`,
    style: 'مرتل',
    audioUrl: n === 5 ? '' : `https://example.com/${n}.mp3`,
    isAvailable: n !== 5,
  }));
  const shuffled = shuffleTracks(tracks, 't_3');
  assert.equal(shuffled.length, 4);
  assert.equal(shuffled[0].id, 't_3');
  assert.equal(shuffled.some((t) => t.id === 't_5'), false);
});

test('buildCollectionTracks skips missingSurahs and generates valid MP3 URLs', () => {
  const reciter: Reciter = {
    id: 'minshawi',
    nameAr: 'المنشاوي',
    nameEn: 'Minshawi',
    titleAr: '',
    bioAr: '',
    birthYear: '',
    deathYear: '',
    originAr: '',
    photoUrl: '/images/reciters/minshawi.jpg',
    photoSource: '',
    featured: true,
    collections: [],
  };
  const col = {
    id: 'col1',
    style: 'حفل إذاعي' as const,
    riwayah: 'حفص',
    server: 'https://cdn.mp3quran.net/audio/muhammad-minshawi/r4/',
    surahTotal: 2,
    missingSurahs: [2],
    sourceName: 'MP3Quran',
  };
  const surahs = [
    { number: 1, name: 'الفاتحة', englishName: 'Al-Fatihah', englishNameTranslation: 'Opening', numberOfAyahs: 7, revelationType: 'Meccan' },
    { number: 2, name: 'البقرة', englishName: 'Al-Baqarah', englishNameTranslation: 'Cow', numberOfAyahs: 286, revelationType: 'Medinan' },
    { number: 3, name: 'آل عمران', englishName: 'Aal-Imran', englishNameTranslation: 'Family', numberOfAyahs: 200, revelationType: 'Medinan' },
  ];
  const built = buildCollectionTracks(reciter, col, surahs);
  assert.equal(built.length, 2);
  assert.equal(built[0].surahNumber, 1);
  assert.equal(built[1].surahNumber, 3);
  assert.equal(built[1].audioUrl, 'https://cdn.mp3quran.net/audio/muhammad-minshawi/r4/003.mp3');
});

test('getDefaultPlayableSurahNumber picks lowest available surah when Al-Fatihah is missing', () => {
  const reciter: Reciter = {
    id: 'shaban-sayyad',
    nameAr: 'شعبان الصياد',
    nameEn: 'Shaban Al-Sayyad',
    titleAr: '',
    bioAr: '',
    birthYear: '1940م',
    deathYear: '1998م',
    isDeceased: true,
    originAr: 'مصر',
    photoUrl: '/images/reciters/shaban-sayyad.jpg',
    photoSource: '',
    schoolAr: 'الشيوخ المصريون الراحلون',
    featured: true,
    collections: [
      {
        id: 'c1',
        style: 'مرتل',
        riwayah: 'حفص',
        server: 'https://cdn.mp3quran.net/audio/shaban-sayyad/r1/',
        surahTotal: 65,
        missingSurahs: [1, 8, 14],
        sourceName: 'MP3Quran',
      },
    ],
  };
  assert.equal(getDefaultPlayableSurahNumber(reciter), 2);
});

test('formatHizbLabel formats hizbQuarter 1..240 into Arabic Hizb & Rub labels', () => {
  assert.equal(formatHizbLabel(1), 'الحزب ١ · بداية الحزب');
  assert.equal(formatHizbLabel(2), 'الحزب ١ · ربع الحزب');
  assert.equal(formatHizbLabel(5), 'الحزب ٢ · بداية الحزب');
  assert.equal(formatHizbLabel(240), 'الحزب ٦٠ · ثلاثة أرباع الحزب');
  assert.equal(formatHizbLabel(undefined), '');
});

test('formatSurahDisplayName cleans Uthmani marks into clear Arabic surah names', () => {
  assert.equal(formatSurahDisplayName('سُورَةُ ٱلْفَاتِحَةِ'), 'سورة الفاتحة');
  assert.equal(formatSurahDisplayName('سُورَةُ آلِ عِمۡرَانَ'), 'سورة آل عمران');
  assert.equal(formatSurahDisplayName('سُورَةُ المَائـِدَةِ'), 'سورة المائدة');
  assert.equal(formatSurahDisplayName('سُورَةُ سَبَإٍ'), 'سورة سبأ');
  assert.equal(formatSurahDisplayName('سُورَةُ النَّبَإِ'), 'سورة النبأ');
});

