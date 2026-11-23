import type {
  DynamicAppConfig,
  DynamicAudioPlayerConfig,
  DynamicGeneralConfig,
  DynamicNavPageItem,
  DynamicPerformanceConfig,
  DynamicSectionItem,
  DynamicSecurityConfig,
  DynamicSeoConfig,
  DynamicThemeConfig,
  DynamicTypographyConfig,
  HomeSectionId,
  NavPageId,
  SectionDensity,
  SectionEnhancementConfig,
  SectionEnhancementId,
  SectionStylePreset,
} from '../types/tilawa';

export const DEFAULT_OTA_MANIFEST_URL =
  'https://ais-pre-yohyjyrr4bd6elu2ixq7e7-1009876701033.europe-west2.run.app/downloads/ota-manifest.json';

export const DYNAMIC_CONFIG_CACHE_KEY = 'tilawa_dynamic_config_cache_v1';
export const DYNAMIC_CONFIG_LOCAL_PREVIEW_KEY = 'tilawa_dynamic_config_preview_v1';

export interface ThemePreset {
  id: string;
  nameAr: string;
  descriptionAr: string;
  theme: DynamicThemeConfig;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'obsidian_gold',
    nameAr: 'الأوبسيديان والذهب العتيق (الافتراضي)',
    descriptionAr: 'الهوية الرسمية لمنصة تلاوة بالخلفية الداكنة والزمردي والذهبي',
    theme: {
      presetId: 'obsidian_gold',
      bgObsidian: '#0A0D0C',
      bgSurface: '#121715',
      bgElevated: '#171F1C',
      emeraldDeep: '#0E6B4D',
      emeraldSoft: '#178A64',
      goldAntique: '#C8A253',
      textPrimary: '#F5F3EE',
      textSecondary: '#A9B2AE',
    },
  },
  {
    id: 'royal_emerald',
    nameAr: 'الأخضر الحرمي الملكي',
    descriptionAr: 'خلفية زمردية داكنة مستوحاة من أروقة المسجد النبوي الشريف',
    theme: {
      presetId: 'royal_emerald',
      bgObsidian: '#07140F',
      bgSurface: '#0D211A',
      bgElevated: '#132D23',
      emeraldDeep: '#107D58',
      emeraldSoft: '#1EA074',
      goldAntique: '#D9B664',
      textPrimary: '#F7F5EF',
      textSecondary: '#A8C2B7',
    },
  },
  {
    id: 'midnight_sapphire',
    nameAr: 'ليالي السحر الكحلية',
    descriptionAr: 'تدرج ليلي هادئ مريح للعين في القراءة الليلية والقيام',
    theme: {
      presetId: 'midnight_sapphire',
      bgObsidian: '#080D16',
      bgSurface: '#101826',
      bgElevated: '#162133',
      emeraldDeep: '#1A5F7A',
      emeraldSoft: '#257FA3',
      goldAntique: '#E0B96B',
      textPrimary: '#F4F7FB',
      textSecondary: '#9FB1C8',
    },
  },
  {
    id: 'warm_kaaba',
    nameAr: 'وقار الحرم المكي',
    descriptionAr: 'أسود مخملي عميق مع لمسات ذهبية ساطعة وتباين واضح',
    theme: {
      presetId: 'warm_kaaba',
      bgObsidian: '#09090B',
      bgSurface: '#141316',
      bgElevated: '#1D1B20',
      emeraldDeep: '#8A6824',
      emeraldSoft: '#B08936',
      goldAntique: '#E3BE6A',
      textPrimary: '#FAF8F3',
      textSecondary: '#B9B4AA',
    },
  },
];

export const DEFAULT_TYPOGRAPHY: DynamicTypographyConfig = {
  displayFont: 'Amiri',
  bodyFont: 'IBM Plex Sans Arabic',
  baseFontSizePx: 16,
  cardRadiusPx: 16,
  glassBlurPx: 16,
};

export const DEFAULT_AUDIO_PLAYER: DynamicAudioPlayerConfig = {
  defaultVolume: 0.9,
  defaultPlaybackRate: 1,
  autoPlayNext: true,
  showWaveform: true,
  enableSleepTimer: true,
  enableSegmentLoop: true,
};

export const DEFAULT_SEO: DynamicSeoConfig = {
  metaTitle: 'TILAWA | تلاوة — عِش مع القرآن | مصحف وتلاوات ١٠٩ قارئ',
  metaDescription:
    'منصة تلاوة (TILAWA) القرآنية المجانية: استمع إلى ١٠٩ من أعلام القراء والشيوخ المصريين الراحلين والأصوات الهادئة، وبودكاست بصيرة (١٢٠ حلقة صوتية)، وتصفح المصحف الشريف بالرسم العثماني (٦٠٤ صفحة) مع التفسير والتحفيظ دون إنترنت.',
  metaKeywords:
    'تلاوة, القرآن الكريم, المصحف الشريف, المنشاوي, عبد الباسط, الحصري, مصطفى إسماعيل, البهتيمي, بصيرة, تحفيظ القرآن, التفسير الميسر, TILAWA',
  ogTitle: 'TILAWA | تلاوة — عِش مع القرآن',
  ogDescription:
    'منصة قرآنية متكاملة تجمع بين ١٠٩ من أعلام التلاوة وبودكاست بصيرة والمصحف الشريف بالرسم العثماني والتفسير الميسر والمعلم للتحفيظ دون إنترنت.',
  canonicalUrl: 'https://phat-invention-llcf1.web.app/',
  robotsIndex: true,
};

export const DEFAULT_PERFORMANCE: DynamicPerformanceConfig = {
  precacheQuranOffline: true,
  prefetchNextSurah: true,
  cacheTtlHours: 24,
};

export const DEFAULT_SECURITY: DynamicSecurityConfig = {
  blockedReciterKeywords: ['عمر بن ضياء الدين', 'omar ben diaa', 'omar diaa', 'عمر بن ضياء'],
  disabledReciterIds: [],
  allowedAudioDomains: [
    'server6.mp3quran.net',
    'server7.mp3quran.net',
    'server8.mp3quran.net',
    'server9.mp3quran.net',
    'server10.mp3quran.net',
    'server11.mp3quran.net',
    'server12.mp3quran.net',
    'server13.mp3quran.net',
    'server14.mp3quran.net',
    'server15.mp3quran.net',
    'cdn.mp3quran.net',
    'archive.org',
    'mirrors.quranicaudio.com',
  ],
  sessionTimeoutMinutes: 720,
};

