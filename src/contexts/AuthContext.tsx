import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type {
  FavoriteItem,
  ListeningHistoryItem,
  PlaylistTrack,
  UserPlaylist,
} from '../types/tilawa';
import { clampFontSize, sanitizeFirestoreId } from '../utils/quranHelpers';
import { useAppData } from './AppDataContext';

const LOCAL_FAV_KEY = 'tilawa_guest_favorites_v1';
const LOCAL_HIST_KEY = 'tilawa_guest_history_v1';
const LOCAL_PL_KEY = 'tilawa_guest_playlists_v1';
const LOCAL_PL_TRK_KEY = 'tilawa_guest_playlist_tracks_v1';
const LOCAL_PREFS_KEY = 'tilawa_guest_prefs_v1';
const LOCAL_SEEDED_KEY = 'tilawa_starter_seeded_v1';

export interface UserPrefs {
  fontSize: number;
  playbackRate: number;
  lastReadSurah: number;
  lastReadAyah: number;
  lastReadPage: number;
}

const DEFAULT_PREFS: UserPrefs = {
  fontSize: 28,
  playbackRate: 1,
  lastReadSurah: 1,
  lastReadAyah: 1,
  lastReadPage: 1,
};

const STARTER_PLAYLISTS: UserPlaylist[] = [
  {
    id: 'starter_fajr',
    name: 'روائع الفجر والخشوع',
    description: 'مختارات مؤثرة للسكينة والتدبر في أوقات الفجر والسحر',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'starter_short',
    name: 'تلاوات قصار السور للصلاة',
    description: 'سور مختارة بأصوات أعلام التلاوة للحفظ والمراجعة اليومية',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const STARTER_PLAYLIST_TRACKS: Record<string, PlaylistTrack[]> = {
  starter_fajr: [
    {
      id: 'trk_fajr_1',
      playlistId: 'starter_fajr',
      reciterId: 'minshawi',
      reciterName: 'الشيخ محمد صديق المنشاوي',
      surahNumber: 12,
      surahName: 'سورة يوسف',
      style: 'مجود',
      audioUrl: 'https://cdn.mp3quran.net/audio/muhammad-minshawi/r2/012.mp3',
    },
    {
      id: 'trk_fajr_2',
      playlistId: 'starter_fajr',
      reciterId: 'abdulbasit',
      reciterName: 'الشيخ عبد الباسط عبد الصمد',
      surahNumber: 19,
      surahName: 'سورة مريم',
      style: 'مجود',
      audioUrl: 'https://cdn.mp3quran.net/audio/abdulbasit-abdulsamad/r1/019.mp3',
    },
    {
      id: 'trk_fajr_3',
      playlistId: 'starter_fajr',
      reciterId: 'banna',
      reciterName: 'الشيخ محمود علي البنا',
      surahNumber: 55,
      surahName: 'سورة الرحمن',
      style: 'مجود',
      audioUrl: 'https://cdn.mp3quran.net/audio/mahmoud-banna/r2/055.mp3',
    },
  ],
  starter_short: [
    {
      id: 'trk_short_1',
      playlistId: 'starter_short',
      reciterId: 'husary',
      reciterName: 'الشيخ محمود خليل الحصري',
      surahNumber: 93,
      surahName: 'سورة الضحى',
      style: 'مرتل',
      audioUrl: 'https://cdn.mp3quran.net/audio/mahmoud-husary/r1/093.mp3',
    },
    {
      id: 'trk_short_2',
      playlistId: 'starter_short',
      reciterId: 'minshawi',
      reciterName: 'الشيخ محمد صديق المنشاوي',
      surahNumber: 112,
      surahName: 'سورة الإخلاص',
      style: 'مرتل',
      audioUrl: 'https://cdn.mp3quran.net/audio/muhammad-minshawi/r1/112.mp3',
    },
    {
      id: 'trk_short_3',
      playlistId: 'starter_short',
      reciterId: 'banna',
      reciterName: 'الشيخ محمود علي البنا',
      surahNumber: 87,
      surahName: 'سورة الأعلى',
      style: 'مرتل',
      audioUrl: 'https://cdn.mp3quran.net/audio/mahmoud-banna/r1/087.mp3',
    },
  ],
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getInitialPlaylistsAndTracks(): {
  playlists: UserPlaylist[];
  tracks: Record<string, PlaylistTrack[]>;
} {
  const existingPls = readJson<UserPlaylist[]>(LOCAL_PL_KEY, []);
  const existingTracks = readJson<Record<string, PlaylistTrack[]>>(LOCAL_PL_TRK_KEY, {});
  try {
    const alreadySeeded = localStorage.getItem(LOCAL_SEEDED_KEY) === '1';
    if (!alreadySeeded && existingPls.length === 0) {
      localStorage.setItem(LOCAL_SEEDED_KEY, '1');
      localStorage.setItem(LOCAL_PL_KEY, JSON.stringify(STARTER_PLAYLISTS));
      localStorage.setItem(LOCAL_PL_TRK_KEY, JSON.stringify(STARTER_PLAYLIST_TRACKS));
      return { playlists: STARTER_PLAYLISTS, tracks: STARTER_PLAYLIST_TRACKS };
    }
  } catch {
    // ignore storage restriction
  }
  return { playlists: existingPls, tracks: existingTracks };
}

interface AuthContextValue {
  authReady: boolean;
  favorites: FavoriteItem[];
  isFavorite: (targetId: string) => boolean;
  toggleFavorite: (item: Omit<FavoriteItem, 'userId' | 'createdAt'>) => Promise<void>;
  history: ListeningHistoryItem[];
  recordListeningProgress: (item: Omit<ListeningHistoryItem, 'userId' | 'updatedAt'>) => Promise<void>;
  clearHistory: () => void;
  playlists: UserPlaylist[];
  playlistTracks: Record<string, PlaylistTrack[]>;
  createNewPlaylist: (name: string, description?: string) => Promise<UserPlaylist | null>;
  removePlaylist: (playlistId: string) => Promise<void>;
  addTrackToUserPlaylist: (
    playlistId: string,
    track: Omit<PlaylistTrack, 'id' | 'userId' | 'playlistId' | 'createdAt'>
  ) => Promise<void>;
  removeTrackFromUserPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  prefs: UserPrefs;
  saveReadingPosition: (surah: number, page: number, ayah?: number) => Promise<void>;
  savePreferences: (updates: Partial<Pick<UserPrefs, 'fontSize' | 'playbackRate'>>) => Promise<void>;
  clearAllLocalData: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { notify } = useAppData();

  const initialLibrary = useMemo(() => getInitialPlaylistsAndTracks(), []);
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => readJson(LOCAL_FAV_KEY, []));
  const [history, setHistory] = useState<ListeningHistoryItem[]>(() => readJson(LOCAL_HIST_KEY, []));
  const [playlists, setPlaylists] = useState<UserPlaylist[]>(initialLibrary.playlists);
  const [playlistTracks, setPlaylistTracks] = useState<Record<string, PlaylistTrack[]>>(
    initialLibrary.tracks
  );
  const [prefs, setPrefs] = useState<UserPrefs>(() => readJson(LOCAL_PREFS_KEY, DEFAULT_PREFS));
  const prefsRef = useRef<UserPrefs>(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  const isFavorite = useCallback(
    (targetId: string) => favorites.some((f) => f.targetId === targetId || f.id === targetId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (item: Omit<FavoriteItem, 'userId' | 'createdAt'>) => {
      const safeId = sanitizeFirestoreId(item.id);
      const exists = favorites.find((f) => f.id === safeId || f.targetId === item.targetId);
      if (exists) {
        const next = favorites.filter((f) => f.id !== exists.id);
        setFavorites(next);
        localStorage.setItem(LOCAL_FAV_KEY, JSON.stringify(next));
        notify('تمت الإزالة من المفضلة', 'info');
      } else {
        const created: FavoriteItem = {
          ...item,
          id: safeId,
          createdAt: new Date().toISOString(),
        };
        const next = [created, ...favorites];
        setFavorites(next);
        localStorage.setItem(LOCAL_FAV_KEY, JSON.stringify(next));
        notify('تم الحفظ في المفضلة', 'success');
      }
    },
    [favorites, notify]
  );

  const recordListeningProgress = useCallback(
    async (item: Omit<ListeningHistoryItem, 'userId' | 'updatedAt'>) => {
      const safeId = sanitizeFirestoreId(item.id);
      const nextItem: ListeningHistoryItem = {
        ...item,
        id: safeId,
        updatedAt: new Date().toISOString(),
      };
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.id !== safeId);
        const updated = [nextItem, ...filtered].slice(0, 40);
        localStorage.setItem(LOCAL_HIST_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.setItem(LOCAL_HIST_KEY, '[]');
    notify('تم مسح سجل الاستماع', 'info');
  }, [notify]);

  const createNewPlaylist = useCallback(
    async (name: string, description = ''): Promise<UserPlaylist | null> => {
      const cleanName = name.trim();
      if (!cleanName) {
        notify('يرجى إدخال اسم قائمة التشغيل', 'error');
        return null;
      }
      const localCreated: UserPlaylist = {
        id: sanitizeFirestoreId(`pl_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`),
        name: cleanName.slice(0, 120),
        description: description.trim().slice(0, 300),
        createdAt: new Date().toISOString(),
      };
      setPlaylists((prev) => {
        const next = [localCreated, ...prev];
        localStorage.setItem(LOCAL_PL_KEY, JSON.stringify(next));
        return next;
      });
      notify(`تم إنشاء قائمة «${localCreated.name}»`, 'success');
      return localCreated;
    },
    [notify]
  );

  const removePlaylist = useCallback(
    async (playlistId: string) => {
      setPlaylists((prev) => {
        const next = prev.filter((p) => p.id !== playlistId);
        localStorage.setItem(LOCAL_PL_KEY, JSON.stringify(next));
        return next;
      });
      setPlaylistTracks((prev) => {
        const copy = { ...prev };
        delete copy[playlistId];
        localStorage.setItem(LOCAL_PL_TRK_KEY, JSON.stringify(copy));
        return copy;
      });
      notify('تم حذف قائمة التشغيل', 'info');
    },
    [notify]
  );

  const addTrackToUserPlaylist = useCallback(
    async (
      playlistId: string,
      track: Omit<PlaylistTrack, 'id' | 'userId' | 'playlistId' | 'createdAt'>
    ) => {
      let wasDuplicate = false;
      const localTrack: PlaylistTrack = {
        ...track,
        id: sanitizeFirestoreId(`trk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`),
        playlistId,
        createdAt: new Date().toISOString(),
      };
      setPlaylistTracks((prev) => {
        const existing = prev[playlistId] || [];
        if (
          existing.some(
            (t) =>
              t.reciterId === track.reciterId &&
              t.surahNumber === track.surahNumber &&
              t.style === track.style
          )
        ) {
          wasDuplicate = true;
          return prev;
        }
        const next = { ...prev, [playlistId]: [localTrack, ...existing] };
        localStorage.setItem(LOCAL_PL_TRK_KEY, JSON.stringify(next));
        return next;
      });
      if (wasDuplicate) {
        notify('هذه التلاوة موجودة بالفعل في القائمة', 'info');
      } else {
        notify('أُضيفت التلاوة إلى القائمة', 'success');
      }
    },
    [notify]
  );

  const removeTrackFromUserPlaylist = useCallback(
    async (playlistId: string, trackId: string) => {
      setPlaylistTracks((prev) => {
        const next = {
          ...prev,
          [playlistId]: (prev[playlistId] || []).filter((t) => t.id !== trackId),
        };
        localStorage.setItem(LOCAL_PL_TRK_KEY, JSON.stringify(next));
        return next;
      });
      notify('تمت إزالة التلاوة من القائمة', 'info');
    },
    [notify]
  );

  const saveReadingPosition = useCallback(async (surah: number, page: number, ayah = 1) => {
    const current = prefsRef.current;
    if (
      current.lastReadSurah === surah &&
      current.lastReadPage === page &&
      current.lastReadAyah === ayah
    ) {
      return;
    }
    const next: UserPrefs = {
      ...current,
      lastReadSurah: surah,
      lastReadPage: page,
      lastReadAyah: ayah,
    };
    prefsRef.current = next;
    setPrefs(next);
    localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(next));
  }, []);

  const savePreferences = useCallback(
    async (updates: Partial<Pick<UserPrefs, 'fontSize' | 'playbackRate'>>) => {
      const current = prefsRef.current;
      const nextFont =
        updates.fontSize !== undefined ? clampFontSize(updates.fontSize) : current.fontSize;
      const nextRate = updates.playbackRate ?? current.playbackRate;
      if (nextFont === current.fontSize && nextRate === current.playbackRate) {
        return;
      }
      const next: UserPrefs = {
        ...current,
        fontSize: nextFont,
        playbackRate: nextRate,
      };
      prefsRef.current = next;
      setPrefs(next);
      localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(next));
    },
    []
  );

  const clearAllLocalData = useCallback(() => {
    setFavorites([]);
    setHistory([]);
    setPlaylists(STARTER_PLAYLISTS);
    setPlaylistTracks(STARTER_PLAYLIST_TRACKS);
    setPrefs(DEFAULT_PREFS);
    prefsRef.current = DEFAULT_PREFS;
    localStorage.setItem(LOCAL_FAV_KEY, '[]');
    localStorage.setItem(LOCAL_HIST_KEY, '[]');
    localStorage.setItem(LOCAL_PL_KEY, JSON.stringify(STARTER_PLAYLISTS));
    localStorage.setItem(LOCAL_PL_TRK_KEY, JSON.stringify(STARTER_PLAYLIST_TRACKS));
    localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(DEFAULT_PREFS));
    localStorage.setItem(LOCAL_SEEDED_KEY, '1');
    notify('تمت إعادة ضبط المكتبة المحلية بنجاح', 'info');
  }, [notify]);

  const value = useMemo(
    () => ({
      authReady: true,
      favorites,
      isFavorite,
      toggleFavorite,
      history,
      recordListeningProgress,
      clearHistory,
      playlists,
      playlistTracks,
      createNewPlaylist,
      removePlaylist,
      addTrackToUserPlaylist,
      removeTrackFromUserPlaylist,
      prefs,
      saveReadingPosition,
      savePreferences,
      clearAllLocalData,
    }),
    [
      favorites,
      isFavorite,
      toggleFavorite,
      history,
      recordListeningProgress,
      clearHistory,
      playlists,
      playlistTracks,
      createNewPlaylist,
      removePlaylist,
      addTrackToUserPlaylist,
      removeTrackFromUserPlaylist,
      prefs,
      saveReadingPosition,
      savePreferences,
      clearAllLocalData,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
