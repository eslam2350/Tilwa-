import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider, testConnection } from '../services/firebase';
import { warmOfflineQuranCache } from '../services/quranApi';
import {
  fetchDynamicAppConfig,
  publishDynamicAppConfig,
  subscribeDynamicAppConfig,
} from '../services/storeService';
import type { DynamicAppConfig } from '../types/tilawa';
import {
  ADMIN_EMAIL,
  DEFAULT_DYNAMIC_CONFIG,
  DYNAMIC_CONFIG_CACHE_KEY,
  DYNAMIC_CONFIG_LOCAL_PREVIEW_KEY,
  isCustomTheme,
  mergeDynamicConfig,
} from '../utils/dynamicConfigHelpers';
import { useAppData } from './AppDataContext';

export interface AndroidBridge {
  setThemeColors?: (bgObsidian: string, accent: string) => void;
  getOtaInfo?: () => string;
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

interface DynamicConfigContextValue {
  config: DynamicAppConfig;
  publishedConfig: DynamicAppConfig;
  hasLocalPreview: boolean;
  isCheckingRemote: boolean;
  lastSyncedAt: string | null;
  remoteConnected: boolean;
  adminUser: User | null;
  isVerifiedAdmin: boolean;
  authLoading: boolean;
  androidOta: AndroidOtaState;
  signInAsAdmin: () => Promise<void>;
  signOutAdmin: () => Promise<void>;
  checkRemoteConfigNow: () => Promise<boolean>;
  triggerAndroidOtaCheck: () => void;
  applyAndroidOtaUpdate: () => void;
  resetAndroidEmbeddedBundle: () => void;
  saveLocalPreview: (draft: DynamicAppConfig) => void;
  clearLocalPreview: () => void;
  publishConfigToServer: (draft: DynamicAppConfig) => Promise<DynamicAppConfig>;
  resetServerToDefault: () => Promise<DynamicAppConfig>;
}

const DynamicConfigContext = createContext<DynamicConfigContextValue | null>(null);

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

function applyThemeToDom(config: DynamicAppConfig): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const { theme } = config;
  root.style.setProperty('--bg-obsidian', theme.bgObsidian);
  root.style.setProperty('--bg-surface', theme.bgSurface);
  root.style.setProperty('--bg-elevated', theme.bgElevated);
  root.style.setProperty('--emerald-deep', theme.emeraldDeep);
  root.style.setProperty('--emerald-soft', theme.emeraldSoft);
  root.style.setProperty('--gold-antique', theme.goldAntique);
  root.style.setProperty('--text-primary', theme.textPrimary);
  root.style.setProperty('--text-secondary', theme.textSecondary);
  root.dataset.dynamicTheme = isCustomTheme(theme) ? 'custom' : 'default';

  try {
    window.TilawaAndroid?.setThemeColors?.(theme.bgObsidian, theme.emeraldDeep);
  } catch {
    // ignore outside Android bridge
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
  const { notify } = useAppData();

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

  // Sync CSS variables & Android system bars whenever active config changes
  useEffect(() => {
    applyThemeToDom(activeConfig);
    if (activeConfig.images.heroBackdropUrl) {
      void precacheRemoteImage(activeConfig.images.heroBackdropUrl);
    }
  }, [activeConfig]);

  // Listen for Firebase Auth user state (used by Admin Dashboard)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAdminUser(user);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const isVerifiedAdmin = useMemo(
    () =>
      Boolean(
        adminUser &&
          adminUser.emailVerified &&
          adminUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      ),
    [adminUser]
  );

  // Connect to central Firestore `/app_config/live` in real-time & persist offline cache
  useEffect(() => {
    let active = true;
    void testConnection().then((ok) => {
      if (active) setRemoteConnected(ok);
    });

    const unsub = subscribeDynamicAppConfig(
      (remoteCfg) => {
        if (!active) return;
        setPublishedConfig(remoteCfg);
        writeCachedConfig(DYNAMIC_CONFIG_CACHE_KEY, remoteCfg);
        setLastSyncedAt(new Date().toISOString());
        setRemoteConnected(true);
      },
      () => {
        if (active) setRemoteConnected(false);
      }
    );

    void warmOfflineQuranCache();

    return () => {
      active = false;
      unsub();
    };
  }, []);

