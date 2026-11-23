import React, { useCallback, useEffect, useState } from 'react';
import {
  Gauge,
  MessageSquareHeart,
  Pin,
  Sparkles,
  Star,
  Volume2,
  Wand2,
} from 'lucide-react';
import type { SiteFeedbackItem, SiteFeedbackSummary } from '../types/tilawa';
import { formatArabicDecimalScore, getFeedbackCategoryLabel } from '../utils/feedbackHelpers';
import { toArabicDigits } from '../utils/quranHelpers';
import { PerformanceFeedbackModal } from './PerformanceFeedbackModal';

export const FeedbackShowcaseSection: React.FC = () => {
  const [items, setItems] = useState<SiteFeedbackItem[]>([]);
  const [summary, setSummary] = useState<SiteFeedbackSummary | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadFeedback = useCallback(async () => {
    try {
      const res = await fetch('/api/public/feedback', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        feedback?: SiteFeedbackItem[];
        summary?: SiteFeedbackSummary;
      };
      if (data.ok) {
        setItems(data.feedback || []);
        if (data.summary) setSummary(data.summary);
      }
    } catch {
      // keep section graceful if offline
    }
  }, []);

  useEffect(() => {
    void loadFeedback();
    const onRefresh = () => void loadFeedback();
    window.addEventListener('tilawa:feedback-updated', onRefresh);
    return () => window.removeEventListener('tilawa:feedback-updated', onRefresh);
  }, [loadFeedback]);

  const hasReviews = (summary?.visibleCount || 0) > 0;

  return (
    <section
      aria-labelledby="home-feedback-heading"
      className="glass-panel rounded-3xl p-5 sm:p-7 border border-white/10 space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#C8A253] font-medium">
            <MessageSquareHeart className="w-4 h-4" />
            <span>قياس جودة التجربة وتطوير المنصة</span>
          </div>
          <h2
            id="home-feedback-heading"
            className="text-xl sm:text-2xl font-display font-bold text-[#F5F3EE]"
          >
            آراء المستخدمين عن أداء الموقع
          </h2>
          <p className="text-xs sm:text-sm text-[#A9B2AE]">
            انطباعات الزوار الحقيقية حول سرعة التصفح، جودة التلاوات، وسهولة قراءة المصحف
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 min-h-[42px] px-5 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4 text-[#C8A253]" />
          <span>أبدِ رأيك في أداء الموقع</span>
        </button>
      </div>

      {/* Metrics & Latest Reviews Compact Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Summary Card (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl bg-[#0A0D0C]/75 border border-[#C8A253]/25 p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[#A9B2AE]">متوسط رضا الزوار</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-3xl font-display font-bold text-[#C8A253] tabular-nums">
                  {hasReviews
                    ? formatArabicDecimalScore(summary!.averageOverall)
                    : '—'}
                </span>
                <span className="text-xs text-[#A9B2AE]">/ {toArabicDigits(5)}</span>
              </div>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-0.5 text-[#C8A253]">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`w-3.5 h-3.5 ${
                      hasReviews && n <= Math.round(summary!.averageOverall)
                        ? 'fill-current'
                        : 'opacity-30'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-[#A9B2AE] mt-1">
                {toArabicDigits(summary?.visibleCount || 0)} تقييم موثق
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            {[
              {
                label: 'سرعة التصفح والتشغيل',
                score: summary?.averageSpeed || 0,
                icon: <Gauge className="w-3.5 h-3.5 text-[#C8A253]" />,
              },
              {
                label: 'جودة الصوت واستقرار البث',
                score: summary?.averageAudio || 0,
                icon: <Volume2 className="w-3.5 h-3.5 text-[#C8A253]" />,
              },
              {
                label: 'جمال التصميم وسهولة القراءة',
                score: summary?.averageDesign || 0,
                icon: <Wand2 className="w-3.5 h-3.5 text-[#C8A253]" />,
              },
            ].map((metric) => {
              const pct = hasReviews ? Math.min(100, Math.round((metric.score / 5) * 100)) : 0;
              return (
                <div key={metric.label} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1.5 text-[#F5F3EE]">
                      {metric.icon}
                      <span>{metric.label}</span>
                    </span>
                    <span className="font-mono-nums text-[#C8A253]">
                      {hasReviews ? `${formatArabicDecimalScore(metric.score)}/${toArabicDigits(5)}` : '—'}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-[#C8A253] to-[#178A64] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reviews Cards (8 cols) */}
        <div className="lg:col-span-8">
          {items.length === 0 ? (
            <div className="h-full rounded-2xl bg-[#0A0D0C]/55 border border-dashed border-white/15 p-6 flex flex-col items-center justify-center text-center gap-3">
              <MessageSquareHeart className="w-8 h-8 text-[#C8A253]/80" />
              <div className="space-y-1 max-w-md">
                <p className="text-sm font-semibold text-[#F5F3EE]">
                  كن أول من يقيّم أداء منصة تلاوة
                </p>
                <p className="text-xs text-[#A9B2AE] leading-relaxed">
                  رأيك يساعدنا على تحسين سرعة تشغيل السور وتجربة قراءة المصحف والتحفيظ باستمرار.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-[#C8A253]/35 text-xs font-medium text-[#C8A253] cursor-pointer"
              >
                اكتب تقييمك الأول الآن
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.slice(0, 4).map((fb) => (
                <article
                  key={fb.id}
                  className="rounded-2xl bg-[#0A0D0C]/70 border border-white/10 p-4 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {fb.pinned && <Pin className="w-3 h-3 text-[#C8A253] shrink-0" />}
                        <span className="text-xs font-semibold text-[#F5F3EE] truncate">
                          {fb.authorName}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 text-[#C8A253] shrink-0">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3 h-3 ${
                              s <= fb.overallRating ? 'fill-current' : 'opacity-25'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-[#F5F3EE]/90 leading-relaxed line-clamp-3">
                      {fb.comment}
                    </p>

                    {fb.adminReply && (
                      <div className="p-2.5 rounded-xl bg-[#0E6B4D]/15 border border-[#0E6B4D]/35 text-[11px] text-[#A9B2AE]">
                        <span className="font-semibold text-[#C8A253]">رد الإدارة: </span>
                        <span>{fb.adminReply}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5 text-[10px] text-[#A9B2AE]">
                    <span>{getFeedbackCategoryLabel(fb.category)}</span>
                    <span dir="ltr">
                      {new Date(fb.createdAt).toLocaleDateString('ar-EG', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <PerformanceFeedbackModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmitted={(nextItems, nextSummary) => {
          setItems(nextItems);
          setSummary(nextSummary);
          window.dispatchEvent(new Event('tilawa:feedback-updated'));
        }}
      />
    </section>
  );
};
