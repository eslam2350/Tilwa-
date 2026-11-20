import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  GraduationCap,
  HelpCircle,
  Minus,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Sparkles,
  Square,
  Volume2,
  XCircle,
} from 'lucide-react';
import { useAppData } from '../contexts/AppDataContext';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAuth } from '../contexts/AuthContext';
import { QURAN_META } from '../data/reciters';
import { fetchSurahUthmani } from '../services/quranApi';
import type { AppRoute, AyahItem } from '../types/tilawa';
import {
  clampFontSize,
  formatSurahDisplayName,
  stripLeadingBismillah,
  toArabicDigits,
} from '../utils/quranHelpers';
import {
  buildEveryAyahUrl,
  buildTahfeezQuiz,
  calculateTahfeezStats,
  clampAyahRange,
  computeEchoDelayMs,
  maskAyahWords,
  TEACHER_RECITERS,
  type EchoPauseMode,
  type TahfeezProgressMap,
  type VisualMaskMode,
} from '../utils/tahfeezHelpers';

interface TahfeezPageProps {
  initialSurah?: number;
  initialStartAyah?: number;
  initialEndAyah?: number;
  navigate: (next: AppRoute) => void;
}

const PROGRESS_STORAGE_KEY = 'tilawa_tahfeez_progress_v1';
const SETTINGS_STORAGE_KEY = 'tilawa_tahfeez_settings_v1';

interface SavedSettings {
  surahNumber?: number;
  startAyah?: number;
  endAyah?: number;
  teacherId?: string;
  ayahRepeat?: number;
  rangeRepeat?: number;
  echoPause?: EchoPauseMode;
  playbackRate?: number;
}

function loadSavedProgress(): TahfeezProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as TahfeezProgressMap) : {};
  } catch {
    return {};
  }
}

function loadSavedSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SavedSettings) : {};
  } catch {
    return {};
  }
}

