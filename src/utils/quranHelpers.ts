import type { AudioTrack, RecitationCollection, Reciter, RepeatMode, SurahMeta } from '../types/tilawa';

const ARABIC_DIACRITICS_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

/**
 * Normalizes Arabic text for accent-insensitive search (removes tashkeel, tatweel, and unifies alef/taa/yaa).
 */
export function normalizeArabic(input: string): string {
  if (!input) return '';
  return input
    .replace(ARABIC_DIACRITICS_RE, '')
    .replace(/\u0640/g, '') // tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .trim()
    .toLowerCase();
}

/**
 * Formats seconds into MM:SS or HH:MM:SS.
 */
export function formatTimeSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00';
  const rounded = Math.floor(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Converts Western digits to Eastern Arabic-Indic numerals for Mushaf ayah markers.
 */
export function toArabicDigits(num: number): string {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num)
    .split('')
    .map((ch) => {
      const idx = Number(ch);
      return Number.isInteger(idx) && ch >= '0' && ch <= '9' ? digits[idx] : ch;
    })
    .join('');
}

const BLOCKED_RECITER_KEYWORDS_AR = [
  'عمر بن ضياء',
  'عمر ضياء الدين',
  'بن ضياء الدين',
  'ضياء الدين',
];

const BLOCKED_RECITER_KEYWORDS_EN = [
  'omar-diaa',
  'omar diaa',
  'omar bin diaa',
  'diaa eldin',
  'diaa aldin',
  'diyaa',
];

/**
 * Globally excludes removed/blocked reciters from appearing anywhere in the app,
 * including localStorage history/favorites, cached PWA bundles, or uncleaned Firestore docs.
 */
export function isBlockedReciter(
  input: { id?: string; nameAr?: string; nameEn?: string; titleAr?: string } | string | null | undefined
): boolean {
  if (!input) return false;
  if (typeof input === 'string') {
    const normAr = normalizeArabic(input);
    const lower = input.toLowerCase();
    return (
      BLOCKED_RECITER_KEYWORDS_AR.some((k) => normAr.includes(normalizeArabic(k))) ||
      BLOCKED_RECITER_KEYWORDS_EN.some((k) => lower.includes(k))
    );
  }
  const combinedAr = normalizeArabic(`${input.nameAr || ''} ${input.titleAr || ''}`);
  const combinedEn = `${input.id || ''} ${input.nameEn || ''}`.toLowerCase();
  return (
    BLOCKED_RECITER_KEYWORDS_AR.some((k) => combinedAr.includes(normalizeArabic(k))) ||
    BLOCKED_RECITER_KEYWORDS_EN.some((k) => combinedEn.includes(k))
  );
}

/**
 * Builds the canonical MP3 URL for a surah from a base server URL or custom per-surah URL map.
 */
export function buildSurahAudioUrl(
  serverBase: string,
  surahNumber: number,
  surahUrls?: Record<number, string>
): string {
  if (surahNumber < 1 || surahNumber > 114) return '';
  const custom = surahUrls?.[surahNumber];
  if (custom) return custom;
  if (!serverBase) return '';
  const cleanBase = serverBase.endsWith('/') ? serverBase : `${serverBase}/`;
  const padded = String(surahNumber).padStart(3, '0');
  return `${cleanBase}${padded}.mp3`;
}

/**
 * Checks if a specific surah is genuinely available in a recitation collection.
 */
export function isSurahAvailableInCollection(
  collection: RecitationCollection,
  surahNumber: number
): boolean {
  if (surahNumber < 1 || surahNumber > 114) return false;
  if (collection.missingSurahs && collection.missingSurahs.includes(surahNumber)) {
    return false;
  }
  if (collection.surahUrls) {
    return Boolean(collection.surahUrls[surahNumber]);
  }
  if (!collection.server) return false;
  return true;
}

/**
 * Clamps Mushaf font size within safe readable limits [18, 46].
 */
export function clampFontSize(size: number): number {
  if (!Number.isFinite(size)) return 28;
  return Math.min(46, Math.max(18, Math.round(size)));
}

/**
 * Returns the next or previous Surah number within 1..114.
 */
export function getNextSurahNumber(current: number, direction: 'next' | 'prev'): number {
  if (direction === 'next') {
    return current >= 114 ? 1 : current + 1;
  }
  return current <= 1 ? 114 : current - 1;
}

/**
 * Produces a Firestore-safe document ID matching ^[a-zA-Z0-9_-]+$ with length <= 120.
 */
export function sanitizeFirestoreId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
  const bounded = cleaned.slice(0, 120);
  return bounded.length >= 2 ? bounded : `id_${Date.now()}`;
}

