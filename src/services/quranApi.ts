import type { AyahItem } from '../types/tilawa';
import {
  buildOfflineQuranIndex,
  searchOfflineQuran,
  type CompactUthmaniRecord,
  type OfflineQuranIndex,
  type OfflineSearchResult,
} from '../utils/offlineQuranHelpers';

const API_BASE = 'https://api.alquran.cloud/v1';

declare global {
  interface Window {
    __TILAWA_OFFLINE_QURAN__?: CompactUthmaniRecord[];
  }
}

export type QuranSearchMatch = OfflineSearchResult;

const surahCache = new Map<number, AyahItem[]>();
const pageCache = new Map<number, AyahItem[]>();
const juzCache = new Map<number, AyahItem[]>();

const OFFLINE_ASSETS_CACHE = 'tilawa-dynamic-assets-v1';
const QURAN_DATA_PATH = '/data/quran-uthmani.json';

let offlineIndexPromise: Promise<OfflineQuranIndex | null> | null = null;

async function readQuranRecordsFromCacheOrNetwork(): Promise<CompactUthmaniRecord[] | null> {
  // 1. Embedded standalone APK / OTA bundle
  if (typeof window !== 'undefined' && Array.isArray(window.__TILAWA_OFFLINE_QURAN__)) {
    return window.__TILAWA_OFFLINE_QURAN__;
  }

  // 2. Cache API (works seamlessly offline even in dev/browser without SW)
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(OFFLINE_ASSETS_CACHE);
      const cachedRes = await cache.match(QURAN_DATA_PATH);
      if (cachedRes && cachedRes.ok) {
        const records = (await cachedRes.json()) as CompactUthmaniRecord[];
        if (Array.isArray(records) && records.length > 0) {
          return records;
        }
      }
    } catch {
      // ignore Cache API access failures
    }
  }

  // 3. Network fetch + store clone into Cache API for future offline sessions
  try {
    const res = await fetch(QURAN_DATA_PATH);
    if (!res.ok) return null;
    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(OFFLINE_ASSETS_CACHE);
        await cache.put(QURAN_DATA_PATH, res.clone());
      } catch {
        // ignore quota errors
      }
    }
    const records = (await res.json()) as CompactUthmaniRecord[];
    if (!Array.isArray(records) || records.length === 0) return null;
    return records;
  } catch {
    return null;
  }
}

export async function warmOfflineQuranCache(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (Array.isArray(window.__TILAWA_OFFLINE_QURAN__)) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  try {
    await getOfflineIndex();
  } catch {
    // non-blocking warmup
  }
}

async function getOfflineIndex(): Promise<OfflineQuranIndex | null> {
  if (!offlineIndexPromise) {
    offlineIndexPromise = (async () => {
      const records = await readQuranRecordsFromCacheOrNetwork();
      if (!records) {
        offlineIndexPromise = null;
        return null;
      }
      return buildOfflineQuranIndex(records);
    })();
  }
  return offlineIndexPromise;
}

interface RawApiAyah {
  number: number;
  numberInSurah: number;
  text: string;
  juz: number;
  page: number;
  hizbQuarter?: number;
  sajda?: boolean | { id: number; recommended: boolean; obligatory: boolean };
  surah?: {
    number: number;
    name: string;
  };
}

function mapAyahs(
  rawList: RawApiAyah[],
  fallbackSurahNumber?: number,
  fallbackSurahName?: string
): AyahItem[] {
  return rawList.map((a) => ({
    number: a.number,
    numberInSurah: a.numberInSurah,
    text: a.text.replace(/^\uFEFF/, ''),
    surahNumber: a.surah?.number ?? fallbackSurahNumber ?? 1,
    surahName: a.surah?.name ?? fallbackSurahName ?? '',
    juz: a.juz,
    page: a.page,
    hizbQuarter: a.hizbQuarter,
    sajda: a.sajda,
  }));
}

export async function fetchSurahUthmani(surahNumber: number): Promise<AyahItem[]> {
  if (surahCache.has(surahNumber)) {
    return surahCache.get(surahNumber)!;
  }
  const index = await getOfflineIndex();
  const offlineSurah = index?.bySurah.get(surahNumber);
  if (offlineSurah && offlineSurah.length > 0) {
    surahCache.set(surahNumber, offlineSurah);
    return offlineSurah;
  }

  const res = await fetch(`${API_BASE}/surah/${surahNumber}/quran-uthmani`);
  if (!res.ok) {
    throw new Error('تعذر تحميل نص السورة من الخادم القرآني الموثوق');
  }
  const json = await res.json();
  if (json.code !== 200 || !json.data?.ayahs) {
    throw new Error('بيانات السورة غير مكتملة');
  }
  const mapped = mapAyahs(json.data.ayahs, json.data.number, json.data.name);
  surahCache.set(surahNumber, mapped);
  return mapped;
}

