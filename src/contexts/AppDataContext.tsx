import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_BASIRA_CATALOG } from '../data/basiraData';
import { CANONICAL_RECITERS, LATEST_CURATED_RECITATIONS } from '../data/reciters';
import { fetchAdminRecitations, fetchCustomReciters } from '../services/storeService';
import type {
  BasiraCatalogData,
  BasiraEpisode,
  BasiraPlaylist,
  BasiraPreacher,
  CuratedRecitation,
  Reciter,
} from '../types/tilawa';
import {
  buildApiEndpointCandidates,
  persistWorkingServerOrigin,
  readClientOriginOptions,
  resolveRuntimeMediaUrl,
} from '../utils/apiOrigin';
import { mergeBasiraCatalog } from '../utils/basiraHelpers';
import { isBlockedReciter } from '../utils/quranHelpers';

const BASIRA_CACHE_KEY = 'tilawa_basira_cache_v1';

function readCachedBasiraCatalog(): BasiraCatalogData {
  try {
    const raw = localStorage.getItem(BASIRA_CACHE_KEY);
    if (!raw) return DEFAULT_BASIRA_CATALOG;
    return mergeBasiraCatalog(DEFAULT_BASIRA_CATALOG, JSON.parse(raw) as Partial<BasiraCatalogData>);
  } catch {
    return DEFAULT_BASIRA_CATALOG;
  }
}

function writeCachedBasiraCatalog(cat: BasiraCatalogData): void {
  try {
    localStorage.setItem(BASIRA_CACHE_KEY, JSON.stringify(cat));
  } catch {
    // ignore storage quota errors
  }
}

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'error';
}

interface SecurityPolicySnapshot {
  disabledReciterIds: string[];
  blockedReciterKeywords: string[];
}