export const DEFAULT_GENERAL: DynamicGeneralConfig = {
  maintenanceMode: false,
  maintenanceMessage:
    'تجرى حاليًا تحسينات سريعة على بعض التلاوات — المصحف الشريف والمشغل متاحان كالمعتاد.',
  showHijriDate: true,
};

export interface CertificateTemplateTheme {
  id: 'royal_emerald' | 'royal_ivory' | 'kaaba_obsidian' | 'andalusi_sapphire';
  nameAr: string;
  taglineAr: string;
  bgGradientCss: string;
  bgInnerStop: string;
  bgMidStop: string;
  bgOuterStop: string;
  primaryTextColor: string;
  secondaryTextColor: string;
  bodyTextColor: string;
  accentColor: string;
  accentSoftColor: string;
  emeraldColor: string;
  namePlateBg: string;
  badgeBg: string;
  badgeText: string;
  isLightPaper: boolean;
}

export const CERTIFICATE_TEMPLATES: CertificateTemplateTheme[] = [
  {
    id: 'royal_emerald',
    nameAr: 'الملكي الزمردي المذهب',
    taglineAr: 'أخضر زمردي عميق بزخارف ذهبية عريقة',
    bgGradientCss: 'linear-gradient(135deg, #132A22 0%, #0A1612 52%, #060B09 100%)',
    bgInnerStop: '#153026',
    bgMidStop: '#0B1813',
    bgOuterStop: '#060A09',
    primaryTextColor: '#FAF7F0',
    secondaryTextColor: '#A9BDB4',
    bodyTextColor: '#EBE6DC',
    accentColor: '#D6B15C',
    accentSoftColor: 'rgba(214, 177, 92, 0.38)',
    emeraldColor: '#22A378',
    namePlateBg: 'rgba(214, 177, 92, 0.10)',
    badgeBg: '#0E6B4D',
    badgeText: '#FFFFFF',
    isLightPaper: false,
  },
  {
    id: 'royal_ivory',
    nameAr: 'الرقّ الأندلسي الكريمي',
    taglineAr: 'ورق إجازة أرشيفي فاتح مثالي للطباعة',
    bgGradientCss: 'linear-gradient(135deg, #FCF8EC 0%, #F5ECD4 55%, #EADBC0 100%)',
    bgInnerStop: '#FFFDF6',
    bgMidStop: '#F6EED9',
    bgOuterStop: '#E9D9BA',
    primaryTextColor: '#133126',
    secondaryTextColor: '#5A5041',
    bodyTextColor: '#2B261E',
    accentColor: '#9E7324',
    accentSoftColor: 'rgba(158, 115, 36, 0.35)',
    emeraldColor: '#0E6B4D',
    namePlateBg: 'rgba(158, 115, 36, 0.08)',
    badgeBg: '#133A2C',
    badgeText: '#FBF5E6',
    isLightPaper: true,
  },
  {
    id: 'kaaba_obsidian',
    nameAr: 'الكسوة الفحمي الفاخر',
    taglineAr: 'أسود مخملي مهيب بحزام الكسوة المذهب',
    bgGradientCss: 'linear-gradient(135deg, #1B1813 0%, #0D0C0A 55%, #050506 100%)',
    bgInnerStop: '#1E1A13',
    bgMidStop: '#0E0D0B',
    bgOuterStop: '#050506',
    primaryTextColor: '#FDFBF6',
    secondaryTextColor: '#B8B0A0',
    bodyTextColor: '#EFEAE0',
    accentColor: '#E8C56E',
    accentSoftColor: 'rgba(232, 197, 110, 0.42)',
    emeraldColor: '#E8C56E',
    namePlateBg: 'rgba(232, 197, 110, 0.09)',
    badgeBg: '#8B6821',
    badgeText: '#FFFDF7',
    isLightPaper: false,
  },
  {
    id: 'andalusi_sapphire',
    nameAr: 'اللازوردي الشامي',
    taglineAr: 'كحلي ليلي هادئ بإطار ذهبي وفيروزي',
    bgGradientCss: 'linear-gradient(135deg, #132740 0%, #0A1525 55%, #060C16 100%)',
    bgInnerStop: '#152B46',
    bgMidStop: '#0B182A',
    bgOuterStop: '#060C16',
    primaryTextColor: '#F4F8FD',
    secondaryTextColor: '#9DB2C9',
    bodyTextColor: '#E3ECF5',
    accentColor: '#DFC070',
    accentSoftColor: 'rgba(223, 192, 112, 0.4)',
    emeraldColor: '#38BDF8',
    namePlateBg: 'rgba(56, 189, 248, 0.08)',
    badgeBg: '#155A7A',
    badgeText: '#F4F8FD',
    isLightPaper: false,
  },
];

export function getCertificateTemplateTheme(templateId?: string): CertificateTemplateTheme {
  return (
    CERTIFICATE_TEMPLATES.find((t) => t.id === templateId) || CERTIFICATE_TEMPLATES[0]
  );
}

export const DEFAULT_CERTIFICATES = {
  platformTitleAr: 'منصة تلاوة للقرآن الكريم · TILAWA',
  signerName: 'منصة تلاوة · TILAWA',
  signerTitleAr: 'إدارة منصة تلاوة للقرآن الكريم',
  signatureStyle: 'calligraphic_gold' as const,
  defaultTemplate: 'royal_emerald' as const,
  stampLabelAr: 'ختم تلاوة المعتمد',
  blessingVerseAr: '«خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ»',
  memorizationAyahGoal: 140,
  listeningMinutesGoal: 15,
  listeningSurahsGoal: 5,
  readingPagesGoal: 20,
  tahfeezSessionsGoal: 5,
  requiredLevelMemorization: 3,
  requiredLevelListening: 2,
  requiredLevelExcellence: 4,
  requiredLevelKhatmah: 5,
};

export const DEFAULT_MUSHAF = {
  defaultTheme: 'obsidian' as const,
  defaultFontSizePx: 26,
  showTafsirByDefault: false,
  defaultReciterId: 'husary',
  enableJuzQuickNav: true,
};

export const DEFAULT_TAHFEEZ = {
  defaultRepeatsPerAyah: 3,
  defaultPauseSeconds: 2,
  enableVoiceHideByDefault: false,
  autoAdvanceAyah: true,
};

