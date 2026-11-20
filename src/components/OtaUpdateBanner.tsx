import React from 'react';
import { EyeOff, RefreshCw, Sparkles } from 'lucide-react';
import { useDynamicConfig } from '../contexts/DynamicConfigContext';

export const OtaUpdateBanner: React.FC = () => {
  const {
    hasLocalPreview,
    clearLocalPreview,
    androidOta,
    applyAndroidOtaUpdate,
  } = useDynamicConfig();

  if (!androidOta.otaUpdateReady && !hasLocalPreview) {
    return null;
  }

  return (
    <div className="bg-[#0E6B4D]/25 border-b border-[#C8A253]/35 px-4 py-2.5 text-xs text-[#F5F3EE]">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {androidOta.otaUpdateReady ? (
          <>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C8A253] shrink-0" />
              <span>
                يتوفر تحديث جديد لواجهة ومحتوى التطبيق (الإصدار{' '}
                <strong className="text-[#C8A253]">{androidOta.pendingVersion}</strong>) تم تحميله وجاهز للتطبيق دون إعادة تثبيت.
              </span>
            </div>
            <button
              type="button"
              onClick={applyAndroidOtaUpdate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#C8A253] hover:bg-[#d6b368] text-[#0A0D0C] font-bold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تطبيق التحديث الآن</span>
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C8A253] shrink-0" />
              <span>أنت تشاهد حالياً معاينة محلية غير منشورة من لوحة الإدارة.</span>
            </div>
            <button
              type="button"
              onClick={clearLocalPreview}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[#F5F3EE] cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>إنهاء المعاينة</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
