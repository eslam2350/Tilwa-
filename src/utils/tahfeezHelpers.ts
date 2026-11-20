import type { AyahItem } from '../types/tilawa';

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