export const DEFAULT_HOME_SECTIONS: DynamicSectionItem[] = [
  { id: 'hero', label: 'واجهة الترحيب والآية المختارة', visible: true, order: 0 },
  { id: 'continue', label: 'متابعة آخر استماع وقراءة', visible: true, order: 1 },
  { id: 'reciters', label: 'نخبة أعلام التلاوة (مكتبة ١٠٩ قارئ)', visible: true, order: 2 },
  { id: 'stations', label: 'إذاعة تلاوة — محطات مختارة', visible: true, order: 3 },
  { id: 'basiraShowcase', label: 'بصيرة — بودكاست دعوي صوتي', visible: true, order: 4 },
  { id: 'latest', label: 'مختارات التلاوة والمصحف والتحفيظ', visible: true, order: 5 },
  { id: 'mostListened', label: 'السور الأكثر استماعًا', visible: false, order: 6 },
  { id: 'mushafShowcase', label: 'واجهة المصحف الشريف والتحفيظ', visible: true, order: 7 },
  { id: 'feedback', label: 'آراء المستخدمين وتقييم الأداء', visible: true, order: 8 },
];

export const DEFAULT_NAV_PAGES: DynamicNavPageItem[] = [
  { id: 'home', label: 'الرئيسية', visible: true, order: 0 },
  { id: 'reciters', label: 'القراء', visible: true, order: 1 },
  { id: 'basira', label: 'بصيرة', visible: true, order: 2 },
  { id: 'mushaf', label: 'المصحف', visible: true, order: 3 },
  { id: 'tahfeez', label: 'التحفيظ', visible: true, order: 4 },
  { id: 'search', label: 'البحث', visible: true, order: 5 },
  { id: 'library', label: 'مكتبتي', visible: true, order: 6 },
];

export interface SectionEnhancementTargetMeta {
  id: SectionEnhancementId;
  labelAr: string;
  groupAr: 'الرئيسية' | 'الأقسام المستقلة';
  descriptionAr: string;
}

export const SECTION_ENHANCEMENT_TARGETS: SectionEnhancementTargetMeta[] = [
  {
    id: 'hero',
    labelAr: 'واجهة الترحيب الرئيسية',
    groupAr: 'الرئيسية',
    descriptionAr: 'الإطار الافتتاحي والآية المختارة وأزرار البدء الفوري',
  },
  {
    id: 'continue',
    labelAr: 'متابعة الاستماع والقراءة',
    groupAr: 'الرئيسية',
    descriptionAr: 'بطاقة متابعة آخر تلاوة وآخر صفحة مصحف',
  },
  {
    id: 'reciters',
    labelAr: 'نخبة أعلام التلاوة بالرئيسية',
    groupAr: 'الرئيسية',
    descriptionAr: 'شبكة القراء المميزين على الصفحة الرئيسية',
  },
  {
    id: 'stations',
    labelAr: 'إذاعة تلاوة — المحطات',
    groupAr: 'الرئيسية',
    descriptionAr: 'محطات الخشوع والمدرسة المصرية والترتيل',
  },
  {
    id: 'basiraShowcase',
    labelAr: 'واجهة بصيرة بالرئيسية',
    groupAr: 'الرئيسية',
    descriptionAr: 'مختارات بودكاست بصيرة والدعاة في الصفحة الرئيسية',
  },
  {
    id: 'latest',
    labelAr: 'مختارات التلاوة والمصحف والتحفيظ',
    groupAr: 'الرئيسية',
    descriptionAr: 'بطاقات الانتقال السريع للختمة والمصحف',
  },
  {
    id: 'mostListened',
    labelAr: 'السور الأكثر استماعًا',
    groupAr: 'الرئيسية',
    descriptionAr: 'قائمة السور الأكثر تشغيلًا على المنصة',
  },
  {
    id: 'mushafShowcase',
    labelAr: 'واجهة المصحف والتحفيظ بالرئيسية',
    groupAr: 'الرئيسية',
    descriptionAr: 'إبراز مصحف المدينة والمعلم للتحفيظ والشهادات',
  },
  {
    id: 'feedback',
    labelAr: 'آراء المستخدمين وتقييم الأداء',
    groupAr: 'الرئيسية',
    descriptionAr: 'عرض متوسط تقييم الأداء وآراء الزوار ونموذج إبداء الرأي',
  },
  {
    id: 'recitersDirectory',
    labelAr: 'قسم مكتبة القراء (١٠٩ قارئ)',
    groupAr: 'الأقسام المستقلة',
    descriptionAr: 'رأس وأقسام دليل القراء والمدارس القرآنية',
  },
  {
    id: 'basiraSection',
    labelAr: 'قسم بصيرة — البودكاست الدعوي',
    groupAr: 'الأقسام المستقلة',
    descriptionAr: 'الواجهة الكاملة لقسم بصيرة والبوكسات الموضوعية',
  },
  {
    id: 'mushafSection',
    labelAr: 'قسم المصحف الشريف',
    groupAr: 'الأقسام المستقلة',
    descriptionAr: 'إطار وشريط القراءة العثمانية في المصحف',
  },
  {
    id: 'tahfeezSection',
    labelAr: 'قسم التحفيظ والمعلم الذكي',
    groupAr: 'الأقسام المستقلة',
    descriptionAr: 'واجهة استوديو التحفيظ، التكرار، والاختبارات',
  },
];

export const SECTION_STYLE_PRESETS: Array<{
  id: SectionStylePreset;
  nameAr: string;
  taglineAr: string;
  previewBorder: string;
  previewBg: string;
}> = [
  {
    id: 'default',
    nameAr: 'التنسيق القياسي الهادئ',
    taglineAr: 'يحافظ على المظهر الأصلي المتناسق للمنصة',
    previewBorder: 'rgba(255,255,255,0.12)',
    previewBg: '#0E1311',
  },
  {
    id: 'royal_gold',
    nameAr: 'الذهبي الملكي المضيء',
    taglineAr: 'إطار ذهبي مصقول مع هالة خفيفة وعنوان بارز',
    previewBorder: 'rgba(200,162,83,0.45)',
    previewBg: 'linear-gradient(155deg, rgba(28,34,26,0.94), rgba(10,13,12,0.98))',
  },
  {
    id: 'emerald_sanctuary',
    nameAr: 'الرواق الزمردي الحرمي',
    taglineAr: 'تدرج زمردي عميق مريح للعين مع خطوط ذهبية رفيعة',
    previewBorder: 'rgba(23,138,100,0.45)',
    previewBg: 'linear-gradient(155deg, rgba(12,34,26,0.94), rgba(8,16,13,0.98))',
  },
  {
    id: 'obsidian_glass',
    nameAr: 'الأوبسيديان الزجاجي المصقول',
    taglineAr: 'لوح زجاجي داكن عالي التباين مع حافة علوية دقيقة',
    previewBorder: 'rgba(255,255,255,0.16)',
    previewBg: 'linear-gradient(180deg, rgba(22,28,26,0.9), rgba(10,13,12,0.96))',
  },
  {
    id: 'editorial_bordered',
    nameAr: 'التحريري المخطوط المؤطّر',
    taglineAr: 'إطار معماري مزدوج هادئ يبرز القيمة التحريرية للقسم',
    previewBorder: 'rgba(200,162,83,0.3)',
    previewBg: 'linear-gradient(180deg, rgba(16,20,18,0.95), rgba(9,11,10,0.98))',
  },
];