  // Refresh config & notify Android OTA checker when online
  const checkRemoteConfigNow = useCallback(async (): Promise<boolean> => {
    setIsCheckingRemote(true);
    try {
      const remoteCfg = await fetchDynamicAppConfig();
      if (remoteCfg) {
        const versionChanged = remoteCfg.version > publishedConfig.version;
        setPublishedConfig(remoteCfg);
        writeCachedConfig(DYNAMIC_CONFIG_CACHE_KEY, remoteCfg);
        setLastSyncedAt(new Date().toISOString());
        setRemoteConnected(true);
        if (window.TilawaAndroid?.checkForUpdates && remoteCfg.ota.manifestUrl) {
          window.TilawaAndroid.checkForUpdates(remoteCfg.ota.manifestUrl);
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
  }, [publishedConfig.version]);

  useEffect(() => {
    const onOnline = () => {
      void warmOfflineQuranCache();
      void checkRemoteConfigNow();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [checkRemoteConfigNow]);

  // Listen to native Android WebView OTA events dispatched from MainActivity.java
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

  const signInAsAdmin = useCallback(async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        notify('هذا الحساب مسجل كمستمع؛ النشر للسيرفر مقتصر على حساب المدير المعتمد.', 'info');
      } else {
        notify('تم تسجيل دخول المدير بنجاح — يمكنك النشر المباشر لجميع الأجهزة', 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر إتمام تسجيل الدخول';
      notify(msg, 'error');
    }
  }, [notify]);

  const signOutAdmin = useCallback(async () => {
    await signOut(auth);
    notify('تم تسجيل الخروج من حساب الإدارة', 'info');
  }, [notify]);

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
    notify('تم الرجوع للنسخة المنشورة من السيرفر', 'info');
  }, [notify]);

  const publishConfigToServer = useCallback(
    async (draft: DynamicAppConfig): Promise<DynamicAppConfig> => {
      if (!adminUser || !isVerifiedAdmin) {
        throw new Error('يجب تسجيل الدخول بحساب المدير الموثق لنشر التعديلات على السيرفر.');
      }
      const nextDraft: DynamicAppConfig = {
        ...draft,
        version: Math.max(publishedConfig.version + 1, draft.version || 1),
      };
      const published = await publishDynamicAppConfig(nextDraft, adminUser.uid);
      setPublishedConfig(published);
      writeCachedConfig(DYNAMIC_CONFIG_CACHE_KEY, published);
      setLocalPreview(null);
      try {
        localStorage.removeItem(DYNAMIC_CONFIG_LOCAL_PREVIEW_KEY);
      } catch {
        // ignore
      }
      setLastSyncedAt(new Date().toISOString());
      notify(`تم نشر الإصدار #${published.version} بنجاح لجميع المستخدمين وتطبيقات APK`, 'success');
      return published;
    },
    [adminUser, isVerifiedAdmin, publishedConfig.version, notify]
  );

  const resetServerToDefault = useCallback(async (): Promise<DynamicAppConfig> => {
    const cleanDefault: DynamicAppConfig = {
      ...DEFAULT_DYNAMIC_CONFIG,
      version: publishedConfig.version + 1,
    };
    if (adminUser && isVerifiedAdmin) {
      return publishConfigToServer(cleanDefault);
    }
    setLocalPreview(null);
    try {
      localStorage.removeItem(DYNAMIC_CONFIG_LOCAL_PREVIEW_KEY);
    } catch {
      // ignore
    }
    notify('تمت استعادة الإعدادات الافتراضية محليًا', 'info');
    return cleanDefault;
  }, [adminUser, isVerifiedAdmin, publishedConfig.version, publishConfigToServer, notify]);

  const value = useMemo<DynamicConfigContextValue>(
    () => ({
      config: activeConfig,
      publishedConfig,
      hasLocalPreview: Boolean(localPreview),
      isCheckingRemote,
      lastSyncedAt,
      remoteConnected,
      adminUser,
      isVerifiedAdmin,
      authLoading,
      androidOta,
      signInAsAdmin,
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
      adminUser,
      isVerifiedAdmin,
      authLoading,
      androidOta,
      signInAsAdmin,
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
