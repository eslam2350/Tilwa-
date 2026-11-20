import React from 'react';
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { useAppData } from '../contexts/AppDataContext';
import { useDynamicConfig } from '../contexts/DynamicConfigContext';
import { DEVELOPER_NAME } from '../data/reciters';
import type { AppRoute, NavPageId } from '../types/tilawa';
import { toArabicDigits } from '../utils/quranHelpers';

interface FooterProps {
  navigate: (next: AppRoute) => void;
}

const FOOTER_ROUTE_MAP: Record<NavPageId, AppRoute> = {
  home: { page: 'home' },
  reciters: { page: 'reciters' },
  mushaf: { page: 'mushaf' },
  tahfeez: { page: 'tahfeez' },
  search: { page: 'search' },
  library: { page: 'library' },
};

export const Footer: React.FC<FooterProps> = ({ navigate }) => {
  const { reciters } = useAppData();
  const { config } = useDynamicConfig();

  return (
    <footer className="border-t border-[#C8A253]/20 bg-[#070908] mt-16 pb-28 md:pb-24">
      <div className="sanctuary-hairline w-full" aria-hidden="true" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-10">
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

        {/* Navigation Links */}
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
            <button
              type="button"
              onClick={() => navigate({ page: 'admin' })}
              className="inline-flex items-center gap-1 text-[#C8A253]/85 hover:text-[#C8A253] transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>لوحة الإدارة</span>
            </button>
          </div>
        </div>

        {/* Sources & Developer Credit */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#F5F3EE]">المصادر والتطوير</h3>
          <p className="text-xs text-[#A9B2AE] leading-relaxed">
            النص القرآني بالرسم العثماني: مجمع الملك فهد عبر AlQuran.cloud · التلاوات الصوتية الموثوقة: شبكة MP3Quran · الصور الأرشيفية: ويكيميديا كومنز.
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#F5F3EE]">
            <span>تطوير وهندسة البرمجيات:</span>
            <span
              dir="ltr"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0E6B4D]/20 border border-[#C8A253]/35 text-[#F5F3EE] font-semibold shadow-sm"
            >
              <span>{DEVELOPER_NAME}</span>
              <BadgeCheck
                className="w-4 h-4 text-[#38BDF8] fill-[#38BDF8]/15 shrink-0"
                aria-label="مطور موثق"
              />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

