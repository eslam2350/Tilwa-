import type {
  DynamicAppConfig,
  DynamicNavPageItem,
  DynamicSectionItem,
  DynamicThemeConfig,
  HomeSectionId,
  NavPageId,
} from '../types/tilawa';

export const DEFAULT_OTA_MANIFEST_URL =
  'https://ais-pre-yohyjyrr4bd6elu2ixq7e7-1009876701033.europe-west2.run.app/downloads/ota-manifest.json';

export const ADMIN_EMAIL = 'eslamkhalifa244@gmail.com';
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

export const DEFAULT_HOME_SECTIONS: DynamicSectionItem[] = [
  { id: 'hero', label: 'واجهة الترحيب والآية المختارة', visible: true, order: 0 },
  { id: 'continue', label: 'متابعة آخر استماع وقراءة', visible: true, order: 1 },
  { id: 'stations', label: 'قوائم استماع جاهزة — إذاعة تلاوة', visible: true, order: 2 },
  { id: 'reciters', label: 'أعلام التلاوة (٣٦ قارئًا)', visible: true, order: 3 },
  { id: 'latest', label: 'أحدث التلاوات المختارة', visible: true, order: 4 },
  { id: 'mostListened', label: 'السور الأكثر استماعًا', visible: true, order: 5 },
  { id: 'mushafShowcase', label: 'واجهة المصحف الشريف المستقل', visible: true, order: 6 },
];

export const DEFAULT_NAV_PAGES: DynamicNavPageItem[] = [
  { id: 'home', label: 'الرئيسية', visible: true, order: 0 },
  { id: 'reciters', label: 'القراء', visible: true, order: 1 },
  { id: 'mushaf', label: 'المصحف', visible: true, order: 2 },
  { id: 'tahfeez', label: 'التحفيظ', visible: true, order: 3 },
  { id: 'search', label: 'البحث', visible: true, order: 4 },
  { id: 'library', label: 'مكتبتي', visible: true, order: 5 },
];

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
      'استمع مباشرةً دون تسجيل دخول إلى أعلام التلاوة والشيوخ المصريين الراحلين وأئمة الحرمين، وتصفح المصحف الشريف المستقل بالرسم العثماني دون إنترنت.',
    ctaListenLabel: 'ابدأ الاستماع',
    ctaMushafLabel: 'المصحف الشريف',
    ctaTahfeezLabel: 'المعلم للتحفيظ',
    announcementEnabled: false,
    announcementText: '',
    mushafShowcaseTitle: 'مصحف المدينة المنورة بجميع السور الـ١١٤ والأجزاء الـ٣٠',
    mushafShowcaseSubtitle:
      'يفتح المصحف في واجهة مستقلة هادئة بخط الرسم العثماني، مع ٦٠٤ صفحات متكاملة وفهرس سريع ومظاهر قراءة ليلية وكريمية وحفظ تلقائي لموضع القراءة.',
    footerDescription:
      'منصة قرآنية متكاملة تجمع بين عذوبة التلاوات الخالدة لكبار القراء والشيوخ المصريين الراحلين وقراءة المصحف الشريف بالرسم العثماني كاملًا دون إنترنت.',
  },
  images: {
    heroBackdropUrl: '',
  },
  homeSections: DEFAULT_HOME_SECTIONS.map((s) => ({ ...s })),
  navPages: DEFAULT_NAV_PAGES.map((p) => ({ ...p })),
  ota: {
    manifestUrl: DEFAULT_OTA_MANIFEST_URL,
    autoCheck: true,
    releaseNotes: 'تحديث بصري شامل للمنصة بهوية الواحة القرآنية، مع ورد الختمة اليومية والتفسير الميسر والتحديث التلقائي الفوري.',
  },
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
    };
  }

  const r = raw as Partial<DynamicAppConfig>;
  const rt: Partial<DynamicThemeConfig> = (r.theme && typeof r.theme === 'object' ? r.theme : {}) as Partial<DynamicThemeConfig>;
  const rtxt: Partial<DynamicAppConfig['texts']> = (r.texts && typeof r.texts === 'object' ? r.texts : {}) as Partial<DynamicAppConfig['texts']>;
  const rimg: Partial<DynamicAppConfig['images']> = (r.images && typeof r.images === 'object' ? r.images : {}) as Partial<DynamicAppConfig['images']>;
  const rota: Partial<DynamicAppConfig['ota']> = (r.ota && typeof r.ota === 'object' ? r.ota : {}) as Partial<DynamicAppConfig['ota']>;

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