interface AppDataContextValue {
  reciters: Reciter[];
  curatedRecitations: CuratedRecitation[];
  basiraCatalog: BasiraCatalogData;
  basiraPreachers: BasiraPreacher[];
  basiraEpisodes: BasiraEpisode[];
  basiraPlaylists: BasiraPlaylist[];
  isLoadingCatalog: boolean;
  refreshCatalog: () => Promise<void>;
  refreshBasira: () => Promise<void>;
  toasts: ToastMessage[];
  notify: (text: string, tone?: 'info' | 'success' | 'error') => void;
  dismissToast: (id: string) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function readInitialSecurityPolicy(): SecurityPolicySnapshot {
  try {
    const raw = localStorage.getItem('tilawa_security_policy_v1');
    if (!raw) return { disabledReciterIds: [], blockedReciterKeywords: [] };
    const parsed = JSON.parse(raw) as Partial<SecurityPolicySnapshot>;
    return {
      disabledReciterIds: Array.isArray(parsed.disabledReciterIds) ? parsed.disabledReciterIds : [],
      blockedReciterKeywords: Array.isArray(parsed.blockedReciterKeywords) ? parsed.blockedReciterKeywords : [],
    };
  } catch {
    return { disabledReciterIds: [], blockedReciterKeywords: [] };
  }
}

function matchesCustomBlockedKeyword(
  reciter: { id?: string; nameAr?: string; titleAr?: string },
  keywords: string[]
): boolean {
  if (keywords.length === 0) return false;
  const hay = `${reciter.id || ''} ${reciter.nameAr || ''} ${reciter.titleAr || ''}`.toLowerCase();
  return keywords.some((kw) => kw && hay.includes(kw.toLowerCase()));
}

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customReciters, setCustomReciters] = useState<Reciter[]>([]);
  const [adminRecitations, setAdminRecitations] = useState<CuratedRecitation[]>([]);
  const [basiraCatalog, setBasiraCatalog] = useState<BasiraCatalogData>(() =>
    readCachedBasiraCatalog()
  );
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [securityPolicy, setSecurityPolicy] = useState<SecurityPolicySnapshot>(
    () => readInitialSecurityPolicy()
  );

  useEffect(() => {
    const onPolicyChanged = (ev: Event) => {
      const detail = (ev as CustomEvent<SecurityPolicySnapshot>).detail;
      if (detail) {
        setSecurityPolicy({
          disabledReciterIds: Array.isArray(detail.disabledReciterIds) ? detail.disabledReciterIds : [],
          blockedReciterKeywords: Array.isArray(detail.blockedReciterKeywords)
            ? detail.blockedReciterKeywords
            : [],
        });
      }
    };
    window.addEventListener('tilawa:security-policy-changed', onPolicyChanged);
    return () => window.removeEventListener('tilawa:security-policy-changed', onPolicyChanged);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (text: string, tone: 'info' | 'success' | 'error' = 'info') => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
      setTimeout(() => {
        dismissToast(id);
      }, 3600);
    },
    [dismissToast]
  );

  const refreshBasira = useCallback(async () => {
    const originOpts = readClientOriginOptions();
    const candidates = buildApiEndpointCandidates('/api/public/basira', originOpts);
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        const data = (await res.json()) as {
          ok?: boolean;
          catalog?: Partial<BasiraCatalogData> | null;
        };
        if (data.ok && data.catalog) {
          persistWorkingServerOrigin(url);
          const merged = mergeBasiraCatalog(DEFAULT_BASIRA_CATALOG, data.catalog);
          setBasiraCatalog(merged);
          writeCachedBasiraCatalog(merged);
          return;
        }
      } catch {
        // try next origin
      }
    }
  }, []);

  const refreshCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    try {
      const [dbReciters, dbRecitations] = await Promise.all([
        fetchCustomReciters().catch(() => []),
        fetchAdminRecitations().catch(() => []),
        refreshBasira(),
      ]);
      setCustomReciters(dbReciters);
      setAdminRecitations(dbRecitations);
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [refreshBasira]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  const disabledSet = useMemo(
    () => new Set(securityPolicy.disabledReciterIds),
    [securityPolicy.disabledReciterIds]
  );

  const reciters = useMemo(() => {
    const map = new Map<string, Reciter>();
    for (const c of CANONICAL_RECITERS) {
      if (
        !isBlockedReciter(c) &&
        !disabledSet.has(c.id) &&
        !matchesCustomBlockedKeyword(c, securityPolicy.blockedReciterKeywords)
      ) {
        map.set(c.id, c);
      }
    }
    for (const custom of customReciters) {
      if (
        isBlockedReciter(custom) ||
        disabledSet.has(custom.id) ||
        matchesCustomBlockedKeyword(custom, securityPolicy.blockedReciterKeywords)
      ) {
        continue;
      }
      const existing = map.get(custom.id);
      if (existing) {
        map.set(custom.id, {
          ...existing,
          ...custom,
          collections: existing.collections,
        });
      } else {
        map.set(custom.id, custom);
      }
    }
    return Array.from(map.values());
  }, [customReciters, disabledSet, securityPolicy.blockedReciterKeywords]);

  const curatedRecitations = useMemo(() => {
    const map = new Map<string, CuratedRecitation>();
    for (const r of LATEST_CURATED_RECITATIONS) {
      if (
        !isBlockedReciter({ id: r.reciterId }) &&
        !disabledSet.has(r.reciterId) &&
        !matchesCustomBlockedKeyword({ id: r.reciterId }, securityPolicy.blockedReciterKeywords)
      ) {
        map.set(r.id, r);
      }
    }
    for (const r of adminRecitations) {
      if (
        !isBlockedReciter({ id: r.reciterId }) &&
        !disabledSet.has(r.reciterId) &&
        !matchesCustomBlockedKeyword({ id: r.reciterId }, securityPolicy.blockedReciterKeywords)
      ) {
        map.set(r.id, r);
      }
    }
    return Array.from(map.values());
  }, [adminRecitations, disabledSet, securityPolicy.blockedReciterKeywords]);

  const basiraPreachers = useMemo(() => {
    const opts = readClientOriginOptions();
    return basiraCatalog.preachers
      .filter((p) => p.published !== false)
      .sort((a, b) => a.order - b.order)
      .map((p) => ({
        ...p,
        photoUrl: resolveRuntimeMediaUrl(p.photoUrl, opts),
      }));
  }, [basiraCatalog.preachers]);

  const basiraEpisodes = useMemo(() => {
    const opts = readClientOriginOptions();
    return basiraCatalog.episodes
      .filter((e) => e.published !== false)
      .sort((a, b) => a.order - b.order)
      .map((e) => ({
        ...e,
        audioUrl: resolveRuntimeMediaUrl(e.audioUrl, opts),
        coverUrl: resolveRuntimeMediaUrl(e.coverUrl, opts),
      }));
  }, [basiraCatalog.episodes]);

  const basiraPlaylists = useMemo(() => {
    const opts = readClientOriginOptions();
    return basiraCatalog.playlists
      .filter((pl) => pl.published !== false)
      .sort((a, b) => a.order - b.order)
      .map((pl) => ({
        ...pl,
        coverUrl: pl.coverUrl ? resolveRuntimeMediaUrl(pl.coverUrl, opts) : undefined,
      }));
  }, [basiraCatalog.playlists]);

  const value = useMemo(
    () => ({
      reciters,
      curatedRecitations,
      basiraCatalog,
      basiraPreachers,
      basiraEpisodes,
      basiraPlaylists,
      isLoadingCatalog,
      refreshCatalog,
      refreshBasira,
      toasts,
      notify,
      dismissToast,
    }),
    [
      reciters,
      curatedRecitations,
      basiraCatalog,
      basiraPreachers,
      basiraEpisodes,
      basiraPlaylists,
      isLoadingCatalog,
      refreshCatalog,
      refreshBasira,
      toasts,
      notify,
      dismissToast,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
