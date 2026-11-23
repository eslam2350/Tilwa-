import type { AyahItem } from '../types/tilawa';
import { normalizeArabic } from './quranHelpers';

export interface TeacherReciterOption {
  id: string;
  nameAr: string;
  subtitleAr: string;
  everyAyahFolder: string;
}

export const TEACHER_RECITERS: TeacherReciterOption[] = [
  {
    id: 'husary-muallim',
    nameAr: 'الشيخ محمود خليل الحصري',
    subtitleAr: 'المصحف المعلم للتحفيظ (مع مهلة ترديد)',
    everyAyahFolder: 'Husary_Muallim_128kbps',
  },
  {
    id: 'minshawi-murattal',
    nameAr: 'الشيخ محمد صديق المنشاوي',
    subtitleAr: 'مرتل متقن — وضوح المخارج والأحكام',
    everyAyahFolder: 'Minshawy_Murattal_128kbps',
  },
  {
    id: 'husary-murattal',
    nameAr: 'الشيخ محمود خليل الحصري (مرتل)',
    subtitleAr: 'أداء تعليمي رصين للمراجعة والتثبيت',
    everyAyahFolder: 'Husary_128kbps',
  },
  {
    id: 'abdulbasit-murattal',
    nameAr: 'الشيخ عبد الباسط عبد الصمد',
    subtitleAr: 'مرتل — نفس طويل وترتيل خاشع',
    everyAyahFolder: 'Abdul_Basit_Murattal_192kbps',
  },
  {
    id: 'alafasy-murattal',
    nameAr: 'الشيخ مشاري راشد العفاسي',
    subtitleAr: 'مرتل — صوت نقي للحفظ والمراجعة',
    everyAyahFolder: 'Alafasy_128kbps',
  },
  {
    id: 'muaiqly-murattal',
    nameAr: 'الشيخ ماهر المعيقلي',
    subtitleAr: 'إمام المسجد الحرام — ترتيل متوازن',
    everyAyahFolder: 'MaherAlMuaiqly128kbps',
  },
  {
    id: 'shuraym-murattal',
    nameAr: 'الشيخ سعود الشريم',
    subtitleAr: 'تلاوة حدر متزنة لمراجعة المحفوظ',
    everyAyahFolder: 'Saood_ash-Shuraym_128kbps',
  },
];

export type VisualMaskMode = 'full' | 'first-two' | 'keywords' | 'hidden';
export type EchoPauseMode = 'off' | 'auto' | '3s' | '5s';

export interface MaskedWordToken {
  word: string;
  masked: boolean;
  index: number;
}

export interface TahfeezQuizQuestion {
  ayahNumber: number;
  ayahNumberInSurah: number;
  beforeWords: string[];
  afterWords: string[];
  missingWord: string;
  options: string[];
}

export interface TahfeezConnectionQuestion {
  ayahNumber: number;
  promptAyahNumberInSurah: number;
  promptText: string;
  nextAyahNumberInSurah: number;
  nextAyahText: string;
  options: string[];
}

export type TahfeezProgressMap = Record<string, number[]>; // key: String(surahNumber), value: array of memorized ayah numbers

export interface TahfeezStateSnapshot {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
  teacherId: string;
  ayahRepeat: number;
  rangeRepeat: number;
  echoPause: EchoPauseMode;
  playbackRate: number;
  progress: TahfeezProgressMap;
}

/**
 * Builds an EveryAyah MP3 URL for a single ayah (e.g. 001001.mp3, 002255.mp3).
 */
export function buildEveryAyahUrl(
  folder: string,
  surahNumber: number,
  ayahInSurah: number
): string {
  if (!folder || surahNumber < 1 || surahNumber > 114 || ayahInSurah < 1) {
    return '';
  }
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  const s = String(surahNumber).padStart(3, '0');
  const a = String(ayahInSurah).padStart(3, '0');
  return `https://everyayah.com/data/${cleanFolder}/${s}${a}.mp3`;
}

/**
 * Ensures [start, end] stays strictly inside [1, totalAyahs] and start <= end.
 */
export function clampAyahRange(
  start: number,
  end: number,
  totalAyahs: number
): { start: number; end: number } {
  const safeTotal = Math.max(1, Math.floor(totalAyahs));
  const rawStart = Number.isFinite(start) ? Math.floor(start) : 1;
  const rawEnd = Number.isFinite(end) ? Math.floor(end) : safeTotal;
  const s = Math.min(safeTotal, Math.max(1, rawStart));
  const e = Math.min(safeTotal, Math.max(s, rawEnd));
  return { start: s, end: e };
}

/**
 * Splits clean ayah text into non-empty Uthmani words (filtering standalone pause marks if isolated).
 */
