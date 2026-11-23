import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  FastForward,
  Heart,
  ListMusic,
  Moon,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Rewind,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAppData } from '../contexts/AppDataContext';
import { useAudioPlayer, useAudioProgress } from '../contexts/AudioPlayerContext';
import { useAuth } from '../contexts/AuthContext';
import { useDynamicConfig } from '../contexts/DynamicConfigContext';
import type { SleepTimerOption } from '../types/tilawa';
import { formatTimeSeconds, toArabicDigits } from '../utils/quranHelpers';
import { AudioWaveBars } from './AudioWaveBars';
import { ReciterImage } from './ReciterImage';

interface AudioPlayerBarProps {
  onAddToPlaylistClick: () => void;
}

const SLEEP_OPTIONS: Array<{ value: SleepTimerOption; label: string }> = [
  { value: 0, label: 'إيقاف المؤقت' },
  { value: 15, label: '١٥ دقيقة' },
  { value: 30, label: '٣٠ دقيقة' },
  { value: 45, label: '٤٥ دقيقة' },
  { value: 60, label: '٦٠ دقيقة' },
  { value: -1, label: 'بنهاية المقطع الحالي' },
];

const MiniTopProgressBar: React.FC = () => {
  const { currentTime, duration } = useAudioProgress();
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  return (
    <div className="h-1 w-full bg-white/10 relative overflow-hidden">
      <div
        className="h-full bg-[#C8A253] transition-[width] duration-150"
        style={{ width: `${progressPct}%` }}
      />
    </div>
  );
};

const DesktopScrubberBar: React.FC<{ seekTo: (seconds: number) => void }> = ({ seekTo }) => {
  const { currentTime, duration } = useAudioProgress();
  return (
    <div dir="ltr" className="hidden lg:flex items-center gap-2.5 w-full">
      <span className="text-[11px] font-mono-nums text-[#A9B2AE] w-11 text-right">
        {formatTimeSeconds(currentTime)}
      </span>
      <input
        type="range"
        aria-label="شريط التقدم الصوتي"
        min={0}
        max={duration || 100}
        value={currentTime}
        onChange={(e) => seekTo(Number(e.target.value))}
        className="w-full accent-[#C8A253] cursor-pointer h-1.5"
      />
      <span className="text-[11px] font-mono-nums text-[#A9B2AE] w-11 text-left">
        {formatTimeSeconds(duration)}
      </span>
    </div>
  );
};

