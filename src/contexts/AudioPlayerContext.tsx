import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QURAN_META } from '../data/reciters';
import type {
  AudioTrack,
  BasiraEpisode,
  BasiraPlaylist,
  BasiraPreacher,
  Reciter,
  RepeatMode,
  SleepTimerOption,
} from '../types/tilawa';
import {
  episodeToAudioTrack,
  getSavedEpisodePosition,
  saveBasiraEpisodeProgress,
} from '../utils/basiraHelpers';
import {
  buildSurahAudioUrl,
  cycleRepeatMode,
  formatSurahDisplayName,
  getDefaultPlayableSurahNumber,
  getNextSurahNumber,
  isBlockedReciter,
  isSurahAvailableInCollection,
  shuffleTracks,
} from '../utils/quranHelpers';
import {
  loadListenerStats,
  recordListeningTick,
  saveListenerStats,
} from '../utils/certificateHelpers';
import { useAppData } from './AppDataContext';
import { useAuth } from './AuthContext';
import { useDynamicConfig } from './DynamicConfigContext';

interface SegmentLoop {
  start: number | null;
  end: number | null;
  active: boolean;
}

interface PlayCollectionOptions {
  shuffle?: boolean;
  startTrackId?: string;
}

interface AudioProgressContextValue {
  currentTime: number;
  duration: number;
}

interface AudioPlayerContextValue {
  currentTrack: AudioTrack | null;
  queue: AudioTrack[];
  isPlaying: boolean;
  isBuffering: boolean;
  audioError: string | null;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  repeatMode: RepeatMode;
  repeatSurah: boolean;
  isShuffle: boolean;
  autoPlayNext: boolean;
  segmentLoop: SegmentLoop;
  sleepTimerOption: SleepTimerOption;
  sleepRemainingSeconds: number | null;
  isExpanded: boolean;
  setIsExpanded: (open: boolean) => void;
  playTrack: (track: AudioTrack, newQueue?: AudioTrack[], resumeSeconds?: number) => void;
  playCollection: (tracks: AudioTrack[], options?: PlayCollectionOptions) => void;
  playSurahByReciter: (reciter: Reciter, surahNumber: number, preferredStyle?: string, resumeSeconds?: number) => void;
  playBasiraEpisode: (
    episode: BasiraEpisode,
    preacher: BasiraPreacher | undefined,
    allPreachers: BasiraPreacher[],
    queueEpisodes?: BasiraEpisode[],
    options?: { resume?: boolean; startSeconds?: number }
  ) => void;
  playBasiraPlaylist: (
    playlist: BasiraPlaylist,
    allEpisodes: BasiraEpisode[],
    allPreachers: BasiraPreacher[],
    shuffle?: boolean
  ) => void;
  togglePlayPause: () => void;
  seekTo: (seconds: number) => void;
  seekRelative: (delta: number) => void;
  playNext: () => void;
  playPrev: () => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  cycleRepeat: () => void;
  toggleRepeatSurah: () => void;
  toggleShuffle: () => void;
  toggleAutoPlayNext: () => void;
  setSleepTimer: (option: SleepTimerOption) => void;
  setLoopStart: () => void;
  setLoopEnd: () => void;
  clearSegmentLoop: () => void;
  addToQueue: (track: AudioTrack) => void;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  switchCurrentReciter: (reciter: Reciter, style?: string) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);