export async function fetchPageUthmani(pageNumber: number): Promise<AyahItem[]> {
  if (pageCache.has(pageNumber)) {
    return pageCache.get(pageNumber)!;
  }
  const index = await getOfflineIndex();
  const offlinePage = index?.byPage.get(pageNumber);
  if (offlinePage && offlinePage.length > 0) {
    pageCache.set(pageNumber, offlinePage);
    return offlinePage;
  }

  const res = await fetch(`${API_BASE}/page/${pageNumber}/quran-uthmani`);
  if (!res.ok) {
    throw new Error('تعذر تحميل صفحة المصحف الشريف');
  }
  const json = await res.json();
  if (json.code !== 200 || !json.data?.ayahs) {
    throw new Error('تعذر قراءة بيانات الصفحة');
  }
  const mapped = mapAyahs(json.data.ayahs);
  pageCache.set(pageNumber, mapped);
  return mapped;
}

export async function fetchJuzUthmani(juzNumber: number): Promise<AyahItem[]> {
  if (juzCache.has(juzNumber)) {
    return juzCache.get(juzNumber)!;
  }
  const index = await getOfflineIndex();
  const offlineJuz = index?.byJuz.get(juzNumber);
  if (offlineJuz && offlineJuz.length > 0) {
    juzCache.set(juzNumber, offlineJuz);
    return offlineJuz;
  }

  const res = await fetch(`${API_BASE}/juz/${juzNumber}/quran-uthmani`);
  if (!res.ok) {
    throw new Error('تعذر تحميل الجزء المطلوب');
  }
  const json = await res.json();
  if (json.code !== 200 || !json.data?.ayahs) {
    throw new Error('تعذر قراءة بيانات الجزء');
  }
  const mapped = mapAyahs(json.data.ayahs);
  juzCache.set(juzNumber, mapped);
  return mapped;
}

export async function searchQuranVerses(query: string): Promise<QuranSearchMatch[]> {
  const cleaned = query.trim();
  if (cleaned.length < 2) return [];

  const index = await getOfflineIndex();
  if (index) {
    return searchOfflineQuran(index, cleaned, 25);
  }

  const res = await fetch(
    `${API_BASE}/search/${encodeURIComponent(cleaned)}/all/quran-simple-clean`
  );
  if (!res.ok) {
    return [];
  }
  const json = await res.json();
  if (json.code !== 200 || !json.data?.matches) {
    return [];
  }
  return (json.data.matches as Array<{
    number: number;
    numberInSurah: number;
    text: string;
    surah: { number: number; name: string };
  }>)
    .slice(0, 25)
    .map((m) => ({
      number: m.number,
      numberInSurah: m.numberInSurah,
      text: m.text,
      surahNumber: m.surah.number,
      surahName: m.surah.name,
    }));
}

const tafseerMemoryCache = new Map<string, string>();
const TAFSEER_STORAGE_KEY = 'tilawa_tafseer_muyassar_v1';

function readStoredTafseer(key: string): string | null {
  try {
    const raw = localStorage.getItem(TAFSEER_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return typeof map[key] === 'string' ? map[key] : null;
  } catch {
    return null;
  }
}

function writeStoredTafseer(key: string, text: string): void {
  try {
    const raw = localStorage.getItem(TAFSEER_STORAGE_KEY);
    const map: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    const keys = Object.keys(map);
    if (keys.length > 250) {
      delete map[keys[0]];
    }
    map[key] = text;
    localStorage.setItem(TAFSEER_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

export async function fetchAyahTafseer(
  surahNumber: number,
  numberInSurah: number
): Promise<string> {
  const key = `${surahNumber}:${numberInSurah}`;
  if (tafseerMemoryCache.has(key)) {
    return tafseerMemoryCache.get(key)!;
  }
  const stored = readStoredTafseer(key);
  if (stored) {
    tafseerMemoryCache.set(key, stored);
    return stored;
  }

  const res = await fetch(`${API_BASE}/ayah/${surahNumber}:${numberInSurah}/ar.muyassar`);
  if (!res.ok) {
    throw new Error('تعذر جلب التفسير الميسر — تأكد من الاتصال بالإنترنت');
  }
  const json = await res.json();
  const tafseerText = json?.data?.text;
  if (json.code !== 200 || typeof tafseerText !== 'string' || !tafseerText.trim()) {
    throw new Error('لم يتوفر تفسير لهذه الآية حاليًا');
  }
  tafseerMemoryCache.set(key, tafseerText.trim());
  writeStoredTafseer(key, tafseerText.trim());
  return tafseerText.trim();
}