export function splitAyahWords(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Produces word-level masking tokens for active recall memorization.
 */
export function maskAyahWords(
  text: string,
  mode: VisualMaskMode,
  ayahNumberInSurah = 1
): MaskedWordToken[] {
  const words = splitAyahWords(text);
  return words.map((word, idx) => {
    if (mode === 'full') {
      return { word, masked: false, index: idx };
    }
    if (mode === 'hidden') {
      return { word, masked: true, index: idx };
    }
    if (mode === 'first-two') {
      const keepCount = words.length <= 2 ? 1 : 2;
      return { word, masked: idx >= keepCount, index: idx };
    }
    // 'keywords': hide roughly every 2nd/3rd content word deterministically while keeping first word as cue
    if (idx === 0) {
      return { word, masked: false, index: idx };
    }
    const shouldMask = (idx + ayahNumberInSurah) % 2 === 1;
    return { word, masked: shouldMask, index: idx };
  });
}

/**
 * Computes how long the teacher waits for the student to repeat after finishing an ayah.
 */
export function computeEchoDelayMs(ayahText: string, mode: EchoPauseMode): number {
  if (mode === 'off') return 0;
  if (mode === '3s') return 3000;
  if (mode === '5s') return 5000;
  const wordsCount = splitAyahWords(ayahText).length;
  // ~450ms per word + 1200ms breath margin, clamped nicely between 2.2s and 8.5s
  return Math.min(8500, Math.max(2200, Math.round(wordsCount * 450 + 1200)));
}

/**
 * Builds deterministic interactive "Complete the Ayah" quiz items from a list of ayahs.
 */
export function buildTahfeezQuiz(
  ayahs: AyahItem[],
  maxQuestions = 5,
  stripPrefixFn?: (text: string, surahNumber: number, ayahInSurah: number) => string
): TahfeezQuizQuestion[] {
  const poolWords: string[] = [];
  const prepared = ayahs.map((a) => {
    const clean = stripPrefixFn
      ? stripPrefixFn(a.text, a.surahNumber, a.numberInSurah)
      : a.text;
    const words = splitAyahWords(clean);
    for (const w of words) {
      if (w.length >= 2 && !poolWords.includes(w)) {
        poolWords.push(w);
      }
    }
    return { ayah: a, words };
  });

  const fallbackDistractors = [
    'ٱلْعَٰلَمِينَ',
    'ٱلرَّحِيمِ',
    'ٱلْمُؤْمِنِينَ',
    'ٱلْحَكِيمُ',
    'ٱلسَّمَٰوَٰتِ',
    'ٱلْأَرْضِ',
    'تَعْلَمُونَ',
    'مُبِينٌ',
  ];

  const questions: TahfeezQuizQuestion[] = [];
  for (const item of prepared) {
    if (questions.length >= maxQuestions) break;
    if (item.words.length < 2) continue;

    // Pick a deterministic pivot word past the first word
    const targetIdx =
      item.words.length <= 3
        ? item.words.length - 1
        : Math.max(1, (item.ayah.numberInSurah % (item.words.length - 1)) || 1);
    const missingWord = item.words[targetIdx];

    const distractors: string[] = [];
    const candidatePool = [...poolWords, ...fallbackDistractors];
    for (let offset = 0; offset < candidatePool.length && distractors.length < 3; offset++) {
      const candidate =
        candidatePool[(offset + item.ayah.numberInSurah * 3 + targetIdx) % candidatePool.length];
      if (candidate !== missingWord && !distractors.includes(candidate)) {
        distractors.push(candidate);
      }
    }

    if (distractors.length < 3) continue;

    // Deterministic option placement so tests & UX stay consistent
    const options = [...distractors];
    const insertPos = (item.ayah.numberInSurah + targetIdx) % 4;
    options.splice(insertPos, 0, missingWord);

    questions.push({
      ayahNumber: item.ayah.number,
      ayahNumberInSurah: item.ayah.numberInSurah,
      beforeWords: item.words.slice(0, targetIdx),
      afterWords: item.words.slice(targetIdx + 1),
      missingWord,
      options,
    });
  }

  return questions;
}

/**
 * Builds "What comes next?" Ayah Connection questions from consecutive ayahs.
 */
export function buildAyahConnectionQuiz(
  ayahs: AyahItem[],
  maxQuestions = 5,
  stripPrefixFn?: (text: string, surahNumber: number, ayahInSurah: number) => string
): TahfeezConnectionQuestion[] {
  if (ayahs.length < 2) return [];
  const cleanTexts = ayahs.map((a) => ({
    ayah: a,
    text: (stripPrefixFn
      ? stripPrefixFn(a.text, a.surahNumber, a.numberInSurah)
      : a.text
    ).trim(),
  }));

  const fallbackNextVerses = [
    'ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ',
    'ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ',
    'وَبَشِّرِ ٱلَّذِينَ ءَامَنُوا۟ وَعَمِلُوا۟ ٱلصَّٰلِحَٰتِ',
    'إِنَّا أَعْطَيْنَٰكَ ٱلْكَوْثَرَ',
    'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
  ];

  const questions: TahfeezConnectionQuestion[] = [];
  for (let i = 0; i < cleanTexts.length - 1 && questions.length < maxQuestions; i++) {
    const promptItem = cleanTexts[i];
    const nextItem = cleanTexts[i + 1];
    if (!promptItem.text || !nextItem.text) continue;

    const pool = [
      ...cleanTexts
        .filter((_, idx) => idx !== i + 1)
        .map((c) => c.text)
        .filter(Boolean),
      ...fallbackNextVerses,
    ];

    const distractors: string[] = [];
    for (let offset = 0; offset < pool.length && distractors.length < 3; offset++) {
      const candidate = pool[(offset + i * 2 + 1) % pool.length];
      if (candidate !== nextItem.text && !distractors.includes(candidate)) {
        distractors.push(candidate);
      }
    }
    if (distractors.length < 3) continue;

    const options = [...distractors];
    const insertPos = (promptItem.ayah.numberInSurah + i) % 4;
    options.splice(insertPos, 0, nextItem.text);

    questions.push({
      ayahNumber: promptItem.ayah.number,
      promptAyahNumberInSurah: promptItem.ayah.numberInSurah,
      promptText: promptItem.text,
      nextAyahNumberInSurah: nextItem.ayah.numberInSurah,
      nextAyahText: nextItem.text,
      options,
    });
  }

  return questions;
}

/**
 * Computes current consecutive-day activity streak ending today (or yesterday).
 */
export function computeStreakDays(activeDays: string[], referenceIso?: string): number {
  const uniqueSet = new Set(activeDays.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)));
  if (uniqueSet.size === 0) return 0;

  const refDateStr = referenceIso || new Date().toISOString().slice(0, 10);
  const stepDay = (iso: string, deltaDays: number): string => {
    const dt = new Date(`${iso}T12:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + deltaDays);
    return dt.toISOString().slice(0, 10);
  };

  let cursor = refDateStr;
  if (!uniqueSet.has(cursor)) {
    const yesterday = stepDay(refDateStr, -1);
    if (!uniqueSet.has(yesterday)) return 0;
    cursor = yesterday;
  }

  let streak = 0;
  while (uniqueSet.has(cursor)) {
    streak += 1;
    cursor = stepDay(cursor, -1);
  }
  return streak;
}

/**
 * Calculates total memorized ayahs and completed surahs from saved progress map.
 */
export function calculateTahfeezStats(
  progress: TahfeezProgressMap,
  surahCounts: Array<{ number: number; numberOfAyahs: number }>,
  totalQuranAyahs = 6236
): { memorizedAyahs: number; completedSurahs: number; percentage: number } {
  let memorizedAyahs = 0;
  let completedSurahs = 0;

  for (const s of surahCounts) {
    const list = progress[String(s.number)] || [];
    const uniqueValid = new Set(list.filter((n) => n >= 1 && n <= s.numberOfAyahs));
    memorizedAyahs += uniqueValid.size;
    if (s.numberOfAyahs > 0 && uniqueValid.size >= s.numberOfAyahs) {
      completedSurahs += 1;
    }
  }

  const percentage =
    totalQuranAyahs > 0 ? Math.min(100, Math.round((memorizedAyahs / totalQuranAyahs) * 1000) / 10) : 0;

  return { memorizedAyahs, completedSurahs, percentage };
}

function stripNonArabicLetters(word: string): string {
  return normalizeArabic(word).replace(/[^ا-ي]/g, '');
}

function editDistanceBounded(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }
  return dp[b.length];
}

function wordsRoughlyMatch(spokenNorm: string, targetNorm: string): boolean {
  if (!spokenNorm || !targetNorm) return false;
  if (spokenNorm === targetNorm) return true;
  // Handle Uthmani superscript Alef omission (e.g. الرحمن vs الرحمان, العالمين vs العلمين)
  const spNoAlif = spokenNorm.replace(/ا/g, '');
  const tgNoAlif = targetNorm.replace(/ا/g, '');
  if (spNoAlif && spNoAlif === tgNoAlif) return true;
  if (targetNorm.length >= 4 && spokenNorm.length >= 4) {
    const dist = editDistanceBounded(spokenNorm, targetNorm);
    const maxDist = targetNorm.length >= 7 ? 2 : 1;
    return dist <= maxDist;
  }
  return false;
}

export interface VoiceRecitationEvaluation {
  accuracy: number;
  matchedWords: number;
  totalWords: number;
  wordResults: Array<{ word: string; matched: boolean }>;
}

/**
 * Evaluates spoken Arabic recitation transcript against target Uthmani ayah text,
 * accounting for Uthmani orthography vs standard Arabic SpeechRecognition output.
 */
export function evaluateVoiceRecitation(
  spokenArabic: string,
  targetAyahText: string
): VoiceRecitationEvaluation {
  const targetTokens = splitAyahWords(targetAyahText);
  const spokenNorms = splitAyahWords(spokenArabic)
    .map(stripNonArabicLetters)
    .filter(Boolean);

  if (targetTokens.length === 0) {
    return { accuracy: 0, matchedWords: 0, totalWords: 0, wordResults: [] };
  }

  let spokenCursor = 0;
  let matchedWords = 0;
  const wordResults = targetTokens.map((rawWord) => {
    const targetNorm = stripNonArabicLetters(rawWord);
    if (!targetNorm) {
      return { word: rawWord, matched: true };
    }
    const lookaheadLimit = Math.min(spokenNorms.length, spokenCursor + 4);
    for (let j = spokenCursor; j < lookaheadLimit; j++) {
      if (wordsRoughlyMatch(spokenNorms[j], targetNorm)) {
        spokenCursor = j + 1;
        matchedWords += 1;
        return { word: rawWord, matched: true };
      }
    }
    return { word: rawWord, matched: false };
  });

  const countableWords = targetTokens.filter((w) => stripNonArabicLetters(w).length > 0).length;
  const denom = Math.max(1, countableWords);
  const accuracy = Math.min(100, Math.round((matchedWords / denom) * 100));

  return {
    accuracy,
    matchedWords,
    totalWords: countableWords,
    wordResults,
  };
}

export interface PageSurahRangeResult {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
  surahSegments: Array<{ surahNumber: number; startAyah: number; endAyah: number }>;
}

/**
 * Computes surah and ayah boundaries contained inside a Madinah Mushaf page (1..604).
 */
export function extractPageSurahRange(
  pageAyahs: AyahItem[],
  preferredSurahNumber?: number
): PageSurahRangeResult | null {
  if (!pageAyahs || pageAyahs.length === 0) return null;
  const bySurah = new Map<number, { startAyah: number; endAyah: number; count: number }>();
  for (const a of pageAyahs) {
    const existing = bySurah.get(a.surahNumber);
    if (!existing) {
      bySurah.set(a.surahNumber, {
        startAyah: a.numberInSurah,
        endAyah: a.numberInSurah,
        count: 1,
      });
    } else {
      existing.startAyah = Math.min(existing.startAyah, a.numberInSurah);
      existing.endAyah = Math.max(existing.endAyah, a.numberInSurah);
      existing.count += 1;
    }
  }
  const segments = Array.from(bySurah.entries()).map(([surahNumber, bounds]) => ({
    surahNumber,
    startAyah: bounds.startAyah,
    endAyah: bounds.endAyah,
  }));
  const picked =
    (preferredSurahNumber && segments.find((s) => s.surahNumber === preferredSurahNumber)) ||
    segments[0];
  return {
    surahNumber: picked.surahNumber,
    startAyah: picked.startAyah,
    endAyah: picked.endAyah,
    surahSegments: segments,
  };
}

export interface MushafBookmarkItem {
  id: string;
  label: string;
  surahNumber: number;
  surahName: string;
  page: number;
  ayahInSurah: number;
  createdAt: string;
}

export const MUSHAF_BOOKMARKS_STORAGE_KEY = 'tilawa_mushaf_bookmarks_v1';

export function loadMushafBookmarks(): MushafBookmarkItem[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(MUSHAF_BOOKMARKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 30) : [];
  } catch {
    return [];
  }
}

export function saveMushafBookmark(
  entry: Omit<MushafBookmarkItem, 'id' | 'createdAt'>
): MushafBookmarkItem[] {
  const current = loadMushafBookmarks();
  const deduped = current.filter(
    (b) => !(b.page === entry.page && b.surahNumber === entry.surahNumber && b.ayahInSurah === entry.ayahInSurah)
  );
  const next: MushafBookmarkItem[] = [
    {
      ...entry,
      id: `bm_${entry.surahNumber}_${entry.ayahInSurah}_${Date.now()}`,
      createdAt: new Date().toISOString(),
    },
    ...deduped,
  ].slice(0, 20);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MUSHAF_BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore quota
  }
  return next;
}

export function deleteMushafBookmark(id: string): MushafBookmarkItem[] {
  const next = loadMushafBookmarks().filter((b) => b.id !== id);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MUSHAF_BOOKMARKS_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore quota
  }
  return next;
}

