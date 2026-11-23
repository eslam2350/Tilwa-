import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OtaUpdateBanner } from './components/OtaUpdateBanner';
import { PlaylistPickerModal } from './components/PlaylistPickerModal';
import { ToastContainer } from './components/ToastContainer';
import { AppDataProvider } from './contexts/AppDataContext';
import { AudioPlayerProvider, useAudioPlayer } from './contexts/AudioPlayerContext';
import { AuthProvider } from './contexts/AuthContext';
import { DynamicConfigProvider, useDynamicConfig } from './contexts/DynamicConfigContext';
import { HomePage } from './pages/HomePage';
import type { AppRoute, AudioTrack, NavPageId } from './types/tilawa';

const loadAdminDashboardPage = () =>
  import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }));
const loadBasiraEpisodePage = () =>
  import('./pages/BasiraEpisodePage').then((m) => ({ default: m.BasiraEpisodePage }));
const loadBasiraPage = () =>
  import('./pages/BasiraPage').then((m) => ({ default: m.BasiraPage }));
const loadBasiraPreacherPage = () =>
  import('./pages/BasiraPreacherPage').then((m) => ({ default: m.BasiraPreacherPage }));
const loadLibraryPage = () =>
  import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage }));
const loadMushafPage = () =>
  import('./pages/MushafPage').then((m) => ({ default: m.MushafPage }));
const loadReciterProfilePage = () =>
  import('./pages/ReciterProfilePage').then((m) => ({ default: m.ReciterProfilePage }));
const loadRecitersPage = () =>
  import('./pages/RecitersPage').then((m) => ({ default: m.RecitersPage }));
const loadSearchPage = () =>
  import('./pages/SearchPage').then((m) => ({ default: m.SearchPage }));
const loadTahfeezPage = () =>
  import('./pages/TahfeezPage').then((m) => ({ default: m.TahfeezPage }));

export function prefetchRouteChunk(id: NavPageId): void {
  switch (id) {
    case 'reciters':
      void loadRecitersPage();
      break;
    case 'basira':
      void loadBasiraPage();
      break;
    case 'mushaf':
      void loadMushafPage();
      break;
    case 'tahfeez':
      void loadTahfeezPage();
      break;
    case 'search':
      void loadSearchPage();
      break;
    case 'library':
      void loadLibraryPage();
      break;
    default:
      break;
  }
}

const AdminDashboardPage = React.lazy(loadAdminDashboardPage);
const BasiraEpisodePage = React.lazy(loadBasiraEpisodePage);
const BasiraPage = React.lazy(loadBasiraPage);
const BasiraPreacherPage = React.lazy(loadBasiraPreacherPage);
const LibraryPage = React.lazy(loadLibraryPage);
const MushafPage = React.lazy(loadMushafPage);
const ReciterProfilePage = React.lazy(loadReciterProfilePage);
const RecitersPage = React.lazy(loadRecitersPage);
const SearchPage = React.lazy(loadSearchPage);
const TahfeezPage = React.lazy(loadTahfeezPage);

const PageLoadingFallback: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 flex items-center justify-center">
    <div className="glass-panel rounded-2xl px-6 py-4 flex items-center gap-3 text-xs text-[#A9B2AE]">
      <span className="w-4 h-4 rounded-full border-2 border-[#C8A253]/30 border-t-[#C8A253] animate-spin" />
      <span>جارٍ فتح القسم...</span>
    </div>
  </div>
);