export const DEFAULT_SECTION_ENHANCEMENT_ITEM: SectionEnhancementConfig = {
  boosted: false,
  boostLevel: 'standard',
  stylePreset: 'default',
  density: 'comfortable',
  glowAccent: false,
  showDivider: false,
  badgeText: '',
  customHeadline: '',
  customSubtitle: '',
};

export const DEFAULT_SECTION_ENHANCEMENTS: Record<string, SectionEnhancementConfig> =
  Object.fromEntries(
    SECTION_ENHANCEMENT_TARGETS.map((t) => [t.id, { ...DEFAULT_SECTION_ENHANCEMENT_ITEM }])
  );

const VALID_STYLE_PRESETS = new Set<SectionStylePreset>([
  'default',
  'royal_gold',
  'emerald_sanctuary',
  'obsidian_glass',
  'editorial_bordered',
]);
const VALID_DENSITIES = new Set<SectionDensity>(['compact', 'comfortable', 'spacious']);
const VALID_BOOST_LEVELS = new Set(['standard', 'featured', 'spotlight']);

export function mergeSectionEnhancements(
  raw: unknown
): Record<string, SectionEnhancementConfig> {
  const result: Record<string, SectionEnhancementConfig> = {};
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  for (const target of SECTION_ENHANCEMENT_TARGETS) {
    const entry = src[target.id];
    const rec = entry && typeof entry === 'object' ? (entry as Partial<SectionEnhancementConfig>) : {};
    result[target.id] = {
      boosted: typeof rec.boosted === 'boolean' ? rec.boosted : false,
      boostLevel:
        typeof rec.boostLevel === 'string' && VALID_BOOST_LEVELS.has(rec.boostLevel)
          ? (rec.boostLevel as SectionEnhancementConfig['boostLevel'])
          : 'standard',
      stylePreset:
        typeof rec.stylePreset === 'string' && VALID_STYLE_PRESETS.has(rec.stylePreset as SectionStylePreset)
          ? (rec.stylePreset as SectionStylePreset)
          : 'default',
      density:
        typeof rec.density === 'string' && VALID_DENSITIES.has(rec.density as SectionDensity)
          ? (rec.density as SectionDensity)
          : 'comfortable',
      glowAccent: typeof rec.glowAccent === 'boolean' ? rec.glowAccent : false,
      showDivider: typeof rec.showDivider === 'boolean' ? rec.showDivider : false,
      badgeText: truncOptionalStr(rec.badgeText, 50, ''),
      customHeadline: truncOptionalStr(rec.customHeadline, 120, ''),
      customSubtitle: truncOptionalStr(rec.customSubtitle, 240, ''),
    };
  }
  return result;
}

export const DEFAULT_DYNAMIC_CONFIG: DynamicAppConfig = {
  id: 'live',
  version: 1,
  theme: { ...THEME_PRESETS[0].theme },
  texts: {
    siteName: 'TILAWA | تلاوة',
    slogan: 'عِش مع القرآن',
    heroBadge: 'TILAWA | تلاوة · عِش مع القرآن',
    heroTitle: 'مرحبًا بك في رحاب القرآن الكريم وتلاوات أعلام القراء',
    heroSubtitle:
      'استمع مباشرةً دون تسجيل دخول إلى ١٠٩ من أعلام التلاوة والشيوخ المصريين الراحلين والأصوات الهادئة وبودكاست بصيرة (١٢٠ حلقة صوتية)، وتصفح المصحف الشريف بالرسم العثماني دون إنترنت.',
    ctaListenLabel: 'ابدأ الاستماع',
    ctaMushafLabel: 'المصحف الشريف',
    ctaTahfeezLabel: 'المعلم للتحفيظ',
    announcementEnabled: false,
    announcementText: '',
    mushafShowcaseTitle: 'مصحف المدينة المنورة بجميع السور الـ١١٤ والأجزاء الـ٣٠',
    mushafShowcaseSubtitle:
      'يفتح المصحف في واجهة مستقلة هادئة بخط الرسم العثماني، مع ٦٠٤ صفحات متكاملة وفهرس سريع ومظاهر قراءة ليلية وكريمية وحفظ تلقائي لموضع القراءة.',
    footerDescription:
      'منصة قرآنية متكاملة تجمع بين عذوبة التلاوات الخالدة لـ ١٠٩ من كبار القراء والشيوخ المصريين الراحلين، وبودكاست بصيرة الدعوي (١٢٠ حلقة)، وقراءة المصحف الشريف بالرسم العثماني كاملًا دون إنترنت.',
  },
  images: {
    heroBackdropUrl: '',
  },
  homeSections: DEFAULT_HOME_SECTIONS.map((s) => ({ ...s })),
  navPages: DEFAULT_NAV_PAGES.map((p) => ({ ...p })),
  ota: {
    manifestUrl: DEFAULT_OTA_MANIFEST_URL,
    autoCheck: true,
    releaseNotes:
      'الإصدار النهائي الجاهز للنشر: مكتبة ١٠٩ قارئ متكاملة، ١٢٠ حلقة صوتية و١٥ سلسلة في بصيرة مع صور المشايخ الحقيقية، تسريع التحميل وتقسيم الحزم.',
  },
  typography: { ...DEFAULT_TYPOGRAPHY },
  audioPlayer: { ...DEFAULT_AUDIO_PLAYER },
  seo: { ...DEFAULT_SEO },
  performance: { ...DEFAULT_PERFORMANCE },
  security: {
    blockedReciterKeywords: [...DEFAULT_SECURITY.blockedReciterKeywords],
    disabledReciterIds: [...DEFAULT_SECURITY.disabledReciterIds],
    allowedAudioDomains: [...DEFAULT_SECURITY.allowedAudioDomains],
    sessionTimeoutMinutes: DEFAULT_SECURITY.sessionTimeoutMinutes,
  },
  general: { ...DEFAULT_GENERAL },
  certificates: { ...DEFAULT_CERTIFICATES },
  mushaf: { ...DEFAULT_MUSHAF },
  tahfeez: { ...DEFAULT_TAHFEEZ },
  sectionEnhancements: { ...DEFAULT_SECTION_ENHANCEMENTS },
  featuredReciterOverrides: [],
  updatedBy: 'system',
};

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export function isValidHexColor(color: unknown): color is string {
  return typeof color === 'string' && HEX_COLOR_RE.test(color.trim());
}

