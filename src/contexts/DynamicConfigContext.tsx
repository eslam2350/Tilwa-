import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, testConnection } from '../services/firebase';
import { warmOfflineQuranCache } from '../services/quranApi';
import {
  deleteAdminRecitation,
  deleteAdminReciter,
  fetchDynamicAppConfig,
  fetchRawAdminRecitations,
  fetchRawCustomReciters,
  publishDynamicAppConfig,
  subscribeDynamicAppConfig,
} from '../services/storeService';
import type { DynamicAppConfig } from '../types/tilawa';
import {
  DEFAULT_DYNAMIC_CONFIG,
  DEFAULT_SECURITY,
  DEFAULT_TYPOGRAPHY,
  DYNAMIC_CONFIG_CACHE_KEY,
  DYNAMIC_CONFIG_LOCAL_PREVIEW_KEY,
  isCustomTheme,
  mergeDynamicConfig,
} from '../utils/dynamicConfigHelpers';
import {
  buildApiEndpointCandidates,
  persistWorkingServerOrigin,
  readClientOriginOptions,
} from '../utils/apiOrigin';
import { isBlockedReciter } from '../utils/quranHelpers';
import { useAppData } from './AppDataContext';

export interface AndroidBridge {
  setThemeColors?: (bgObsidian: string, accent: string) => void;
  getOtaInfo?: () => string;
  getServerOrigin?: () => string;
  getAppVersion?: () => string;
  checkForUpdates?: (manifestUrl: string) => void;
  applyUpdate?: () => void;
  resetToEmbedded?: () => void;
}

declare global {
  interface Window {
    TilawaAndroid?: AndroidBridge;
  }
}

export interface AndroidOtaState {
  isAndroidApk: boolean;
  usingCachedBundle: boolean;
  cachedVersion: string;
  pendingVersion: string | null;
  otaUpdateReady: boolean;
  checking: boolean;
  lastCheckedAt: string | null;
}

export interface OwnerAuthState {
  authenticated: boolean;
  checked: boolean;
  token: string | null;
  expiresAt: string | null;
}

interface DynamicConfigContextValue {
  config: DynamicAppConfig;
  publishedConfig: DynamicAppConfig;
  hasLocalPreview: boolean;
  isCheckingRemote: boolean;
  lastSyncedAt: string | null;
  remoteConnected: boolean;
  ownerAuth: OwnerAuthState;
  adminUser: User | null;
  isVerifiedAdmin: boolean;
  authLoading: boolean;
  androidOta: AndroidOtaState;
  loginOwnerByEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
  logoutOwner: () => Promise<void>;
  revokeAllOwnerSessions: () => Promise<void>;
  refreshOwnerSession: () => Promise<boolean>;
  ownerFetch: (url: string, init?: RequestInit) => Promise<Response>;
  signOutAdmin: () => Promise<void>;
  checkRemoteConfigNow: () => Promise<boolean>;
  triggerAndroidOtaCheck: () => void;
  applyAndroidOtaUpdate: () => void;
  resetAndroidEmbeddedBundle: () => void;
  saveLocalPreview: (draft: DynamicAppConfig) => void;
  clearLocalPreview: () => void;
  publishConfigToServer: (draft: DynamicAppConfig, summary?: string) => Promise<DynamicAppConfig>;
  resetServerToDefault: () => Promise<DynamicAppConfig>;
}

const DynamicConfigContext = createContext<DynamicConfigContextValue | null>(null);

const OWNER_SESSION_TOKEN_KEY = 'tilawa_owner_session_token_v1';
const WEB_KNOWN_MANIFEST_SHA_KEY = 'tilawa_known_web_manifest_sha_v1';
export const SECURITY_POLICY_STORAGE_KEY = 'tilawa_security_policy_v1';

