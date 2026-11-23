import type {
  AudioTrack,
  BasiraCatalogData,
  BasiraCategory,
  BasiraEpisode,
  BasiraPlaylist,
  BasiraPreacher,
} from '../types/tilawa';
import { formatTimeSeconds, normalizeArabic } from './quranHelpers';

export const BASIRA_CATEGORIES: BasiraCategory[] = [
  'تصحيح المفاهيم الدينية',
  'التوبة والذنوب',
  'قضايا الشباب',
  'الأخلاق والتربية',
  'العبادات',
  'العلاقات الاجتماعية',
  'قصص وعبر',
  'فتن العصر',
  'نصائح دعوية',
  'حلقات قصيرة',
  'محاضرات طويلة',
];

export const BASIRA_PROGRESS_STORAGE_KEY = 'tilawa_basira_progress_v1';

export interface BasiraEpisodeProgress {
  episodeId: string;
  progressSeconds: number;
  durationSeconds: number;
  updatedAt: string;
}

export function loadBasiraProgressMap(): Record<string, BasiraEpisodeProgress> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(BASIRA_PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, BasiraEpisodeProgress>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveBasiraEpisodeProgress(
  episodeId: string,
  progressSeconds: number,
  durationSeconds: number
): Record<string, BasiraEpisodeProgress> {
  const map = loadBasiraProgressMap();
  const safeProgress = Math.max(0, Math.floor(progressSeconds));
  const safeDuration = Math.max(0, Math.floor(durationSeconds));
  map[episodeId] = {
    episodeId,
    progressSeconds: safeProgress,
    durationSeconds: safeDuration,
    updatedAt: new Date().toISOString(),
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BASIRA_PROGRESS_STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // ignore storage quota failure
  }
  return map;
}

export function getSavedEpisodePosition(episodeId: string): number {
  const map = loadBasiraProgressMap();
  const entry = map[episodeId];
  if (!entry || !Number.isFinite(entry.progressSeconds)) return 0;
  // Restart from beginning if listener already reached last 15 seconds
  if (entry.durationSeconds > 60 && entry.progressSeconds >= entry.durationSeconds - 15) {
    return 0;
  }
  return Math.max(0, entry.progressSeconds);
}

export function formatBasiraDuration(durationSeconds: number, fallbackLabel?: string): string {
  if (fallbackLabel && fallbackLabel.trim()) return fallbackLabel;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return '٠٥:٠٠';
  return formatTimeSeconds(durationSeconds);
}

export function filterBasiraEpisodes(params: {
  episodes: BasiraEpisode[];
  preachers: BasiraPreacher[];
  category?: string;
  preacherId?: string;
  query?: string;
  onlyPublished?: boolean;
}): BasiraEpisode[] {
  const {
    episodes,
    preachers,
    category = 'الكل',
    preacherId = '',
    query = '',
    onlyPublished = true,
  } = params;

  const preacherMap = new Map(preachers.map((p) => [p.id, p]));
  const normQ = normalizeArabic(query);

  return episodes
    .filter((ep) => (onlyPublished ? ep.published !== false : true))
    .filter((ep) => !preacherId || ep.preacherId === preacherId)
    .filter((ep) => !category || category === 'الكل' || ep.category === category)
    .filter((ep) => {
      if (!normQ) return true;
      const preacher = preacherMap.get(ep.preacherId);
      const haystack = normalizeArabic(
        `${ep.title} ${ep.description} ${ep.category} ${ep.tags.join(' ')} ${preacher?.nameAr || ''}`
      );
      return haystack.includes(normQ);
    })
    .sort((a, b) => a.order - b.order);
}

export function getRelatedBasiraEpisodes(
  target: BasiraEpisode,
  allEpisodes: BasiraEpisode[],
  maxCount = 4
): BasiraEpisode[] {
  const published = allEpisodes.filter((ep) => ep.published !== false && ep.id !== target.id);
  const scored = published.map((ep) => {
    let score = 0;
    if (ep.category === target.category) score += 5;
    if (ep.preacherId === target.preacherId) score += 2;
    const sharedTags = ep.tags.filter((t) => target.tags.includes(t)).length;
    score += sharedTags * 2;
    return { ep, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || b.ep.publishedAt.localeCompare(a.ep.publishedAt))
    .slice(0, maxCount)
    .map((item) => item.ep);
}

export function getPreacherStats(
  preacher: BasiraPreacher,
  episodes: BasiraEpisode[],
  playlists: BasiraPlaylist[]
): {
  episodesList: BasiraEpisode[];
  latestEpisodes: BasiraEpisode[];
  playlistsList: BasiraPlaylist[];
  totalEpisodes: number;
} {
  const episodesList = episodes
    .filter((ep) => ep.published !== false && ep.preacherId === preacher.id)
    .sort((a, b) => a.order - b.order);

  const latestEpisodes = [...episodesList]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);

  const playlistsList = playlists
    .filter((pl) => pl.published !== false && pl.preacherId === preacher.id)
    .sort((a, b) => a.order - b.order);

  return {
    episodesList,
    latestEpisodes,
    playlistsList,
    totalEpisodes: episodesList.length,
  };
}

export function episodeToAudioTrack(
  episode: BasiraEpisode,
  preacher: BasiraPreacher | undefined,
  indexNumber = 1
): AudioTrack {
  return {
    id: `basira_${episode.id}`,
    kind: 'podcast',
    episodeId: episode.id,
    preacherId: episode.preacherId,
    reciterId: `preacher_${episode.preacherId}`,
    reciterName: preacher?.nameAr || 'داعية مصري',
    reciterPhoto: episode.coverUrl || preacher?.photoUrl || '',
    surahNumber: indexNumber,
    surahName: episode.title,
    style: episode.category,
    riwayah: `بودكاست بصيرة · ${episode.category}`,
    category: episode.category,
    publishedAt: episode.publishedAt,
    durationSeconds: episode.durationSeconds,
    durationLabel: episode.durationLabel,
    audioUrl: episode.audioUrl,
    isAvailable: Boolean(episode.audioUrl),
    unavailableReason: episode.audioUrl ? undefined : 'رابط الصوت غير متاح لهذه الحلقة',
    sourceName: 'بصيرة — بودكاست دعوي صوتي',
  };
}

export function mergeBasiraCatalog(
  defaults: BasiraCatalogData,
  remote: Partial<BasiraCatalogData> | null | undefined
): BasiraCatalogData {
  if (!remote || typeof remote !== 'object') {
    return {
      preachers: [...defaults.preachers].sort((a, b) => a.order - b.order),
      episodes: [...defaults.episodes].sort((a, b) => a.order - b.order),
      playlists: [...defaults.playlists].sort((a, b) => a.order - b.order),
      updatedAt: defaults.updatedAt,
    };
  }

  // If server catalog exists and has entries, server is source of truth (so deletes/reorders persist)
  const preachers = Array.isArray(remote.preachers) && remote.preachers.length > 0
    ? remote.preachers
        .filter((p): p is BasiraPreacher => Boolean(p && p.id && p.nameAr))
        .map((p, i) => ({
          id: String(p.id).slice(0, 80),
          nameAr: String(p.nameAr).slice(0, 140),
          titleAr: String(p.titleAr || 'داعية إسلامي').slice(0, 180),
          bioAr: String(p.bioAr || '').slice(0, 2000),
          photoUrl: String(p.photoUrl || ''),
          specialties: Array.isArray(p.specialties) ? p.specialties.slice(0, 12).map(String) : [],
          featured: Boolean(p.featured),
          published: typeof p.published === 'boolean' ? p.published : true,
          order: typeof p.order === 'number' && Number.isFinite(p.order) ? p.order : i,
        }))
        .sort((a, b) => a.order - b.order)
    : [...defaults.preachers].sort((a, b) => a.order - b.order);

  const episodes = Array.isArray(remote.episodes) && remote.episodes.length > 0
    ? remote.episodes
        .filter((ep): ep is BasiraEpisode => Boolean(ep && ep.id && ep.title && ep.audioUrl))
        .map((ep, i) => ({
          id: String(ep.id).slice(0, 100),
          preacherId: String(ep.preacherId || ''),
          title: String(ep.title).slice(0, 220),
          description: String(ep.description || '').slice(0, 4000),
          coverUrl: String(ep.coverUrl || ''),
          audioUrl: String(ep.audioUrl),
          durationSeconds: Math.max(0, Math.round(Number(ep.durationSeconds) || 0)),
          durationLabel: String(ep.durationLabel || '١٥:٠٠').slice(0, 32),
          publishedAt: String(ep.publishedAt || '2025-01-01').slice(0, 32),
          category: BASIRA_CATEGORIES.includes(ep.category) ? ep.category : 'نصائح دعوية',
          tags: Array.isArray(ep.tags) ? ep.tags.slice(0, 12).map(String) : [],
          featured: Boolean(ep.featured),
          published: typeof ep.published === 'boolean' ? ep.published : true,
          order: typeof ep.order === 'number' && Number.isFinite(ep.order) ? ep.order : i,
        }))
        .sort((a, b) => a.order - b.order)
    : [...defaults.episodes].sort((a, b) => a.order - b.order);

  const playlists = Array.isArray(remote.playlists) && remote.playlists.length > 0
    ? remote.playlists
        .filter((pl): pl is BasiraPlaylist => Boolean(pl && pl.id && pl.title))
        .map((pl, i) => ({
          id: String(pl.id).slice(0, 80),
          preacherId: String(pl.preacherId || ''),
          title: String(pl.title).slice(0, 160),
          description: String(pl.description || '').slice(0, 800),
          coverUrl: pl.coverUrl ? String(pl.coverUrl) : undefined,
          episodeIds: Array.isArray(pl.episodeIds) ? pl.episodeIds.map(String) : [],
          published: typeof pl.published === 'boolean' ? pl.published : true,
          order: typeof pl.order === 'number' && Number.isFinite(pl.order) ? pl.order : i,
        }))
        .sort((a, b) => a.order - b.order)
    : [...defaults.playlists].sort((a, b) => a.order - b.order);

  return {
    preachers,
    episodes,
    playlists,
    updatedAt: remote.updatedAt || defaults.updatedAt,
  };
}
