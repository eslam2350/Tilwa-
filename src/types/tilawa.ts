export type RecordingStyle = 'مرتل' | 'مجود' | 'حفل إذاعي' | 'معلم';

export interface SurahMeta {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: 'Meccan' | 'Medinan' | string;
}

export interface JuzMeta {
  surah: number;
  ayah: number;
}

export interface PageRef {
  surah: number;
  ayah: number;
}

export interface RecitationCollection {
  id: string;
  style: RecordingStyle;
  riwayah: string;
  server: string;
  surahTotal: number;
  missingSurahs?: number[];
  surahUrls?: Record<number, string>;
  sourceName: string;
}

export type ReciterSchool =
  | 'الشيوخ المصريون الراحلون'
  | 'المدرسة المصرية'
  | 'أئمة الحرمين والخليج'
  | 'قراء العالم الإسلامي';

export interface Reciter {
  id: string;
  nameAr: string;
  nameEn: string;
  titleAr: string;
  bioAr: string;
  birthYear: string;
  deathYear: string;
  isDeceased?: boolean;
  originAr: string;
  photoUrl: string;
  photoSource: string;
  schoolAr?: ReciterSchool;
  featured: boolean;
  collections: RecitationCollection[];
}

export interface AudioTrack {
  id: string;
  reciterId: string;
  reciterName: string;
  reciterPhoto: string;
  surahNumber: number;
  surahName: string;
  style: RecordingStyle | string;
  riwayah?: string;
  audioUrl: string;
  isAvailable: boolean;
  unavailableReason?: string;
  sourceName?: string;
  durationLabel?: string;
  kind?: 'quran' | 'podcast';
  episodeId?: string;
  preacherId?: string;
  category?: string;
  publishedAt?: string;
  durationSeconds?: number;
}

export type BasiraCategory =
  | 'تصحيح المفاهيم الدينية'
  | 'التوبة والذنوب'
  | 'قضايا الشباب'
  | 'الأخلاق والتربية'
  | 'العبادات'
  | 'العلاقات الاجتماعية'
  | 'قصص وعبر'
  | 'فتن العصر'
  | 'نصائح دعوية'
  | 'حلقات قصيرة'
  | 'محاضرات طويلة';

export interface BasiraPreacher {
  id: string;
  nameAr: string;
  titleAr: string;
  bioAr: string;
  photoUrl: string;
  specialties: string[];
  featured: boolean;
  published: boolean;
  order: number;
}

export interface BasiraEpisode {
  id: string;
  preacherId: string;
  title: string;
  description: string;
  coverUrl: string;
  audioUrl: string;
  durationSeconds: number;
  durationLabel: string;
  publishedAt: string;
  category: BasiraCategory;
  tags: string[];
  featured?: boolean;
  published: boolean;
  order: number;
}

export interface BasiraPlaylist {
  id: string;
  preacherId: string;
  title: string;
  description: string;
  coverUrl?: string;
  episodeIds: string[];
  published: boolean;
  order: number;
}

export interface BasiraCatalogData {
  preachers: BasiraPreacher[];
  episodes: BasiraEpisode[];
  playlists: BasiraPlaylist[];
  updatedAt?: string;
}

export interface CuratedRecitation {
  id: string;
  reciterId: string;
  surahNumber: number;
  surahNameAr: string;
  style: RecordingStyle;
  riwayah?: string;
  audioUrl: string;
  durationLabel?: string;
  isAvailable: boolean;
  sourceName?: string;
  playsCount?: number;
}

