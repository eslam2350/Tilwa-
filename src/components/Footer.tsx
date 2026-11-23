import React, { useState } from 'react';
import { BadgeCheck, BookOpenCheck, MessageSquareHeart, RefreshCw, Sparkles } from 'lucide-react';
import { useAppData } from '../contexts/AppDataContext';
import { useDynamicConfig } from '../contexts/DynamicConfigContext';
import type { AppRoute, NavPageId } from '../types/tilawa';
import { toArabicDigits } from '../utils/quranHelpers';
import { PerformanceFeedbackModal } from './PerformanceFeedbackModal';

interface FooterProps {
  navigate: (next: AppRoute) => void;
}

const FOOTER_ROUTE_MAP: Record<NavPageId, AppRoute> = {
  home: { page: 'home' },
  reciters: { page: 'reciters' },
  basira: { page: 'basira' },
  mushaf: { page: 'mushaf' },
  tahfeez: { page: 'tahfeez' },
  search: { page: 'search' },
  library: { page: 'library' },
};

export const Footer: React.FC<FooterProps> = ({ navigate }) => {
  const { reciters, basiraEpisodes } = useAppData();
  const { config, androidOta, triggerAndroidOtaCheck, applyAndroidOtaUpdate } = useDynamicConfig();
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

  return (
    <footer className="border-t border-[#C8A253]/20 bg-[#070908] mt-16 pb-28 md:pb-24">
      <div className="sanctuary-hairline w-full" aria-hidden="true" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Brand & Slogan */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xl font-display font-bold text-[#F5F3EE]">
            <span aria-hidden="true" className="w-2 h-2 rotate-45 bg-[#C8A253] shrink-0" />
            <span>{config.texts.siteName}</span>
          </div>
          <p className="text-sm text-[#C8A253]">{config.texts.slogan}</p>
          <p className="text-xs text-[#A9B2AE] leading-relaxed max-w-sm">
            {config.texts.footerDescription}
          </p>
        </div>

        {/* Navigation Links (Public Only — No direct Admin link) */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#F5F3EE]">أقسام المنصة</h3>
          <div className="flex flex-wrap gap-x-6 gap-y-2.5 text-xs text-[#A9B2AE]">
            {config.navPages
              .filter((p) => p.visible)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(FOOTER_ROUTE_MAP[p.id])}
                  className="hover:text-[#C8A253] transition-colors cursor-pointer"
                >
                  {p.id === 'reciters' ? `${p.label} (${toArabicDigits(reciters.length)})` : p.label}
                </button>
              ))}
          </div>
        </div>

        {/* Platform Experience Highlights (Instant Web & Offline Mushaf) */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#F5F3EE] flex items-center gap-1.5">
            <BookOpenCheck className="w-4 h-4 text-[#C8A253]" />
            <span>منصة تفاعلية بلا تسجيل</span>
          </h3>
          {androidOta.isAndroidApk ? (
            <div className="p-3.5 rounded-2xl bg-[#0E6B4D]/15 border border-[#0E6B4D]/40 space-y-2.5">
              <p className="text-xs text-[#F5F3EE] font-medium">
                المزامنة الفورية للتحديثات مفعّلة
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={triggerAndroidOtaCheck}
                  disabled={androidOta.checking}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-[11px] font-semibold text-white cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${androidOta.checking ? 'animate-spin' : ''}`} />
                  <span>{androidOta.checking ? 'جارٍ الفحص...' : 'فحص التحديثات الآن'}</span>
                </button>
                {androidOta.otaUpdateReady && (
                  <button
                    type="button"
                    onClick={applyAndroidOtaUpdate}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#C8A253] text-[#0A0D0C] text-[11px] font-bold cursor-pointer"
                  >
                    تطبيق التحديث
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-xs text-[#A9B2AE] leading-relaxed">
              <p>
                استماع مباشر إلى {toArabicDigits(reciters.length)} قارئًا و{toArabicDigits(basiraEpisodes.length)} حلقة بودكاست في «بصيرة»، مع مصحف يعمل دون إنترنت وشهادات تقدير فورية دون حسابات.
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => navigate({ page: 'library' })}
                  className="inline-flex items-center gap-1.5 text-xs text-[#C8A253] hover:underline cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>افتح مكتبتي وشهادات التقدير</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-[#F5F3EE] hover:text-[#C8A253] transition-colors cursor-pointer"
                >
                  <MessageSquareHeart className="w-3.5 h-3.5 text-[#C8A253]" />
                  <span>أبدِ رأيك في أداء الموقع</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sources & Stealth Owner Access via Developer Signature */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#F5F3EE]">المصادر والتطوير</h3>
          <p className="text-xs text-[#A9B2AE] leading-relaxed">
            النص القرآني بالرسم العثماني: مجمع الملك فهد عبر AlQuran.cloud · التلاوات الصوتية الموثوقة: شبكة MP3Quran · الحلقات الدعوية: أرشيف الإنترنت المفتوح.
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#F5F3EE]">
            <span>تطوير وهندسة البرمجيات:</span>
            <button
              type="button"
              dir="ltr"
              onClick={() => navigate({ page: 'admin' })}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0E6B4D]/20 hover:bg-[#0E6B4D]/35 border border-[#C8A253]/35 text-[#F5F3EE] font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <span>Eslam — Developer</span>
              <BadgeCheck
                className="w-4 h-4 text-[#38BDF8] fill-[#38BDF8]/15 shrink-0"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>
      <PerformanceFeedbackModal
        open={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        onSubmitted={() => window.dispatchEvent(new Event('tilawa:feedback-updated'))}
      />
    </footer>
  );
};