export const TahfeezPage: React.FC<TahfeezPageProps> = ({
  initialSurah,
  initialStartAyah,
  initialEndAyah,
  navigate,
}) => {
  const { notify } = useAppData();
  const { isPlaying: isGlobalPlaying, togglePlayPause: toggleGlobalPlayPause, currentTrack } =
    useAudioPlayer();
  const { prefs, savePreferences } = useAuth();

  const savedSettings = useMemo(() => loadSavedSettings(), []);
  const startSurah = initialSurah || savedSettings.surahNumber || 1;
  const startSurahMeta =
    QURAN_META.surahs.find((s) => s.number === startSurah) || QURAN_META.surahs[0];

  const [surahNum, setSurahNum] = useState<number>(startSurahMeta.number);
  const [range, setRange] = useState<{ start: number; end: number }>(() => {
    const defaultEnd = Math.min(5, startSurahMeta.numberOfAyahs);
    return clampAyahRange(
      initialStartAyah || (!initialSurah && savedSettings.startAyah) || 1,
      initialEndAyah ||
        (!initialSurah && savedSettings.endAyah) ||
        (startSurahMeta.number === 1 ? startSurahMeta.numberOfAyahs : defaultEnd),
      startSurahMeta.numberOfAyahs
    );
  });

  const [teacherId, setTeacherId] = useState<string>(
    savedSettings.teacherId && TEACHER_RECITERS.some((t) => t.id === savedSettings.teacherId)
      ? savedSettings.teacherId
      : TEACHER_RECITERS[0].id
  );
  const [ayahRepeat, setAyahRepeat] = useState<number>(savedSettings.ayahRepeat || 3);
  const [rangeRepeat, setRangeRepeat] = useState<number>(savedSettings.rangeRepeat || 2);
  const [echoPause, setEchoPause] = useState<EchoPauseMode>(savedSettings.echoPause || 'auto');
  const [playbackRate, setPlaybackRate] = useState<number>(savedSettings.playbackRate || 1);
  const [visualMode, setVisualMode] = useState<VisualMaskMode>('full');
  const [fontSize, setFontSize] = useState<number>(prefs.fontSize || 28);
  const [workspaceTab, setWorkspaceTab] = useState<'learn' | 'quiz'>('learn');

  const [surahAyahs, setSurahAyahs] = useState<AyahItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Memorization progress persisted locally
  const [progress, setProgress] = useState<TahfeezProgressMap>(() => loadSavedProgress());

  // Reveal states for interactive active recall
  const [revealedAyahs, setRevealedAyahs] = useState<Record<number, boolean>>({});
  const [revealedWords, setRevealedWords] = useState<Record<string, boolean>>({});

  // Teacher Audio Engine state
  const teacherAudioRef = useRef<HTMLAudioElement | null>(null);
  const echoTimerRef = useRef<number | null>(null);
  const echoCountdownIntervalRef = useRef<number | null>(null);

  const [isTeacherPlaying, setIsTeacherPlaying] = useState(false);
  const [isEchoWaiting, setIsEchoWaiting] = useState(false);
  const [echoRemainingSec, setEchoRemainingSec] = useState(0);
  const [activeAyahInSurah, setActiveAyahInSurah] = useState<number | null>(null);
  const [currentAyahPass, setCurrentAyahPass] = useState(1);
  const [currentRangePass, setCurrentRangePass] = useState(1);
  const [teacherAudioError, setTeacherAudioError] = useState<string | null>(null);

  // Interactive Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});

  // Refs synced for audio event callbacks without stale closures
  const engineStateRef = useRef({
    active: false,
    surahNum,
    range,
    teacherId,
    ayahRepeat,
    rangeRepeat,
    echoPause,
    playbackRate,
    activeAyah: range.start,
    ayahPass: 1,
    rangePass: 1,
    ayahs: [] as AyahItem[],
  });

  const activeSurahMeta = useMemo(
    () => QURAN_META.surahs.find((s) => s.number === surahNum) || QURAN_META.surahs[0],
    [surahNum]
  );

  const activeTeacher = useMemo(
    () => TEACHER_RECITERS.find((t) => t.id === teacherId) || TEACHER_RECITERS[0],
    [teacherId]
  );

  useEffect(() => {
    engineStateRef.current.surahNum = surahNum;
    engineStateRef.current.range = range;
    engineStateRef.current.teacherId = teacherId;
    engineStateRef.current.ayahRepeat = ayahRepeat;
    engineStateRef.current.rangeRepeat = rangeRepeat;
    engineStateRef.current.echoPause = echoPause;
    engineStateRef.current.playbackRate = playbackRate;
    engineStateRef.current.ayahs = surahAyahs;
  }, [surahNum, range, teacherId, ayahRepeat, rangeRepeat, echoPause, playbackRate, surahAyahs]);

  // Persist user preferences cleanly
  useEffect(() => {
    try {
      const payload: SavedSettings = {
        surahNumber: surahNum,
        startAyah: range.start,
        endAyah: range.end,
        teacherId,
        ayahRepeat,
        rangeRepeat,
        echoPause,
        playbackRate,
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota errors
    }
  }, [surahNum, range, teacherId, ayahRepeat, rangeRepeat, echoPause, playbackRate]);

  useEffect(() => {
    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // ignore
    }
  }, [progress]);

  // Update playback rate dynamically on active audio element
  useEffect(() => {
    if (teacherAudioRef.current) {
      teacherAudioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Sync if user navigated directly with initialSurah
  useEffect(() => {
    if (initialSurah) {
      const meta = QURAN_META.surahs.find((s) => s.number === initialSurah);
      if (meta) {
        setSurahNum(meta.number);
        const clamped = clampAyahRange(
          initialStartAyah || 1,
          initialEndAyah || Math.min(7, meta.numberOfAyahs),
          meta.numberOfAyahs
        );
        setRange(clamped);
      }
    }
  }, [initialSurah, initialStartAyah, initialEndAyah]);

  // Load Uthmani ayahs (works 100% offline from bundled index)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setRevealedAyahs({});
    setRevealedWords({});
    setQuizIndex(0);
    setQuizAnswers({});

    fetchSurahUthmani(surahNum)
      .then((data) => {
        if (!cancelled) {
          setSurahAyahs(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'تعذر تحميل آيات السورة');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [surahNum]);

  const clearEchoTimers = useCallback(() => {
    if (echoTimerRef.current !== null) {
      window.clearTimeout(echoTimerRef.current);
      echoTimerRef.current = null;
    }
    if (echoCountdownIntervalRef.current !== null) {
      window.clearInterval(echoCountdownIntervalRef.current);
      echoCountdownIntervalRef.current = null;
    }
    setIsEchoWaiting(false);
    setEchoRemainingSec(0);
  }, []);

  const stopTeacherEngine = useCallback(() => {
    engineStateRef.current.active = false;
    clearEchoTimers();
    if (teacherAudioRef.current) {
      teacherAudioRef.current.pause();
      teacherAudioRef.current.removeAttribute('src');
    }
    setIsTeacherPlaying(false);
  }, [clearEchoTimers]);

  // Cleanup audio & timers when leaving TahfeezPage
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    teacherAudioRef.current = audio;

    return () => {
      engineStateRef.current.active = false;
      clearEchoTimers();
      audio.pause();
      audio.src = '';
    };
  }, [clearEchoTimers]);

  const startSpecificAyahPass = useCallback(
    (ayahNum: number, ayahPass: number, rangePass: number) => {
      const audio = teacherAudioRef.current;
      const st = engineStateRef.current;
      if (!audio || !st.active) return;

      const teacher = TEACHER_RECITERS.find((t) => t.id === st.teacherId) || TEACHER_RECITERS[0];
      const url = buildEveryAyahUrl(teacher.everyAyahFolder, st.surahNum, ayahNum);
      if (!url) {
        stopTeacherEngine();
        return;
      }

      clearEchoTimers();
      setTeacherAudioError(null);
      st.activeAyah = ayahNum;
      st.ayahPass = ayahPass;
      st.rangePass = rangePass;

      setActiveAyahInSurah(ayahNum);
      setCurrentAyahPass(ayahPass);
      setCurrentRangePass(rangePass);
      setIsTeacherPlaying(true);

      audio.src = url;
      audio.playbackRate = st.playbackRate;
      void audio.play().catch(() => {
        setIsTeacherPlaying(false);
        engineStateRef.current.active = false;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setTeacherAudioError(
            'أنت الآن بدون إنترنت — يمكنك استخدام أوضاع الإخفاء البصري والاختبار التفاعلي، بينما يتطلب صوت الشيخ المعلم اتصالاً بالإنترنت.'
          );
        } else {
          setTeacherAudioError('اضغط «ابدأ التحفيظ» مرة أخرى لبدء صوت الشيخ المعلم.');
        }
      });
    },
    [clearEchoTimers, stopTeacherEngine]
  );

  const advanceTeacherStep = useCallback(() => {
    const st = engineStateRef.current;
    if (!st.active) return;

    if (st.ayahPass < st.ayahRepeat) {
      startSpecificAyahPass(st.activeAyah, st.ayahPass + 1, st.rangePass);
      return;
    }

    if (st.activeAyah < st.range.end) {
      startSpecificAyahPass(st.activeAyah + 1, 1, st.rangePass);
      return;
    }

    if (st.rangePass < st.rangeRepeat) {
      startSpecificAyahPass(st.range.start, 1, st.rangePass + 1);
      return;
    }

    // Completed the full scheduled memorization session!
    engineStateRef.current.active = false;
    setIsTeacherPlaying(false);
    setActiveAyahInSurah(null);
    notify('أحسنت! أتممت ورد الترديد مع المعلم بنجاح — ثبّت حفظك الآن بالاختبار', 'success');
  }, [notify, startSpecificAyahPass]);

  // Attach ended & error listeners to teacher audio
  useEffect(() => {
    const audio = teacherAudioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      const st = engineStateRef.current;
      if (!st.active) return;

      const ayahObj = st.ayahs.find((a) => a.numberInSurah === st.activeAyah);
      const clean = ayahObj
        ? stripLeadingBismillah(ayahObj.text, ayahObj.surahNumber, ayahObj.numberInSurah)
        : '';
      const delayMs = computeEchoDelayMs(clean, st.echoPause);

      if (delayMs <= 0) {
        advanceTeacherStep();
        return;
      }

      setIsEchoWaiting(true);
      setEchoRemainingSec(Math.ceil(delayMs / 1000));
      const startedAt = Date.now();

      echoCountdownIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const left = Math.max(0, Math.ceil((delayMs - elapsed) / 1000));
        setEchoRemainingSec(left);
      }, 250);

      echoTimerRef.current = window.setTimeout(() => {
        clearEchoTimers();
        if (engineStateRef.current.active) {
          advanceTeacherStep();
        }
      }, delayMs);
    };

    const handleError = () => {
      setIsTeacherPlaying(false);
      engineStateRef.current.active = false;
      clearEchoTimers();
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setTeacherAudioError(
          'أنت في وضع عدم الاتصال — الإخفاء البصري والاختبار يعملان بالكامل بدون إنترنت، بينما يحتاج بث صوت المعلم اتصالاً.'
        );
      } else {
        setTeacherAudioError(
          'تعذر تحميل صوت هذه الآية من الخادم حاليًا. جرّب اختيار قارئ معلم آخر أو إعادة المحاولة.'
        );
      }
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [advanceTeacherStep, clearEchoTimers]);

  const startTeacherSession = useCallback(
    (fromAyah?: number) => {
      // Ensure global Surah player never overlaps with Teacher Mode
      if (isGlobalPlaying) {
        toggleGlobalPlayPause();
      }
      const targetAyah =
        fromAyah && fromAyah >= range.start && fromAyah <= range.end ? fromAyah : range.start;
      engineStateRef.current.active = true;
      startSpecificAyahPass(targetAyah, 1, 1);
    },
    [isGlobalPlaying, range.end, range.start, startSpecificAyahPass, toggleGlobalPlayPause]
  );

  const toggleTeacherPlayPause = () => {
    if (isTeacherPlaying) {
      stopTeacherEngine();
    } else {
      startTeacherSession(activeAyahInSurah || range.start);
    }
  };

  const handleSurahChange = (nextSurahNumber: number) => {
    stopTeacherEngine();
    setActiveAyahInSurah(null);
    const meta = QURAN_META.surahs.find((s) => s.number === nextSurahNumber);
    if (!meta) return;
    setSurahNum(meta.number);
    setRange({
      start: 1,
      end: Math.min(meta.number === 1 ? meta.numberOfAyahs : 5, meta.numberOfAyahs),
    });
  };

  const applyRangePreset = (preset: 'first5' | 'next5' | 'next10' | 'full') => {
    stopTeacherEngine();
    const total = activeSurahMeta.numberOfAyahs;
    if (preset === 'first5') {
      setRange(clampAyahRange(1, Math.min(5, total), total));
    } else if (preset === 'full') {
      setRange({ start: 1, end: total });
    } else if (preset === 'next5') {
      const nextStart = range.end < total ? range.end + 1 : 1;
      setRange(clampAyahRange(nextStart, Math.min(total, nextStart + 4), total));
    } else if (preset === 'next10') {
      const nextStart = range.end < total ? range.end + 1 : 1;
      setRange(clampAyahRange(nextStart, Math.min(total, nextStart + 9), total));
    }
    setQuizIndex(0);
    setQuizAnswers({});
  };

  const rangeAyahs = useMemo(
    () => surahAyahs.filter((a) => a.numberInSurah >= range.start && a.numberInSurah <= range.end),
    [surahAyahs, range]
  );

  const memorizedForSurah = useMemo(
    () => new Set(progress[String(surahNum)] || []),
    [progress, surahNum]
  );

  const toggleAyahMemorized = (ayahInSurah: number) => {
    setProgress((prev) => {
      const key = String(surahNum);
      const current = new Set(prev[key] || []);
      if (current.has(ayahInSurah)) {
        current.delete(ayahInSurah);
      } else {
        current.add(ayahInSurah);
      }
      return {
        ...prev,
        [key]: Array.from(current).sort((a, b) => a - b),
      };
    });
  };

  const markCurrentRangeMemorized = () => {
    setProgress((prev) => {
      const key = String(surahNum);
      const current = new Set(prev[key] || []);
      for (let a = range.start; a <= range.end; a++) {
        current.add(a);
      }
      return {
        ...prev,
        [key]: Array.from(current).sort((a, b) => a - b),
      };
    });
    notify(
      `تم تسجيل حفظ الآيات ${toArabicDigits(range.start)} – ${toArabicDigits(range.end)} من ${
        activeSurahMeta.name
      }`,
      'success'
    );
  };

  const globalStats = useMemo(
    () => calculateTahfeezStats(progress, QURAN_META.surahs, 6236),
    [progress]
  );

  const currentSurahMemorizedPct = useMemo(() => {
    if (!activeSurahMeta.numberOfAyahs) return 0;
    return Math.round((memorizedForSurah.size / activeSurahMeta.numberOfAyahs) * 100);
  }, [memorizedForSurah.size, activeSurahMeta.numberOfAyahs]);

  const quizQuestions = useMemo(
    () => buildTahfeezQuiz(rangeAyahs, Math.min(8, Math.max(1, rangeAyahs.length)), stripLeadingBismillah),
    [rangeAyahs]
  );

  const quizScore = useMemo(() => {
    let correct = 0;
    quizQuestions.forEach((q, idx) => {
      if (quizAnswers[idx] === q.missingWord) correct += 1;
    });
    return correct;
  }, [quizAnswers, quizQuestions]);

  const allRevealed = useMemo(
    () => rangeAyahs.length > 0 && rangeAyahs.every((a) => revealedAyahs[a.numberInSurah]),
    [rangeAyahs, revealedAyahs]
  );

  const toggleRevealAll = () => {
    if (allRevealed) {
      setRevealedAyahs({});
      setRevealedWords({});
    } else {
      const next: Record<number, boolean> = {};
      rangeAyahs.forEach((a) => {
        next[a.numberInSurah] = true;
      });
      setRevealedAyahs(next);
    }
  };

  const handleFontDelta = (delta: number) => {
    const next = clampFontSize(fontSize + delta);
    setFontSize(next);
    void savePreferences({ fontSize: next });
  };

  return (
    <main
      className={`max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6 ${
        currentTrack ? 'pb-44 md:pb-36' : 'pb-28 md:pb-16'
      }`}
    >
      {/* 1. Studio Header & Memorization Progress Summary */}
      <section className="glass-gold rounded-3xl p-5 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[#C8A253]">
            <GraduationCap className="w-4 h-4" />
            <span>المعلم الذكي لتحفيظ القرآن الكريم</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]">
            احفظ القرآن بسهولة خطوةً بخطوة مع الشيخ المعلم
          </h1>
          <p className="text-xs sm:text-sm text-[#A9B2AE] max-w-2xl leading-relaxed">
            استمع للترديد التلقائي آية بآية مع مهلة للترديد خلف القارئ، واختبر حفظك بإخفاء الكلمات أو أسئلة إكمال الآيات.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
          <div className="rounded-2xl bg-[#0A0D0C]/80 border border-white/10 px-3.5 py-3 text-center">
            <p className="text-xl sm:text-2xl font-bold text-[#C8A253]">
              {toArabicDigits(globalStats.memorizedAyahs)}
            </p>
            <p className="text-[11px] text-[#A9B2AE]">آية محفوظة</p>
          </div>
          <div className="rounded-2xl bg-[#0A0D0C]/80 border border-white/10 px-3.5 py-3 text-center">
            <p className="text-xl sm:text-2xl font-bold text-[#178A64]">
              {toArabicDigits(globalStats.completedSurahs)}
            </p>
            <p className="text-[11px] text-[#A9B2AE]">سورة مكتملة</p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'mushaf', surah: surahNum })}
            className="rounded-2xl bg-[#0E6B4D]/25 hover:bg-[#0E6B4D]/40 border border-[#0E6B4D]/50 px-3.5 py-3 text-center flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            <BookOpen className="w-4 h-4 text-[#C8A253]" />
            <span className="text-[11px] font-medium text-[#F5F3EE]">فتح بالمصحف</span>
          </button>
        </div>
      </section>

      {/* 2. Mode Switcher Tabs: Teacher Study vs. Interactive Self-Test */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="وضع التحفيظ"
          className="inline-flex items-center gap-1 p-1 rounded-2xl bg-[#121715] border border-white/10"
        >
          <button
            type="button"
            role="tab"
            aria-selected={workspaceTab === 'learn'}
            onClick={() => setWorkspaceTab('learn')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              workspaceTab === 'learn'
                ? 'bg-[#0E6B4D] text-white'
                : 'text-[#A9B2AE] hover:text-white'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>التحفيظ والترديد مع المعلم</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={workspaceTab === 'quiz'}
            onClick={() => {
              stopTeacherEngine();
              setWorkspaceTab('quiz');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              workspaceTab === 'quiz'
                ? 'bg-[#C8A253] text-[#0A0D0C] font-bold'
                : 'text-[#A9B2AE] hover:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>اختبر حفظك (تسميع)</span>
          </button>
        </div>

        {/* Current Surah Progress Bar */}
        <div className="flex items-center gap-3 text-xs text-[#A9B2AE] bg-[#121715] border border-white/10 rounded-2xl px-4 py-2">
          <span>
            تقدم {formatSurahDisplayName(activeSurahMeta.name)}:{' '}
            <strong className="text-[#C8A253] font-mono-nums">
              {toArabicDigits(memorizedForSurah.size)} / {toArabicDigits(activeSurahMeta.numberOfAyahs)}
            </strong>
          </span>
          <div className="w-24 h-2 rounded-full bg-[#0A0D0C] overflow-hidden">
            <div
              className="h-full bg-[#178A64] transition-all duration-300"
              style={{ width: `${currentSurahMemorizedPct}%` }}
            />
          </div>
          <span className="font-mono-nums text-[#F5F3EE]">{toArabicDigits(currentSurahMemorizedPct)}٪</span>
        </div>
      </div>

      {/* 3. Clear & Simple Control Panel (Surah, Range, Teacher, Repeat Settings) */}
      <section className="glass-panel rounded-3xl p-4 sm:p-6 space-y-5">
        {/* Row A: Surah & Ayah Range + Quick Presets */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
          <div className="md:col-span-4 space-y-1.5">
            <label htmlFor="tahfeez-surah" className="block text-xs font-medium text-[#A9B2AE]">
              السورة المختارة
            </label>
            <select
              id="tahfeez-surah"
              value={surahNum}
              onChange={(e) => handleSurahChange(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE] focus:outline-none focus:border-[#C8A253]"
            >
              {QURAN_META.surahs.map((s) => (
                <option key={s.number} value={s.number}>
                  {toArabicDigits(s.number)}. {formatSurahDisplayName(s.name)} ({toArabicDigits(s.numberOfAyahs)} آية)
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label htmlFor="tahfeez-from" className="block text-xs font-medium text-[#A9B2AE]">
                من آية
              </label>
              <select
                id="tahfeez-from"
                value={range.start}
                onChange={(e) => {
                  stopTeacherEngine();
                  const nextStart = Number(e.target.value);
                  setRange(clampAyahRange(nextStart, range.end, activeSurahMeta.numberOfAyahs));
                }}
                className="w-full px-2.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE] focus:outline-none focus:border-[#C8A253]"
              >
                {Array.from({ length: activeSurahMeta.numberOfAyahs }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {toArabicDigits(n)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tahfeez-to" className="block text-xs font-medium text-[#A9B2AE]">
                إلى آية
              </label>
              <select
                id="tahfeez-to"
                value={range.end}
                onChange={(e) => {
                  stopTeacherEngine();
                  const nextEnd = Number(e.target.value);
                  setRange(clampAyahRange(range.start, nextEnd, activeSurahMeta.numberOfAyahs));
                }}
                className="w-full px-2.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE] focus:outline-none focus:border-[#C8A253]"
              >
                {Array.from({ length: activeSurahMeta.numberOfAyahs }, (_, i) => i + 1)
                  .filter((n) => n >= range.start)
                  .map((n) => (
                    <option key={n} value={n}>
                      {toArabicDigits(n)}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="md:col-span-6 space-y-1.5">
            <span className="block text-xs font-medium text-[#A9B2AE]">اختيار سريع للمقطع</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyRangePreset('first5')}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#F5F3EE] cursor-pointer"
              >
                أول ٥ آيات
              </button>
              <button
                type="button"
                onClick={() => applyRangePreset('next5')}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#F5F3EE] cursor-pointer"
              >
                الـ ٥ آيات التالية
              </button>
              <button
                type="button"
                onClick={() => applyRangePreset('next10')}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#F5F3EE] cursor-pointer"
              >
                ١٠ آيات تالية
              </button>
              <button
                type="button"
                onClick={() => applyRangePreset('full')}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#C8A253] cursor-pointer"
              >
                كامل السورة
              </button>
            </div>
          </div>
        </div>

        {/* Row B: Teacher Controls (Only in Teacher Learning Tab) */}
        {workspaceTab === 'learn' && (
          <>
            <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Teacher Voice Selector */}
              <div className="sm:col-span-2 space-y-1.5">
                <label htmlFor="tahfeez-teacher" className="block text-xs font-medium text-[#A9B2AE]">
                  صوت الشيخ المعلم (آية بآية)
                </label>
                <select
                  id="tahfeez-teacher"
                  value={teacherId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setTeacherId(nextId);
                    if (engineStateRef.current.active) {
                      engineStateRef.current.teacherId = nextId;
                      startSpecificAyahPass(engineStateRef.current.activeAyah, 1, 1);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs sm:text-sm text-[#F5F3EE] focus:outline-none focus:border-[#C8A253]"
                >
                  {TEACHER_RECITERS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nameAr} — {t.subtitleAr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Repeat Each Ayah */}
              <div className="space-y-1.5">
                <label htmlFor="tahfeez-ayah-repeat" className="block text-xs font-medium text-[#A9B2AE]">
                  تكرار كل آية
                </label>
                <select
                  id="tahfeez-ayah-repeat"
                  value={ayahRepeat}
                  onChange={(e) => setAyahRepeat(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE] focus:outline-none focus:border-[#C8A253]"
                >
                  {[1, 2, 3, 5, 7, 10].map((n) => (
                    <option key={n} value={n}>
                      {toArabicDigits(n)} {n === 1 ? 'مرة' : n === 2 ? 'مرتين' : 'مرات'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Repeat Whole Range */}
              <div className="space-y-1.5">
                <label htmlFor="tahfeez-range-repeat" className="block text-xs font-medium text-[#A9B2AE]">
                  تكرار المقطع كاملًا
                </label>
                <select
                  id="tahfeez-range-repeat"
                  value={rangeRepeat}
                  onChange={(e) => setRangeRepeat(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE] focus:outline-none focus:border-[#C8A253]"
                >
                  {[1, 2, 3, 5].map((n) => (
                    <option key={n} value={n}>
                      {toArabicDigits(n)} {n === 1 ? 'مرة' : n === 2 ? 'مرتين' : 'مرات'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Echo Pause Time */}
              <div className="space-y-1.5">
                <label htmlFor="tahfeez-echo" className="block text-xs font-medium text-[#A9B2AE]">
                  مهلة الترديد خلف الشيخ
                </label>
                <select
                  id="tahfeez-echo"
                  value={echoPause}
                  onChange={(e) => setEchoPause(e.target.value as EchoPauseMode)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs sm:text-sm text-[#F5F3EE] focus:outline-none focus:border-[#C8A253]"
                >
                  <option value="auto">تلقائي حسب طول الآية</option>
                  <option value="3s">٣ ثوانٍ بعد كل آية</option>
                  <option value="5s">٥ ثوانٍ بعد كل آية</option>
                  <option value="off">متواصل بدون انتظار</option>
                </select>
              </div>
            </div>

            {/* Row C: Primary Action Buttons + Speed + Font + Visual Recall Mode */}
            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTeacherPlayPause}
                  className="flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-sm font-semibold shadow-lg cursor-pointer transition-colors"
                >
                  {isTeacherPlaying ? (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>إيقاف المعلم</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>ابدأ التحفيظ مع المعلم</span>
                    </>
                  )}
                </button>

                {isTeacherPlaying && (
                  <button
                    type="button"
                    onClick={() => {
                      stopTeacherEngine();
                      setActiveAyahInSurah(null);
                    }}
                    aria-label="إيقاف وتصفير جلسة التحفيظ"
                    className="flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#F5F3EE] cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>إنهاء</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={markCurrentRangeMemorized}
                  className="flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-[#C8A253]/15 hover:bg-[#C8A253]/25 border border-[#C8A253]/40 text-xs sm:text-sm font-medium text-[#C8A253] cursor-pointer transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تحديد المقطع كمحفوظ</span>
                </button>
              </div>

              {/* Speed & Uthmani Font Size */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-[#0A0D0C] border border-white/10 rounded-xl p-1">
                  <span className="text-[11px] text-[#A9B2AE] px-2">السرعة:</span>
                  {[0.75, 0.9, 1, 1.15].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setPlaybackRate(rate)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-mono-nums cursor-pointer ${
                        playbackRate === rate
                          ? 'bg-[#0E6B4D] text-white'
                          : 'text-[#A9B2AE] hover:text-white'
                      }`}
                    >
                      {rate}×
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-0.5 bg-[#0A0D0C] border border-white/10 rounded-xl px-1.5 py-0.5">
                  <button
                    type="button"
                    onClick={() => handleFontDelta(-2)}
                    aria-label="تصغير الخط القرآني"
                    className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[#F5F3EE] cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-mono-nums text-[#C8A253] px-1.5">
                    {toArabicDigits(fontSize)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleFontDelta(2)}
                    aria-label="تكبير الخط القرآني"
                    className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[#F5F3EE] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Row D: Offline Active-Recall Visual Masking Modes */}
            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[#C8A253] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>مستوى الإخفاء للتسميع:</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'full', label: 'إظهار كامل' },
                      { id: 'first-two', label: 'أول كلمتين فقط' },
                      { id: 'keywords', label: 'إخفاء كلمات متقاطعة' },
                      { id: 'hidden', label: 'إخفاء كامل للتسميع' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setVisualMode(item.id);
                        setRevealedAyahs({});
                        setRevealedWords({});
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                        visualMode === item.id
                          ? 'bg-[#C8A253] text-[#0A0D0C] font-bold'
                          : 'bg-[#0A0D0C] border border-white/10 text-[#A9B2AE] hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {visualMode !== 'full' && (
                <button
                  type="button"
                  onClick={toggleRevealAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#F5F3EE] cursor-pointer"
                >
                  {allRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-[#C8A253]" />}
                  <span>{allRevealed ? 'إعادة الإخفاء للجميع' : 'كشف جميع الآيات مؤقتًا'}</span>
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {/* Live Teacher Status Banner */}
      {workspaceTab === 'learn' && isTeacherPlaying && activeAyahInSurah && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-2xl p-4 border flex flex-wrap items-center justify-between gap-3 transition-colors ${
            isEchoWaiting
              ? 'bg-[#C8A253]/15 border-[#C8A253]/45'
              : 'bg-[#0E6B4D]/25 border-[#178A64]/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isEchoWaiting ? 'bg-[#C8A253] text-[#0A0D0C]' : 'bg-[#0E6B4D] text-white'
              }`}
            >
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#F5F3EE]">
                {isEchoWaiting
                  ? `دورك الآن: ردّد الآية ${toArabicDigits(activeAyahInSurah)} بصوتك (${toArabicDigits(
                      echoRemainingSec
                    )} ث)`
                  : `يتلو المعلم (${activeTeacher.nameAr}): الآية ${toArabicDigits(activeAyahInSurah)}`}
              </p>
              <p className="text-xs text-[#A9B2AE]">
                تكرار الآية: {toArabicDigits(currentAyahPass)} من {toArabicDigits(ayahRepeat)} · جولة المقطع:{' '}
                {toArabicDigits(currentRangePass)} من {toArabicDigits(rangeRepeat)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEchoWaiting && (
              <button
                type="button"
                onClick={() => {
                  clearEchoTimers();
                  advanceTeacherStep();
                }}
                className="px-3.5 py-2 rounded-xl bg-[#C8A253] text-[#0A0D0C] text-xs font-bold cursor-pointer"
              >
                تخطي الانتظار
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (activeAyahInSurah > range.start) {
                  startSpecificAyahPass(activeAyahInSurah - 1, 1, currentRangePass);
                }
              }}
              disabled={activeAyahInSurah <= range.start}
              aria-label="الآية السابقة"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-35 text-[#F5F3EE] cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeAyahInSurah < range.end) {
                  startSpecificAyahPass(activeAyahInSurah + 1, 1, currentRangePass);
                }
              }}
              disabled={activeAyahInSurah >= range.end}
              aria-label="الآية التالية"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-35 text-[#F5F3EE] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {teacherAudioError && (
        <div className="rounded-2xl bg-rose-950/35 border border-rose-500/30 p-3.5 flex items-center justify-between gap-3 text-xs text-rose-200">
          <span>{teacherAudioError}</span>
          <button
            type="button"
            onClick={() => setTeacherAudioError(null)}
            className="text-rose-200 hover:text-white underline cursor-pointer shrink-0"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* 4. Main Workspace Content */}
      {loading ? (
        <div className="glass-panel rounded-3xl py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#C8A253]/30 border-t-[#C8A253] rounded-full animate-spin mx-auto" />
          <p className="text-sm text-[#A9B2AE]">جاري تجهيز آيات المقطع بالرسم العثماني...</p>
        </div>
      ) : loadError ? (
        <div className="glass-panel rounded-3xl py-16 text-center space-y-4">
          <p className="text-sm text-rose-400">{loadError}</p>
        </div>
      ) : workspaceTab === 'learn' ? (
        /* TAB 1: Interactive Memorization Ayah Cards */
        <section aria-label="آيات التحفيظ" className="space-y-3.5">
          {rangeAyahs.map((ayah) => {
            const cleanText = stripLeadingBismillah(
              ayah.text,
              ayah.surahNumber,
              ayah.numberInSurah
            );
            const isCurrent = activeAyahInSurah === ayah.numberInSurah && isTeacherPlaying;
            const isMemorized = memorizedForSurah.has(ayah.numberInSurah);
            const isAyahRevealed = Boolean(revealedAyahs[ayah.numberInSurah]);
            const effectiveMode: VisualMaskMode = isAyahRevealed ? 'full' : visualMode;
            const tokens = maskAyahWords(cleanText, effectiveMode, ayah.numberInSurah);

            return (
              <article
                key={ayah.number}
                className={`rounded-2xl p-4 sm:p-6 transition-all border ${
                  isCurrent
                    ? 'bg-[#13221C] border-[#C8A253] shadow-[0_0_24px_rgba(200,162,83,0.12)]'
                    : isMemorized
                    ? 'bg-[#0E1814] border-[#0E6B4D]/55'
                    : 'glass-panel border-white/10 hover:border-white/20'
                }`}
              >
                {/* Ayah Header Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono-nums font-semibold ${
                        isCurrent
                          ? 'bg-[#C8A253] text-[#0A0D0C]'
                          : 'bg-[#0A0D0C] border border-white/10 text-[#C8A253]'
                      }`}
                    >
                      الآية {toArabicDigits(ayah.numberInSurah)}
                    </span>
                    <span className="text-[11px] text-[#A9B2AE]">
                      صفحة {toArabicDigits(ayah.page)}
                    </span>
                    {isCurrent && (
                      <span className="text-[11px] text-[#178A64] font-medium">
                        {isEchoWaiting ? '· دورك بالترديد' : '· يتلو المعلم'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {visualMode !== 'full' && (
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedAyahs((prev) => ({
                            ...prev,
                            [ayah.numberInSurah]: !prev[ayah.numberInSurah],
                          }))
                        }
                        aria-label={
                          isAyahRevealed
                            ? `إخفاء الآية ${ayah.numberInSurah}`
                            : `كشف الآية ${ayah.numberInSurah}`
                        }
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-[#F5F3EE] cursor-pointer"
                      >
                        {isAyahRevealed ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-[#A9B2AE]" />
                            <span>إخفاء</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5 text-[#C8A253]" />
                            <span>كشف الآية</span>
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (isCurrent) {
                          stopTeacherEngine();
                          setActiveAyahInSurah(null);
                        } else {
                          startTeacherSession(ayah.numberInSurah);
                        }
                      }}
                      aria-label={`تشغيل الآية ${ayah.numberInSurah} بصوت المعلم`}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                        isCurrent
                          ? 'bg-[#C8A253] text-[#0A0D0C]'
                          : 'bg-[#0E6B4D]/35 hover:bg-[#0E6B4D] text-[#F5F3EE]'
                      }`}
                    >
                      {isCurrent ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                      <span>{isCurrent ? 'إيقاف' : 'استمع'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleAyahMemorized(ayah.numberInSurah)}
                      aria-label={
                        isMemorized
                          ? `إلغاء علامة حفظ الآية ${ayah.numberInSurah}`
                          : `تمييز الآية ${ayah.numberInSurah} كمحفوظة`
                      }
                      aria-pressed={isMemorized}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        isMemorized
                          ? 'bg-[#0E6B4D] text-white'
                          : 'bg-white/5 hover:bg-white/10 text-[#A9B2AE] hover:text-white'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isMemorized ? 'محفوظة' : 'تم الحفظ'}</span>
                    </button>
                  </div>
                </div>

                {/* Ayah Uthmani Text with Tap-to-Reveal Masked Words */}
                <div
                  dir="rtl"
                  className="font-quran text-[#F5F3EE] text-right leading-[2.3]"
                  style={{ fontSize: `${fontSize}px`, wordSpacing: 'normal', letterSpacing: 0 }}
                >
                  {tokens.map((tok) => {
                    const wordKey = `${ayah.numberInSurah}_${tok.index}`;
                    const isWordPeeked = Boolean(revealedWords[wordKey]);
                    if (!tok.masked || isWordPeeked) {
                      return (
                        <React.Fragment key={wordKey}>
                          <span className={tok.masked && isWordPeeked ? 'text-[#C8A253]' : ''}>
                            {tok.word}
                          </span>{' '}
                        </React.Fragment>
                      );
                    }
                    return (
                      <React.Fragment key={wordKey}>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedWords((prev) => ({ ...prev, [wordKey]: true }))
                          }
                          aria-label={`كشف الكلمة المخفية رقم ${tok.index + 1}`}
                          title="اضغط لكشف الكلمة"
                          className="inline-flex items-center justify-center px-2.5 py-0.5 mx-0.5 rounded-lg bg-[#0A0D0C]/80 border border-dashed border-[#C8A253]/45 text-[#C8A253]/75 hover:border-[#C8A253] hover:text-[#C8A253] font-sans text-xs align-middle cursor-pointer"
                        >
                          •••
                        </button>{' '}
                      </React.Fragment>
                    );
                  })}
                  <span className="text-[#C8A253] select-none mx-1 inline-block text-[0.82em]">
                    ﴿{toArabicDigits(ayah.numberInSurah)}﴾
                  </span>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        /* TAB 2: Interactive Fill-in-the-Blank Self Quiz */
        <section aria-label="اختبار التسميع التفاعلي" className="mushaf-frame rounded-3xl p-5 sm:p-8 space-y-6">
          {quizQuestions.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm text-[#A9B2AE]">
                اختر مقطعًا يحتوي على آيات من كلمتين فأكثر لبدء اختبار التسميع التفاعلي.
              </p>
            </div>
          ) : (
            (() => {
              const allAnswered = quizQuestions.every((_, idx) => quizAnswers[idx] !== undefined);
              if (quizIndex >= quizQuestions.length || (allAnswered && quizIndex === quizQuestions.length - 1 && quizAnswers[quizIndex] !== undefined && Object.keys(quizAnswers).length === quizQuestions.length && quizIndex === -1)) {
                return null;
              }
              const currentQ = quizQuestions[Math.min(quizIndex, quizQuestions.length - 1)];
              const selectedOpt = quizAnswers[quizIndex];
              const hasAnsweredCurrent = selectedOpt !== undefined;
              const isCorrectCurrent = selectedOpt === currentQ.missingWord;
              const isLastQuestion = quizIndex === quizQuestions.length - 1;

              return (
                <div className="max-w-3xl mx-auto space-y-6">
                  {/* Quiz Top Status */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-[#C8A253] font-semibold">
                      <Award className="w-4 h-4" />
                      <span>
                        سؤال {toArabicDigits(quizIndex + 1)} من {toArabicDigits(quizQuestions.length)} ·{' '}
                        {formatSurahDisplayName(activeSurahMeta.name)} (الآية {toArabicDigits(currentQ.ayahNumberInSurah)})
                      </span>
                    </div>
                    <div className="text-xs text-[#A9B2AE]">
                      النتيجة:{' '}
                      <strong className="text-[#178A64] font-mono-nums">
                        {toArabicDigits(quizScore)} / {toArabicDigits(quizQuestions.length)}
                      </strong>
                    </div>
                  </div>

                  {/* Ayah Prompt with Highlighted Missing Slot */}
                  <div className="rounded-2xl bg-[#0A0D0C]/80 border border-[#C8A253]/25 p-5 sm:p-7 text-center">
                    <p className="text-xs text-[#A9B2AE] mb-3">اختر الكلمة القرآنية الصحيحة لإكمال الآية:</p>
                    <p
                      dir="rtl"
                      className="font-quran text-2xl sm:text-3xl leading-[2.2] text-[#F5F3EE]"
                    >
                      {currentQ.beforeWords.join(' ')}{' '}
                      <span
                        className={`inline-block px-3 py-0.5 mx-1 rounded-xl border ${
                          hasAnsweredCurrent
                            ? isCorrectCurrent
                              ? 'bg-[#0E6B4D]/35 border-[#178A64] text-[#6EE7B7]'
                              : 'bg-[#C8A253]/20 border-[#C8A253] text-[#C8A253]'
                            : 'bg-[#C8A253]/15 border-dashed border-[#C8A253] text-[#C8A253]'
                        }`}
                      >
                        {hasAnsweredCurrent ? currentQ.missingWord : '[ ؟ ]'}
                      </span>{' '}
                      {currentQ.afterWords.join(' ')}
                    </p>
                  </div>

                  {/* 4 Choices Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentQ.options.map((option, optIdx) => {
                      const picked = selectedOpt === option;
                      const isRight = option === currentQ.missingWord;
                      let btnClass =
                        'bg-[#121715] hover:bg-[#171F1C] border-white/15 text-[#F5F3EE]';
                      if (hasAnsweredCurrent) {
                        if (isRight) {
                          btnClass = 'bg-[#0E6B4D]/35 border-[#178A64] text-[#F5F3EE]';
                        } else if (picked) {
                          btnClass = 'bg-rose-950/50 border-rose-500/60 text-rose-200';
                        } else {
                          btnClass = 'bg-[#121715]/50 border-white/5 text-[#A9B2AE] opacity-65';
                        }
                      }

                      return (
                        <button
                          key={`${quizIndex}_${optIdx}`}
                          type="button"
                          disabled={hasAnsweredCurrent}
                          onClick={() =>
                            setQuizAnswers((prev) => ({ ...prev, [quizIndex]: option }))
                          }
                          className={`p-4 rounded-2xl border font-quran text-xl sm:text-2xl flex items-center justify-between gap-3 transition-all cursor-pointer disabled:cursor-default ${btnClass}`}
                        >
                          <span>{option}</span>
                          {hasAnsweredCurrent && isRight && (
                            <CheckCircle2 className="w-5 h-5 text-[#6EE7B7] shrink-0" />
                          )}
                          {hasAnsweredCurrent && picked && !isRight && (
                            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback & Next / Restart Controls */}
                  {hasAnsweredCurrent && (
                    <div className="pt-2 space-y-3">
                      {isLastQuestion && (
                        <div className="rounded-2xl bg-[#0E6B4D]/20 border border-[#178A64]/45 p-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold text-[#F5F3EE]">
                              أتممت اختبار التسميع — نتيجتك: {toArabicDigits(quizScore)} من{' '}
                              {toArabicDigits(quizQuestions.length)}
                            </p>
                            <p className="text-xs text-[#A9B2AE]">
                              نسبة الإتقان:{' '}
                              {toArabicDigits(Math.round((quizScore / quizQuestions.length) * 100))}٪
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p
                          className={`text-sm font-medium ${
                            isCorrectCurrent ? 'text-[#6EE7B7]' : 'text-[#C8A253]'
                          }`}
                        >
                          {isCorrectCurrent
                            ? 'أحسنت! إجابة متقنة بارك الله في حفظك'
                            : `الصواب: «${currentQ.missingWord}»`}
                        </p>

                        <div className="flex items-center gap-2">
                          {!isLastQuestion ? (
                            <button
                              type="button"
                              onClick={() => setQuizIndex((i) => i + 1)}
                              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs sm:text-sm font-semibold cursor-pointer"
                            >
                              <span>السؤال التالي</span>
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuizIndex(0);
                                  setQuizAnswers({});
                                }}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm text-[#F5F3EE] cursor-pointer"
                              >
                                <RotateCcw className="w-4 h-4" />
                                <span>إعادة الاختبار</span>
                              </button>
                              <button
                                type="button"
                                onClick={markCurrentRangeMemorized}
                                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#C8A253] hover:bg-[#d6b368] text-[#0A0D0C] text-xs sm:text-sm font-bold cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>اعتماد حفظ المقطع</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </section>
      )}
    </main>
  );
};
