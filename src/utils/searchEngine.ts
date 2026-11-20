import type { CuratedRecitation, Reciter, SurahMeta } from '../types/tilawa';
import { normalizeArabic } from './quranHelpers';

export interface SearchResults {
  reciters: Reciter[];
  surahs: SurahMeta[];
  recitations: CuratedRecitation[];
  styles: Array<{ label: string; count: number }>;
  suggestions: string[];
}

export function runLocalSearch(
  rawQuery: string,
  reciters: Reciter[],
  surahs: SurahMeta[],
  curatedRecitations: CuratedRecitation[]
): SearchResults {
  const q = normalizeArabic(rawQuery);
  if (!q) {
    return {
      reciters: [],
      surahs: [],
      recitations: [],
      styles: [],
      suggestions: [
        'المنشاوي',
        'مصطفى إسماعيل',
        'الطبلاوي',
        'عبد الباسط',
        'محمد أيوب',
        'الحذيفي',
        'العفاسي',
        'المعيقلي',
        'سورة الكهف',
        'مجود',
      ],
    };
  }

  const matchedReciters = reciters.filter((r) => {
    const hay = normalizeArabic(`${r.nameAr} ${r.nameEn} ${r.titleAr} ${r.originAr}`);
    return hay.includes(q);
  });

  const matchedSurahs = surahs.filter((s) => {
    const cleanName = normalizeArabic(s.name.replace(/^سُورَةُ\s*/, ''));
    const fullName = normalizeArabic(s.name);
    const eng = s.englishName.toLowerCase();
    return (
      fullName.includes(q) ||
      cleanName.includes(q) ||
      eng.includes(q) ||
      String(s.number) === q
    );
  });

  const matchedRecitations = curatedRecitations.filter((rec) => {
    const reciter = reciters.find((r) => r.id === rec.reciterId);
    const hay = normalizeArabic(
      `${rec.surahNameAr} ${rec.style} ${rec.riwayah || ''} ${reciter?.nameAr || ''}`
    );
    return hay.includes(q);
  });

  const allStyles = ['مرتل', 'مجود', 'حفل إذاعي', 'معلم'] as const;
  const matchedStyles = allStyles
    .filter((st) => normalizeArabic(st).includes(q))
    .map((st) => ({
      label: st,
      count: reciters.reduce(
        (acc, r) => acc + r.collections.filter((c) => c.style === st).length,
        0
      ),
    }));

  const suggestionSet = new Set<string>();
  matchedReciters.forEach((r) => suggestionSet.add(r.nameAr));
  matchedSurahs.slice(0, 5).forEach((s) => suggestionSet.add(s.name));
  matchedStyles.forEach((s) => suggestionSet.add(s.label));

  return {
    reciters: matchedReciters,
    surahs: matchedSurahs,
    recitations: matchedRecitations,
    styles: matchedStyles,
    suggestions: Array.from(suggestionSet).slice(0, 6),
  };
}