export function sanitizeHexColor(color: unknown, fallback: string): string {
  return isValidHexColor(color) ? color.trim().toUpperCase() : fallback;
}

export function isCustomTheme(theme: DynamicThemeConfig): boolean {
  const def = THEME_PRESETS[0].theme;
  return (
    theme.bgObsidian.toUpperCase() !== def.bgObsidian.toUpperCase() ||
    theme.bgSurface.toUpperCase() !== def.bgSurface.toUpperCase() ||
    theme.bgElevated.toUpperCase() !== def.bgElevated.toUpperCase() ||
    theme.emeraldDeep.toUpperCase() !== def.emeraldDeep.toUpperCase() ||
    theme.emeraldSoft.toUpperCase() !== def.emeraldSoft.toUpperCase() ||
    theme.goldAntique.toUpperCase() !== def.goldAntique.toUpperCase() ||
    theme.textPrimary.toUpperCase() !== def.textPrimary.toUpperCase() ||
    theme.textSecondary.toUpperCase() !== def.textSecondary.toUpperCase()
  );
}

function truncStr(val: unknown, max: number, fallback: string): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed.slice(0, max) : fallback;
}

function truncOptionalStr(val: unknown, max: number, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  return val.trim().slice(0, max);
}

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.min(max, Math.max(min, val));
}

function sanitizeStringArray(raw: unknown, maxItems: number, maxLen: number, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().slice(0, maxLen);
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function sanitizeImageUrl(url: unknown, fallback: string): string {
  if (typeof url !== 'string') return fallback;
  const trimmed = url.trim().slice(0, 600);
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:image/') || trimmed.startsWith('/')) {
    return trimmed;
  }
  return fallback;
}

export function mergeHomeSections(raw: unknown): DynamicSectionItem[] {
  const validIds = new Set<HomeSectionId>(DEFAULT_HOME_SECTIONS.map((s) => s.id));
  const incomingList = Array.isArray(raw) ? raw : [];
  const seen = new Set<HomeSectionId>();
  const result: DynamicSectionItem[] = [];

  for (const item of incomingList) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Partial<DynamicSectionItem>;
    if (!rec.id || !validIds.has(rec.id) || seen.has(rec.id)) continue;
    const def = DEFAULT_HOME_SECTIONS.find((d) => d.id === rec.id)!;
    seen.add(rec.id);
    result.push({
      id: rec.id,
      label: truncStr(rec.label, 100, def.label),
      visible: typeof rec.visible === 'boolean' ? rec.visible : def.visible,
      order: typeof rec.order === 'number' && Number.isFinite(rec.order) ? rec.order : result.length,
    });
  }

  for (const def of DEFAULT_HOME_SECTIONS) {
    if (!seen.has(def.id)) {
      result.push({ ...def, order: result.length });
    }
  }

  return result
    .sort((a, b) => a.order - b.order)
    .map((item, idx) => ({ ...item, order: idx }));
}

export function mergeNavPages(raw: unknown): DynamicNavPageItem[] {
  const validIds = new Set<NavPageId>(DEFAULT_NAV_PAGES.map((p) => p.id));
  const incomingList = Array.isArray(raw) ? raw : [];
  const seen = new Set<NavPageId>();
  const result: DynamicNavPageItem[] = [];

  for (const item of incomingList) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Partial<DynamicNavPageItem>;
    if (!rec.id || !validIds.has(rec.id) || seen.has(rec.id)) continue;
    const def = DEFAULT_NAV_PAGES.find((d) => d.id === rec.id)!;
    seen.add(rec.id);
    result.push({
      id: rec.id,
      label: truncStr(rec.label, 40, def.label),
      visible: rec.id === 'home' ? true : typeof rec.visible === 'boolean' ? rec.visible : def.visible,
      order: typeof rec.order === 'number' && Number.isFinite(rec.order) ? rec.order : result.length,
    });
  }

  for (const def of DEFAULT_NAV_PAGES) {
    if (!seen.has(def.id)) {
      result.push({ ...def, order: result.length });
    }
  }

  return result
    .sort((a, b) => a.order - b.order)
    .map((item, idx) => ({ ...item, order: idx }));
}

const VALID_DISPLAY_FONTS = new Set<DynamicTypographyConfig['displayFont']>([
  'Amiri',
  'IBM Plex Sans Arabic',
  'Cairo',
  'Noto Naskh Arabic',
]);

const VALID_BODY_FONTS = new Set<DynamicTypographyConfig['bodyFont']>([
  'IBM Plex Sans Arabic',
  'Cairo',
  'Readex Pro',
]);