const ExpandedTimelineScrubber: React.FC<{ seekTo: (seconds: number) => void }> = ({ seekTo }) => {
  const { currentTime, duration } = useAudioProgress();
  return (
    <div dir="ltr" className="space-y-2">
      <input
        type="range"
        aria-label="تحديد موضع التلاوة"
        min={0}
        max={duration || 100}
        value={currentTime}
        onChange={(e) => seekTo(Number(e.target.value))}
        className="w-full accent-[#C8A253] cursor-pointer h-2"
      />
      <div className="flex items-center justify-between text-xs font-mono-nums text-[#A9B2AE]">
        <span>{formatTimeSeconds(currentTime)}</span>
        <span>{formatTimeSeconds(duration)}</span>
      </div>
    </div>
  );
};

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({ onAddToPlaylistClick }) => {
  const { reciters } = useAppData();
  const { isFavorite, toggleFavorite } = useAuth();
  const { config } = useDynamicConfig();
  const showWaveform = config.audioPlayer?.showWaveform !== false;
  const enableSleepTimer = config.audioPlayer?.enableSleepTimer !== false;
  const enableSegmentLoop = config.audioPlayer?.enableSegmentLoop !== false;
  const {
    currentTrack,
    queue,
    isPlaying,
    isBuffering,
    audioError,
    volume,
    isMuted,
    playbackRate,
    repeatMode,
    isShuffle,
    autoPlayNext,
    segmentLoop,
    sleepTimerOption,
    sleepRemainingSeconds,
    isExpanded,
    setIsExpanded,
    playTrack,
    togglePlayPause,
    seekTo,
    seekRelative,
    playNext,
    playPrev,
    setVolume,
    toggleMute,
    setPlaybackRate,
    cycleRepeat,
    toggleShuffle,
    toggleAutoPlayNext,
    setSleepTimer,
    setLoopStart,
    setLoopEnd,
    clearSegmentLoop,
    removeFromQueue,
    clearQueue,
    switchCurrentReciter,
  } = useAudioPlayer();

  const [showQueueDrawer, setShowQueueDrawer] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isExpanded) setIsExpanded(false);
        else if (showQueueDrawer) setShowQueueDrawer(false);
        return;
      }
      if (e.code === 'Space' && currentTrack) {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.tagName === 'BUTTON' ||
            target.tagName === 'A' ||
            target.getAttribute('role') === 'button')
        ) {
          return;
        }
        e.preventDefault();
        togglePlayPause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isExpanded, showQueueDrawer, setIsExpanded, currentTrack, togglePlayPause]);

  if (!currentTrack) return null;

  const favKey = `rec_${currentTrack.reciterId}_${currentTrack.surahNumber}`;
  const favored = isFavorite(favKey);

  const currentIdx = queue.findIndex((t) => t.id === currentTrack.id);
  const upNextTrack =
    currentIdx !== -1 && queue.length > 1
      ? queue[(currentIdx + 1) % queue.length]
      : null;

  const handleToggleFavorite = () => {
    void toggleFavorite({
      id: favKey,
      type: 'recitation',
      targetId: favKey,
      title: currentTrack.surahName,
      subtitle: `${currentTrack.reciterName} · ${currentTrack.style}`,
      audioUrl: currentTrack.audioUrl,
      reciterId: currentTrack.reciterId,
      surahNumber: currentTrack.surahNumber,
    });
  };

  const repeatLabel =
    repeatMode === 'one'
      ? 'تكرار السورة الحالية'
      : repeatMode === 'all'
      ? 'تكرار القائمة'
      : 'بدون تكرار';

  return (
    <>
      {/* Persistent Spotify-Style Mini-Player Bar */}
      <div
        role="region"
        aria-label="مشغل التلاوة الصوتي"
        className="fixed bottom-14 md:bottom-0 inset-x-0 z-40 glass-gold glass-bar border-t border-[#C8A253]/30 shadow-2xl"
      >
        <MiniTopProgressBar />

        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-3">
          {/* Left Zone: Reciter Art, Surah Info & Like */}
          <div className="flex items-center gap-3 min-w-0 flex-1 lg:max-w-[30%]">
            <div className="relative shrink-0">
              <ReciterImage
                src={currentTrack.reciterPhoto}
                alt={currentTrack.reciterName}
                loading="eager"
                className="w-10 h-10 md:w-12 md:h-12 rounded-xl object-cover border border-[#C8A253]/35"
              />
              {isPlaying && showWaveform && (
                <span className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-[#0A0D0C] border border-[#C8A253]/50 flex items-center justify-center text-[#C8A253]">
                  <AudioWaveBars active className="h-2.5" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  className="text-sm font-semibold text-[#F5F3EE] hover:text-[#C8A253] truncate text-right cursor-pointer"
                >
                  {currentTrack.surahName}
                </button>
                <span className="hidden sm:inline text-xs text-[#C8A253] shrink-0">
                  · {currentTrack.style}
                </span>
              </div>
              <p className="text-xs text-[#A9B2AE] truncate">
                {currentTrack.reciterName}
                {sleepTimerOption !== 0 && (
                  <span className="text-[#C8A253] mr-2">
                    · مؤقت:{' '}
                    {sleepTimerOption === -1
                      ? 'نهاية السورة'
                      : formatTimeSeconds(sleepRemainingSeconds ?? 0)}
                  </span>
                )}
                {audioError ? ` — ${audioError}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-label={favored ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
              className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-white/5 cursor-pointer shrink-0 transition-transform active:scale-90 ${
                favored ? 'text-[#C8A253]' : 'text-[#A9B2AE]'
              }`}
            >
              <Heart className={`w-4 h-4 ${favored ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Center Zone: Spotify Transport + Desktop Scrubber */}
          <div className="flex flex-col items-center gap-1 shrink-0 lg:flex-1 lg:max-w-xl">
            <div dir="ltr" className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={toggleShuffle}
                aria-label="التشغيل العشوائي"
                aria-pressed={isShuffle}
                className={`hidden md:flex min-w-[36px] min-h-[36px] items-center justify-center rounded-xl hover:bg-white/5 cursor-pointer ${
                  isShuffle ? 'text-[#C8A253]' : 'text-[#A9B2AE] hover:text-[#F5F3EE]'
                }`}
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={playPrev}
                aria-label="السورة السابقة"
                className="hidden sm:flex min-w-[38px] min-h-[38px] items-center justify-center rounded-xl text-[#A9B2AE] hover:text-[#F5F3EE] hover:bg-white/5 cursor-pointer"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => seekRelative(-10)}
                aria-label="تأخير ١٠ ثوانٍ"
                className="hidden lg:flex min-w-[36px] min-h-[36px] items-center justify-center rounded-xl text-[#A9B2AE] hover:text-[#F5F3EE] hover:bg-white/5 cursor-pointer"
              >
                <Rewind className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التلاوة'}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-[#0E6B4D] hover:bg-[#178A64] text-[#F5F3EE] shadow-md cursor-pointer transition-transform active:scale-95"
              >
                {isBuffering ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 fill-current" />
                )}
              </button>

              <button
                type="button"
                onClick={() => seekRelative(10)}
                aria-label="تقديم ١٠ ثوانٍ"
                className="hidden lg:flex min-w-[36px] min-h-[36px] items-center justify-center rounded-xl text-[#A9B2AE] hover:text-[#F5F3EE] hover:bg-white/5 cursor-pointer"
              >
                <FastForward className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={playNext}
                aria-label="السورة التالية"
                className="hidden sm:flex min-w-[38px] min-h-[38px] items-center justify-center rounded-xl text-[#A9B2AE] hover:text-[#F5F3EE] hover:bg-white/5 cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={cycleRepeat}
                aria-label={repeatLabel}
                title={repeatLabel}
                className={`hidden md:flex min-w-[36px] min-h-[36px] items-center justify-center rounded-xl hover:bg-white/5 cursor-pointer ${
                  repeatMode !== 'off' ? 'text-[#C8A253]' : 'text-[#A9B2AE] hover:text-[#F5F3EE]'
                }`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
              </button>
            </div>

            <DesktopScrubberBar seekTo={seekTo} />
          </div>

          {/* Right Zone: Queue Drawer Toggle, Desktop Volume, Expand Studio */}
          <div className="flex items-center gap-1.5 shrink-0 lg:min-w-[240px] justify-end">
            <button
              type="button"
              onClick={() => setShowQueueDrawer((q) => !q)}
              aria-label="قائمة الانتظار التالية"
              aria-expanded={showQueueDrawer}
              className={`min-w-[38px] min-h-[38px] hidden sm:flex items-center gap-1.5 px-2.5 rounded-xl hover:bg-white/5 text-xs cursor-pointer ${
                showQueueDrawer ? 'text-[#C8A253] bg-white/5' : 'text-[#A9B2AE]'
              }`}
            >
              <ListMusic className="w-4 h-4" />
              <span className="font-mono-nums">{toArabicDigits(queue.length)}</span>
            </button>

            <div dir="ltr" className="hidden xl:flex items-center gap-1.5 w-28">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
                className="p-1.5 rounded-lg text-[#A9B2AE] hover:text-[#F5F3EE] cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                aria-label="مستوى الصوت المختصر"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-[#0E6B4D] cursor-pointer h-1"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? 'تصغير المشغل' : 'توسيع المشغل المتقدم'}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#F5F3EE] hover:bg-white/10 cursor-pointer"
            >
              {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Floating Spotify-style Up-Next Queue Drawer */}
      {showQueueDrawer && !isExpanded && (
        <aside
          aria-label="قائمة الانتظار الصوتية"
          className="fixed bottom-32 md:bottom-20 left-4 right-4 sm:right-auto sm:w-96 z-40 glass-gold rounded-2xl p-4 shadow-2xl space-y-3 border border-[#C8A253]/30"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div>
              <h3 className="text-sm font-display font-bold text-[#F5F3EE]">
                قائمة الانتظار ({toArabicDigits(queue.length)})
              </h3>
              {upNextTrack && (
                <p className="text-[11px] text-[#C8A253] truncate">
                  التالي: {upNextTrack.surahName}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {queue.length > 1 && (
                <button
                  type="button"
                  onClick={clearQueue}
                  className="px-2 py-1 rounded-lg text-[11px] text-[#A9B2AE] hover:text-rose-300 hover:bg-white/5 cursor-pointer"
                >
                  تفريغ
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowQueueDrawer(false)}
                aria-label="إغلاق قائمة الانتظار"
                className="p-1.5 rounded-lg text-[#A9B2AE] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {queue.map((item) => {
              const active = item.id === currentTrack.id;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-2.5 p-2 rounded-xl transition-colors ${
                    active ? 'bg-[#0E6B4D]/25 border border-[#0E6B4D]/40' : 'hover:bg-white/5'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => playTrack(item, queue)}
                    className="flex items-center gap-2.5 flex-1 text-right min-w-0 cursor-pointer"
                  >
                    {active ? (
                      <AudioWaveBars active={isPlaying} className="text-[#C8A253] shrink-0" />
                    ) : (
                      <span className="w-3.5 text-[11px] font-mono-nums text-[#A9B2AE] text-center shrink-0">
                        {toArabicDigits(item.surahNumber)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className={`text-xs font-medium truncate ${active ? 'text-[#C8A253]' : 'text-[#F5F3EE]'}`}>
                        {item.surahName}
                      </p>
                      <p className="text-[11px] text-[#A9B2AE] truncate">
                        {item.reciterName} · {item.style}
                      </p>
                    </div>
                  </button>
                  {!active && (
                    <button
                      type="button"
                      onClick={() => removeFromQueue(item.id)}
                      aria-label={`إزالة ${item.surahName}`}
                      className="p-1.5 text-[#A9B2AE] hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {/* Expanded Full Spotify-Style Audio Studio Modal */}
      {isExpanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="استوديو المشغل الصوتي المتقدم"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6"
        >
          <div className="w-full md:max-w-3xl max-h-[92vh] overflow-y-auto glass-gold rounded-t-3xl md:rounded-3xl p-5 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                {isPlaying && showWaveform && <AudioWaveBars active className="text-[#C8A253]" />}
                <div className="space-y-1">
                  <p className="text-xs text-[#C8A253]">المشغل الصوتي المتقدم</p>
                  <h2 className="text-xl font-display font-bold text-[#F5F3EE] leading-snug">
                    {currentTrack.surahName}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                aria-label="إغلاق المشغل الموسع"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-[#F5F3EE] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reciter / Preacher Header + Conditional Reciter Switcher */}
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <ReciterImage
                src={currentTrack.reciterPhoto}
                alt={currentTrack.reciterName}
                loading="eager"
                className="w-28 h-28 rounded-2xl object-cover border border-[#C8A253]/35 shadow-xl shrink-0"
              />
              <div className="flex-1 text-center sm:text-right space-y-2.5 w-full">
                <h3 className="text-lg font-semibold text-[#F5F3EE]">{currentTrack.reciterName}</h3>
                <p className="text-xs text-[#A9B2AE]">
                  {currentTrack.riwayah || currentTrack.style}
                  {currentTrack.sourceName ? ` · ${currentTrack.sourceName}` : ''}
                </p>

                {currentTrack.kind !== 'podcast' ? (
                  <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <label htmlFor="player-reciter-select" className="text-xs text-[#A9B2AE]">
                      تبديل القارئ لهذه السورة:
                    </label>
                    <select
                      id="player-reciter-select"
                      value={currentTrack.reciterId}
                      onChange={(e) => {
                        const nextReciter = reciters.find((r) => r.id === e.target.value);
                        if (nextReciter) switchCurrentReciter(nextReciter);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                    >
                      {reciters.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-[#C8A253]">
                    <span>بودكاست بصيرة الصوتي</span>
                    {currentTrack.publishedAt && (
                      <>
                        <span>·</span>
                        <span className="text-[#A9B2AE]">{currentTrack.publishedAt}</span>
                      </>
                    )}
                    {currentTrack.episodeId && (
                      <>
                        <span>·</span>
                        <a
                          href={`#/basira/episodes/${currentTrack.episodeId}`}
                          onClick={() => setIsExpanded(false)}
                          className="underline hover:text-[#F5F3EE]"
                        >
                          صفحة الحلقة والتفاصيل
                        </a>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {audioError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-xs text-rose-200">
                {audioError}
              </div>
            )}

            <ExpandedTimelineScrubber seekTo={seekTo} />

            {/* Spotify Full Transport Row */}
            <div dir="ltr" className="flex items-center justify-center gap-2 sm:gap-4">
              <button
                type="button"
                onClick={toggleShuffle}
                aria-label="التشغيل العشوائي"
                aria-pressed={isShuffle}
                className={`min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl cursor-pointer ${
                  isShuffle ? 'bg-[#C8A253]/20 text-[#C8A253]' : 'bg-white/5 text-[#A9B2AE] hover:text-white'
                }`}
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={playPrev}
                aria-label="السورة السابقة"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-[#F5F3EE] cursor-pointer"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => seekRelative(-10)}
                aria-label="تأخير ١٠ ثوانٍ"
                className="min-w-[42px] min-h-[42px] hidden sm:flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-[#F5F3EE] cursor-pointer"
              >
                <Rewind className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={togglePlayPause}
                aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                className="w-14 h-14 flex items-center justify-center rounded-full bg-[#0E6B4D] hover:bg-[#178A64] text-[#F5F3EE] shadow-xl cursor-pointer"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
              </button>
              <button
                type="button"
                onClick={() => seekRelative(10)}
                aria-label="تقديم ١٠ ثوانٍ"
                className="min-w-[42px] min-h-[42px] hidden sm:flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-[#F5F3EE] cursor-pointer"
              >
                <FastForward className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={playNext}
                aria-label="السورة التالية"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-[#F5F3EE] cursor-pointer"
              >
                <SkipForward className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={cycleRepeat}
                aria-label={repeatLabel}
                className={`min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl cursor-pointer ${
                  repeatMode !== 'off' ? 'bg-[#C8A253]/20 text-[#C8A253]' : 'bg-white/5 text-[#A9B2AE] hover:text-white'
                }`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Volume, Speed, Sleep Timer & A-B Segment Loop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/10">
              {/* Volume & Speed */}
              <div className="space-y-3 bg-[#0A0D0C]/70 rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleMute}
                    aria-label={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[#C8A253] cursor-pointer"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    aria-label="مستوى الصوت"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full accent-[#0E6B4D] cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#A9B2AE]">سرعة التشغيل:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setPlaybackRate(rate)}
                        className={`px-2 py-1 rounded-lg text-xs font-mono-nums cursor-pointer ${
                          playbackRate === rate
                            ? 'bg-[#0E6B4D] text-white'
                            : 'bg-white/5 text-[#A9B2AE] hover:text-white'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Repeat Mode, Sleep Timer & A-B Loop */}
              <div className="space-y-3 bg-[#0A0D0C]/70 rounded-2xl p-4 border border-white/5">
                {enableSleepTimer && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-[#A9B2AE]">
                      <Moon className="w-3.5 h-3.5 text-[#C8A253]" />
                      <span>مؤقت النوم:</span>
                    </div>
                    <select
                      aria-label="اختيار مؤقت النوم"
                      value={sleepTimerOption}
                      onChange={(e) => setSleepTimer(Number(e.target.value) as SleepTimerOption)}
                      className="px-2.5 py-1 rounded-lg bg-[#121715] border border-white/15 text-xs text-[#F5F3EE]"
                    >
                      {SLEEP_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {enableSleepTimer && sleepTimerOption !== 0 && (
                  <p className="text-[11px] text-[#C8A253]">
                    {sleepTimerOption === -1
                      ? 'سيتوقف التشغيل تلقائيًا عند انتهاء السورة الحالية'
                      : `يتبقى ${formatTimeSeconds(sleepRemainingSeconds ?? 0)} على الإيقاف التلقائي`}
                  </p>
                )}

                {enableSegmentLoop && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[#A9B2AE]">تكرار مقطع (أ-ب):</span>
                    <button
                      type="button"
                      onClick={setLoopStart}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-[#F5F3EE] cursor-pointer"
                    >
                      أ{segmentLoop.start !== null ? ` ${formatTimeSeconds(segmentLoop.start)}` : ''}
                    </button>
                    <button
                      type="button"
                      onClick={setLoopEnd}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-[#F5F3EE] cursor-pointer"
                    >
                      ب{segmentLoop.end !== null ? ` ${formatTimeSeconds(segmentLoop.end)}` : ''}
                    </button>
                    {segmentLoop.active && (
                      <button
                        type="button"
                        onClick={clearSegmentLoop}
                        className="px-2.5 py-1 rounded-lg bg-rose-900/50 text-xs text-rose-200 cursor-pointer"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={cycleRepeat}
                    className="text-xs text-[#C8A253] hover:underline cursor-pointer"
                  >
                    وضع التكرار: {repeatLabel}
                  </button>
                  <button
                    type="button"
                    onClick={toggleAutoPlayNext}
                    className="text-xs text-[#A9B2AE] hover:text-white cursor-pointer"
                  >
                    تشغيل متتابع: {autoPlayNext ? 'مفعل' : 'متوقف'}
                  </button>
                </div>
              </div>
            </div>

            {/* Actions: Favorite, Add to Playlist & MP3 Download */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#F5F3EE] cursor-pointer"
                >
                  <Heart className={`w-4 h-4 ${favored ? 'fill-[#C8A253] text-[#C8A253]' : ''}`} />
                  <span>{favored ? 'في المفضلة' : 'إضافة للمفضلة'}</span>
                </button>
                <button
                  type="button"
                  onClick={onAddToPlaylistClick}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#F5F3EE] cursor-pointer"
                >
                  <ListMusic className="w-4 h-4 text-[#C8A253]" />
                  <span>حفظ في قائمة تشغيل</span>
                </button>
                {currentTrack.audioUrl && (
                  <a
                    href={currentTrack.audioUrl}
                    download={`${currentTrack.surahName}-${currentTrack.reciterName}.mp3`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0E6B4D]/30 hover:bg-[#0E6B4D]/50 border border-[#0E6B4D] text-xs text-[#F5F3EE] cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#C8A253]" />
                    <span>{currentTrack.kind === 'podcast' ? 'تنزيل الحلقة (MP3)' : 'تنزيل التلاوة (MP3)'}</span>
                  </a>
                )}
              </div>
              {queue.length > 1 && (
                <button
                  type="button"
                  onClick={clearQueue}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-rose-950/40 text-xs text-[#A9B2AE] hover:text-rose-200 cursor-pointer"
                >
                  تفريغ قائمة الانتظار
                </button>
              )}
            </div>

            {/* Live Interactive Queue Inside Studio */}
            <div className="bg-[#0A0D0C]/80 rounded-2xl p-4 border border-white/10 space-y-2 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-semibold text-[#C8A253]">
                  قائمة التشغيل الحالية ({toArabicDigits(queue.length)})
                </span>
                {upNextTrack && (
                  <span className="text-[11px] text-[#A9B2AE]">
                    التالي: {upNextTrack.surahName}
                  </span>
                )}
              </div>
              {queue.length === 0 ? (
                <p className="text-xs text-[#A9B2AE] text-center py-2">قائمة الانتظار فارغة</p>
              ) : (
                queue.map((item) => {
                  const active = item.id === currentTrack.id;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between gap-3 p-2 rounded-xl ${
                        active ? 'bg-[#0E6B4D]/25 border border-[#0E6B4D]/40' : 'hover:bg-white/5'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => playTrack(item, queue)}
                        className="flex items-center gap-2.5 flex-1 text-right min-w-0 cursor-pointer"
                      >
                        {active && <AudioWaveBars active={isPlaying} className="text-[#C8A253] shrink-0" />}
                        <p className={`text-xs font-medium truncate ${active ? 'text-[#C8A253]' : 'text-[#F5F3EE]'}`}>
                          {item.surahName} — {item.reciterName}
                        </p>
                      </button>
                      {!active && (
                        <button
                          type="button"
                          onClick={() => removeFromQueue(item.id)}
                          aria-label={`إزالة ${item.surahName} من القائمة`}
                          className="p-1.5 text-[#A9B2AE] hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
