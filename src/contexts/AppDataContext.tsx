import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CANONICAL_RECITERS, LATEST_CURATED_RECITATIONS } from '../data/reciters';
import { fetchAdminRecitations, fetchCustomReciters } from '../services/storeService';
import type { CuratedRecitation, Reciter } from '../types/tilawa';

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'info' | 'success' | 'error';
}

interface AppDataContextValue {
  reciters: Reciter[];
  curatedRecitations: CuratedRecitation[];
  isLoadingCatalog: boolean;
  refreshCatalog: () => Promise<void>;
  toasts: ToastMessage[];
  notify: (text: string, tone?: 'info' | 'success' | 'error') => void;
  dismissToast: (id: string) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customReciters, setCustomReciters] = useState<Reciter[]>([]);
  const [adminRecitations, setAdminRecitations] = useState<CuratedRecitation[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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

  const refreshCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    try {
      const [dbReciters, dbRecitations] = await Promise.all([
        fetchCustomReciters().catch(() => []),
        fetchAdminRecitations().catch(() => []),
      ]);
      setCustomReciters(dbReciters);
      setAdminRecitations(dbRecitations);
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  // Merge canonical reciters with any overrides/additions
  const reciters = useMemo(() => {
    const map = new Map<string, Reciter>();
    for (const c of CANONICAL_RECITERS) {
      map.set(c.id, c);
    }
    for (const custom of customReciters) {
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
  }, [customReciters]);

  // Merge curated recitations
  const curatedRecitations = useMemo(() => {
    const map = new Map<string, CuratedRecitation>();
    for (const r of LATEST_CURATED_RECITATIONS) {
      map.set(r.id, r);
    }
    for (const r of adminRecitations) {
      map.set(r.id, r);
    }
    return Array.from(map.values());
  }, [adminRecitations]);

  const value = useMemo(
    () => ({
      reciters,
      curatedRecitations,
      isLoadingCatalog,
      refreshCatalog,
      toasts,
      notify,
      dismissToast,
    }),
    [reciters, curatedRecitations, isLoadingCatalog, refreshCatalog, toasts, notify, dismissToast]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
