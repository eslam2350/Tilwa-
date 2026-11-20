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
  | 'latest'
  | 'mostListened'
  | 'mushafShowcase';

export type NavPageId = 'home' | 'reciters' | 'mushaf' | 'tahfeez' | 'search' | 'library';

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

export interface DynamicAppConfig {
  id: string;
  version: number;
  theme: DynamicThemeConfig;
  texts: DynamicTextsConfig;
  images: DynamicImagesConfig;
  homeSections: DynamicSectionItem[];
  navPages: DynamicNavPageItem[];
  ota: DynamicOtaConfig;
  updatedBy?: string;
  updatedAt?: string | unknown;
}