export function mergeDynamicConfig(raw: unknown): DynamicAppConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_DYNAMIC_CONFIG,
      theme: { ...DEFAULT_DYNAMIC_CONFIG.theme },
      texts: { ...DEFAULT_DYNAMIC_CONFIG.texts },
      images: { ...DEFAULT_DYNAMIC_CONFIG.images },
      homeSections: DEFAULT_DYNAMIC_CONFIG.homeSections.map((s) => ({ ...s })),
      navPages: DEFAULT_DYNAMIC_CONFIG.navPages.map((p) => ({ ...p })),
      ota: { ...DEFAULT_DYNAMIC_CONFIG.ota },
      typography: { ...DEFAULT_TYPOGRAPHY },
      audioPlayer: { ...DEFAULT_AUDIO_PLAYER },
      seo: { ...DEFAULT_SEO },
      performance: { ...DEFAULT_PERFORMANCE },
      security: {
        blockedReciterKeywords: [...DEFAULT_SECURITY.blockedReciterKeywords],
        disabledReciterIds: [...DEFAULT_SECURITY.disabledReciterIds],
        allowedAudioDomains: [...DEFAULT_SECURITY.allowedAudioDomains],
        sessionTimeoutMinutes: DEFAULT_SECURITY.sessionTimeoutMinutes,
      },
      general: { ...DEFAULT_GENERAL },
      certificates: { ...DEFAULT_CERTIFICATES },
      mushaf: { ...DEFAULT_MUSHAF },
      tahfeez: { ...DEFAULT_TAHFEEZ },
      sectionEnhancements: mergeSectionEnhancements(undefined),
      featuredReciterOverrides: [],
    };
  }

  const r = raw as Partial<DynamicAppConfig>;
  const rt: Partial<DynamicThemeConfig> = (r.theme && typeof r.theme === 'object' ? r.theme : {}) as Partial<DynamicThemeConfig>;
  const rtxt: Partial<DynamicAppConfig['texts']> = (r.texts && typeof r.texts === 'object' ? r.texts : {}) as Partial<DynamicAppConfig['texts']>;
  const rimg: Partial<DynamicAppConfig['images']> = (r.images && typeof r.images === 'object' ? r.images : {}) as Partial<DynamicAppConfig['images']>;
  const rota: Partial<DynamicAppConfig['ota']> = (r.ota && typeof r.ota === 'object' ? r.ota : {}) as Partial<DynamicAppConfig['ota']>;
  const rtyp: Partial<DynamicTypographyConfig> = (r.typography && typeof r.typography === 'object' ? r.typography : {}) as Partial<DynamicTypographyConfig>;
  const rply: Partial<DynamicAudioPlayerConfig> = (r.audioPlayer && typeof r.audioPlayer === 'object' ? r.audioPlayer : {}) as Partial<DynamicAudioPlayerConfig>;
  const rseo: Partial<DynamicSeoConfig> = (r.seo && typeof r.seo === 'object' ? r.seo : {}) as Partial<DynamicSeoConfig>;
  const rprf: Partial<DynamicPerformanceConfig> = (r.performance && typeof r.performance === 'object' ? r.performance : {}) as Partial<DynamicPerformanceConfig>;
  const rsec: Partial<DynamicSecurityConfig> = (r.security && typeof r.security === 'object' ? r.security : {}) as Partial<DynamicSecurityConfig>;
  const rgen: Partial<DynamicGeneralConfig> = (r.general && typeof r.general === 'object' ? r.general : {}) as Partial<DynamicGeneralConfig>;
  const rcert = (r.certificates && typeof r.certificates === 'object' ? r.certificates : {}) as Partial<typeof DEFAULT_CERTIFICATES>;
  const rmsh = (r.mushaf && typeof r.mushaf === 'object' ? r.mushaf : {}) as Partial<typeof DEFAULT_MUSHAF>;
  const rtah = (r.tahfeez && typeof r.tahfeez === 'object' ? r.tahfeez : {}) as Partial<typeof DEFAULT_TAHFEEZ>;

  const defTheme = DEFAULT_DYNAMIC_CONFIG.theme;
  const defTexts = DEFAULT_DYNAMIC_CONFIG.texts;
  const defOta = DEFAULT_DYNAMIC_CONFIG.ota;

  return {
    id: typeof r.id === 'string' && r.id.trim() ? r.id.trim().slice(0, 64) : 'live',
    version:
      typeof r.version === 'number' && Number.isFinite(r.version) && r.version >= 1
        ? Math.floor(r.version)
        : 1,
    theme: {
      presetId: truncStr(rt.presetId, 40, defTheme.presetId),
      bgObsidian: sanitizeHexColor(rt.bgObsidian, defTheme.bgObsidian),
      bgSurface: sanitizeHexColor(rt.bgSurface, defTheme.bgSurface),
      bgElevated: sanitizeHexColor(rt.bgElevated, defTheme.bgElevated),
      emeraldDeep: sanitizeHexColor(rt.emeraldDeep, defTheme.emeraldDeep),
      emeraldSoft: sanitizeHexColor(rt.emeraldSoft, defTheme.emeraldSoft),
      goldAntique: sanitizeHexColor(rt.goldAntique, defTheme.goldAntique),
      textPrimary: sanitizeHexColor(rt.textPrimary, defTheme.textPrimary),
      textSecondary: sanitizeHexColor(rt.textSecondary, defTheme.textSecondary),
    },
    texts: {
      siteName: truncStr(rtxt.siteName, 100, defTexts.siteName),
      slogan: truncStr(rtxt.slogan, 120, defTexts.slogan),
      heroBadge: truncStr(rtxt.heroBadge, 120, defTexts.heroBadge),
      heroTitle: truncStr(rtxt.heroTitle, 300, defTexts.heroTitle),
      heroSubtitle: truncStr(rtxt.heroSubtitle, 600, defTexts.heroSubtitle),
      ctaListenLabel: truncStr(rtxt.ctaListenLabel, 60, defTexts.ctaListenLabel),
      ctaMushafLabel: truncStr(rtxt.ctaMushafLabel, 60, defTexts.ctaMushafLabel),
      ctaTahfeezLabel: truncStr(rtxt.ctaTahfeezLabel, 60, defTexts.ctaTahfeezLabel),
      announcementEnabled:
        typeof rtxt.announcementEnabled === 'boolean'
          ? rtxt.announcementEnabled
          : defTexts.announcementEnabled,
      announcementText: truncOptionalStr(rtxt.announcementText, 300, defTexts.announcementText),
      mushafShowcaseTitle: truncStr(rtxt.mushafShowcaseTitle, 200, defTexts.mushafShowcaseTitle),
      mushafShowcaseSubtitle: truncStr(
        rtxt.mushafShowcaseSubtitle,
        500,
        defTexts.mushafShowcaseSubtitle
      ),
      footerDescription: truncStr(rtxt.footerDescription, 600, defTexts.footerDescription),
    },
    images: {
      heroBackdropUrl: sanitizeImageUrl(rimg.heroBackdropUrl, DEFAULT_DYNAMIC_CONFIG.images.heroBackdropUrl),
    },
    homeSections: mergeHomeSections(r.homeSections),
    navPages: mergeNavPages(r.navPages),
    ota: {
      manifestUrl: truncStr(rota.manifestUrl, 500, defOta.manifestUrl),
      autoCheck: typeof rota.autoCheck === 'boolean' ? rota.autoCheck : defOta.autoCheck,
      releaseNotes: truncOptionalStr(rota.releaseNotes, 500, defOta.releaseNotes),
    },
    typography: {
      displayFont:
        rtyp.displayFont && VALID_DISPLAY_FONTS.has(rtyp.displayFont)
          ? rtyp.displayFont
          : DEFAULT_TYPOGRAPHY.displayFont,
      bodyFont:
        rtyp.bodyFont && VALID_BODY_FONTS.has(rtyp.bodyFont)
          ? rtyp.bodyFont
          : DEFAULT_TYPOGRAPHY.bodyFont,
      baseFontSizePx: Math.round(clampNum(rtyp.baseFontSizePx, 13, 20, DEFAULT_TYPOGRAPHY.baseFontSizePx)),
      cardRadiusPx: Math.round(clampNum(rtyp.cardRadiusPx, 6, 32, DEFAULT_TYPOGRAPHY.cardRadiusPx)),
      glassBlurPx: Math.round(clampNum(rtyp.glassBlurPx, 0, 32, DEFAULT_TYPOGRAPHY.glassBlurPx)),
    },
    audioPlayer: {
      defaultVolume: Number(clampNum(rply.defaultVolume, 0.1, 1, DEFAULT_AUDIO_PLAYER.defaultVolume).toFixed(2)),
      defaultPlaybackRate: Number(clampNum(rply.defaultPlaybackRate, 0.5, 2, DEFAULT_AUDIO_PLAYER.defaultPlaybackRate).toFixed(2)),
      autoPlayNext: typeof rply.autoPlayNext === 'boolean' ? rply.autoPlayNext : DEFAULT_AUDIO_PLAYER.autoPlayNext,
      showWaveform: typeof rply.showWaveform === 'boolean' ? rply.showWaveform : DEFAULT_AUDIO_PLAYER.showWaveform,
      enableSleepTimer:
        typeof rply.enableSleepTimer === 'boolean'
          ? rply.enableSleepTimer
          : DEFAULT_AUDIO_PLAYER.enableSleepTimer,
      enableSegmentLoop:
        typeof rply.enableSegmentLoop === 'boolean'
          ? rply.enableSegmentLoop
          : DEFAULT_AUDIO_PLAYER.enableSegmentLoop,
    },
    seo: {
      metaTitle: truncStr(rseo.metaTitle, 140, DEFAULT_SEO.metaTitle),
      metaDescription: truncStr(rseo.metaDescription, 400, DEFAULT_SEO.metaDescription),
      metaKeywords: truncStr(rseo.metaKeywords, 400, DEFAULT_SEO.metaKeywords),
      ogTitle: truncStr(rseo.ogTitle, 140, DEFAULT_SEO.ogTitle),
      ogDescription: truncStr(rseo.ogDescription, 400, DEFAULT_SEO.ogDescription),
      canonicalUrl: truncStr(rseo.canonicalUrl, 300, DEFAULT_SEO.canonicalUrl),
      robotsIndex: typeof rseo.robotsIndex === 'boolean' ? rseo.robotsIndex : DEFAULT_SEO.robotsIndex,
    },
    performance: {
      precacheQuranOffline:
        typeof rprf.precacheQuranOffline === 'boolean'
          ? rprf.precacheQuranOffline
          : DEFAULT_PERFORMANCE.precacheQuranOffline,
      prefetchNextSurah:
        typeof rprf.prefetchNextSurah === 'boolean'
          ? rprf.prefetchNextSurah
          : DEFAULT_PERFORMANCE.prefetchNextSurah,
      cacheTtlHours: Math.round(clampNum(rprf.cacheTtlHours, 1, 720, DEFAULT_PERFORMANCE.cacheTtlHours)),
    },
    security: {
      blockedReciterKeywords: sanitizeStringArray(
        rsec.blockedReciterKeywords,
        50,
        80,
        DEFAULT_SECURITY.blockedReciterKeywords
      ),
      disabledReciterIds: sanitizeStringArray(
        rsec.disabledReciterIds,
        80,
        80,
        DEFAULT_SECURITY.disabledReciterIds
      ),
      allowedAudioDomains: sanitizeStringArray(
        rsec.allowedAudioDomains,
        50,
        120,
        DEFAULT_SECURITY.allowedAudioDomains
      ),
      sessionTimeoutMinutes: Math.round(
        clampNum(rsec.sessionTimeoutMinutes, 15, 43200, DEFAULT_SECURITY.sessionTimeoutMinutes)
      ),
    },
    general: {
      maintenanceMode:
        typeof rgen.maintenanceMode === 'boolean' ? rgen.maintenanceMode : DEFAULT_GENERAL.maintenanceMode,
      maintenanceMessage: truncStr(rgen.maintenanceMessage, 300, DEFAULT_GENERAL.maintenanceMessage),
      showHijriDate:
        typeof rgen.showHijriDate === 'boolean' ? rgen.showHijriDate : DEFAULT_GENERAL.showHijriDate,
    },
    certificates: (() => {
      const rawSignerName = truncStr(rcert.signerName, 80, DEFAULT_CERTIFICATES.signerName);
      const isLegacyDevName =
        /^(eslam(\s+(mohammad|mohamed|khalifa))?|إسلام\s+محمد)$/i.test(rawSignerName.trim());
      const rawSignerTitle = truncStr(rcert.signerTitleAr, 120, DEFAULT_CERTIFICATES.signerTitleAr);
      const isLegacyDevTitle = /(مؤسس|المطور)/.test(rawSignerTitle);

      return {
        platformTitleAr: truncStr(rcert.platformTitleAr, 120, DEFAULT_CERTIFICATES.platformTitleAr),
        signerName: isLegacyDevName ? DEFAULT_CERTIFICATES.signerName : rawSignerName,
        signerTitleAr: isLegacyDevTitle ? DEFAULT_CERTIFICATES.signerTitleAr : rawSignerTitle,
        signatureStyle:
          (rcert.signatureStyle as string) === 'modern_minimal' ||
          (rcert.signatureStyle as string) === 'royal_emblem'
            ? (rcert.signatureStyle as 'modern_minimal' | 'royal_emblem')
            : 'calligraphic_gold',
        defaultTemplate:
          (rcert.defaultTemplate as string) === 'royal_ivory' ||
          (rcert.defaultTemplate as string) === 'kaaba_obsidian' ||
          (rcert.defaultTemplate as string) === 'andalusi_sapphire'
            ? (rcert.defaultTemplate as 'royal_ivory' | 'kaaba_obsidian' | 'andalusi_sapphire')
            : 'royal_emerald',
        stampLabelAr: truncStr(rcert.stampLabelAr, 80, DEFAULT_CERTIFICATES.stampLabelAr),
        blessingVerseAr: truncStr(rcert.blessingVerseAr, 160, DEFAULT_CERTIFICATES.blessingVerseAr),
        memorizationAyahGoal: Math.round(
          clampNum(rcert.memorizationAyahGoal, 20, 6236, DEFAULT_CERTIFICATES.memorizationAyahGoal)
        ),
        listeningMinutesGoal: Math.round(
          clampNum(rcert.listeningMinutesGoal, 3, 600, DEFAULT_CERTIFICATES.listeningMinutesGoal)
        ),
        listeningSurahsGoal: Math.round(
          clampNum(rcert.listeningSurahsGoal, 2, 114, DEFAULT_CERTIFICATES.listeningSurahsGoal)
        ),
        readingPagesGoal: Math.round(
          clampNum(rcert.readingPagesGoal, 5, 604, DEFAULT_CERTIFICATES.readingPagesGoal)
        ),
        tahfeezSessionsGoal: Math.round(
          clampNum(rcert.tahfeezSessionsGoal, 1, 100, DEFAULT_CERTIFICATES.tahfeezSessionsGoal)
        ),
        requiredLevelMemorization: Math.round(
          clampNum(
            rcert.requiredLevelMemorization,
            1,
            10,
            DEFAULT_CERTIFICATES.requiredLevelMemorization
          )
        ),
        requiredLevelListening: Math.round(
          clampNum(
            rcert.requiredLevelListening,
            1,
            10,
            DEFAULT_CERTIFICATES.requiredLevelListening
          )
        ),
        requiredLevelExcellence: Math.round(
          clampNum(
            rcert.requiredLevelExcellence,
            1,
            10,
            DEFAULT_CERTIFICATES.requiredLevelExcellence
          )
        ),
        requiredLevelKhatmah: Math.round(
          clampNum(
            rcert.requiredLevelKhatmah,
            1,
            10,
            DEFAULT_CERTIFICATES.requiredLevelKhatmah
          )
        ),
      };
    })(),
    mushaf: {
      defaultTheme:
        (rmsh.defaultTheme as string) === 'sepia' || (rmsh.defaultTheme as string) === 'light'
          ? (rmsh.defaultTheme as 'sepia' | 'light')
          : 'obsidian',
      defaultFontSizePx: Math.round(
        clampNum(rmsh.defaultFontSizePx, 18, 42, DEFAULT_MUSHAF.defaultFontSizePx)
      ),
      showTafsirByDefault:
        typeof rmsh.showTafsirByDefault === 'boolean'
          ? rmsh.showTafsirByDefault
          : DEFAULT_MUSHAF.showTafsirByDefault,
      defaultReciterId: truncStr(rmsh.defaultReciterId, 80, DEFAULT_MUSHAF.defaultReciterId),
      enableJuzQuickNav:
        typeof rmsh.enableJuzQuickNav === 'boolean'
          ? rmsh.enableJuzQuickNav
          : DEFAULT_MUSHAF.enableJuzQuickNav,
    },
    tahfeez: {
      defaultRepeatsPerAyah: Math.round(
        clampNum(rtah.defaultRepeatsPerAyah, 1, 20, DEFAULT_TAHFEEZ.defaultRepeatsPerAyah)
      ),
      defaultPauseSeconds: Math.round(
        clampNum(rtah.defaultPauseSeconds, 0, 15, DEFAULT_TAHFEEZ.defaultPauseSeconds)
      ),
      enableVoiceHideByDefault:
        typeof rtah.enableVoiceHideByDefault === 'boolean'
          ? rtah.enableVoiceHideByDefault
          : DEFAULT_TAHFEEZ.enableVoiceHideByDefault,
      autoAdvanceAyah:
        typeof rtah.autoAdvanceAyah === 'boolean'
          ? rtah.autoAdvanceAyah
          : DEFAULT_TAHFEEZ.autoAdvanceAyah,
    },
    sectionEnhancements: mergeSectionEnhancements(r.sectionEnhancements),
    featuredReciterOverrides: sanitizeStringArray(r.featuredReciterOverrides, 16, 80, []),
    updatedBy: truncStr(r.updatedBy, 128, 'system'),
    updatedAt: r.updatedAt,
  };
}

