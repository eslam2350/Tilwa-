import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  MessageSquareHeart,
  Pin,
  RefreshCw,
  Reply,
  Star,
  Trash2,
} from 'lucide-react';
import { useAppData } from '../contexts/AppDataContext';
import type { SiteFeedbackItem, SiteFeedbackSummary } from '../types/tilawa';
import { formatArabicDecimalScore, getFeedbackCategoryLabel } from '../utils/feedbackHelpers';
import { toArabicDigits } from '../utils/quranHelpers';

interface AdminFeedbackTabProps {
  ownerFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export const AdminFeedbackTab: React.FC<AdminFeedbackTabProps> = ({ ownerFetch }) => {
  const { notify } = useAppData();
  const [items, setItems] = useState<SiteFeedbackItem[]>([]);
  const [summary, setSummary] = useState<SiteFeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ownerFetch('/api/admin/feedback');
      if (!res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        feedback?: SiteFeedbackItem[];
        summary?: SiteFeedbackSummary;
      };
      if (data.ok) {
        setItems(data.feedback || []);
        if (data.summary) setSummary(data.summary);
        const drafts: Record<string, string> = {};
        for (const f of data.feedback || []) {
          drafts[f.id] = f.adminReply || '';
        }
        setReplyDrafts(drafts);
      }
    } catch {
      notify('تعذر تحميل آراء المستخدمين', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify, ownerFetch]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handlePatch = async (
    id: string,
    patch: { visible?: boolean; pinned?: boolean; adminReply?: string }
  ) => {
    setSavingId(id);
    try {
      const res = await ownerFetch(`/api/admin/feedback/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        feedback?: SiteFeedbackItem[];
        summary?: SiteFeedbackSummary;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        notify(data.error || 'تعذر تحديث التقييم', 'error');
        return;
      }
      setItems(data.feedback || []);
      if (data.summary) setSummary(data.summary);
      window.dispatchEvent(new Event('tilawa:feedback-updated'));
      notify('تم تحديث التقييم بنجاح', 'success');
    } catch {
      notify('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setSavingId(id);
    try {
      const res = await ownerFetch(`/api/admin/feedback/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as {
        ok?: boolean;
        feedback?: SiteFeedbackItem[];
        summary?: SiteFeedbackSummary;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        notify(data.error || 'تعذر حذف التقييم', 'error');
        return;
      }
      setItems(data.feedback || []);
      if (data.summary) setSummary(data.summary);
      window.dispatchEvent(new Event('tilawa:feedback-updated'));
      notify('تم حذف التقييم', 'info');
    } catch {
      notify('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="space-y-6">
      {/* Header & Metrics */}
      <div className="glass-gold rounded-3xl p-5 sm:p-6 border border-[#C8A253]/30 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs text-[#C8A253] font-semibold">
            <MessageSquareHeart className="w-4 h-4" />
            <span>قياس تجربة الزوار وجودة الأداء</span>
          </div>
          <h2 className="text-xl font-display font-bold text-[#F5F3EE]">
            إدارة آراء المستخدمين وتقييمات الأداء
          </h2>
          <p className="text-xs text-[#A9B2AE]">
            تابع انطباعات الزوار عن سرعة التصفح وجودة التلاوات، وثبّت الآراء المفيدة أو أضف ردًا رسميًا.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-[#F5F3EE] cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#C8A253] ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث الآراء</span>
        </button>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'إجمالي التقييمات', val: toArabicDigits(summary?.totalCount || 0) },
          {
            label: 'المتوسط العام',
            val: summary?.visibleCount
              ? `${formatArabicDecimalScore(summary.averageOverall)} / ${toArabicDigits(5)}`
              : '—',
          },
          {
            label: 'سرعة التصفح',
            val: summary?.visibleCount
              ? `${formatArabicDecimalScore(summary.averageSpeed)} / ${toArabicDigits(5)}`
              : '—',
          },
          {
            label: 'جودة الصوت',
            val: summary?.visibleCount
              ? `${formatArabicDecimalScore(summary.averageAudio)} / ${toArabicDigits(5)}`
              : '—',
          },
          {
            label: 'وضوح التصميم',
            val: summary?.visibleCount
              ? `${formatArabicDecimalScore(summary.averageDesign)} / ${toArabicDigits(5)}`
              : '—',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass-panel rounded-2xl p-4 border border-white/10 space-y-1"
          >
            <p className="text-[11px] text-[#A9B2AE]">{stat.label}</p>
            <p className="text-lg font-display font-bold text-[#C8A253] tabular-nums">{stat.val}</p>
          </div>
        ))}
      </div>

      {/* Feedback List */}
      {loading && items.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center text-xs text-[#A9B2AE]">
          جارٍ تحميل آراء المستخدمين...
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel rounded-2xl p-8 text-center space-y-2 border border-white/10">
          <p className="text-sm font-semibold text-[#F5F3EE]">لا توجد تقييمات مرسلة بعد</p>
          <p className="text-xs text-[#A9B2AE]">
            عند إرسال الزوار لآرائهم من الصفحة الرئيسية أو التذييل ستظهر هنا مباشرة لإدارتها والرد عليها.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((fb) => {
            const busy = savingId === fb.id;
            return (
              <article
                key={fb.id}
                aria-label={`تقييم ${fb.authorName}`}
                className={`glass-panel rounded-2xl p-5 border space-y-3 ${
                  fb.visible ? 'border-white/10' : 'border-amber-500/35 opacity-75'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[#F5F3EE]">{fb.authorName}</span>
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-[#C8A253]">
                        {getFeedbackCategoryLabel(fb.category)}
                      </span>
                      {fb.pinned && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#C8A253]/20 text-[10px] text-[#C8A253]">
                          <Pin className="w-3 h-3" />
                          مثبّت
                        </span>
                      )}
                      {!fb.visible && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-950/70 border border-amber-500/40 text-[10px] text-amber-200">
                          مخفي عن الزوار
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#A9B2AE]">
                      <span className="inline-flex items-center gap-1 text-[#C8A253]">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>عام: {toArabicDigits(fb.overallRating)}/{toArabicDigits(5)}</span>
                      </span>
                      <span>سرعة: {toArabicDigits(fb.speedScore)}/{toArabicDigits(5)}</span>
                      <span>صوت: {toArabicDigits(fb.audioScore)}/{toArabicDigits(5)}</span>
                      <span>تصميم: {toArabicDigits(fb.designScore)}/{toArabicDigits(5)}</span>
                      <span dir="ltr">{new Date(fb.createdAt).toLocaleString('ar-EG')}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`${fb.pinned ? 'إلغاء تثبيت' : 'تثبيت'} تقييم ${fb.authorName}`}
                      onClick={() => void handlePatch(fb.id, { pinned: !fb.pinned })}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-[11px] cursor-pointer ${
                        fb.pinned
                          ? 'bg-[#C8A253]/20 border-[#C8A253]/50 text-[#C8A253]'
                          : 'bg-white/5 border-white/10 text-[#A9B2AE] hover:text-white'
                      }`}
                    >
                      <Pin className="w-3.5 h-3.5" />
                      <span>{fb.pinned ? 'إلغاء التثبيت' : 'تثبيت'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`${fb.visible ? 'إخفاء' : 'إظهار'} تقييم ${fb.authorName}`}
                      onClick={() => void handlePatch(fb.id, { visible: !fb.visible })}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-[#F5F3EE] cursor-pointer"
                    >
                      {fb.visible ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-amber-300" />
                          <span>إخفاء</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-300" />
                          <span>إظهار</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`حذف تقييم ${fb.authorName}`}
                      onClick={() => void handleDelete(fb.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/35 text-[11px] text-rose-200 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>

                <p className="p-3.5 rounded-xl bg-[#0A0D0C]/80 border border-white/10 text-xs sm:text-sm text-[#F5F3EE] leading-relaxed">
                  {fb.comment}
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    maxLength={400}
                    aria-label={`رد الإدارة على تقييم ${fb.authorName}`}
                    value={replyDrafts[fb.id] ?? ''}
                    onChange={(e) =>
                      setReplyDrafts((prev) => ({ ...prev, [fb.id]: e.target.value }))
                    }
                    placeholder="اكتب ردًا رسميًا من إدارة تلاوة يظهر أسفل تقييم الزائر..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`${fb.adminReply ? 'تحديث الرد على' : 'حفظ الرد على'} تقييم ${fb.authorName}`}
                    onClick={() =>
                      void handlePatch(fb.id, { adminReply: replyDrafts[fb.id] || '' })
                    }
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs font-semibold text-white cursor-pointer"
                  >
                    {fb.adminReply ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#C8A253]" />
                        <span>تحديث الرد</span>
                      </>
                    ) : (
                      <>
                        <Reply className="w-3.5 h-3.5 text-[#C8A253]" />
                        <span>حفظ الرد</span>
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
