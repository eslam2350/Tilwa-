import type { AyahItem } from '../types/tilawa';
import { normalizeArabic, stripLeadingBismillah } from './quranHelpers';

export interface AyahTimeSegment {
  ayahNumber: number;
  numberInSurah: number;
  surahNumber: number;
  cleanText: string;
  weight: number;
  startTime: number;
  endTime: number;
}

/**
 * Computes a realistic recitation duration weight for an ayah in Uthmani script.
 * Short opening letters (e.g. الم، يس، طه) include Madd elongation & Waqf pause,
 * so a minimum breath+pause baseline prevents ultra-short ayahs from flashing too fast.
 */
export function computeAyahRecitationWeight(cleanText: string): number {
  const letters = normalizeArabic(cleanText).replace(/[^ا-ي]/g, '').length;
  const words = cleanText
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  // Base pause per ayah + letter articulation + word pause weighting
  return Math.max(18, letters + words * 1.5 + 14);
}

/**
 * Builds cumulative timestamp segments [startTime, endTime) for every ayah in a surah
 * given the audio file's total duration in seconds.
 */
export function buildSurahAyahTimeline(
  ayahs: AyahItem[],
  surahNumber: number,
  durationSeconds: number
): AyahTimeSegment[] {
  if (!Array.isArray(ayahs) || ayahs.length === 0) return [];
  const safeDuration =
    Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;

  const prepared = ayahs.map((a) => {
    const cleanText = stripLeadingBismillah(a.text, a.surahNumber || surahNumber, a.numberInSurah);
    return {
      ayahNumber: a.number,
      numberInSurah: a.numberInSurah,
      surahNumber: a.surahNumber || surahNumber,
      cleanText: cleanText || a.text,
      weight: computeAyahRecitationWeight(cleanText || a.text),
    };
  });

  if (safeDuration <= 0) {
    return prepared.map((item) => ({
      ...item,
      startTime: 0,
      endTime: 0,
    }));
  }

  // Reserve brief Basmalah lead-in for Surahs 2..114 (except At-Tawbah 9) when audio is > 20s
  const hasIntroBasmalah = surahNumber !== 1 && surahNumber !== 9 && safeDuration > 20;
  const introOffset = hasIntroBasmalah ? Math.min(5.2, safeDuration * 0.035) : 0;
  const playableDuration = Math.max(1, safeDuration - introOffset);
  const totalWeight = prepared.reduce((acc, item) => acc + item.weight, 0) || prepared.length;

  let cursor = 0;
  return prepared.map((item, idx) => {
    const share = (item.weight / totalWeight) * playableDuration;
    const startTime = idx === 0 ? 0 : cursor;
    const endTime =
      idx === prepared.length - 1
        ? safeDuration
        : (idx === 0 ? introOffset : cursor) + share;
    cursor = endTime;
    return {
      ...item,
      startTime,
      endTime,
    };
  });
}

/**
 * Finds the active ayah segment index matching currentTimeSeconds.
 * Returns -1 only if segments is empty.
 */
export function findActiveAyahSegmentIndex(
  segments: AyahTimeSegment[],
  currentTimeSeconds: number
): number {
  if (!Array.isArray(segments) || segments.length === 0) return -1;
  const t = Number.isFinite(currentTimeSeconds) && currentTimeSeconds >= 0 ? currentTimeSeconds : 0;
  if (segments[0].endTime <= 0) return 0;

  // Binary search across contiguous [startTime, endTime)
  let low = 0;
  let high = segments.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const seg = segments[mid];
    if (t < seg.startTime) {
      high = mid - 1;
    } else if (t >= seg.endTime && mid < segments.length - 1) {
      low = mid + 1;
    } else {
      return mid;
    }
  }
  return Math.max(0, Math.min(segments.length - 1, low));
}
