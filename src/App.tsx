import React, { useCallback, useEffect, useState } from 'react';
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
import { DynamicConfigProvider } from './contexts/DynamicConfigContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { HomePage } from './pages/HomePage';
import { LibraryPage } from './pages/LibraryPage';
import { MushafPage } from './pages/MushafPage';
import { ReciterProfilePage } from './pages/ReciterProfilePage';
import { RecitersPage } from './pages/RecitersPage';
import { SearchPage } from './pages/SearchPage';
import { TahfeezPage } from './pages/TahfeezPage';
import type { AppRoute, AudioTrack } from './types/tilawa';

function parseHashToRoute(): AppRoute {
  const rawHash = window.location.hash.replace(/^#/, '');
  const [hashPath, queryStr] = rawHash.split('?');
  if (!hashPath || hashPath === '/') return { page: 'home' };
  const parts = hashPath.split('/').filter(Boolean);
  if (parts[0] === 'reciters' && parts[1]) {
    return { page: 'reciter', reciterId: parts[1] };
  }
  if (parts[0] === 'reciters') return { page: 'reciters' };
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

function getRouteDocumentTitle(r: AppRoute): string {
  switch (r.page) {
    case 'mushaf':
      return 'المصحف الشريف بالرسم العثماني (٦٠٤ صفحة) | TILAWA تلاوة';
    case 'reciters':
      return 'مكتبة أعلام القراء (٣٦ قارئًا) | TILAWA تلاوة';
    case 'reciter':
      return 'ملف القارئ والسور الصوتية | TILAWA تلاوة';
    case 'tahfeez':
      return 'معلم تحفيظ القرآن الكريم | TILAWA تلاوة';
    case 'search':
      return 'البحث الذكي في الآيات والقراء | TILAWA تلاوة';
    case 'library':
      return 'مكتبتي والختمة اليومية | TILAWA تلاوة';
    case 'admin':
      return 'لوحة الإدارة والتحديثات | TILAWA تلاوة';
    default:
      return 'TILAWA | تلاوة — عِش مع القرآن | مصحف وتلاوات ٣٦ قارئًا';
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

  useEffect(() => {
    const onHashChange = () => setRoute(parseHashToRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    document.title = getRouteDocumentTitle(route);
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (canonical) canonical.href = cleanUrl;
      const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
      if (ogUrl) ogUrl.content = cleanUrl;
    }
  }, [route]);

  const navigate = useCallback((next: AppRoute) => {
    setRoute(next);
    window.location.hash = routeToHash(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const isStandaloneMushaf = route.page === 'mushaf';

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-[#0A0D0C] text-[#F5F3EE]">
      {!isStandaloneMushaf && <Navbar route={route} navigate={navigate} />}
      <OtaUpdateBanner />
      <OfflineIndicator />
      <ToastContainer />

      <div className="flex-1">
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
