import type {
  FeedbackCategory,
  SiteFeedbackItem,
  SiteFeedbackSummary,
} from '../types/tilawa.ts';

export const FEEDBACK_CATEGORIES: Array<{ id: FeedbackCategory; labelAr: string }> = [
  { id: 'general', labelAr: 'الأداء العام للموقع' },
  { id: 'audio', labelAr: 'سرعة التلاوات وجودة الصوت' },
  { id: 'mushaf', labelAr: 'المصحف الشريف والقراءة' },
  { id: 'tahfeez', labelAr: 'قسم التحفيظ والمعلم' },
  { id: 'basira', labelAr: 'بودكاست بصيرة والدعاة' },
  { id: 'suggestion', labelAr: 'مقترح تطوير جديد' },
];

const VALID_CATEGORIES = new Set<FeedbackCategory>(FEEDBACK_CATEGORIES.map((c) => c.id));

export function getFeedbackCategoryLabel(category: FeedbackCategory | string): string {
  return FEEDBACK_CATEGORIES.find((c) => c.id === category)?.labelAr || 'الأداء العام للموقع';
}

export function clampRatingScore(value: unknown, fallback = 5): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(5, Math.max(1, Math.round(num)));
}

export interface RawFeedbackInput {
  authorName?: unknown;
  overallRating?: unknown;
  speedScore?: unknown;
  designScore?: unknown;
  audioScore?: unknown;
  category?: unknown;
  comment?: unknown;
}

export function validateAndSanitizeFeedbackInput(raw: RawFeedbackInput):
  | {
      ok: true;
      data: {
        authorName: string;
        overallRating: number;
        speedScore: number;
        designScore: number;
        audioScore: number;
        category: FeedbackCategory;
        comment: string;
      };
    }
  | { ok: false; error: string } {
  const commentRaw = typeof raw.comment === 'string' ? raw.comment.replace(/\s+/g, ' ').trim() : '';
  if (commentRaw.length < 4) {
    return { ok: false, error: 'يرجى كتابة رأيك أو ملاحظتك حول أداء الموقع (٤ أحرف على الأقل).' };
  }
  if (commentRaw.length > 600) {
    return { ok: false, error: 'الحد الأقصى للتعليق هو ٦٠٠ حرف.' };
  }

  const authorRaw =
    typeof raw.authorName === 'string' ? raw.authorName.replace(/\s+/g, ' ').trim() : '';
  const authorName = authorRaw ? authorRaw.slice(0, 50) : 'زائر منصة تلاوة';

  const overallRating = clampRatingScore(raw.overallRating, 5);
  const speedScore = clampRatingScore(raw.speedScore, overallRating);
  const designScore = clampRatingScore(raw.designScore, overallRating);
  const audioScore = clampRatingScore(raw.audioScore, overallRating);

  const catCandidate = typeof raw.category === 'string' ? raw.category.trim() : 'general';
  const category: FeedbackCategory = VALID_CATEGORIES.has(catCandidate as FeedbackCategory)
    ? (catCandidate as FeedbackCategory)
    : 'general';

  return {
    ok: true,
    data: {
      authorName,
      overallRating,
      speedScore,
      designScore,
      audioScore,
      category,
      comment: commentRaw,
    },
  };
}

export function computeFeedbackSummary(items: SiteFeedbackItem[]): SiteFeedbackSummary {
  const visibleItems = items.filter((item) => item.visible);
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  if (visibleItems.length === 0) {
    return {
      totalCount: items.length,
      visibleCount: 0,
      averageOverall: 0,
      averageSpeed: 0,
      averageDesign: 0,
      averageAudio: 0,
      ratingDistribution: distribution,
    };
  }

  let sumOverall = 0;
  let sumSpeed = 0;
  let sumDesign = 0;
  let sumAudio = 0;

  for (const item of visibleItems) {
    const overall = clampRatingScore(item.overallRating, 5) as 1 | 2 | 3 | 4 | 5;
    sumOverall += overall;
    sumSpeed += clampRatingScore(item.speedScore, overall);
    sumDesign += clampRatingScore(item.designScore, overall);
    sumAudio += clampRatingScore(item.audioScore, overall);
    distribution[overall] += 1;
  }

  const count = visibleItems.length;
  return {
    totalCount: items.length,
    visibleCount: count,
    averageOverall: Number((sumOverall / count).toFixed(1)),
    averageSpeed: Number((sumSpeed / count).toFixed(1)),
    averageDesign: Number((sumDesign / count).toFixed(1)),
    averageAudio: Number((sumAudio / count).toFixed(1)),
    ratingDistribution: distribution,
  };
}

export function sortFeedbackForDisplay(items: SiteFeedbackItem[]): SiteFeedbackItem[] {
  return [...items].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'] as const;

export function formatArabicDecimalScore(score: number): string {
  const safe = Number.isFinite(score) ? Math.max(0, Math.min(5, score)) : 0;
  return safe
    .toFixed(1)
    .replace('.', '٫')
    .replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)] || d);
}