function parseHashToRoute(): AppRoute {
  const rawHash = window.location.hash.replace(/^#/, '');
  const [hashPath, queryStr] = rawHash.split('?');
  if (!hashPath || hashPath === '/') return { page: 'home' };
  const parts = hashPath.split('/').filter(Boolean);
  if (parts[0] === 'reciters' && parts[1]) {
    return { page: 'reciter', reciterId: parts[1] };
  }
  if (parts[0] === 'reciters') return { page: 'reciters' };
  if (parts[0] === 'basira') {
    if (parts[1] === 'preachers' && parts[2]) {
      return { page: 'basira-preacher', preacherId: decodeURIComponent(parts[2]) };
    }
    if (parts[1] === 'episodes' && parts[2]) {
      return { page: 'basira-episode', episodeId: decodeURIComponent(parts[2]) };
    }
    const params = new URLSearchParams(queryStr || '');
    const cat = params.get('cat') || undefined;
    return { page: 'basira', category: cat };
  }
  if (parts[0] === 'mushaf') {
    if (parts[1] === 'page' && parts[2]) {
      const p = Number(parts[2]);
      return { page: 'mushaf', pageNum: Number.isFinite(p) ? p : undefined };
    }
    if (parts[1] === 'juz' && parts[2]) {
      const j = Number(parts[2]);
      return { page: 'mushaf', juz: Number.isFinite(j) ? j : undefined };
    }
    if (parts[1] === 'surah' && parts[2]) {
      const s = Number(parts[2]);
      return { page: 'mushaf', surah: Number.isFinite(s) ? s : undefined };
    }
    const surah = parts[1] ? Number(parts[1]) : undefined;
    return { page: 'mushaf', surah: Number.isFinite(surah) ? surah : undefined };
  }
  if (parts[0] === 'tahfeez') {
    const surah = parts[1] ? Number(parts[1]) : undefined;
    return { page: 'tahfeez', surah: Number.isFinite(surah) ? surah : undefined };
  }
  if (parts[0] === 'search') {
    const params = new URLSearchParams(queryStr || '');
    const q = params.get('q') || undefined;
    return { page: 'search', query: q };
  }
  if (parts[0] === 'library') return { page: 'library' };
  if (parts[0] === 'admin') return { page: 'admin' };
  return { page: 'home' };
}

function getRouteDocumentTitle(r: AppRoute, homeSeoTitle?: string): string {
  switch (r.page) {
    case 'mushaf':
      return 'المصحف الشريف بالرسم العثماني (٦٠٤ صفحة) | TILAWA تلاوة';
    case 'reciters':
      return 'مكتبة أعلام القراء (١٠٩ قارئ) | TILAWA تلاوة';
    case 'reciter':
      return 'ملف القارئ والسور الصوتية | TILAWA تلاوة';
    case 'basira':
      return 'بصيرة — بودكاست دعوي صوتي (١٢٠ حلقة) | TILAWA تلاوة';
    case 'basira-preacher':
      return 'صفحة الداعية والحلقات الصوتية — بصيرة | TILAWA تلاوة';
    case 'basira-episode':
      return 'حلقة بودكاست صوتي — بصيرة | TILAWA تلاوة';
    case 'tahfeez':
      return 'معلم تحفيظ القرآن الكريم | TILAWA تلاوة';
    case 'search':
      return 'البحث الذكي في الآيات والقراء | TILAWA تلاوة';
    case 'library':
      return 'مكتبتي والختمة اليومية | TILAWA تلاوة';
    case 'admin':
      return 'بوابة المالك | TILAWA تلاوة';
    default:
      return homeSeoTitle || 'TILAWA | تلاوة — عِش مع القرآن | مصحف وتلاوات ١٠٩ قارئ';
  }
}

function routeToHash(r: AppRoute): string {
  switch (r.page) {
    case 'home':
      return '#/';
    case 'reciters':
      return '#/reciters';
    case 'reciter':
      return `#/reciters/${r.reciterId}`;
    case 'basira':
      return r.category ? `#/basira?cat=${encodeURIComponent(r.category)}` : '#/basira';
    case 'basira-preacher':
      return `#/basira/preachers/${encodeURIComponent(r.preacherId)}`;
    case 'basira-episode':
      return `#/basira/episodes/${encodeURIComponent(r.episodeId)}`;
    case 'mushaf':
      if (r.pageNum) return `#/mushaf/page/${r.pageNum}`;
      if (r.juz) return `#/mushaf/juz/${r.juz}`;
      if (r.surah) return `#/mushaf/surah/${r.surah}`;
      return '#/mushaf';
    case 'tahfeez':
      return r.surah ? `#/tahfeez/${r.surah}` : '#/tahfeez';
    case 'search':
      return r.query ? `#/search?q=${encodeURIComponent(r.query)}` : '#/search';
    case 'library':
      return '#/library';
    case 'admin':
      return '#/admin';
  }
}

const TilawaShell: React.FC = () => {
  const [route, setRoute] = useState<AppRoute>(() => parseHashToRoute());
  const [playlistModalTrack, setPlaylistModalTrack] = useState<AudioTrack | null>(null);
  const { currentTrack } = useAudioPlayer();
  const { config } = useDynamicConfig();

  useEffect(() => {
    const onHashChange = () => setRoute(parseHashToRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = getRouteDocumentTitle(route, config.seo?.metaTitle);
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (canonical && !config.seo?.canonicalUrl) canonical.href = cleanUrl;
      const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
      if (ogUrl) ogUrl.content = cleanUrl;
    }
  }, [route, config.seo?.metaTitle, config.seo?.canonicalUrl]);

  useEffect(() => {
    if (route.page === 'admin') return;
    const isFileRuntime =
      window.location.protocol === 'file:' || Boolean(window.TilawaAndroid?.getServerOrigin);
    const origin = isFileRuntime
      ? window.TilawaAndroid?.getServerOrigin?.() ||
        'https://ais-pre-yohyjyrr4bd6elu2ixq7e7-1009876701033.europe-west2.run.app'
      : '';
    void fetch(`${origin}/api/public/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'pageview', route: route.page }),
    }).catch(() => {});
  }, [route.page]);

  const navigate = useCallback((next: AppRoute) => {
    setRoute(next);
    window.location.hash = routeToHash(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const isStandaloneMushaf = route.page === 'mushaf';

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-[#0A0D0C] text-[#F5F3EE]">
      {!isStandaloneMushaf && <Navbar route={route} navigate={navigate} />}
      {config.general?.maintenanceMode && route.page !== 'admin' && (
        <div
          role="status"
          className="bg-amber-950/75 border-b border-amber-400/30 px-4 py-2 text-center text-xs text-amber-100"
        >
          {config.general.maintenanceMessage}
        </div>
      )}
      <OtaUpdateBanner />
      <OfflineIndicator />
      <ToastContainer />

      <div className="flex-1">
        <Suspense fallback={<PageLoadingFallback />}>
          {route.page === 'home' && (
            <HomePage
              navigate={navigate}
              onPickPlaylistForTrack={(trk) => setPlaylistModalTrack(trk)}
            />
          )}
          {route.page === 'reciters' && <RecitersPage navigate={navigate} />}
          {route.page === 'reciter' && (
            <ReciterProfilePage
              reciterId={route.reciterId}
              navigate={navigate}
              onPickPlaylistForTrack={(trk) => setPlaylistModalTrack(trk)}
            />
          )}
          {route.page === 'basira' && (
            <BasiraPage initialCategory={route.category} navigate={navigate} />
          )}
          {route.page === 'basira-preacher' && (
            <BasiraPreacherPage preacherId={route.preacherId} navigate={navigate} />
          )}
          {route.page === 'basira-episode' && (
            <BasiraEpisodePage episodeId={route.episodeId} navigate={navigate} />
          )}
          {route.page === 'mushaf' && (
            <MushafPage
              initialSurah={route.surah}
              initialPage={route.pageNum}
              initialJuz={route.juz}
              navigate={navigate}
            />
          )}
          {route.page === 'tahfeez' && (
            <TahfeezPage
              initialSurah={route.surah}
              initialStartAyah={route.startAyah}
              initialEndAyah={route.endAyah}
              navigate={navigate}
            />
          )}
          {route.page === 'search' && (
            <SearchPage initialQuery={route.query} navigate={navigate} />
          )}
          {route.page === 'library' && <LibraryPage navigate={navigate} />}
          {route.page === 'admin' && <AdminDashboardPage navigate={navigate} />}
        </Suspense>
      </div>

      {!isStandaloneMushaf && <Footer navigate={navigate} />}

      <AudioPlayerBar
        onAddToPlaylistClick={() => {
          if (currentTrack) setPlaylistModalTrack(currentTrack);
        }}
      />

      <PlaylistPickerModal
        track={playlistModalTrack}
        onClose={() => setPlaylistModalTrack(null)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppDataProvider>
        <DynamicConfigProvider>
          <AuthProvider>
            <AudioPlayerProvider>
              <TilawaShell />
            </AudioPlayerProvider>
          </AuthProvider>
        </DynamicConfigProvider>
      </AppDataProvider>
    </ErrorBoundary>
  );
}