function readStoredOwnerToken(): string | null {
  try {
    return sessionStorage.getItem(OWNER_SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeStoredOwnerToken(token: string | null): void {
  try {
    if (token) {
      sessionStorage.setItem(OWNER_SESSION_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(OWNER_SESSION_TOKEN_KEY);
    }
  } catch {
    // ignore storage restriction
  }
}

function readCachedConfig(key: string): DynamicAppConfig | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return mergeDynamicConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeCachedConfig(key: string, cfg: DynamicAppConfig): void {
  try {
    localStorage.setItem(key, JSON.stringify(cfg));
  } catch {
    // ignore storage quota errors
  }
}

function readBridgeOtaInfo(): Partial<AndroidOtaState> {
  try {
    if (typeof window === 'undefined' || !window.TilawaAndroid?.getOtaInfo) {
      return { isAndroidApk: false };
    }
    const raw = window.TilawaAndroid.getOtaInfo();
    const parsed = JSON.parse(raw) as {
      isAndroidApk?: boolean;
      usingCachedBundle?: boolean;
      cachedVersion?: string;
      pendingVersion?: string;
      otaUpdateReady?: boolean;
    };
    return {
      isAndroidApk: Boolean(parsed.isAndroidApk),
      usingCachedBundle: Boolean(parsed.usingCachedBundle),
      cachedVersion: parsed.cachedVersion || 'embedded',
      pendingVersion: parsed.pendingVersion || null,
      otaUpdateReady: Boolean(parsed.otaUpdateReady),
    };
  } catch {
    return { isAndroidApk: Boolean(window?.TilawaAndroid) };
  }
}

const DISPLAY_FONT_STACKS: Record<string, string> = {
  Amiri: "'Amiri', 'IBM Plex Sans Arabic', serif",
  'IBM Plex Sans Arabic': "'IBM Plex Sans Arabic', system-ui, sans-serif",
  Cairo: "'Cairo', 'IBM Plex Sans Arabic', sans-serif",
  'Noto Naskh Arabic': "'Noto Naskh Arabic', 'Amiri', serif",
};

const BODY_FONT_STACKS: Record<string, string> = {
  'IBM Plex Sans Arabic': "'IBM Plex Sans Arabic', system-ui, -apple-system, sans-serif",
  Cairo: "'Cairo', 'IBM Plex Sans Arabic', system-ui, sans-serif",
  'Readex Pro': "'Readex Pro', 'IBM Plex Sans Arabic', system-ui, sans-serif",
};

function applyThemeAndTypographyToDom(config: DynamicAppConfig): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const { theme } = config;
  const typo = config.typography || DEFAULT_TYPOGRAPHY;

  root.style.setProperty('--bg-obsidian', theme.bgObsidian);
  root.style.setProperty('--bg-surface', theme.bgSurface);
  root.style.setProperty('--bg-elevated', theme.bgElevated);
  root.style.setProperty('--emerald-deep', theme.emeraldDeep);
  root.style.setProperty('--emerald-soft', theme.emeraldSoft);
  root.style.setProperty('--gold-antique', theme.goldAntique);
  root.style.setProperty('--text-primary', theme.textPrimary);
  root.style.setProperty('--text-secondary', theme.textSecondary);

  root.style.setProperty(
    '--font-display',
    DISPLAY_FONT_STACKS[typo.displayFont] || DISPLAY_FONT_STACKS.Amiri
  );
  root.style.setProperty(
    '--font-body',
    BODY_FONT_STACKS[typo.bodyFont] || BODY_FONT_STACKS['IBM Plex Sans Arabic']
  );
  root.style.setProperty('--base-font-size', `${typo.baseFontSizePx}px`);
  root.style.setProperty('--card-radius', `${typo.cardRadiusPx}px`);
  root.style.setProperty('--glass-blur', `${typo.glassBlurPx}px`);

  root.dataset.dynamicTheme = isCustomTheme(theme) ? 'custom' : 'default';

  try {
    window.TilawaAndroid?.setThemeColors?.(theme.bgObsidian, theme.emeraldDeep);
  } catch {
    // ignore outside Android bridge
  }
}

function applySeoToDom(config: DynamicAppConfig): void {
  if (typeof document === 'undefined' || !config.seo) return;
  const seo = config.seo;

  const setMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
    let el = document.querySelector<HTMLMetaElement>(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.content = content;
  };

  setMeta('meta[name="description"]', 'name', 'description', seo.metaDescription);
  setMeta('meta[name="keywords"]', 'name', 'keywords', seo.metaKeywords);
  setMeta(
    'meta[name="robots"]',
    'name',
    'robots',
    seo.robotsIndex ? 'index, follow, max-image-preview:large' : 'noindex, nofollow'
  );
  setMeta('meta[property="og:title"]', 'property', 'og:title', seo.ogTitle);
  setMeta('meta[property="og:description"]', 'property', 'og:description', seo.ogDescription);

  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical && seo.canonicalUrl) {
    canonical.href = seo.canonicalUrl;
  }
}

async function precacheRemoteImage(url: string): Promise<void> {
  if (!url || !/^https?:\/\//i.test(url) || typeof caches === 'undefined') return;
  try {
    const cache = await caches.open('tilawa-dynamic-assets-v1');
    const hit = await cache.match(url);
    if (!hit) {
      await cache.add(new Request(url, { mode: 'no-cors' }));
    }
  } catch {
    // ignore CORS / offline cache misses
  }
}

export const DynamicConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { notify, refreshCatalog } = useAppData();

  const [publishedConfig, setPublishedConfig] = useState<DynamicAppConfig>(
    () => readCachedConfig(DYNAMIC_CONFIG_CACHE_KEY) || DEFAULT_DYNAMIC_CONFIG
  );
  const [localPreview, setLocalPreview] = useState<DynamicAppConfig | null>(() =>
    readCachedConfig(DYNAMIC_CONFIG_LOCAL_PREVIEW_KEY)
  );
  const [isCheckingRemote, setIsCheckingRemote] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [ownerAuth, setOwnerAuth] = useState<OwnerAuthState>(() => ({
    authenticated: false,
    checked: false,
    token: readStoredOwnerToken(),
    expiresAt: null,
  }));
  const serverVersionRef = useRef<number>(0);

  const [androidOta, setAndroidOta] = useState<AndroidOtaState>(() => ({
    isAndroidApk: false,
    usingCachedBundle: false,
    cachedVersion: 'embedded',
    pendingVersion: null,
    otaUpdateReady: false,
    checking: false,
    lastCheckedAt: null,
    ...readBridgeOtaInfo(),
  }));

  const activeConfig = useMemo(
    () => localPreview || publishedConfig,
    [localPreview, publishedConfig]
  );

  // Sync theme, typography, SEO tags & security policy bridge whenever active config updates
  useEffect(() => {
    applyThemeAndTypographyToDom(activeConfig);
    applySeoToDom(activeConfig);
    if (activeConfig.images.heroBackdropUrl) {
      void precacheRemoteImage(activeConfig.images.heroBackdropUrl);
    }

    const sec = activeConfig.security || DEFAULT_SECURITY;
    try {
      localStorage.setItem(
        SECURITY_POLICY_STORAGE_KEY,
        JSON.stringify({
          disabledReciterIds: sec.disabledReciterIds,
          blockedReciterKeywords: sec.blockedReciterKeywords,
        })
      );
      window.dispatchEvent(
        new CustomEvent('tilawa:security-policy-changed', {
          detail: {
            disabledReciterIds: sec.disabledReciterIds,
            blockedReciterKeywords: sec.blockedReciterKeywords,
          },
        })
      );
    } catch {
      // ignore storage errors
    }
  }, [activeConfig]);

  // Verify backend Owner Session token/cookie on mount
  const refreshOwnerSession = useCallback(async (): Promise<boolean> => {
    const token = readStoredOwnerToken();
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/admin/session', {
        method: 'GET',
        headers,
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        setOwnerAuth({ authenticated: false, checked: true, token: null, expiresAt: null });
        writeStoredOwnerToken(null);
        return false;
      }
      const data = (await res.json()) as { authenticated?: boolean; expiresAt?: string | null };
      const isAuthed = Boolean(data.authenticated);
      if (!isAuthed) {
        writeStoredOwnerToken(null);
      }
      setOwnerAuth({
        authenticated: isAuthed,
        checked: true,
        token: isAuthed ? token : null,
        expiresAt: data.expiresAt || null,
      });
      return isAuthed;
    } catch {
      setOwnerAuth((prev) => ({ ...prev, authenticated: false, checked: true }));
      return false;
    }
  }, []);

  useEffect(() => {
    void refreshOwnerSession();
  }, [refreshOwnerSession]);

  const ownerFetch = useCallback(
    async (url: string, init: RequestInit = {}): Promise<Response> => {
      const token = ownerAuth.token || readStoredOwnerToken();
      const headers = new Headers(init.headers || {});
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await fetch(url, {
        ...init,
        headers,
        credentials: 'include',
      });
      if (res.status === 401 || res.status === 403) {
        writeStoredOwnerToken(null);
        setOwnerAuth({ authenticated: false, checked: true, token: null, expiresAt: null });
      }
      return res;
    },
    [ownerAuth.token]
  );

  const loginOwnerByEmail = useCallback(
    async (email: string): Promise<{ ok: boolean; error?: string }> => {
      const trimmed = email.trim();
      if (!trimmed || !trimmed.includes('@')) {
        return { ok: false, error: 'يرجى إدخال البريد الإلكتروني الصحيح.' };
      }
      try {
        const res = await fetch('/api/owner/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: trimmed }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          authenticated?: boolean;
          token?: string;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.authenticated || !data.token) {
          return {
            ok: false,
            error: data.error || 'البريد الإلكتروني غير مصرح له بالدخول.',
          };
        }
        writeStoredOwnerToken(data.token);
        setOwnerAuth({
          authenticated: true,
          checked: true,
          token: data.token,
          expiresAt: null,
        });
        void refreshOwnerSession();
        notify('تم التحقق من هوية المالك وفتح لوحة الإدارة بنجاح', 'success');
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بخادم التحقق، يرجى المحاولة لاحقًا.' };
      }
    },
    [notify, refreshOwnerSession]
  );

  const logoutOwner = useCallback(async () => {
    try {
      await fetch('/api/owner/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore network error on logout
    }
    writeStoredOwnerToken(null);
    setOwnerAuth({ authenticated: false, checked: true, token: null, expiresAt: null });
    notify('تم تسجيل الخروج من جلسة المالك', 'info');
  }, [notify]);

  const revokeAllOwnerSessions = useCallback(async () => {
    const res = await ownerFetch('/api/admin/session/revoke-all', { method: 'POST' });
    if (!res.ok) {
      throw new Error('تعذر إنهاء الجلسات النشطة.');
    }
    writeStoredOwnerToken(null);
    setOwnerAuth({ authenticated: false, checked: true, token: null, expiresAt: null });
    notify('تم إنهاء جميع الجلسات النشطة — أعد تسجيل الدخول', 'success');
  }, [notify, ownerFetch]);

  // Listen for Firebase Auth state (used only as optional cloud-sync mirror)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAdminUser(user);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const isVerifiedAdmin = ownerAuth.authenticated;

  // Auto-purge any blocked reciters from Firestore if Firebase session happens to be active
  useEffect(() => {
    if (!adminUser?.emailVerified) return;
    let cancelled = false;
    void (async () => {
      try {
        const [rawReciters, rawRecitations] = await Promise.all([
          fetchRawCustomReciters(),
          fetchRawAdminRecitations(),
        ]);
        const blockedReciters = rawReciters.filter((r) => isBlockedReciter(r));
        const blockedRecitations = rawRecitations.filter((rec) =>
          isBlockedReciter({ id: rec.reciterId, nameAr: rec.surahNameAr, titleAr: rec.sourceName })
        );
        if (blockedReciters.length === 0 && blockedRecitations.length === 0) return;
        await Promise.all([
          ...blockedReciters.map((r) => deleteAdminReciter(r.id)),
          ...blockedRecitations.map((rec) => deleteAdminRecitation(rec.id)),
        ]);
        if (!cancelled) {
          await refreshCatalog();
        }
      } catch {
        // ignore if Firestore permission or offline
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminUser, refreshCatalog]);

  const fetchBackendSiteConfig = useCallback(async (): Promise<DynamicAppConfig | null> => {
    const candidates = buildApiEndpointCandidates('/api/public/config', {
      ...readClientOriginOptions(),
      manifestUrl: publishedConfig.ota?.manifestUrl,
    });
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        const data = (await res.json()) as { ok?: boolean; config?: unknown };
        if (!data.ok || !data.config) continue;
        persistWorkingServerOrigin(url);
        const merged = mergeDynamicConfig(data.config);
        serverVersionRef.current = merged.version;
        return merged;
      } catch {
        // try next origin candidate
      }
    }
    return null;
  }, [publishedConfig.ota?.manifestUrl]);

  // Connect to central Express `/api/public/config` + Firestore `/app_config/live`
  useEffect(() => {
    let active = true;

    void fetchBackendSiteConfig().then((srvCfg) => {
      if (!active || !srvCfg) return;
      setPublishedConfig(srvCfg);
      writeCachedConfig(DYNAMIC_CONFIG_CACHE_KEY, srvCfg);
      setLastSyncedAt(new Date().toISOString());
      setRemoteConnected(true);
    });

    void testConnection().then((ok) => {
      if (active && ok) setRemoteConnected(true);
    });

    const unsub = subscribeDynamicAppConfig(
      (remoteCfg) => {
        if (!active) return;
        // Never overwrite newer Express server saved config with an older Firestore document
        if (serverVersionRef.current > 0 && remoteCfg.version <= serverVersionRef.current) {
          return;
        }
        setPublishedConfig(remoteCfg);
        writeCachedConfig(DYNAMIC_CONFIG_CACHE_KEY, remoteCfg);
        setLastSyncedAt(new Date().toISOString());
        setRemoteConnected(true);
      },
      () => {
        // ignore Firestore stream errors if Express config already works
      }
    );

    if (publishedConfig.performance?.precacheQuranOffline !== false) {
      void warmOfflineQuranCache();
    }

    const checkWebBundleVersion = async () => {
      if (
        window.TilawaAndroid?.getOtaInfo ||
        (window.location.protocol !== 'http:' && window.location.protocol !== 'https:')
      ) {
        return;
      }
      try {
        const res = await fetch(`/downloads/ota-manifest.json?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const manifest = (await res.json()) as { version?: string; sha256?: string };
        if (!manifest.sha256) return;
        const prevSha = localStorage.getItem(WEB_KNOWN_MANIFEST_SHA_KEY);
        if (!prevSha) {
          localStorage.setItem(WEB_KNOWN_MANIFEST_SHA_KEY, manifest.sha256);
          return;
        }
        if (prevSha !== manifest.sha256 && active) {
          localStorage.setItem(WEB_KNOWN_MANIFEST_SHA_KEY, manifest.sha256);
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            await reg?.update();
          }
          setAndroidOta((prev) => ({
            ...prev,
            otaUpdateReady: true,
            pendingVersion: manifest.version || 'جديد',
            lastCheckedAt: new Date().toISOString(),
          }));
        }
      } catch {
        // ignore misses
      }
    };
    const webCheckTimer = window.setTimeout(() => void checkWebBundleVersion(), 2500);

    return () => {
      active = false;
      window.clearTimeout(webCheckTimer);
      unsub();
    };
  }, [fetchBackendSiteConfig]);

  const checkRemoteConfigNow = useCallback(async (): Promise<boolean> => {
    setIsCheckingRemote(true);
    try {
      const [srvCfg, fsCfg] = await Promise.all([
        fetchBackendSiteConfig(),
        fetchDynamicAppConfig().catch(() => null),
      ]);
      const chosen =
        srvCfg && fsCfg
          ? srvCfg.version >= fsCfg.version
            ? srvCfg
            : fsCfg
          : srvCfg || fsCfg;

      if (chosen) {
        const versionChanged = chosen.version > publishedConfig.version;
        setPublishedConfig(chosen);
        writeCachedConfig(DYNAMIC_CONFIG_CACHE_KEY, chosen);
        setLastSyncedAt(new Date().toISOString());
        setRemoteConnected(true);
        if (window.TilawaAndroid?.checkForUpdates && chosen.ota.manifestUrl) {
          window.TilawaAndroid.checkForUpdates(chosen.ota.manifestUrl);
        }
        return versionChanged;
      }
      setLastSyncedAt(new Date().toISOString());
      return false;
    } catch {
      return false;
    } finally {
      setIsCheckingRemote(false);
    }
  }, [fetchBackendSiteConfig, publishedConfig.version]);

  useEffect(() => {
    const onOnline = () => {
      void warmOfflineQuranCache();
      void checkRemoteConfigNow();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [checkRemoteConfigNow]);

  useEffect(() => {
    const onOtaReady = (ev: Event) => {
      const detail = (ev as CustomEvent<{ version?: string }>).detail || {};
      setAndroidOta((prev) => ({
        ...prev,
        isAndroidApk: true,
        checking: false,
        otaUpdateReady: true,
        pendingVersion: detail.version || 'جديد',
        lastCheckedAt: new Date().toISOString(),
      }));
    };

    const onOtaStatus = (ev: Event) => {
      const detail = (ev as CustomEvent<Partial<AndroidOtaState>>).detail || {};
      setAndroidOta((prev) => ({
        ...prev,
        ...readBridgeOtaInfo(),
        ...detail,
        checking: false,
        lastCheckedAt: new Date().toISOString(),
      }));
    };

    window.addEventListener('tilawa:ota-ready', onOtaReady);
    window.addEventListener('tilawa:ota-status', onOtaStatus);
    return () => {
      window.removeEventListener('tilawa:ota-ready', onOtaReady);
      window.removeEventListener('tilawa:ota-status', onOtaStatus);
    };
  }, []);

  const triggerAndroidOtaCheck = useCallback(() => {
    const manifestUrl = activeConfig.ota.manifestUrl;
    if (!window.TilawaAndroid?.checkForUpdates) {
      void checkRemoteConfigNow().then((changed) => {
        notify(
          changed ? 'تم تحديث إعدادات التطبيق بنجاح' : 'أنت على أحدث إصدار من الواجهة والإعدادات',
          changed ? 'success' : 'info'
        );
      });
      return;
    }
    setAndroidOta((prev) => ({ ...prev, checking: true }));
    window.TilawaAndroid.checkForUpdates(manifestUrl);
  }, [activeConfig.ota.manifestUrl, checkRemoteConfigNow, notify]);

  const applyAndroidOtaUpdate = useCallback(() => {
    if (window.TilawaAndroid?.applyUpdate) {
      window.TilawaAndroid.applyUpdate();
    } else {
      window.location.reload();
    }
  }, []);

  const resetAndroidEmbeddedBundle = useCallback(() => {
    if (window.TilawaAndroid?.resetToEmbedded) {
      window.TilawaAndroid.resetToEmbedded();
    }
  }, []);

  const signOutAdmin = useCallback(async () => {
    await logoutOwner();
    if (adminUser) {
      await signOut(auth).catch(() => {});
    }
  }, [adminUser, logoutOwner]);

  const saveLocalPreview = useCallback(
    (draft: DynamicAppConfig) => {
      const clean = mergeDynamicConfig(draft);
      setLocalPreview(clean);
      writeCachedConfig(DYNAMIC_CONFIG_LOCAL_PREVIEW_KEY, clean);
      notify('تم تفعيل المعاينة المحلية على جهازك', 'success');
    },
    [notify]
  );

  const clearLocalPreview = useCallback(() => {
    setLocalPreview(null);
    try {
      localStorage.removeItem(DYNAMIC_CONFIG_LOCAL_PREVIEW_KEY);
    } catch {
      // ignore
    }
    notify('تم الرجوع للنسخة المنشورة من الخادم', 'info');
  }, [notify]);

  const publishConfigToServer = useCallback(
    async (draft: DynamicAppConfig, summary?: string): Promise<DynamicAppConfig> => {
      if (!ownerAuth.authenticated) {
        throw new Error('يجب تسجيل دخول المالك بالبريد الإلكتروني لحفظ ونشر التعديلات.');
      }

      const cleanDraft = mergeDynamicConfig(draft);
      const nextDraft: DynamicAppConfig = {
        ...cleanDraft,
        version: Math.max(publishedConfig.version + 1, cleanDraft.version || 1),
      };

      const res = await ownerFetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: nextDraft, summary }),
      });

      const payload = (await res.json()) as { ok?: boolean; config?: unknown; error?: string };
      if (!res.ok || !payload.ok || !payload.config) {
        throw new Error(payload.error || 'تعذر حفظ التعديلات على الخادم.');
      }

      const published = mergeDynamicConfig(payload.config);
      serverVersionRef.current = published.version;

      // Best-effort secondary mirror to Firestore if Firebase admin user happens to be signed in
      if (adminUser) {
        void publishDynamicAppConfig(published, adminUser.uid).catch(() => {});
      }

      setPublishedConfig(published);
      writeCachedConfig(DYNAMIC_CONFIG_CACHE_KEY, published);
      setLocalPreview(null);
      try {
        localStorage.removeItem(DYNAMIC_CONFIG_LOCAL_PREVIEW_KEY);
      } catch {
        // ignore
      }
      setLastSyncedAt(new Date().toISOString());
      setRemoteConnected(true);
      notify(`تم حفظ ونشر الإصدار #${published.version} لجميع الزوار بنجاح`, 'success');
      return published;
    },
    [adminUser, notify, ownerAuth.authenticated, ownerFetch, publishedConfig.version]
  );

  const resetServerToDefault = useCallback(async (): Promise<DynamicAppConfig> => {
    const cleanDefault: DynamicAppConfig = {
      ...DEFAULT_DYNAMIC_CONFIG,
      version: publishedConfig.version + 1,
    };
    if (ownerAuth.authenticated) {
      return publishConfigToServer(cleanDefault, 'استعادة الإعدادات الافتراضية للمنصة');
    }
    setLocalPreview(null);
    try {
      localStorage.removeItem(DYNAMIC_CONFIG_LOCAL_PREVIEW_KEY);
    } catch {
      // ignore
    }
    notify('تمت استعادة الإعدادات الافتراضية محليًا', 'info');
    return cleanDefault;
  }, [notify, ownerAuth.authenticated, publishConfigToServer, publishedConfig.version]);

  const value = useMemo<DynamicConfigContextValue>(
    () => ({
      config: activeConfig,
      publishedConfig,
      hasLocalPreview: Boolean(localPreview),
      isCheckingRemote,
      lastSyncedAt,
      remoteConnected,
      ownerAuth,
      adminUser,
      isVerifiedAdmin,
      authLoading,
      androidOta,
      loginOwnerByEmail,
      logoutOwner,
      revokeAllOwnerSessions,
      refreshOwnerSession,
      ownerFetch,
      signOutAdmin,
      checkRemoteConfigNow,
      triggerAndroidOtaCheck,
      applyAndroidOtaUpdate,
      resetAndroidEmbeddedBundle,
      saveLocalPreview,
      clearLocalPreview,
      publishConfigToServer,
      resetServerToDefault,
    }),
    [
      activeConfig,
      publishedConfig,
      localPreview,
      isCheckingRemote,
      lastSyncedAt,
      remoteConnected,
      ownerAuth,
      adminUser,
      isVerifiedAdmin,
      authLoading,
      androidOta,
      loginOwnerByEmail,
      logoutOwner,
      revokeAllOwnerSessions,
      refreshOwnerSession,
      ownerFetch,
      signOutAdmin,
      checkRemoteConfigNow,
      triggerAndroidOtaCheck,
      applyAndroidOtaUpdate,
      resetAndroidEmbeddedBundle,
      saveLocalPreview,
      clearLocalPreview,
      publishConfigToServer,
      resetServerToDefault,
    ]
  );

  return (
    <DynamicConfigContext.Provider value={value}>{children}</DynamicConfigContext.Provider>
  );
};

export function useDynamicConfig(): DynamicConfigContextValue {
  const ctx = useContext(DynamicConfigContext);
  if (!ctx) {
    throw new Error('useDynamicConfig must be used inside DynamicConfigProvider');
  }
  return ctx;
}
