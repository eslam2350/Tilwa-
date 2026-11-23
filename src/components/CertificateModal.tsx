import React, { useEffect, useState } from 'react';
import {
  Award,
  BadgeCheck,
  CheckCircle2,
  Download,
  FileText,
  Lock,
  Palette,
  Printer,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { useDynamicConfig } from '../contexts/DynamicConfigContext';
import type { CertificateTemplateId, DynamicCertificatesConfig } from '../types/tilawa';
import type { CertificateEvaluation } from '../utils/certificateHelpers';
import {
  downloadCertificatePdf,
  downloadCertificatePng,
  renderCertificateToDataUrl,
} from '../utils/certificateRenderer';
import {
  CERTIFICATE_TEMPLATES,
  DEFAULT_CERTIFICATES,
  getCertificateTemplateTheme,
} from '../utils/dynamicConfigHelpers';
import { toArabicDigits } from '../utils/quranHelpers';

interface CertificatePreviewCardProps {
  certificate: CertificateEvaluation;
  recipientName: string;
  certConfig?: DynamicCertificatesConfig;
  certificatesConfig?: DynamicCertificatesConfig;
  templateId?: CertificateTemplateId;
  compact?: boolean;
}

const ArabesqueCornerSvg: React.FC<{
  positionClass: string;
  rotateDeg: number;
  accentColor: string;
  emeraldColor: string;
}> = ({ positionClass, rotateDeg, accentColor, emeraldColor }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 64 64"
    className={`w-10 h-10 sm:w-12 sm:h-12 absolute pointer-events-none ${positionClass}`}
    style={{ transform: `rotate(${rotateDeg}deg)` }}
    fill="none"
  >
    <path d="M4 58V4H58" stroke={accentColor} strokeWidth="2.5" />
    <path d="M14 44V14H44" stroke={accentColor} strokeWidth="1.4" strokeOpacity="0.8" />
    <rect x="10" y="10" width="8" height="8" stroke={emeraldColor} strokeWidth="1.2" />
    <circle cx="14" cy="14" r="2.2" fill={accentColor} />
  </svg>
);

export const PlatformCalligraphicSignature: React.FC<{
  signerName: string;
  signerTitleAr: string;
  styleMode?: DynamicCertificatesConfig['signatureStyle'];
  accentColor?: string;
  mutedColor?: string;
  highlightColor?: string;
  emeraldColor?: string;
}> = ({
  signerName,
  signerTitleAr,
  styleMode = 'calligraphic_gold',
  accentColor = '#E5C67E',
  mutedColor = '#A9B2AE',
  highlightColor = '#F5D88E',
  emeraldColor = '#6EE7B7',
}) => {
  const safeName =
    !signerName.trim() ||
    /^(eslam(\s+(mohammad|mohamed|khalifa))?|إسلام\s+محمد)$/i.test(signerName.trim())
      ? DEFAULT_CERTIFICATES.signerName
      : signerName;
  const safeTitle =
    !signerTitleAr.trim() || /(مؤسس|المطور)/.test(signerTitleAr)
      ? DEFAULT_CERTIFICATES.signerTitleAr
      : signerTitleAr;

  return (
    <div className="flex flex-col items-center">
      <p className="text-[11px]" style={{ color: mutedColor }}>
        {safeTitle}
      </p>
      {styleMode !== 'modern_minimal' && (
        <svg
          aria-hidden="true"
          viewBox="0 0 220 44"
          className="w-40 h-8 my-0.5 overflow-visible"
          style={{ color: accentColor }}
          fill="none"
        >
          <path
            d="M12 28 C42 -4, 68 34, 96 14 C118 -2, 142 28, 172 10 C192 -2, 206 20, 216 14"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M28 36 Q114 45 204 31"
            stroke={accentColor}
            strokeWidth="1.4"
            strokeOpacity="0.7"
            strokeLinecap="round"
          />
        </svg>
      )}
      <p
        className="inline-flex items-center gap-1.5 font-display font-bold text-sm sm:text-base whitespace-nowrap"
        style={{ color: highlightColor }}
      >
        <span>{safeName}</span>
        <BadgeCheck className="w-4 h-4 text-[#38BDF8] shrink-0" />
      </p>
      <p className="text-[10px]" style={{ color: emeraldColor }}>
        الاعتماد الرسمي لمنصة تلاوة
      </p>
    </div>
  );
};

export const CertificatePreviewCard: React.FC<CertificatePreviewCardProps> = ({
  certificate,
  recipientName,
  certConfig,
  certificatesConfig,
  templateId,
  compact = false,
}) => {
  const activeCertConfig = certificatesConfig || certConfig || DEFAULT_CERTIFICATES;
  const theme = getCertificateTemplateTheme(templateId || activeCertConfig.defaultTemplate);
  const displayName = recipientName.trim() || 'قارئ وحافظ كتاب الله العزيز';

  const hijriStr = (() => {
    try {
      return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date());
    } catch {
      return '';
    }
  })();

  const highlightNameColor = theme.isLightPaper ? theme.primaryTextColor : '#F8DC94';
  const emeraldAccent = theme.isLightPaper ? '#0E6B4D' : theme.emeraldColor;

  return (
    <div
      aria-label="معاينة الشهادة الاحترافية"
      className={`relative rounded-2xl border-2 ${
        compact ? 'p-5 sm:p-8 space-y-3.5' : 'p-6 sm:p-10 space-y-5'
      } text-center shadow-2xl overflow-hidden transition-all`}
      style={{
        background: theme.bgGradientCss,
        borderColor: theme.accentColor,
      }}
    >
      {/* Inner double dashed & solid illuminated border frames */}
      <div
        aria-hidden="true"
        className="absolute inset-2.5 rounded-xl border border-dashed pointer-events-none"
        style={{ borderColor: theme.accentSoftColor }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-4 rounded-lg border pointer-events-none"
        style={{ borderColor: theme.accentSoftColor }}
      />

      {/* Four Arabesque Corner Rosettes */}
      <ArabesqueCornerSvg
        positionClass="top-5 right-5"
        rotateDeg={90}
        accentColor={theme.accentColor}
        emeraldColor={emeraldAccent}
      />
      <ArabesqueCornerSvg
        positionClass="top-5 left-5"
        rotateDeg={0}
        accentColor={theme.accentColor}
        emeraldColor={emeraldAccent}
      />
      <ArabesqueCornerSvg
        positionClass="bottom-5 right-5"
        rotateDeg={180}
        accentColor={theme.accentColor}
        emeraldColor={emeraldAccent}
      />
      <ArabesqueCornerSvg
        positionClass="bottom-5 left-5"
        rotateDeg={-90}
        accentColor={theme.accentColor}
        emeraldColor={emeraldAccent}
      />

      {/* Translucent Centered 8-Point Mandala Watermark */}
      <svg
        aria-hidden="true"
        viewBox="0 0 240 240"
        className="w-64 h-64 sm:w-80 sm:h-80 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-10"
        fill="none"
      >
        <rect x="45" y="45" width="150" height="150" stroke={theme.accentColor} strokeWidth="1.5" />
        <rect
          x="45"
          y="45"
          width="150"
          height="150"
          stroke={theme.accentColor}
          strokeWidth="1.5"
          transform="rotate(45 120 120)"
        />
        <circle cx="120" cy="120" r="95" stroke={theme.accentColor} strokeWidth="1.2" />
        <circle cx="120" cy="120" r="64" stroke={theme.accentColor} strokeWidth="1.2" />
      </svg>

      <div className={`relative ${compact ? 'space-y-3' : 'space-y-4'}`}>
        <div
          className="inline-flex items-center gap-2 px-4 py-1 rounded-full border text-xs font-semibold"
          style={{
            backgroundColor: theme.isLightPaper
              ? 'rgba(14, 107, 77, 0.1)'
              : 'rgba(14, 107, 77, 0.25)',
            borderColor: theme.accentColor,
            color: theme.isLightPaper ? theme.badgeBg : theme.accentColor,
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{activeCertConfig.platformTitleAr || DEFAULT_CERTIFICATES.platformTitleAr}</span>
        </div>

        <p className="font-quran text-lg sm:text-2xl" style={{ color: theme.accentColor }}>
          بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </p>

        <h3
          className={`${compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-4xl'} font-display font-bold`}
          style={{ color: theme.primaryTextColor }}
        >
          شَهَادَةُ شُكْرٍ وَتَقْدِير
        </h3>

        {/* Ornamental diamond hairline */}
        <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
          <span
            className="h-px flex-1"
            style={{
              background: `linear-gradient(to left, ${theme.accentColor}, transparent)`,
            }}
          />
          <span
            className="w-2.5 h-2.5 rotate-45 inline-block"
            style={{ backgroundColor: theme.accentColor }}
          />
          <span
            className="h-px flex-1"
            style={{
              background: `linear-gradient(to right, ${theme.accentColor}, transparent)`,
            }}
          />
        </div>

        <p className="text-xs sm:text-base font-bold" style={{ color: emeraldAccent }}>
          {certificate.titleAr}
        </p>

        <p className="text-xs sm:text-sm" style={{ color: theme.secondaryTextColor }}>
          تتشرف إدارة منصة تلاوة بمنح هذه الشهادة التقديرية الموثقة إلى:
        </p>

        <div
          className="max-w-xl mx-auto px-5 py-3 rounded-2xl border-2"
          style={{
            backgroundColor: theme.namePlateBg,
            borderColor: theme.accentColor,
          }}
        >
          <p
            className={`${compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'} font-display font-bold`}
            style={{ color: highlightNameColor }}
          >
            {displayName}
          </p>
        </div>

        <div
          className="inline-block px-4 py-1 rounded-full text-xs font-bold shadow-sm"
          style={{
            backgroundColor: theme.badgeBg,
            color: theme.badgeText,
          }}
        >
          {certificate.badgeLabelAr}
        </div>

        <p
          className="text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto"
          style={{ color: theme.bodyTextColor }}
        >
          {certificate.citationAr}
        </p>

        <p className="font-quran text-sm" style={{ color: theme.accentColor }}>
          {activeCertConfig.blessingVerseAr || DEFAULT_CERTIFICATES.blessingVerseAr}
        </p>

        <div
          className="pt-4 mt-2 border-t grid grid-cols-1 sm:grid-cols-3 gap-4 items-center text-xs"
          style={{ borderColor: theme.accentSoftColor }}
        >
          <div>
            <p style={{ color: theme.secondaryTextColor }}>تاريخ الإصدار</p>
            <p className="font-semibold mt-0.5" style={{ color: theme.primaryTextColor }}>
              {hijriStr || new Date().toLocaleDateString('ar-EG')}
            </p>
          </div>

          <div className="flex flex-col items-center">
            <div
              className="w-28 h-28 rounded-full border-2 flex flex-col items-center justify-center p-2 shadow-inner"
              style={{
                backgroundColor: theme.isLightPaper
                  ? 'rgba(158, 115, 36, 0.1)'
                  : 'rgba(214, 177, 92, 0.12)',
                borderColor: theme.accentColor,
              }}
            >
              <div
                className="w-full h-full rounded-full border border-dashed flex flex-col items-center justify-center px-1.5"
                style={{ borderColor: emeraldAccent }}
              >
                <p
                  className="font-bold text-[9.5px] leading-tight text-center"
                  style={{ color: theme.isLightPaper ? theme.primaryTextColor : theme.accentColor }}
                >
                  {activeCertConfig.stampLabelAr || 'ختم تلاوة'}
                </p>
                <p
                  dir="ltr"
                  className="font-mono-nums text-[9px] mt-0.5"
                  style={{ color: theme.primaryTextColor }}
                >
                  {certificate.sealNumber}
                </p>
                <p className="text-[9px] font-semibold" style={{ color: emeraldAccent }}>
                  {toArabicDigits(new Date().getFullYear())}
                </p>
              </div>
            </div>
          </div>

          <PlatformCalligraphicSignature
            signerName={activeCertConfig.signerName || DEFAULT_CERTIFICATES.signerName}
            signerTitleAr={activeCertConfig.signerTitleAr || DEFAULT_CERTIFICATES.signerTitleAr}
            styleMode={activeCertConfig.signatureStyle}
            accentColor={theme.accentColor}
            mutedColor={theme.secondaryTextColor}
            highlightColor={highlightNameColor}
            emeraldColor={emeraldAccent}
          />
        </div>
      </div>
    </div>
  );
};

interface CertificateModalProps {
  certificate: CertificateEvaluation | null;
  certificatesConfig?: DynamicCertificatesConfig;
  recipientName: string;
  onRecipientNameChange: (nextName: string) => void;
  onClose: () => void;
  onDownloaded?: () => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  certificate,
  certificatesConfig,
  recipientName,
  onRecipientNameChange,
  onClose,
  onDownloaded,
}) => {
  const { config } = useDynamicConfig();
  const certConfig = certificatesConfig || config.certificates || DEFAULT_CERTIFICATES;
  const [selectedTemplate, setSelectedTemplate] = useState<CertificateTemplateId>(
    certConfig.defaultTemplate || 'royal_emerald'
  );
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (certConfig.defaultTemplate) {
      setSelectedTemplate(certConfig.defaultTemplate);
    }
  }, [certConfig.defaultTemplate]);

  useEffect(() => {
    if (!certificate) return;
    let cancelled = false;
    setRendering(true);
    const timer = setTimeout(() => {
      void renderCertificateToDataUrl(
        certificate,
        recipientName,
        certConfig,
        selectedTemplate
      )
        .then((url) => {
          if (!cancelled) {
            setPreviewUrl(url);
          }
        })
        .finally(() => {
          if (!cancelled) setRendering(false);
        });
    }, 140);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [certificate, recipientName, certConfig, selectedTemplate]);

  if (!certificate) return null;

  const handleDownloadPng = async () => {
    setRendering(true);
    try {
      await downloadCertificatePng(
        certificate,
        recipientName,
        certConfig,
        selectedTemplate
      );
      onDownloaded?.();
    } finally {
      setRendering(false);
    }
  };

  const handleDownloadPdf = async () => {
    setRendering(true);
    try {
      await downloadCertificatePdf(
        certificate,
        recipientName,
        certConfig,
        selectedTemplate
      );
      onDownloaded?.();
    } finally {
      setRendering(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  const canExport = certificate.earned;
  const levelPercent = certificate.requiredLevelXp
    ? Math.min(100, Math.round((certificate.currentXp / certificate.requiredLevelXp) * 100))
    : 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="w-full max-w-4xl rounded-3xl bg-[#0D1311] border border-[#C8A253]/45 shadow-2xl overflow-hidden my-auto">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#C8A253]/15 border border-[#C8A253]/40 flex items-center justify-center text-[#C8A253]">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="cert-modal-title"
                className="text-base sm:text-lg font-display font-bold text-[#F5F3EE]"
              >
                {certificate.titleAr}
              </h2>
              <p className="text-xs text-[#A9B2AE]">
                {canExport
                  ? 'شهادة معتمدة — اختر النموذج المفضل وحمّلها كصورة PNG أو ملف PDF بدقة الطباعة'
                  : `للحصول على هذه الشهادة يجب الوصول إلى المستوى ${toArabicDigits(certificate.requiredLevel)} (${certificate.requiredLevelTitleAr}) وإتمام شرط النشاط`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الشهادة"
            className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-[#A9B2AE] hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Required Level & Unlock Gate Status */}
        <div
          className={`px-5 py-3 border-b text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            canExport
              ? 'bg-[#0E6B4D]/20 border-[#178A64]/35 text-emerald-200'
              : 'bg-amber-950/35 border-[#C8A253]/30 text-amber-100'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2.5">
            {canExport ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <Lock className="w-4 h-4 text-[#C8A253] shrink-0 mt-0.5 sm:mt-0" />
            )}
            <div className="space-y-0.5">
              <p className="font-bold">
                {canExport
                  ? `الشهادة مفتوحة ومعتمدة — مستواك الحالي: المستوى ${toArabicDigits(certificate.currentLevel)} (${certificate.currentLevelTitleAr})`
                  : `مقفلة لحين بلوغ المستوى ${toArabicDigits(certificate.requiredLevel)} (${certificate.requiredLevelTitleAr}) وإتمام الشرط`}
              </p>
              <p className="text-[11px] opacity-85">
                {certificate.levelMet
                  ? `✓ حقّقت المستوى المطلوب (${toArabicDigits(certificate.currentLevel)} / ${toArabicDigits(certificate.requiredLevel)})`
                  : `• مستواك الحالي: المستوى ${toArabicDigits(certificate.currentLevel)} (${toArabicDigits(certificate.currentXp)} / ${toArabicDigits(certificate.requiredLevelXp)} نقطة)`}
                {' · '}
                {certificate.activityGoalMet
                  ? '✓ أتممت شرط النشاط القرآني'
                  : `• ${certificate.progressSummaryAr}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Trophy className="w-4 h-4 text-[#C8A253]" />
            <div className="w-28 h-2 rounded-full bg-black/40 overflow-hidden border border-white/10">
              <div
                className="h-full bg-[#C8A253] transition-all"
                style={{ width: `${levelPercent}%` }}
              />
            </div>
            <span className="font-mono-nums text-[11px] text-[#C8A253]">
              {toArabicDigits(levelPercent)}٪
            </span>
          </div>
        </div>

        {/* Name + Format Download Controls */}
        <div className="px-5 py-4 bg-[#0A0D0C]/75 border-b border-white/10 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <label className="flex-1 space-y-1.5 block">
              <span className="text-xs font-medium text-[#C8A253] block">
                اكتب اسمك الكامل كما تحب أن يظهر على الشهادة:
              </span>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => onRecipientNameChange(e.target.value)}
                maxLength={80}
                placeholder="مثال: أحمد بن محمد عبد الله"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#121715] border border-[#C8A253]/35 text-sm text-[#F5F3EE] placeholder:text-[#A9B2AE]/50 focus:outline-none focus:border-[#C8A253]"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void handleDownloadPng()}
                disabled={rendering || !canExport}
                title={
                  canExport
                    ? 'تحميل الشهادة كصورة PNG'
                    : `يُفتح التحميل عند الوصول للمستوى ${toArabicDigits(certificate.requiredLevel)} وإتمام الشرط`
                }
                className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-xl bg-[#C8A253] hover:bg-[#d6b368] text-[#0A0D0C] text-xs font-bold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {canExport ? <Download className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                <span>{rendering ? 'جارٍ التجهيز...' : 'تحميل كصورة (PNG)'}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
                disabled={rendering || !canExport}
                title={
                  canExport
                    ? 'تحميل الشهادة كملف PDF'
                    : `يُفتح التحميل عند الوصول للمستوى ${toArabicDigits(certificate.requiredLevel)} وإتمام الشرط`
                }
                className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-bold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {canExport ? <FileText className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                <span>تحميل كملف PDF</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={!canExport}
                className="inline-flex items-center gap-1.5 min-h-[42px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-[#F5F3EE] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Printer className="w-4 h-4 text-[#C8A253]" />
                <span>طباعة</span>
              </button>
            </div>
          </div>

          {/* 4 Visual Design Models Selector */}
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#A9B2AE]">
              <Palette className="w-3.5 h-3.5 text-[#C8A253]" />
              <span>اختر نموذج تصميم الشهادة (٤ تصاميم احترافية):</span>
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CERTIFICATE_TEMPLATES.map((tpl) => {
                const active = selectedTemplate === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2 ${
                      active
                        ? 'border-[#C8A253] bg-[#C8A253]/12'
                        : 'border-white/10 bg-[#121715]/80 hover:border-white/25'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full border shrink-0"
                      style={{
                        background: tpl.bgGradientCss,
                        borderColor: tpl.accentColor,
                      }}
                    />
                    <span className="text-[11px] font-semibold text-[#F5F3EE] truncate">
                      {tpl.nameAr}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <CertificatePreviewCard
            certificate={certificate}
            recipientName={recipientName}
            certConfig={certConfig}
            templateId={selectedTemplate}
          />

          {canExport && previewUrl ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#A9B2AE]">
              <span>
                جاهزة للتحميل الفوري بصيغة PDF قياس A4 بالعرض أو صورة PNG عالية الدقة (1800×1260).
              </span>
              <a
                href={previewUrl}
                download={`tilawa-certificate-${certificate.sealNumber.toLowerCase()}.png`}
                className="text-[#C8A253] hover:underline font-medium"
              >
                رابط التحميل المباشر للصورة
              </a>
            </div>
          ) : (
            <p className="text-xs text-amber-200/90 text-center">
              هذا نموذج معاينة فقط — تُفعّل أزرار التحميل والطباعة فور وصولك إلى المستوى{' '}
              {toArabicDigits(certificate.requiredLevel)} واستيفاء شرط الشهادة.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