/**
 * Strips Bismillah prefix when rendering surahs other than Al-Fatihah (1) and At-Tawbah (9),
 * since AlQuran.cloud Uthmani embeds Bismillah at the start of ayah 1 for surahs 2..114.
 */
export function stripLeadingBismillah(ayahText: string, surahNumber: number, ayahInSurah: number): string {
  if (surahNumber === 1 || surahNumber === 9 || ayahInSurah !== 1) {
    return ayahText;
  }
  const bismillahVariants = [
    'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ',
    'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ',
    'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  ];
  let trimmed = ayahText.replace(/^\uFEFF/, '');
  for (const variant of bismillahVariants) {
    if (trimmed.startsWith(variant)) {
      return trimmed.slice(variant.length).trimStart();
    }
  }
  return trimmed;
}

/**
 * Fisher-Yates shuffle returning a new AudioTrack list.
 * If anchorTrackId is supplied and present, keeps that track first so playback flows uninterrupted.
 */
export function shuffleTracks(tracks: AudioTrack[], anchorTrackId?: string): AudioTrack[] {
  const available = tracks.filter((t) => t.isAvailable && Boolean(t.audioUrl));
  if (available.length <= 1) return [...available];

  let anchor: AudioTrack | undefined;
  const pool: AudioTrack[] = [];
  for (const t of available) {
    if (anchorTrackId && t.id === anchorTrackId && !anchor) {
      anchor = t;
    } else {
      pool.push(t);
    }
  }

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return anchor ? [anchor, ...pool] : pool;
}

/**
 * Cycles repeat mode: off -> all -> one -> off.
 */
export function cycleRepeatMode(mode: RepeatMode): RepeatMode {
  if (mode === 'off') return 'all';
  if (mode === 'all') return 'one';
  return 'off';
}

/**
 * Builds playable AudioTrack list for all available surahs in a reciter's collection.
 */
export function buildCollectionTracks(
  reciter: Reciter,
  collection: RecitationCollection,
  surahs: SurahMeta[]
): AudioTrack[] {
  return surahs
    .filter((s) => isSurahAvailableInCollection(collection, s.number))
    .map((s) => ({
      id: `${reciter.id}_${collection.id}_${s.number}`,
      reciterId: reciter.id,
      reciterName: reciter.nameAr,
      reciterPhoto: reciter.photoUrl,
      surahNumber: s.number,
      surahName: formatSurahDisplayName(s.name),
      style: collection.style,
      riwayah: collection.riwayah,
      audioUrl: buildSurahAudioUrl(collection.server, s.number, collection.surahUrls),
      isAvailable: true,
      sourceName: collection.sourceName,
    }));
}

/**
 * Returns Surah 1 if available in any of the reciter's collections,
 * otherwise returns the lowest available surah number (handles partial archives like Shaban Al-Sayyad).
 */
export function getDefaultPlayableSurahNumber(reciter: Reciter): number {
  if (!reciter.collections || reciter.collections.length === 0) return 1;
  if (reciter.collections.some((c) => isSurahAvailableInCollection(c, 1))) return 1;
  for (let s = 2; s <= 114; s++) {
    if (reciter.collections.some((c) => isSurahAvailableInCollection(c, s))) {
      return s;
    }
  }
  return 1;
}

/**
 * Converts AlQuran.cloud hizbQuarter (1..240) into Arabic Hizb & Rub' label.
 */
export function formatHizbLabel(hizbQuarter?: number): string {
  if (!hizbQuarter || hizbQuarter < 1 || hizbQuarter > 240) return '';
  const hizbNumber = Math.ceil(hizbQuarter / 4);
  const rubIndex = ((hizbQuarter - 1) % 4) + 1;
  const rubLabels = ['بداية الحزب', 'ربع الحزب', 'نصف الحزب', 'ثلاثة أرباع الحزب'];
  return `الحزب ${toArabicDigits(hizbNumber)} · ${rubLabels[rubIndex - 1]}`;
}

/**
 * Formats Uthmani Surah metadata names (e.g. "سُورَةُ آلِ عِمۡرَانَ", "سُورَةُ المَائـِدَةِ")
 * into crisp, readable standard Arabic Surah names for UI lists and dropdowns.
 */
export function formatSurahDisplayName(rawName: string): string {
  if (!rawName) return '';
  return rawName
    .replace(/\u0627\u0653/g, 'آ')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/ٱ/g, 'ا')
    .replace(/سبإ/g, 'سبأ')
    .replace(/النبإ/g, 'النبأ')
    .replace(/\s+/g, ' ')
    .trim();
}
