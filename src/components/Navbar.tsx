import React, { useMemo } from 'react';
import { BookOpen, GraduationCap, Home, Library, Pause, Play, Search, Users } from 'lucide-react';
import { useAppData } from '../contexts/AppDataContext';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAuth } from '../contexts/AuthContext';
import { useDynamicConfig } from '../contexts/DynamicConfigContext';
import type { AppRoute, NavPageId } from '../types/tilawa';
import { AudioWaveBars } from './AudioWaveBars';

interface NavbarProps {
  route: AppRoute;
  navigate: (next: AppRoute) => void;
}

const NAV_ICON_MAP: Record<NavPageId, React.ReactNode> = {
  home: <Home className="w-5 h-5" />,
  reciters: <Users className="w-5 h-5" />,
  mushaf: <BookOpen className="w-5 h-5" />,
  tahfeez: <GraduationCap className="w-5 h-5" />,
  search: <Search className="w-5 h-5" />,
  library: <Library className="w-5 h-5" />,
};

const NAV_ROUTE_MAP: Record<NavPageId, AppRoute> = {
  home: { page: 'home' },
  reciters: { page: 'reciters' },
  mushaf: { page: 'mushaf' },
  tahfeez: { page: 'tahfeez' },
  search: { page: 'search' },
  library: { page: 'library' },
};

export const Navbar: React.FC<NavbarProps> = ({ route, navigate }) => {
  const { reciters } = useAppData();
  const { currentTrack, isPlaying, togglePlayPause, playSurahByReciter } = useAudioPlayer();
  const { history } = useAuth();
  const { config } = useDynamicConfig();

  const navItems = useMemo(
    () =>
      config.navPages
        .filter((pg) => pg.visible)
        .map((pg) => ({
          id: pg.id,
          label: pg.label,
          route: NAV_ROUTE_MAP[pg.id],
          icon: NAV_ICON_MAP[pg.id],
        })),
    [config.navPages]
  );

  const isActive = (id: NavPageId) => {
    if (id === 'reciters' && route.page === 'reciter') return true;
    return route.page === id;
  };

  const handleQuickListen = () => {
    if (currentTrack) {
      togglePlayPause();
      return;
    }
    const last = history[0];
    if (last) {
      const r = reciters.find((item) => item.id === last.reciterId) || reciters[0];
      if (r) {
        playSurahByReciter(r, last.surahNumber, last.style, last.progressSeconds);
        return;
      }
    }
    if (reciters[0]) {
      playSurahByReciter(reciters[0], 1, 'مرتل');
    }
  };

  return (
    <>
      <header className="relative md:sticky md:top-0 z-40 glass-panel border-b border-[#C8A253]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate({ page: 'home' })}
            className="flex items-center gap-2 text-lg md:text-xl font-display font-bold tracking-tight text-[#F5F3EE] hover:text-[#C8A253] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span
              aria-hidden="true"
              className="w-2 h-2 rotate-45 bg-[#C8A253] inline-block shrink-0"
            />
            <span>{config.texts.siteName}</span>
          </button>

          {/* Zone 2: Dynamic Ordered Navigation Links */}
          <nav aria-label="التنقل الرئيسي" className="hidden md:flex items-center gap-7">
            {navItems.map((item) => {
              const active = isActive(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.route)}
                  className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active ? 'text-[#C8A253]' : 'text-[#A9B2AE] hover:text-[#F5F3EE]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-[#C8A253] rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action — Instant Playback CTA (Zero Login) */}
          <div className="relative flex items-center shrink-0">
            <button
              type="button"
              onClick={handleQuickListen}
              className="flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] border border-[#178A64]/50 text-[#F5F3EE] text-xs sm:text-sm font-medium shadow-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {currentTrack && isPlaying ? (
                <>
                  <AudioWaveBars active className="text-[#C8A253]" />
                  <Pause className="w-3.5 h-3.5" />
                  <span>إيقاف التلاوة</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>{currentTrack ? 'متابعة التلاوة' : 'استمع الآن'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar (Compact 56px height) */}
      <nav
        aria-label="تنقل الجوال"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-14 glass-panel border-t border-[#C8A253]/20 flex items-center"
      >
        {navItems.map((item) => {
          const active = isActive(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.route)}
              className={`relative flex-1 flex flex-col items-center justify-center min-h-[44px] py-1 transition-colors cursor-pointer ${
                active ? 'text-[#C8A253]' : 'text-[#A9B2AE]'
              }`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 inset-x-4 h-0.5 bg-[#C8A253] rounded-b-full"
                />
              )}
              {item.icon}
              <span className="text-[10px] font-medium mt-0.5 whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