export function moveOrderedItem<T extends { id: string; order: number }>(
  list: T[],
  id: string,
  direction: 'up' | 'down'
): T[] {
  const sorted = [...list].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((item) => item.id === id);
  if (idx === -1) return sorted;
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= sorted.length) return sorted;
  const copy = [...sorted];
  const [moved] = copy.splice(idx, 1);
  copy.splice(targetIdx, 0, moved);
  return copy.map((item, i) => ({ ...item, order: i }));
}

export function isNewerConfigVersion(remoteVersion: number, currentVersion: number): boolean {
  return (
    Number.isFinite(remoteVersion) &&
    Number.isFinite(currentVersion) &&
    remoteVersion > currentVersion
  );
}

export interface ConfigDiffSection {
  key: string;
  labelAr: string;
}

export function getConfigChangedSections(
  draft: DynamicAppConfig,
  published: DynamicAppConfig
): ConfigDiffSection[] {
  const checks: Array<{ key: string; labelAr: string; a: unknown; b: unknown }> = [
    { key: 'texts', labelAr: 'النصوص والإعلانات', a: draft.texts, b: published.texts },
    { key: 'images', labelAr: 'الصور والخلفيات', a: draft.images, b: published.images },
    { key: 'homeSections', labelAr: 'أقسام الرئيسية', a: draft.homeSections, b: published.homeSections },
    { key: 'navPages', labelAr: 'صفحات التنقل', a: draft.navPages, b: published.navPages },
    { key: 'theme', labelAr: 'الألوان والمظهر', a: draft.theme, b: published.theme },
    { key: 'typography', labelAr: 'الخطوط والأبعاد', a: draft.typography, b: published.typography },
    { key: 'audioPlayer', labelAr: 'مشغل الصوت', a: draft.audioPlayer, b: published.audioPlayer },
    { key: 'certificates', labelAr: 'الشهادات والتوقيع', a: draft.certificates, b: published.certificates },
    { key: 'mushaf', labelAr: 'المصحف الشريف', a: draft.mushaf, b: published.mushaf },
    { key: 'tahfeez', labelAr: 'المعلم للتحفيظ', a: draft.tahfeez, b: published.tahfeez },
    { key: 'sectionEnhancements', labelAr: 'تعزيز الأقسام والشكل', a: draft.sectionEnhancements, b: published.sectionEnhancements },
    { key: 'featuredReciterOverrides', labelAr: 'القراء المختارون للرئيسية', a: draft.featuredReciterOverrides, b: published.featuredReciterOverrides },
    { key: 'seo', labelAr: 'بيانات SEO', a: draft.seo, b: published.seo },
    { key: 'performance', labelAr: 'الأداء والكاش', a: draft.performance, b: published.performance },
    { key: 'security', labelAr: 'الأمان والتصفية', a: draft.security, b: published.security },
    { key: 'general', labelAr: 'الإعدادات العامة', a: draft.general, b: published.general },
    { key: 'ota', labelAr: 'المزامنة والتحديثات', a: draft.ota, b: published.ota },
  ];

  return checks
    .filter((item) => JSON.stringify(item.a ?? null) !== JSON.stringify(item.b ?? null))
    .map(({ key, labelAr }) => ({ key, labelAr }));
}


