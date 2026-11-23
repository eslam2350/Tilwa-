export const DEFAULT_SERVER_ORIGINS = [
  'https://ais-pre-yohyjyrr4bd6elu2ixq7e7-1009876701033.europe-west2.run.app',
  'https://ais-dev-yohyjyrr4bd6elu2ixq7e7-1009876701033.europe-west2.run.app',
] as const;

export const SERVER_ORIGIN_CACHE_KEY = 'tilawa_server_origin_v1';

export function extractOriginFromUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
    return null;
  } catch {
    return null;
  }
}

export function isEmbeddedFileRuntime(
  protocol?: string,
  hasAndroidBridge?: boolean
): boolean {
  if (hasAndroidBridge) return true;
  if (protocol === 'file:' || protocol === 'content:') return true;
  return false;
}

export function getCandidateServerOrigins(params: {
  bridgeOrigin?: string | null;
  storedOrigin?: string | null;
  manifestUrl?: string | null;
}): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const pushOrigin = (raw: string | null | undefined) => {
    const clean = extractOriginFromUrl(raw);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      ordered.push(clean);
    }
  };

  pushOrigin(params.bridgeOrigin);
  pushOrigin(params.storedOrigin);
  pushOrigin(params.manifestUrl);
  for (const fallback of DEFAULT_SERVER_ORIGINS) {
    pushOrigin(fallback);
  }

  return ordered;
}

export function buildApiEndpointCandidates(
  apiPath: string,
  options: {
    protocol?: string;
    hasAndroidBridge?: boolean;
    bridgeOrigin?: string | null;
    storedOrigin?: string | null;
    manifestUrl?: string | null;
  }
): string[] {
  const normalizedPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  if (!isEmbeddedFileRuntime(options.protocol, options.hasAndroidBridge)) {
    return [normalizedPath];
  }
  const origins = getCandidateServerOrigins(options);
  return origins.map((origin) => `${origin}${normalizedPath}`);
}

export function resolveRuntimeMediaUrl(
  url: string,
  options: {
    protocol?: string;
    hasAndroidBridge?: boolean;
    bridgeOrigin?: string | null;
    storedOrigin?: string | null;
    manifestUrl?: string | null;
  }
): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed;
  }
  if (!trimmed.startsWith('/uploads/')) {
    return trimmed;
  }
  if (!isEmbeddedFileRuntime(options.protocol, options.hasAndroidBridge)) {
    return trimmed;
  }
  const origins = getCandidateServerOrigins(options);
  return origins[0] ? `${origins[0]}${trimmed}` : trimmed;
}

export function readClientOriginOptions(): {
  protocol: string;
  hasAndroidBridge: boolean;
  bridgeOrigin: string | null;
  storedOrigin: string | null;
} {
  if (typeof window === 'undefined') {
    return {
      protocol: 'https:',
      hasAndroidBridge: false,
      bridgeOrigin: null,
      storedOrigin: null,
    };
  }
  let bridgeOrigin: string | null = null;
  try {
    bridgeOrigin = window.TilawaAndroid?.getServerOrigin?.() || null;
  } catch {
    bridgeOrigin = null;
  }
  let storedOrigin: string | null = null;
  try {
    storedOrigin = localStorage.getItem(SERVER_ORIGIN_CACHE_KEY);
  } catch {
    storedOrigin = null;
  }
  return {
    protocol: window.location.protocol,
    hasAndroidBridge: Boolean(window.TilawaAndroid?.getOtaInfo || window.TilawaAndroid?.getServerOrigin),
    bridgeOrigin,
    storedOrigin,
  };
}

export function persistWorkingServerOrigin(urlUsed: string): void {
  const origin = extractOriginFromUrl(urlUsed);
  if (!origin || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SERVER_ORIGIN_CACHE_KEY, origin);
  } catch {
    // ignore storage errors
  }
}
