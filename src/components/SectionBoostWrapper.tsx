import React from 'react';
import { Sparkles } from 'lucide-react';
import { useDynamicConfig } from '../contexts/DynamicConfigContext';
import type { SectionEnhancementId } from '../types/tilawa';

interface SectionBoostWrapperProps {
  sectionId: SectionEnhancementId;
  children: React.ReactNode;
  className?: string;
}

export const SectionBoostWrapper: React.FC<SectionBoostWrapperProps> = ({
  sectionId,
  children,
  className = '',
}) => {
  const { config } = useDynamicConfig();
  const cfg = config.sectionEnhancements?.[sectionId];

  if (!cfg || !cfg.boosted) {
    return <>{children}</>;
  }

  const presetClass =
    cfg.stylePreset === 'royal_gold'
      ? 'section-boost-royal_gold'
      : cfg.stylePreset === 'emerald_sanctuary'
      ? 'section-boost-emerald_sanctuary'
      : cfg.stylePreset === 'obsidian_glass'
      ? 'section-boost-obsidian_glass'
      : cfg.stylePreset === 'editorial_bordered'
      ? 'section-boost-editorial_bordered'
      : 'border border-white/10 bg-[#101513]/70';

  const densityClass =
    cfg.density === 'compact'
      ? 'p-3.5 sm:p-5'
      : cfg.density === 'spacious'
      ? 'p-6 sm:p-10'
      : 'p-4 sm:p-7';

  const ringClass =
    cfg.boostLevel === 'spotlight'
      ? 'ring-1 ring-[#C8A253]/35'
      : cfg.boostLevel === 'featured'
      ? 'ring-1 ring-white/10'
      : '';

  const hasCustomBanner =
    Boolean(cfg.badgeText.trim()) ||
    Boolean(cfg.customHeadline.trim()) ||
    Boolean(cfg.customSubtitle.trim());

  return (
    <div
      data-section-boost={sectionId}
      data-boost-preset={cfg.stylePreset}
      className={`relative overflow-hidden rounded-3xl ${presetClass} ${densityClass} ${ringClass} ${className}`}
    >
      {cfg.glowAccent && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 inset-x-10 h-44 rounded-full blur-3xl opacity-30 bg-[radial-gradient(ellipse_at_center,rgba(200,162,83,0.42),rgba(14,107,77,0.18),transparent_72%)]"
        />
      )}

      {cfg.showDivider && (
        <div aria-hidden="true" className="sanctuary-hairline mb-4 sm:mb-5" />
      )}

      {hasCustomBanner && (
        <div className="relative z-10 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="space-y-1 max-w-3xl">
            {cfg.badgeText.trim() && (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C8A253]">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>{cfg.badgeText.trim()}</span>
              </div>
            )}
            {cfg.customHeadline.trim() && (
              <h3 className="text-lg sm:text-xl font-display font-bold text-[#F5F3EE]">
                {cfg.customHeadline.trim()}
              </h3>
            )}
            {cfg.customSubtitle.trim() && (
              <p className="text-xs sm:text-sm text-[#A9B2AE] leading-relaxed">
                {cfg.customSubtitle.trim()}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
};