const AudioProgressContext = createContext<AudioProgressContextValue>({
  currentTime: 0,
  duration: 0,
});

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { reciters, notify } = useAppData();
  const { prefs, recordListeningProgress, savePreferences } = useAuth();
  const { config } = useDynamicConfig();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSavedTimeRef = useRef<number>(0);
  const baseQueueRef = useRef<AudioTrack[]>([]);
  const pendingResumeCleanupRef = useRef<(() => void) | null>(null);
  const userTouchedAudioPrefsRef = useRef<{ volume: boolean; rate: boolean; autoNext: boolean }>({
    volume: false,
    rate: false,
    autoNext: false,
  });

  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [queue, setQueue] = useState<AudioTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(config.audioPlayer?.defaultVolume ?? 0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(
    prefs.playbackRate || config.audioPlayer?.defaultPlaybackRate || 1
  );
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [isShuffle, setIsShuffle] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(config.audioPlayer?.autoPlayNext ?? true);
  const [segmentLoop, setSegmentLoop] = useState<SegmentLoop>({
    start: null,
    end: null,
    active: false,
  });
  const [sleepTimerOption, setSleepTimerOption] = useState<SleepTimerOption>(0);
  const [sleepRemainingSeconds, setSleepRemainingSeconds] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const playNextRef = useRef<() => void>(() => {});
  const playPrevRef = useRef<() => void>(() => {});
  const togglePlayPauseRef = useRef<() => void>(() => {});
  const seekRelativeRef = useRef<(d: number) => void>(() => {});
  const toggleMuteRef = useRef<() => void>(() => {});

  // Apply dynamic admin player defaults if visitor has not overridden them in session
  useEffect(() => {
    const ply = config.audioPlayer;
    if (!ply) return;
    if (!userTouchedAudioPrefsRef.current.volume) {
      setVolumeState(ply.defaultVolume);
      if (audioRef.current && !isMuted) {
        audioRef.current.volume = ply.defaultVolume;
      }
    }
    if (!userTouchedAudioPrefsRef.current.rate) {
      setPlaybackRateState(ply.defaultPlaybackRate);
      if (audioRef.current) {
        audioRef.current.playbackRate = ply.defaultPlaybackRate;
      }
    }
    if (!userTouchedAudioPrefsRef.current.autoNext) {
      setAutoPlayNext(ply.autoPlayNext);
    }
  }, [config.audioPlayer, isMuted]);

  // Mount persistent HTMLAudioElement once
  useEffect(() => {
    const el = new Audio();
    el.preload = 'metadata';
    el.volume = config.audioPlayer?.defaultVolume ?? 0.9;
    audioRef.current = el;

    return () => {
      el.pause();
      el.src = '';
    };
  }, []);

  // Sleep Timer countdown interval
  useEffect(() => {
    if (sleepTimerOption <= 0 || sleepRemainingSeconds === null) return;
    if (sleepRemainingSeconds <= 0) {
      audioRef.current?.pause();
      setIsPlaying(false);
      setSleepTimerOption(0);
      setSleepRemainingSeconds(null);
      notify('تم إيقاف التلاوة تلقائيًا — انتهى مؤقت النوم', 'info');
      return;
    }
    const timer = window.setInterval(() => {
      setSleepRemainingSeconds((prev) => {
        if (prev === null) return null;
        return Math.max(0, prev - 1);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sleepTimerOption, sleepRemainingSeconds, notify]);

  // Track real continuous Quran listening time for appreciation certificates
  useEffect(() => {
    if (!isPlaying || !currentTrack) return;
    const surahKey = `${currentTrack.reciterId}_${currentTrack.surahNumber}`;
    const todayIso = new Date().toISOString().slice(0, 10);
    // Record surah start cleanly on playback begin
    saveListenerStats(recordListeningTick(loadListenerStats(), 0, todayIso, surahKey));

    const tracker = window.setInterval(() => {
      const el = audioRef.current;
      if (!el || el.paused) return;
      const dayNow = new Date().toISOString().slice(0, 10);
      saveListenerStats(recordListeningTick(loadListenerStats(), 5, dayNow, surahKey));
    }, 5000);
    return () => window.clearInterval(tracker);
  }, [isPlaying, currentTrack]);

  // Sync audio element listeners
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onPlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
      setAudioError(null);
    };
    const onPause = () => {
      setIsPlaying(false);
      setIsBuffering(false);
    };
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onLoadedMeta = () => {
      setIsBuffering(false);
      setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    };
    const onTimeUpdate = () => {
      const t = el.currentTime;
      setCurrentTime(t);

      // Handle A-B segment loop
      if (
        segmentLoop.active &&
        segmentLoop.start !== null &&
        segmentLoop.end !== null &&
        segmentLoop.end > segmentLoop.start &&
        t >= segmentLoop.end
      ) {
        el.currentTime = segmentLoop.start;
        return;
      }

      // Periodically save listening progress every 5s for podcasts or 10s for recitations
      const saveInterval = currentTrack?.kind === 'podcast' ? 5 : 10;
      if (currentTrack && Math.abs(t - lastSavedTimeRef.current) >= saveInterval) {
        lastSavedTimeRef.current = t;
        const dur = Number.isFinite(el.duration) ? Math.floor(el.duration) : currentTrack.durationSeconds || 0;
        if (currentTrack.kind === 'podcast' && currentTrack.episodeId) {
          saveBasiraEpisodeProgress(currentTrack.episodeId, t, dur);
        } else {
          void recordListeningProgress({
            id: `${currentTrack.reciterId}_${currentTrack.surahNumber}`,
            reciterId: currentTrack.reciterId,
            reciterName: currentTrack.reciterName,
            surahNumber: currentTrack.surahNumber,
            surahName: currentTrack.surahName,
            style: currentTrack.style,
            audioUrl: currentTrack.audioUrl,
            progressSeconds: Math.floor(t),
            durationSeconds: dur,
          });
        }
      }
    };
    const onEnded = () => {
      if (sleepTimerOption === -1) {
        setIsPlaying(false);
        setSleepTimerOption(0);
        setSleepRemainingSeconds(null);
        notify('تم الإيقاف بنهاية السورة كما ضبطت مؤقت النوم', 'info');
        return;
      }
      if (repeatMode === 'one') {
        el.currentTime = 0;
        void el.play().catch((err) => {
          console.warn('Repeat playback interrupted:', err);
          setIsPlaying(false);
        });
      } else if (autoPlayNext) {
        playNextRef.current();
      } else {
        setIsPlaying(false);
      }
    };
    const onError = () => {
      setIsPlaying(false);
      setIsBuffering(false);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setAudioError('أنت في وضع عدم الاتصال — المصحف الشريف متاح كاملًا، بينما يتطلب بث التلاوات إنترنت.');
      } else {
        setAudioError('تعذر تشغيل هذا التسجيل الصوتي حاليًا. قد يكون الخادم مشغولًا أو التسجيل غير متاح.');
      }
    };

    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('loadedmetadata', onLoadedMeta);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);

    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('loadedmetadata', onLoadedMeta);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
    };
  }, [autoPlayNext, currentTrack, notify, recordListeningProgress, repeatMode, segmentLoop, sleepTimerOption]);

  const playTrack = useCallback(
    (track: AudioTrack, newQueue?: AudioTrack[], resumeSeconds = 0) => {
      const disabledIds = config.security?.disabledReciterIds || [];
      if (
        isBlockedReciter({ id: track.reciterId, nameAr: track.reciterName }) ||
        disabledIds.includes(track.reciterId)
      ) {
        return;
      }
      if (!track.isAvailable || !track.audioUrl) {
        const msg =
          track.unavailableReason ||
          `التسجيل الصوتي لـ ${track.surahName} غير متاح حاليًا في هذا الإصدار.`;
        setAudioError(msg);
        notify(msg, 'error');
        return;
      }
      const el = audioRef.current;
      if (!el) return;

      setAudioError(null);
      setIsBuffering(true);
      setSegmentLoop({ start: null, end: null, active: false });
      setCurrentTrack(track);

      if (newQueue && newQueue.length > 0) {
        baseQueueRef.current = newQueue;
        setQueue(newQueue);
      } else {
        setQueue((prev) => {
          const next = prev.some((t) => t.id === track.id) ? prev : [track, ...prev];
          baseQueueRef.current = next;
          return next;
        });
      }

      if (pendingResumeCleanupRef.current) {
        pendingResumeCleanupRef.current();
        pendingResumeCleanupRef.current = null;
      }

      el.src = track.audioUrl;
      el.playbackRate = playbackRate;
      el.volume = isMuted ? 0 : volume;
      setCurrentTime(resumeSeconds);
      lastSavedTimeRef.current = resumeSeconds;

      const handleStart = () => {
        if (resumeSeconds > 0 && Number.isFinite(el.duration) && resumeSeconds < el.duration) {
          el.currentTime = resumeSeconds;
        }
        el.removeEventListener('loadedmetadata', handleStart);
        pendingResumeCleanupRef.current = null;
      };
      if (resumeSeconds > 0) {
        el.addEventListener('loadedmetadata', handleStart);
        pendingResumeCleanupRef.current = () => el.removeEventListener('loadedmetadata', handleStart);
      }

      void el.play().catch((err) => {
        console.warn('Playback start deferred or blocked:', err);
        setIsPlaying(false);
      });

      void fetch('/api/public/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'play',
          reciterId: track.reciterId,
          reciterName: track.reciterName,
          surahNumber: track.surahNumber,
          surahName: track.surahName,
        }),
      }).catch(() => {});

      if (track.kind === 'podcast' && track.episodeId) {
        saveBasiraEpisodeProgress(
          track.episodeId,
          resumeSeconds,
          track.durationSeconds || 0
        );
      } else {
        void recordListeningProgress({
          id: `${track.reciterId}_${track.surahNumber}`,
          reciterId: track.reciterId,
          reciterName: track.reciterName,
          surahNumber: track.surahNumber,
          surahName: track.surahName,
          style: track.style,
          audioUrl: track.audioUrl,
          progressSeconds: Math.floor(resumeSeconds),
          durationSeconds: 0,
        });
      }
    },
    [config.security?.disabledReciterIds, isMuted, notify, playbackRate, recordListeningProgress, volume]
  );

  const playCollection = useCallback(
    (tracks: AudioTrack[], options?: PlayCollectionOptions) => {
      const playable = tracks.filter((t) => t.isAvailable && Boolean(t.audioUrl));
      if (playable.length === 0) {
        notify('لا توجد تسجيلات صالحة للتشغيل في هذه القائمة', 'error');
        return;
      }
      baseQueueRef.current = playable;
      const shouldShuffle = Boolean(options?.shuffle);
      setIsShuffle(shouldShuffle);

      const finalQueue = shouldShuffle
        ? shuffleTracks(playable, options?.startTrackId)
        : playable;
      const first = options?.startTrackId
        ? finalQueue.find((t) => t.id === options.startTrackId) || finalQueue[0]
        : finalQueue[0];

      playTrack(first, finalQueue, 0);
      notify(
        shouldShuffle ? 'بدء التشغيل العشوائي للقائمة' : 'بدء تشغيل السلسلة المتتابعة',
        'success'
      );
    },
    [notify, playTrack]
  );

  const playSurahByReciter = useCallback(
    (reciter: Reciter, surahNumber: number, preferredStyle?: string, resumeSeconds = 0) => {
      const disabledIds = config.security?.disabledReciterIds || [];
      if (isBlockedReciter(reciter) || disabledIds.includes(reciter.id)) return;
      const surah = QURAN_META.surahs.find((s) => s.number === surahNumber);
      if (!surah) return;

      const preferredMatch = preferredStyle
        ? reciter.collections.find(
            (c) => c.style === preferredStyle && isSurahAvailableInCollection(c, surahNumber)
          )
        : undefined;
      const anyAvailable = reciter.collections.find((c) =>
        isSurahAvailableInCollection(c, surahNumber)
      );
      const collection =
        preferredMatch ||
        anyAvailable ||
        (preferredStyle && reciter.collections.find((c) => c.style === preferredStyle)) ||
        reciter.collections[0];

      if (!collection) {
        notify(`لا تتوفر تسجيلات صوتية مضافة حاليًا للشيخ ${reciter.nameAr}`, 'error');
        return;
      }

      const available = isSurahAvailableInCollection(collection, surahNumber);
      const cleanSurahName = formatSurahDisplayName(surah.name);
      const track: AudioTrack = {
        id: `${reciter.id}_${collection.id}_${surahNumber}`,
        reciterId: reciter.id,
        reciterName: reciter.nameAr,
        reciterPhoto: reciter.photoUrl,
        surahNumber,
        surahName: cleanSurahName,
        style: collection.style,
        riwayah: collection.riwayah,
        audioUrl: available ? buildSurahAudioUrl(collection.server, surahNumber, collection.surahUrls) : '',
        isAvailable: available,
        unavailableReason: available
          ? undefined
          : `تسجيل ${cleanSurahName} غير متاح في مجموعة (${collection.riwayah})`,
        sourceName: collection.sourceName,
      };

      playTrack(track, undefined, resumeSeconds);
    },
    [config.security?.disabledReciterIds, notify, playTrack]
  );

  const playBasiraEpisode = useCallback(
    (
      episode: BasiraEpisode,
      preacher: BasiraPreacher | undefined,
      allPreachers: BasiraPreacher[],
      queueEpisodes?: BasiraEpisode[],
      options?: { resume?: boolean; startSeconds?: number }
    ) => {
      const preacherMap = new Map(allPreachers.map((p) => [p.id, p]));
      const list = queueEpisodes && queueEpisodes.length > 0 ? queueEpisodes : [episode];
      const tracks = list.map((ep, idx) =>
        episodeToAudioTrack(ep, preacherMap.get(ep.preacherId) || preacher, idx + 1)
      );
      const targetTrack =
        tracks.find((t) => t.episodeId === episode.id) ||
        episodeToAudioTrack(episode, preacher, 1);

      const resumeSec =
        typeof options?.startSeconds === 'number'
          ? options.startSeconds
          : options?.resume !== false
          ? getSavedEpisodePosition(episode.id)
          : 0;

      playTrack(targetTrack, tracks, resumeSec);
    },
    [playTrack]
  );

  const playBasiraPlaylist = useCallback(
    (
      playlist: BasiraPlaylist,
      allEpisodes: BasiraEpisode[],
      allPreachers: BasiraPreacher[],
      shuffle = false
    ) => {
      const epMap = new Map(allEpisodes.map((e) => [e.id, e]));
      const preacherMap = new Map(allPreachers.map((p) => [p.id, p]));
      const tracks = playlist.episodeIds
        .map((id) => epMap.get(id))
        .filter((e): e is BasiraEpisode => Boolean(e && e.audioUrl && e.published !== false))
        .map((ep, idx) => episodeToAudioTrack(ep, preacherMap.get(ep.preacherId), idx + 1));

      if (tracks.length === 0) {
        notify('لا توجد حلقات صوتية متاحة في هذه القائمة حاليًا', 'error');
        return;
      }
      playCollection(tracks, { shuffle });
    },
    [notify, playCollection]
  );

  const togglePlayPause = useCallback(() => {
    const el = audioRef.current;
    if (!el || !currentTrack) return;
    if (el.paused) {
      void el.play().catch(() => {
        setAudioError('اضغط تشغيل مرة أخرى لبدء الصوت');
      });
    } else {
      el.pause();
    }
  }, [currentTrack]);

  const seekTo = useCallback((seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    const bounded = Math.max(0, Math.min(seconds, el.duration || seconds));
    el.currentTime = bounded;
    setCurrentTime(bounded);
  }, []);

  const seekRelative = useCallback((delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(el.currentTime + delta, el.duration || el.currentTime + delta));
    el.currentTime = target;
    setCurrentTime(target);
  }, []);

  const stepTrack = useCallback(
    (direction: 'next' | 'prev') => {
      if (!currentTrack) return;
      if (queue.length > 1) {
        const idx = queue.findIndex((t) => t.id === currentTrack.id);
        if (idx !== -1) {
          if (direction === 'next' && idx === queue.length - 1 && repeatMode === 'off') {
            setIsPlaying(false);
            return;
          }
          const targetIdx =
            direction === 'next' ? (idx + 1) % queue.length : (idx - 1 + queue.length) % queue.length;
          playTrack(queue[targetIdx], queue);
          return;
        }
      }
      const reciter = reciters.find((r) => r.id === currentTrack.reciterId);
      if (reciter) {
        let candidate = currentTrack.surahNumber;
        for (let step = 0; step < 114; step++) {
          candidate = getNextSurahNumber(candidate, direction);
          if (
            reciter.collections.some((c) => isSurahAvailableInCollection(c, candidate))
          ) {
            playSurahByReciter(reciter, candidate, currentTrack.style);
            return;
          }
        }
        const fallbackNext = getNextSurahNumber(currentTrack.surahNumber, direction);
        playSurahByReciter(reciter, fallbackNext, currentTrack.style);
      }
    },
    [currentTrack, playSurahByReciter, playTrack, queue, reciters, repeatMode]
  );

  const playNext = useCallback(() => stepTrack('next'), [stepTrack]);
  const playPrev = useCallback(() => stepTrack('prev'), [stepTrack]);

  const setVolume = useCallback((vol: number) => {
    userTouchedAudioPrefsRef.current.volume = true;
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    setIsMuted(clamped === 0);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        audioRef.current.volume = next ? 0 : volume;
      }
      return next;
    });
  }, [volume]);

  useEffect(() => {
    playNextRef.current = playNext;
    playPrevRef.current = playPrev;
    togglePlayPauseRef.current = togglePlayPause;
    seekRelativeRef.current = seekRelative;
    toggleMuteRef.current = toggleMute;
  }, [playNext, playPrev, togglePlayPause, seekRelative, toggleMute]);

  // Browser MediaSession integration (Spotify-style OS/Lock-screen controls)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (!currentTrack) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.surahName,
        artist: currentTrack.reciterName,
        album: `TILAWA | تلاوة · ${currentTrack.style}`,
        artwork: currentTrack.reciterPhoto
          ? [{ src: currentTrack.reciterPhoto, sizes: '512x512', type: 'image/jpeg' }]
          : [],
      });
      navigator.mediaSession.setActionHandler('play', () => togglePlayPauseRef.current());
      navigator.mediaSession.setActionHandler('pause', () => togglePlayPauseRef.current());
      navigator.mediaSession.setActionHandler('previoustrack', () => playPrevRef.current());
      navigator.mediaSession.setActionHandler('nexttrack', () => playNextRef.current());
      navigator.mediaSession.setActionHandler('seekbackward', () => seekRelativeRef.current(-10));
      navigator.mediaSession.setActionHandler('seekforward', () => seekRelativeRef.current(10));
    } catch {
      // Ignore unsupported mediaSession actions
    }
  }, [currentTrack]);

  // Global Spotify-style Keyboard Shortcuts (when a track is loaded and focus isn't inside form inputs)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!currentTrack) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPauseRef.current();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMuteRef.current();
      } else if (e.key === 'ArrowRight' && e.altKey) {
        seekRelativeRef.current(-10);
      } else if (e.key === 'ArrowLeft' && e.altKey) {
        seekRelativeRef.current(10);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentTrack]);

  const setPlaybackRate = useCallback(
    (rate: number) => {
      userTouchedAudioPrefsRef.current.rate = true;
      const clamped = Math.max(0.5, Math.min(2.0, rate));
      setPlaybackRateState(clamped);
      if (audioRef.current) {
        audioRef.current.playbackRate = clamped;
      }
      void savePreferences({ playbackRate: clamped });
    },
    [savePreferences]
  );

  const cycleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      const next = cycleRepeatMode(prev);
      const label =
        next === 'one'
          ? 'تكرار السورة الحالية'
          : next === 'all'
          ? 'تكرار قائمة التشغيل'
          : 'إيقاف التكرار';
      notify(label, 'info');
      return next;
    });
  }, [notify]);

  const toggleRepeatSurah = useCallback(() => {
    setRepeatMode((prev) => (prev === 'one' ? 'all' : 'one'));
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const next = !prev;
      if (next) {
        setQueue((q) => {
          const source = q.length > 0 ? q : baseQueueRef.current;
          return shuffleTracks(source, currentTrack?.id);
        });
        notify('تم تفعيل التشغيل العشوائي', 'info');
      } else {
        if (baseQueueRef.current.length > 0) {
          setQueue(baseQueueRef.current);
        }
        notify('تم إيقاف التشغيل العشوائي', 'info');
      }
      return next;
    });
  }, [currentTrack?.id, notify]);

  const toggleAutoPlayNext = useCallback(() => {
    userTouchedAudioPrefsRef.current.autoNext = true;
    setAutoPlayNext((p) => !p);
  }, []);

  const setSleepTimer = useCallback(
    (option: SleepTimerOption) => {
      setSleepTimerOption(option);
      if (option === 0) {
        setSleepRemainingSeconds(null);
        notify('تم إلغاء مؤقت النوم', 'info');
      } else if (option === -1) {
        setSleepRemainingSeconds(null);
        notify('سيتوقف التشغيل بنهاية السورة الحالية', 'success');
      } else {
        setSleepRemainingSeconds(option * 60);
        notify(`تم ضبط مؤقت النوم على ${option} دقيقة`, 'success');
      }
    },
    [notify]
  );

  const setLoopStart = useCallback(() => {
    const now = audioRef.current?.currentTime ?? 0;
    setSegmentLoop((prev) => ({
      start: Math.floor(now),
      end: prev.end !== null && prev.end > now ? prev.end : null,
      active: prev.end !== null && prev.end > now,
    }));
    notify('تم تحديد نقطة بداية إعادة المقطع (أ)', 'info');
  }, [notify]);

  const setLoopEnd = useCallback(() => {
    const now = audioRef.current?.currentTime ?? 0;
    if (segmentLoop.start === null) {
      const start = Math.max(0, Math.floor(now) - 10);
      setSegmentLoop({ start, end: Math.floor(now), active: true });
      notify('تم تفعيل إعادة المقطع للثواني العشر الأخيرة', 'success');
      return;
    }
    if (now <= segmentLoop.start + 1) {
      notify('يجب أن تكون نقطة النهاية بعد نقطة البداية', 'error');
      return;
    }
    setSegmentLoop({
      start: segmentLoop.start,
      end: Math.floor(now),
      active: true,
    });
    notify('تم تفعيل إعادة المقطع (أ - ب)', 'success');
  }, [notify, segmentLoop.start]);

  const clearSegmentLoop = useCallback(() => {
    setSegmentLoop({ start: null, end: null, active: false });
    notify('تم إيقاف إعادة المقطع', 'info');
  }, [notify]);

  const addToQueue = useCallback(
    (track: AudioTrack) => {
      if (!track.isAvailable) {
        notify(track.unavailableReason || 'هذا التسجيل غير متاح للإضافة', 'error');
        return;
      }
      setQueue((prev) => {
        if (prev.some((t) => t.id === track.id)) return prev;
        const next = [...prev, track];
        baseQueueRef.current = next;
        return next;
      });
      notify(`أُضيفت ${track.surahName} إلى قائمة الانتظار`, 'success');
    },
    [notify]
  );

  const removeFromQueue = useCallback((trackId: string) => {
    setQueue((prev) => {
      const next = prev.filter((t) => t.id !== trackId);
      baseQueueRef.current = next;
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue((prev) => {
      const next = currentTrack ? prev.filter((t) => t.id === currentTrack.id) : [];
      baseQueueRef.current = next;
      return next;
    });
    notify('تم إفراغ قائمة الانتظار', 'info');
  }, [currentTrack, notify]);

  const switchCurrentReciter = useCallback(
    (reciter: Reciter, style?: string) => {
      const targetSurah = currentTrack?.surahNumber || 1;
      const hasSurah = reciter.collections.some((c) =>
        isSurahAvailableInCollection(c, targetSurah)
      );
      if (hasSurah) {
        playSurahByReciter(reciter, targetSurah, style);
      } else {
        const fallbackSurah = getDefaultPlayableSurahNumber(reciter);
        const fallbackMeta = QURAN_META.surahs.find((s) => s.number === fallbackSurah);
        const fallbackName = fallbackMeta ? formatSurahDisplayName(fallbackMeta.name) : 'السورة المتاحة';
        notify(
          `هذه السورة غير مدرجة في أرشيف ${reciter.nameAr} — تم تشغيل ${fallbackName}`,
          'info'
        );
        playSurahByReciter(reciter, fallbackSurah, style);
      }
    },
    [currentTrack, notify, playSurahByReciter]
  );

  const progressValue = useMemo(
    () => ({ currentTime, duration }),
    [currentTime, duration]
  );

  const value = useMemo(
    () => ({
      currentTrack,
      queue,
      isPlaying,
      isBuffering,
      audioError,
      volume,
      isMuted,
      playbackRate,
      repeatMode,
      repeatSurah: repeatMode === 'one',
      isShuffle,
      autoPlayNext,
      segmentLoop,
      sleepTimerOption,
      sleepRemainingSeconds,
      isExpanded,
      setIsExpanded,
      playTrack,
      playCollection,
      playSurahByReciter,
      playBasiraEpisode,
      playBasiraPlaylist,
      togglePlayPause,
      seekTo,
      seekRelative,
      playNext,
      playPrev,
      setVolume,
      toggleMute,
      setPlaybackRate,
      cycleRepeat,
      toggleRepeatSurah,
      toggleShuffle,
      toggleAutoPlayNext,
      setSleepTimer,
      setLoopStart,
      setLoopEnd,
      clearSegmentLoop,
      addToQueue,
      removeFromQueue,
      clearQueue,
      switchCurrentReciter,
    }),
    [
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
      playTrack,
      playCollection,
      playSurahByReciter,
      playBasiraEpisode,
      playBasiraPlaylist,
      togglePlayPause,
      seekTo,
      seekRelative,
      playNext,
      playPrev,
      setVolume,
      toggleMute,
      setPlaybackRate,
      cycleRepeat,
      toggleRepeatSurah,
      toggleShuffle,
      toggleAutoPlayNext,
      setSleepTimer,
      setLoopStart,
      setLoopEnd,
      clearSegmentLoop,
      addToQueue,
      removeFromQueue,
      clearQueue,
      switchCurrentReciter,
    ]
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      <AudioProgressContext.Provider value={progressValue}>
        {children}
      </AudioProgressContext.Provider>
    </AudioPlayerContext.Provider>
  );
};

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayer must be used inside AudioPlayerProvider');
  return ctx;
}

export function useAudioProgress() {
  return useContext(AudioProgressContext);
}
