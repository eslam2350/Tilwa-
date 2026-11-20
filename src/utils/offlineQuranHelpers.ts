import type { AyahItem } from '../types/tilawa';
import { normalizeArabic } from './quranHelpers';

export interface CompactUthmaniRecord {
  n: number;
  i: number;
  s: number;
  sn: string;
  t: string;
  j: number;
  p: number;
  h?: number;
  sj?: boolean | { id: number; recommended: boolean; obligatory: boolean };
}

export interface OfflineSearchResult {
  number: number;
  numberInSurah: number;
  text: string;
  surahNumber: number;
  surahName: string;
}

export interface IndexedAyah extends AyahItem {
  norm: string;
  normImla: string;
}

export interface OfflineQuranIndex {
  all: IndexedAyah[];
  bySurah: Map<number, AyahItem[]>;
  byPage: Map<number, AyahItem[]>;
  byJuz: Map<number, AyahItem[]>;
}

/**
 * Maps Uthmani superscript dagger-alif / waw-alif forms (e.g. كِتَٰب، سَمَٰوَٰت، صَلَوٰة)
 * to standard modern Imla'i Arabic so offline keyboard queries match naturally.
 */
export function normalizeUthmaniAsImla(input: string): string {
  if (!input) return '';
  const converted = input
    .replace(/\u0670/g, 'ا') // superscript alif ٰ -> ا (سمٰوٰت -> سماوات, كتٰب -> كتاب)
    .replace(/([لزيغ])[\u064B-\u065F]*و[\u064B-\u065F]*ا(?=[ةت])/g, '$1ا'); // صلوٰة -> صلاة، زكوٰة -> زكاة
  return normalizeArabic(converted);
}

/**
 * Builds O(1) indexed maps for all 114 surahs, 604 pages, 30 juzs, and accent-insensitive verse search.
 */
export function buildOfflineQuranIndex(records: CompactUthmaniRecord[]): OfflineQuranIndex {
  const all: IndexedAyah[] = [];
  const bySurah = new Map<number, AyahItem[]>();
  const byPage = new Map<number, AyahItem[]>();
  const byJuz = new Map<number, AyahItem[]>();

  for (const r of records) {
    const item: AyahItem = {
      number: r.n,
      numberInSurah: r.i,
      text: r.t,
      surahNumber: r.s,
      surahName: r.sn,
      juz: r.j,
      page: r.p,
      hizbQuarter: r.h,
      sajda: r.sj,
    };

    const sList = bySurah.get(r.s);
    if (sList) sList.push(item);
    else bySurah.set(r.s, [item]);

    const pList = byPage.get(r.p);
    if (pList) pList.push(item);
    else byPage.set(r.p, [item]);

    const jList = byJuz.get(r.j);
    if (jList) jList.push(item);
    else byJuz.set(r.j, [item]);

    all.push({
      ...item,
      norm: normalizeArabic(r.t),
      normImla: normalizeUthmaniAsImla(r.t),
    });
  }

  return { all, bySurah, byPage, byJuz };
}

/**
 * Searches all verses locally using both Uthmani-stripped and Imla'i-mapped normalization.
 */
export function searchOfflineQuran(
  index: OfflineQuranIndex,
  rawQuery: string,
  limit = 25
): OfflineSearchResult[] {
  const q = normalizeArabic(rawQuery);
  const qImla = normalizeUthmaniAsImla(rawQuery);
  if (q.length < 2) return [];

  const matches: OfflineSearchResult[] = [];
  for (const ayah of index.all) {
    if (ayah.norm.includes(q) || ayah.normImla.includes(q) || ayah.normImla.includes(qImla)) {
      matches.push({
        number: ayah.number,
        numberInSurah: ayah.numberInSurah,
        text: ayah.text,
        surahNumber: ayah.surahNumber,
        surahName: ayah.surahName,
      });
      if (matches.length >= limit) break;
    }
  }
  return matches;
}