export interface AyahItem {
  number: number; // global 1..6236
  numberInSurah: number;
  text: string;
  surahNumber: number;
  surahName: string;
  juz: number;
  page: number;
  hizbQuarter?: number;
  sajda?: boolean | { id: number; recommended: boolean; obligatory: boolean };
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  role: 'user' | 'admin';
  preferredFontSize: number;
  preferredPlaybackRate: number;
  lastReadSurah: number;
  lastReadAyah: number;
  lastReadPage: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FavoriteItem {
  id: string;
  userId?: string;
  type: 'recitation' | 'reciter' | 'ayah';
  targetId: string;
  title: string;
  subtitle?: string;
  audioUrl?: string;
  reciterId?: string;
  surahNumber?: number;
  ayahNumber?: number;
  createdAt?: string | unknown;
}

export interface ListeningHistoryItem {
  id: string;
  userId?: string;
  reciterId: string;
  reciterName: string;
  surahNumber: number;
  surahName: string;
  style?: string;
  audioUrl: string;
  progressSeconds: number;
  durationSeconds?: number;
  updatedAt?: string | unknown;
}

export interface UserPlaylist {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  createdAt?: string | unknown;
  updatedAt?: string | unknown;
}

export interface PlaylistTrack {
  id: string;
  userId?: string;
  playlistId: string;
  reciterId: string;
  reciterName: string;
  surahNumber: number;
  surahName: string;
  style?: string;
  audioUrl: string;
  createdAt?: string | unknown;
}

export type RepeatMode = 'off' | 'all' | 'one';

/**
 * Sleep timer minutes; 0 = off, -1 = stop at end of current surah.
 */
export type SleepTimerOption = 0 | 15 | 30 | 45 | 60 | -1;

export type AppRoute =
  | { page: 'home' }
  | { page: 'reciters' }
  | { page: 'reciter'; reciterId: string }
  | { page: 'basira'; category?: string }
  | { page: 'basira-preacher'; preacherId: string }
  | { page: 'basira-episode'; episodeId: string }
  | { page: 'mushaf'; surah?: number; pageNum?: number; juz?: number }
  | { page: 'tahfeez'; surah?: number; startAyah?: number; endAyah?: number }
  | { page: 'search'; query?: string }
  | { page: 'library' }
  | { page: 'admin' };

export type HomeSectionId =
  | 'hero'
  | 'continue'
  | 'stations'
  | 'reciters'
  | 'basiraShowcase'
  | 'latest'
  | 'mostListened'
  | 'mushafShowcase'
  | 'feedback';

export type NavPageId = 'home' | 'reciters' | 'basira' | 'mushaf' | 'tahfeez' | 'search' | 'library';

export type SectionEnhancementId =
  | HomeSectionId
  | 'recitersDirectory'
  | 'basiraSection'
  | 'mushafSection'
  | 'tahfeezSection';

export type SectionStylePreset =
  | 'default'
  | 'royal_gold'
  | 'emerald_sanctuary'
  | 'obsidian_glass'
  | 'editorial_bordered';

export type SectionDensity = 'compact' | 'comfortable' | 'spacious';

export interface SectionEnhancementConfig {
  boosted: boolean;
  boostLevel: 'standard' | 'featured' | 'spotlight';
  stylePreset: SectionStylePreset;
  density: SectionDensity;
  glowAccent: boolean;
  showDivider: boolean;
  badgeText: string;
  customHeadline: string;
  customSubtitle: string;
}

export interface DynamicThemeConfig {
  presetId: string;
  bgObsidian: string;
  bgSurface: string;
  bgElevated: string;
  emeraldDeep: string;
  emeraldSoft: string;
  goldAntique: string;
  textPrimary: string;
  textSecondary: string;
}

export interface DynamicTextsConfig {
  siteName: string;
  slogan: string;
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaListenLabel: string;
  ctaMushafLabel: string;
  ctaTahfeezLabel: string;
  announcementEnabled: boolean;
  announcementText: string;
  mushafShowcaseTitle: string;
  mushafShowcaseSubtitle: string;
  footerDescription: string;
}

export interface DynamicImagesConfig {
  heroBackdropUrl: string;
}

export interface DynamicSectionItem {
  id: HomeSectionId;
  label: string;
  visible: boolean;
  order: number;
}

export interface DynamicNavPageItem {
  id: NavPageId;
  label: string;
  visible: boolean;
  order: number;
}

export interface DynamicOtaConfig {
  manifestUrl: string;
  autoCheck: boolean;
  releaseNotes: string;
}

export interface DynamicTypographyConfig {
  displayFont: 'Amiri' | 'IBM Plex Sans Arabic' | 'Cairo' | 'Noto Naskh Arabic';
  bodyFont: 'IBM Plex Sans Arabic' | 'Cairo' | 'Readex Pro';
  baseFontSizePx: number;
  cardRadiusPx: number;
  glassBlurPx: number;
}

export interface DynamicAudioPlayerConfig {
  defaultVolume: number;
  defaultPlaybackRate: number;
  autoPlayNext: boolean;
  showWaveform: boolean;
  enableSleepTimer: boolean;
  enableSegmentLoop: boolean;
}

export interface DynamicSeoConfig {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  ogTitle: string;
  ogDescription: string;
  canonicalUrl: string;
  robotsIndex: boolean;
}

export interface DynamicPerformanceConfig {
  precacheQuranOffline: boolean;
  prefetchNextSurah: boolean;
  cacheTtlHours: number;
}

export interface DynamicSecurityConfig {
  blockedReciterKeywords: string[];
  disabledReciterIds: string[];
  allowedAudioDomains: string[];
  sessionTimeoutMinutes: number;
}

export interface DynamicGeneralConfig {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  showHijriDate: boolean;
}

export type CertificateTemplateId =
  | 'royal_emerald'
  | 'royal_ivory'
  | 'kaaba_obsidian'
  | 'andalusi_sapphire';

export interface DynamicCertificatesConfig {
  platformTitleAr: string;
  signerName: string;
  signerTitleAr: string;
  signatureStyle: 'calligraphic_gold' | 'modern_minimal' | 'royal_emblem';
  defaultTemplate?: CertificateTemplateId;
  stampLabelAr: string;
  blessingVerseAr: string;
  memorizationAyahGoal: number;
  listeningMinutesGoal: number;
  listeningSurahsGoal: number;
  readingPagesGoal: number;
  tahfeezSessionsGoal: number;
  requiredLevelMemorization?: number;
  requiredLevelListening?: number;
  requiredLevelExcellence?: number;
  requiredLevelKhatmah?: number;
}

export interface DynamicMushafConfig {
  defaultTheme: 'obsidian' | 'sepia' | 'light';
  defaultFontSizePx: number;
  showTafsirByDefault: boolean;
  defaultReciterId: string;
  enableJuzQuickNav: boolean;
}

export interface DynamicTahfeezConfig {
  defaultRepeatsPerAyah: number;
  defaultPauseSeconds: number;
  enableVoiceHideByDefault: boolean;
  autoAdvanceAyah: boolean;
}

export interface DynamicAppConfig {
  id: string;
  version: number;
  theme: DynamicThemeConfig;
  texts: DynamicTextsConfig;
  images: DynamicImagesConfig;
  homeSections: DynamicSectionItem[];
  navPages: DynamicNavPageItem[];
  ota: DynamicOtaConfig;
  typography?: DynamicTypographyConfig;
  audioPlayer?: DynamicAudioPlayerConfig;
  seo?: DynamicSeoConfig;
  performance?: DynamicPerformanceConfig;
  security?: DynamicSecurityConfig;
  general?: DynamicGeneralConfig;
  certificates?: DynamicCertificatesConfig;
  mushaf?: DynamicMushafConfig;
  tahfeez?: DynamicTahfeezConfig;
  sectionEnhancements?: Record<string, SectionEnhancementConfig>;
  featuredReciterOverrides?: string[];
  updatedBy?: string;
  updatedAt?: string | unknown;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: 'config' | 'reciter' | 'ai-dev' | 'backup' | 'security';
  action: string;
  summary: string;
  details?: string;
}

export interface BackupFileItem {
  filePath: string;
  existedBefore: boolean;
  content: string;
}

export interface BackupSnapshotMeta {
  id: string;
  createdAt: string;
  label: string;
  reason: string;
  filesCount: number;
  hasConfigSnapshot: boolean;
  filesList: string[];
}

export interface DiffLineItem {
  type: 'context' | 'add' | 'remove';
  lineNumberBefore: number | null;
  lineNumberAfter: number | null;
  text: string;
}

export interface AiProposalChange {
  filePath: string;
  action: 'update' | 'create' | 'delete';
  summary: string;
  beforeContent: string;
  afterContent: string;
  diffLines: DiffLineItem[];
}

export interface AiProposalRecord {
  id: string;
  createdAt: string;
  instruction: string;
  analysis: string;
  riskLevel: 'low' | 'medium' | 'high';
  changes: AiProposalChange[];
  executedTools?: string[];
  executionMode?: 'plan' | 'direct';
  testStatus?: {
    ranAt: string;
    passed: boolean;
    tscOutput: string;
    testsOutput: string;
  };
  buildStatus?: {
    ranAt: string;
    passed: boolean;
    output: string;
  };
  appliedAt?: string;
  backupId?: string;
  autoRolledBack?: boolean;
}

export interface AnalyticsSummary {
  totalPageViews: number;
  totalPlays: number;
  routeCounts: Record<string, number>;
  reciterPlays: Record<string, { name: string; count: number }>;
  surahPlays: Record<string, { name: string; count: number }>;
  dailyViews: Record<string, number>;
  lastUpdatedAt: string;
}

export interface AudioProbeResult {
  url: string;
  ok: boolean;
  status: number;
  contentType: string;
  contentLengthBytes: number | null;
  latencyMs: number;
  error?: string;
}

export type FeedbackCategory =
  | 'general'
  | 'audio'
  | 'mushaf'
  | 'tahfeez'
  | 'basira'
  | 'suggestion';

export interface SiteFeedbackItem {
  id: string;
  authorName: string;
  overallRating: number;
  speedScore: number;
  designScore: number;
  audioScore: number;
  category: FeedbackCategory;
  comment: string;
  visible: boolean;
  pinned?: boolean;
  adminReply?: string;
  createdAt: string;
}

export interface SiteFeedbackSummary {
  totalCount: number;
  visibleCount: number;
  averageOverall: number;
  averageSpeed: number;
  averageDesign: number;
  averageAudio: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface AiDeveloperJobStatus {
  id: string;
  kind: 'plan' | 'execute' | 'analyze';
  status: 'running' | 'completed' | 'failed';
  phase: string;
  logs: string[];
  createdAt: string;
  updatedAt: string;
  proposal?: AiProposalRecord;
  analysisReport?: {
    report: string;
    checkedFiles: string[];
  };
  error?: string;
}

