import React, { useState } from 'react';
import { MessageSquareHeart, Send, Star, X } from 'lucide-react';
import { useAppData } from '../contexts/AppDataContext';
import type { FeedbackCategory, SiteFeedbackItem, SiteFeedbackSummary } from '../types/tilawa';
import { FEEDBACK_CATEGORIES } from '../utils/feedbackHelpers';

interface PerformanceFeedbackModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted?: (items: SiteFeedbackItem[], summary: SiteFeedbackSummary) => void;
}

const StarRatingRow: React.FC<{
  label: string;
  value: number;
  onChange: (val: number) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <span className="text-xs text-[#F5F3EE]">{label}</span>
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${label}: ${star} من ٥`}
            onClick={() => onChange(star)}
            className={`p-1 rounded-lg transition-transform hover:scale-110 cursor-pointer ${
              active ? 'text-[#C8A253]' : 'text-[#A9B2AE]/35 hover:text-[#C8A253]/70'
            }`}
          >
            <Star className={`w-4 h-4 ${active ? 'fill-current' : ''}`} />
          </button>
        );
      })}
    </div>
  </div>
);

export const PerformanceFeedbackModal: React.FC<PerformanceFeedbackModalProps> = ({
  open,
  onClose,
  onSubmitted,
}) => {
  const { notify } = useAppData();
  const [authorName, setAuthorName] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [overallRating, setOverallRating] = useState(5);
  const [speedScore, setSpeedScore] = useState(5);
  const [audioScore, setAudioScore] = useState(5);
  const [designScore, setDesignScore] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    if (comment.trim().length < 4) {
      setErrorText('يرجى كتابة رأيك أو ملاحظتك حول أداء المنصة (٤ أحرف على الأقل).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/public/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName,
          category,
          overallRating,
          speedScore,
          audioScore,
          designScore,
          comment,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        feedback?: SiteFeedbackItem[];
        summary?: SiteFeedbackSummary;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorText(data.error || 'تعذر حفظ رأيك حاليًا، حاول مرة أخرى.');
        return;
      }

      notify('شكرًا لك — تم نشر رأيك حول أداء منصة تلاوة بنجاح', 'success');
      if (data.feedback && data.summary) {
        onSubmitted?.(data.feedback, data.summary);
      }
      setComment('');
      setAuthorName('');
      onClose();
    } catch {
      setErrorText('تعذر الاتصال بالخادم لإرسال التقييم.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg glass-gold rounded-3xl p-5 sm:p-6 border border-[#C8A253]/35 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs text-[#C8A253] font-semibold">
              <MessageSquareHeart className="w-4 h-4" />
              <span>صوت الزوار وتقييم جودة المنصة</span>
            </div>
            <h2 id="feedback-modal-title" className="text-lg font-display font-bold text-[#F5F3EE]">
              شاركنا رأيك في أداء موقع تلاوة
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة التقييم"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#A9B2AE] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-[#0A0D0C]/80 border border-white/10 divide-y divide-white/5">
            <StarRatingRow label="التقييم العام للمنصة" value={overallRating} onChange={setOverallRating} />
            <StarRatingRow label="سرعة التصفح وتشغيل السور" value={speedScore} onChange={setSpeedScore} />
            <StarRatingRow label="جودة الصوت وثبات البث" value={audioScore} onChange={setAudioScore} />
            <StarRatingRow label="وضوح التصميم وسهولة القراءة" value={designScore} onChange={setDesignScore} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="fb-author" className="block text-xs text-[#A9B2AE]">
                الاسم (اختياري)
              </label>
              <input
                id="fb-author"
                type="text"
                maxLength={50}
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="مثال: عبد الرحمن"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE] placeholder:text-[#A9B2AE]/45 focus:border-[#C8A253]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="fb-category" className="block text-xs text-[#A9B2AE]">
                جانب التقييم
              </label>
              <select
                id="fb-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE] focus:border-[#C8A253]"
              >
                {FEEDBACK_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.labelAr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="fb-comment" className="block text-xs text-[#A9B2AE]">
              رأيك وملاحظتك حول الأداء أو اقتراحك للتطوير
            </label>
            <textarea
              id="fb-comment"
              rows={3}
              maxLength={600}
              required
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (errorText) setErrorText(null);
              }}
              placeholder="اكتب انطباعك عن سرعة الموقع، جودة التلاوات، المصحف أو التحفيظ..."
              className="w-full p-3.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs sm:text-sm text-[#F5F3EE] placeholder:text-[#A9B2AE]/45 focus:border-[#C8A253]"
            />
          </div>

          {errorText && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200"
            >
              {errorText}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#A9B2AE] hover:text-white cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] disabled:opacity-60 text-xs sm:text-sm font-semibold text-white shadow cursor-pointer"
            >
              <Send className="w-4 h-4 text-[#C8A253]" />
              <span>{submitting ? 'جارٍ الإرسال...' : 'إرسال التقييم الآن'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
