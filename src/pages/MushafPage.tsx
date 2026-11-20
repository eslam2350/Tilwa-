import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  GraduationCap,
  Heart,
  List,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  Search,
  Share2,
  Sparkles,
  Sun,
  Volume2,
  X,
} from 'lucide-react';
import { DEVELOPER_NAME, QURAN_META } from '../data/reciters';
import { useAppData } from '../contexts/AppDataContext';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchAyahTafseer,
  fetchJuzUthmani,
  fetchPageUthmani,
  fetchSurahUthmani,
  searchQuranVerses,
  type QuranSearchMatch,
} from '../services/quranApi';
import type { AppRoute, AyahItem } from '../types/tilawa';
import {
  clampFontSize,
  formatHizbLabel,
  getDefaultPlayableSurahNumber,
  isSurahAvailableInCollection,
  normalizeArabic,
  stripLeadingBismillah,
  toArabicDigits,
} from '../utils/quranHelpers';
import { buildEveryAyahUrl } from '../utils/tahfeezHelpers';

interface MushafPageProps {
  initialSurah?: number;
  initialPage?: number;
  initialJuz?: number;
  navigate: (next: AppRoute) => void;
}

type ViewMode = 'page' | 'surah' | 'juz';
type MushafTheme = 'obsidian' | 'parchment' | 'emerald';

const THEME_STORAGE_KEY = 'tilawa_mushaf_theme_v1';

export const MushafPage: React.FC<MushafPageProps> = ({
  initialSurah,
  initialPage,
  initialJuz,
  navigate,
}) => {
  const { reciters, notify } = useAppData();
  const { playSurahByReciter, currentTrack } = useAudioPlayer();
  const { prefs, saveReadingPosition, savePreferences, isFavorite, toggleFavorite } = useAuth();

  // Default Mushaf mode opens as a genuine Uthmani Madinah Mushaf page view (604 pages)
  // unless explicitly navigated to a specific Surah or Juz.
  const [mode, setMode] = useState<ViewMode>(
    initialSurah ? 'surah' : initialJuz ? 'juz' : 'page'
  );
  const [surahNum, setSurahNum] = useState<number>(initialSurah || prefs.lastReadSurah || 1);
  const [pageNum, setPageNum] = useState<number>(initialPage || prefs.lastReadPage || 1);
  const [juzNum, setJuzNum] = useState<number>(initialJuz || 1);
  const [fontSize, setFontSize] = useState<number>(prefs.fontSize || 28);
  const [selectedReciterId, setSelectedReciterId] = useState<string>(reciters[0]?.id || 'minshawi');
  const [paperTheme, setPaperTheme] = useState<MushafTheme>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'parchment' || saved === 'emerald' || saved === 'obsidian') return saved;
    } catch {
      // ignore
    }
    return 'obsidian';
  });

  const [ayahs, setAyahs] = useState<AyahItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [selectedAyah, setSelectedAyah] = useState<AyahItem | null>(null);

  // Standalone Drawer Controls (Fihris Index & Search)
  const [showIndexDrawer, setShowIndexDrawer] = useState(false);
  const [indexTab, setIndexTab] = useState<'surahs' | 'juzs'>('surahs');
  const [indexFilter, setIndexFilter] = useState('');
  const [quickJumpPage, setQuickJumpPage] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);

  // Quranic text search inside Mushaf
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<QuranSearchMatch[]>([]);
  const [searching, setSearching] = useState(false);

  // Per-Ayah Tafseer Al-Muyassar & direct Ayah recitation preview
  const [tafseerOpen, setTafseerOpen] = useState(false);
  const [tafseerText, setTafseerText] = useState<string | null>(null);
  const [tafseerLoading, setTafseerLoading] = useState(false);
  const [ayahAudioPlaying, setAyahAudioPlaying] = useState(false);
  const ayahAudioRef = useRef<HTMLAudioElement | null>(null);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const stopAyahAudio = useCallback(() => {
    if (ayahAudioRef.current) {
      ayahAudioRef.current.pause();
      ayahAudioRef.current.src = '';
    }
    setAyahAudioPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      stopAyahAudio();
    };
  }, [stopAyahAudio]);

  useEffect(() => {
    setTafseerOpen(false);
    setTafseerText(null);
    stopAyahAudio();
  }, [selectedAyah?.number, stopAyahAudio]);

  useEffect(() => {
    if (initialPage) {
      setMode('page');
      setPageNum(initialPage);
    } else if (initialJuz) {
      setMode('juz');
      setJuzNum(initialJuz);
    } else if (initialSurah) {
      setMode('surah');
      setSurahNum(initialSurah);
    }
  }, [initialSurah, initialPage, initialJuz]);

  const handleThemeChange = (next: MushafTheme) => {
    setPaperTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const savePositionRef = useRef(saveReadingPosition);
  useEffect(() => {
    savePositionRef.current = saveReadingPosition;
  }, [saveReadingPosition]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedAyah(null);

    const load = async () => {
      try {
        let data: AyahItem[] = [];
        if (mode === 'page') {
          data = await fetchPageUthmani(pageNum);
        } else if (mode === 'surah') {
          data = await fetchSurahUthmani(surahNum);
        } else {
          data = await fetchJuzUthmani(juzNum);
        }
        if (!cancelled) {
          setAyahs(data);
          if (data[0]) {
            void savePositionRef.current(data[0].surahNumber, data[0].page, data[0].numberInSurah);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'تعذر تحميل النص القرآني');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [mode, surahNum, pageNum, juzNum, reloadNonce]);

  // Group ayahs continuously by Surah header so Bismillah & Surah banners appear accurately
  const surahSections = useMemo(() => {
    const groups: Array<{ surahNumber: number; surahName: string; ayahs: AyahItem[] }> = [];
    for (const a of ayahs) {
      const last = groups[groups.length - 1];
      if (!last || last.surahNumber !== a.surahNumber) {
        groups.push({ surahNumber: a.surahNumber, surahName: a.surahName, ayahs: [a] });
      } else {
        last.ayahs.push(a);
      }
    }
    return groups;
  }, [ayahs]);

  const filteredIndexSurahs = useMemo(() => {
    const q = normalizeArabic(indexFilter);
    if (!q) return QURAN_META.surahs;
    return QURAN_META.surahs.filter(
      (s) =>
        normalizeArabic(s.name).includes(q) ||
        s.englishName.toLowerCase().includes(q) ||
        String(s.number) === q
    );
  }, [indexFilter]);

  const handleFontDelta = (delta: number) => {
    const next = clampFontSize(fontSize + delta);
    setFontSize(next);
    void savePreferences({ fontSize: next });
  };

  const handleCopyAyah = async (ayah: AyahItem) => {
    const formatted = `﴿${ayah.text}﴾ [${ayah.surahName}: ${toArabicDigits(ayah.numberInSurah)}]`;
    try {
      await navigator.clipboard.writeText(formatted);
      notify('تم نسخ الآية الكريمة بنجاح', 'success');
    } catch {
      notify('تعذر النسخ التلقائي — يمكنك التحديد يدويًا', 'error');
    }
  };

  const handleToggleTafseer = async (ayah: AyahItem) => {
    if (tafseerOpen) {
      setTafseerOpen(false);
      return;
    }
    setTafseerOpen(true);
    if (tafseerText) return;
    setTafseerLoading(true);
    try {
      const txt = await fetchAyahTafseer(ayah.surahNumber, ayah.numberInSurah);
      setTafseerText(txt);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تحميل التفسير الميسر', 'error');
      setTafseerOpen(false);
    } finally {
      setTafseerLoading(false);
    }
  };

  const handleToggleAyahAudio = (ayah: AyahItem) => {
    if (ayahAudioPlaying) {
      stopAyahAudio();
      return;
    }
    const url = buildEveryAyahUrl('Minshawy_Murattal_128kbps', ayah.surahNumber, ayah.numberInSurah);
    if (!url) {
      notify('تعذر تحديد ملف الآية الصوتي', 'error');
      return;
    }
    if (!ayahAudioRef.current) {
      ayahAudioRef.current = new Audio();
    }
    const el = ayahAudioRef.current;
    el.src = url;
    el.onended = () => setAyahAudioPlaying(false);
    el.onerror = () => {
      setAyahAudioPlaying(false);
      notify('تعذر تشغيل صوت الآية — تحقق من الاتصال بالإنترنت', 'error');
    };
    setAyahAudioPlaying(true);
    void el.play().catch(() => {
      setAyahAudioPlaying(false);
      notify('تعذر بدء تشغيل صوت الآية', 'error');
    });
  };

  const handleShareAyah = async (ayah: AyahItem) => {
    const shareText = `﴿${ayah.text}﴾\n${ayah.surahName} — الآية ${toArabicDigits(
      ayah.numberInSurah
    )}\nمصحف تلاوة | TILAWA`;
    if (navigator.share) {
      try {
        await navigator.share({ title: ayah.surahName, text: shareText });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      notify('تم نسخ نص المشاركة إلى الحافظة', 'success');
    } catch {
      notify('تعذر مشاركة الآية حاليًا', 'error');
    }
  };

  const handleQuranSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) {
      notify('اكتب كلمتين أو حرفين على الأقل للبحث في المصحف', 'info');
      return;
    }
    setSearching(true);
    try {
      const matches = await searchQuranVerses(searchQuery);
      setSearchResults(matches);
      if (matches.length === 0) {
        notify('لم يُعثر على نتائج مطابقة في النص القرآني', 'info');
      }
    } catch {
      notify('تعذر البحث في المصحف حاليًا', 'error');
    } finally {
      setSearching(false);
    }
  };

  const activeSurahNumber = ayahs[0]?.surahNumber || surahNum;
  const activeSurahName =
    ayahs[0]?.surahName ||
    QURAN_META.surahs.find((s) => s.number === activeSurahNumber)?.name ||
    'سُورَةُ ٱلْفَاتِحَةِ';
  const activePageNumber = ayahs[0]?.page || pageNum;
  const activeJuzNumber = ayahs[0]?.juz || juzNum;
  const activeHizbLabel = formatHizbLabel(ayahs[0]?.hizbQuarter);

  const stepNavigation = useCallback(
    (direction: 'next' | 'prev') => {
      if (mode === 'page') {
        setPageNum((prev) =>
          direction === 'next' ? (prev >= 604 ? 1 : prev + 1) : prev <= 1 ? 604 : prev - 1
        );
      } else if (mode === 'surah') {
        setSurahNum((prev) =>
          direction === 'next' ? (prev >= 114 ? 1 : prev + 1) : prev <= 1 ? 114 : prev - 1
        );
      } else {
        setJuzNum((prev) =>
          direction === 'next' ? (prev >= 30 ? 1 : prev + 1) : prev <= 1 ? 30 : prev - 1
        );
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [mode]
  );

  // Standalone keyboard page turn & Escape to close drawer when not typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showIndexDrawer) {
        setShowIndexDrawer(false);
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft') {
        stepNavigation('next');
      } else if (e.key === 'ArrowRight') {
        stepNavigation('prev');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepNavigation, showIndexDrawer]);

  const isParchment = paperTheme === 'parchment';
  const frameClass =
    paperTheme === 'parchment'
      ? 'mushaf-paper-parchment'
      : paperTheme === 'emerald'
      ? 'mushaf-paper-emerald'
      : 'mushaf-frame';

  const ayahTextColor = isParchment ? 'text-[#1B1915]' : 'text-[#F5F3EE]';
  const mutedTextColor = isParchment ? 'text-[#5C5342]' : 'text-[#A9B2AE]';
  const goldAccentColor = isParchment ? 'text-[#8C6416]' : 'text-[#C8A253]';
  const bannerClass = isParchment
    ? 'border-[#9E7E3C]/45 bg-[#EFE6D2]'
    : 'border-[#C8A253]/35 bg-[#0A0D0C]/80';

  const isSelectedAyahFav = selectedAyah
    ? isFavorite(`ayah_${selectedAyah.surahNumber}_${selectedAyah.numberInSurah}`)
    : false;

  return (
    <div className="min-h-screen bg-[#070908] flex flex-col">
      {/* Standalone Mushaf App Top Header */}
      <header className="sticky top-0 z-30 glass-panel border-b border-[#C8A253]/20">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate({ page: 'home' })}
              aria-label="العودة إلى منصة تلاوة"
              className="flex items-center gap-1.5 min-h-[38px] px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-[#F5F3EE] cursor-pointer shrink-0"
            >
              <ArrowRight className="w-4 h-4 text-[#C8A253]" />
              <span className="hidden sm:inline">منصة تلاوة</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-[#C8A253] shrink-0 hidden sm:block" />
                <h1 className="text-sm sm:text-base font-display font-bold text-[#F5F3EE] truncate">
                  المصحف الشريف · {activeSurahName}
                </h1>
              </div>
              <p className="text-[11px] text-[#A9B2AE] truncate">
                الجزء {toArabicDigits(activeJuzNumber)}
                {activeHizbLabel ? ` · ${activeHizbLabel}` : ''} · صفحة {toArabicDigits(activePageNumber)} من ٦٠٤
              </p>
            </div>
          </div>

          {/* Standalone Utility Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => navigate({ page: 'tahfeez', surah: activeSurahNumber })}
              aria-label="تحفيظ السورة الحالية مع المعلم"
              className="flex items-center gap-1.5 min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#C8A253]/15 hover:bg-[#C8A253]/25 border border-[#C8A253]/40 text-[#C8A253] text-xs font-medium cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" />
              <span className="hidden sm:inline">التحفيظ</span>
            </button>

            <button
              type="button"
              onClick={() => setShowIndexDrawer(true)}
              className="flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-medium cursor-pointer"
            >
              <List className="w-4 h-4" />
              <span>الفهرس</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSearchBar((s) => !s)}
              aria-label="البحث داخل الآيات"
              aria-pressed={showSearchBar}
              className={`min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl border cursor-pointer ${
                showSearchBar
                  ? 'bg-[#C8A253]/20 border-[#C8A253] text-[#C8A253]'
                  : 'bg-white/5 border-white/10 text-[#F5F3EE] hover:bg-white/10'
              }`}
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Quick Theme Switcher */}
            <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-[#0A0D0C] border border-white/10">
              <button
                type="button"
                onClick={() => handleThemeChange('obsidian')}
                aria-label="الوضع الليلي الفحمي"
                title="ليلي فحمي"
                className={`p-1.5 rounded-lg cursor-pointer ${
                  paperTheme === 'obsidian' ? 'bg-[#0E6B4D] text-white' : 'text-[#A9B2AE] hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('parchment')}
                aria-label="وضع الورق الكريمي"
                title="ورق المصحف الكريمي"
                className={`p-1.5 rounded-lg cursor-pointer ${
                  paperTheme === 'parchment' ? 'bg-[#C8A253] text-[#0A0D0C]' : 'text-[#A9B2AE] hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange('emerald')}
                aria-label="الوضع الزمردي الهادئ"
                title="زمردي هادئ"
                className={`px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer ${
                  paperTheme === 'emerald' ? 'bg-[#178A64] text-white' : 'text-[#A9B2AE] hover:text-white'
                }`}
              >
                زمردي
              </button>
            </div>
          </div>
        </div>
      </header>

      <main
        className={`max-w-5xl w-full mx-auto px-3 sm:px-6 pt-4 sm:pt-6 space-y-5 flex-1 ${
          currentTrack ? 'pb-44 md:pb-40' : 'pb-24'
        }`}
      >
        {/* Compact Standalone Control Bar */}
        <section className="glass-panel rounded-2xl p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Mode Tabs: Printed Page (Default), Surah, Juz */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0A0D0C] border border-white/10">
              {[
                { id: 'page' as const, label: 'صفحات المصحف (٦٠٤)' },
                { id: 'surah' as const, label: 'السور (١١٤)' },
                { id: 'juz' as const, label: 'الأجزاء (٣٠)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMode(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    mode === tab.id ? 'bg-[#0E6B4D] text-white' : 'text-[#A9B2AE] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Selectors + Font Size + Quick Recitation */}
            <div className="flex flex-wrap items-center gap-2 flex-1 sm:justify-end">
              {mode === 'page' && (
                <select
                  aria-label="اختر رقم الصفحة"
                  value={pageNum}
                  onChange={(e) => setPageNum(Number(e.target.value))}
                  className="px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs sm:text-sm text-[#F5F3EE]"
                >
                  {Array.from({ length: 604 }, (_, idx) => idx + 1).map((p) => (
                    <option key={p} value={p}>
                      صفحة {toArabicDigits(p)}
                    </option>
                  ))}
                </select>
              )}

              {mode === 'surah' && (
                <select
                  aria-label="اختر السورة"
                  value={surahNum}
                  onChange={(e) => setSurahNum(Number(e.target.value))}
                  className="px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs sm:text-sm text-[#F5F3EE] max-w-[210px]"
                >
                  {QURAN_META.surahs.map((s) => (
                    <option key={s.number} value={s.number}>
                      {toArabicDigits(s.number)}. {s.name}
                    </option>
                  ))}
                </select>
              )}

              {mode === 'juz' && (
                <select
                  aria-label="اختر الجزء"
                  value={juzNum}
                  onChange={(e) => setJuzNum(Number(e.target.value))}
                  className="px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs sm:text-sm text-[#F5F3EE]"
                >
                  {Array.from({ length: 30 }, (_, idx) => idx + 1).map((j) => (
                    <option key={j} value={j}>
                      الجزء {toArabicDigits(j)}
                    </option>
                  ))}
                </select>
              )}

              {/* Font Size Control */}
              <div className="flex items-center gap-0.5 bg-[#0A0D0C] border border-white/10 rounded-xl px-1.5 py-0.5">
                <button
                  type="button"
                  onClick={() => handleFontDelta(-2)}
                  aria-label="تصغير خط المصحف"
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
                  aria-label="تكبير خط المصحف"
                  className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[#F5F3EE] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Reciter Selector + Play Audio for Active Surah */}
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="اختر القارئ للاستماع"
                  value={selectedReciterId}
                  onChange={(e) => setSelectedReciterId(e.target.value)}
                  className="px-2.5 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE] max-w-[175px] sm:max-w-[240px]"
                >
                  {reciters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nameAr}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const rec = reciters.find((r) => r.id === selectedReciterId) || reciters[0];
                    if (!rec) return;
                    const availableHere = rec.collections.some((c) =>
                      isSurahAvailableInCollection(c, activeSurahNumber)
                    );
                    if (availableHere) {
                      playSurahByReciter(rec, activeSurahNumber);
                    } else {
                      const fallbackSurah = getDefaultPlayableSurahNumber(rec);
                      notify(
                        `${activeSurahName} غير مدرجة بأرشيف ${rec.nameAr} — تم بدء الاستماع من السورة المتاحة`,
                        'info'
                      );
                      playSurahByReciter(rec, fallbackSurah);
                    }
                  }}
                  aria-label="الاستماع للسورة الحالية"
                  className="flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-medium cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>استماع</span>
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Theme Row */}
          <div className="flex sm:hidden items-center justify-between pt-2 border-t border-white/10 text-xs">
            <span className="text-[#A9B2AE]">مظهر المصحف:</span>
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'obsidian', label: 'داكن' },
                  { id: 'parchment', label: 'ورق المصحف' },
                  { id: 'emerald', label: 'زمردي' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleThemeChange(t.id)}
                  className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                    paperTheme === t.id
                      ? 'bg-[#C8A253] text-[#0A0D0C] font-semibold'
                      : 'bg-white/5 text-[#A9B2AE]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Expandable Inline Quranic Search */}
          {showSearchBar && (
            <div className="pt-2 border-t border-white/10 space-y-2.5">
              <form onSubmit={(e) => void handleQuranSearch(e)} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#A9B2AE] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث داخل آيات القرآن الكريم (مثلاً: الله نور السماوات)..."
                    aria-label="البحث في النص القرآني"
                    className="w-full pr-10 pl-4 py-2 rounded-xl bg-[#0A0D0C] border border-white/10 text-xs sm:text-sm text-[#F5F3EE] placeholder:text-[#A9B2AE]/60 focus:outline-none focus:border-[#C8A253]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs text-white cursor-pointer whitespace-nowrap"
                >
                  {searching ? 'جاري البحث...' : 'بحث'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="bg-[#0A0D0C]/90 rounded-xl p-3 border border-[#C8A253]/25 space-y-2 max-h-56 overflow-y-auto">
                  <div className="flex items-center justify-between text-xs text-[#C8A253] px-1">
                    <span>نتائج البحث ({toArabicDigits(searchResults.length)})</span>
                    <button
                      type="button"
                      onClick={() => setSearchResults([])}
                      className="text-[#A9B2AE] hover:text-white cursor-pointer"
                    >
                      إغلاق النتائج
                    </button>
                  </div>
                  {searchResults.map((m) => (
                    <button
                      key={m.number}
                      type="button"
                      onClick={() => {
                        setMode('surah');
                        setSurahNum(m.surahNumber);
                        setSearchResults([]);
                        setShowSearchBar(false);
                      }}
                      className="w-full text-right p-2.5 rounded-lg hover:bg-white/5 border-b border-white/5 last:border-b-0 cursor-pointer"
                    >
                      <p className="font-quran text-base text-[#F5F3EE]">{m.text}</p>
                      <p className="text-[11px] text-[#C8A253] mt-1">
                        {m.surahName} · الآية {toArabicDigits(m.numberInSurah)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Selected Ayah Action Bar (Play Ayah / Tafseer / Copy / Share / Favorite / Bookmark Position) */}
        {selectedAyah && (
          <div
            role="region"
            aria-label="خيارات الآية المحددة"
            className="glass-gold rounded-2xl p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-[#F5F3EE]">
                الآية المحددة: <span className="text-[#C8A253]">{selectedAyah.surahName}</span> · رقم{' '}
                {toArabicDigits(selectedAyah.numberInSurah)} (صفحة {toArabicDigits(selectedAyah.page)})
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleAyahAudio(selectedAyah)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs cursor-pointer ${
                    ayahAudioPlaying
                      ? 'bg-[#C8A253] text-[#0A0D0C] font-bold'
                      : 'bg-[#0E6B4D]/35 hover:bg-[#0E6B4D]/55 border border-[#0E6B4D] text-[#F5F3EE]'
                  }`}
                >
                  {ayahAudioPlaying ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-[#C8A253]" />
                  )}
                  <span>{ayahAudioPlaying ? 'إيقاف الآية' : 'استمع للآية'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleTafseer(selectedAyah)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs cursor-pointer ${
                    tafseerOpen
                      ? 'bg-[#C8A253]/25 border border-[#C8A253] text-[#C8A253]'
                      : 'bg-white/5 hover:bg-white/10 text-[#F5F3EE]'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#C8A253]" />
                  <span>التفسير الميسر</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyAyah(selectedAyah)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#F5F3EE] cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-[#C8A253]" />
                  <span>نسخ</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleShareAyah(selectedAyah)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#F5F3EE] cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#C8A253]" />
                  <span>مشاركة</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void toggleFavorite({
                      id: `ayah_${selectedAyah.surahNumber}_${selectedAyah.numberInSurah}`,
                      type: 'ayah',
                      targetId: `ayah_${selectedAyah.surahNumber}_${selectedAyah.numberInSurah}`,
                      title: selectedAyah.text.slice(0, 180),
                      subtitle: `${selectedAyah.surahName} · آية ${toArabicDigits(
                        selectedAyah.numberInSurah
                      )}`,
                      surahNumber: selectedAyah.surahNumber,
                      ayahNumber: selectedAyah.numberInSurah,
                    })
                  }
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#F5F3EE] cursor-pointer"
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${isSelectedAyahFav ? 'fill-[#C8A253] text-[#C8A253]' : ''}`}
                  />
                  <span>{isSelectedAyahFav ? 'محفوظة' : 'حفظ الآية'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void saveReadingPosition(
                      selectedAyah.surahNumber,
                      selectedAyah.page,
                      selectedAyah.numberInSurah
                    );
                    notify('تم حفظ موضع القراءة الحالي', 'success');
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs text-white cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>حفظ موضع القراءة</span>
                </button>
              </div>
            </div>

            {tafseerOpen && (
              <div className="pt-3 border-t border-[#C8A253]/25 space-y-1.5">
                <p className="text-[11px] font-semibold text-[#C8A253]">
                  التفسير الميسر — {selectedAyah.surahName} (الآية {toArabicDigits(selectedAyah.numberInSurah)}):
                </p>
                {tafseerLoading ? (
                  <p className="text-xs text-[#A9B2AE]">جارٍ تحميل التفسير...</p>
                ) : (
                  <p className="text-xs sm:text-sm text-[#F5F3EE] leading-relaxed">{tafseerText}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Authentic Continuous Uthmani Mushaf Page Canvas — ZERO Artificial Justification / Word Stretching */}
        <section
          className={`${frameClass} rounded-3xl p-5 sm:p-10 md:p-14 min-h-[540px]`}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            if (touch) {
              touchStartRef.current = { x: touch.clientX, y: touch.clientY };
            }
          }}
          onTouchEnd={(e) => {
            const start = touchStartRef.current;
            touchStartRef.current = null;
            if (!start) return;
            const selectedText = window.getSelection?.()?.toString().trim();
            if (selectedText) return;
            const touch = e.changedTouches[0];
            if (!touch) return;
            const dx = touch.clientX - start.x;
            const dy = touch.clientY - start.y;
            if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) {
              stepNavigation(dx > 0 ? 'next' : 'prev');
            }
          }}
        >
          {/* Top Page Running Header (like Printed Madinah Mushaf) */}
          {!loading && !error && (
            <div
              className={`flex items-center justify-between gap-2 text-xs pb-4 mb-6 border-b ${
                isParchment ? 'border-[#9E7E3C]/25' : 'border-[#C8A253]/20'
              } ${mutedTextColor}`}
            >
              <span className="truncate">
                الجزء {toArabicDigits(activeJuzNumber)}
                {activeHizbLabel ? ` · ${activeHizbLabel}` : ''}
              </span>
              <span className={`font-semibold shrink-0 ${goldAccentColor}`}>{activeSurahName}</span>
              <span className="shrink-0">صفحة {toArabicDigits(activePageNumber)}</span>
            </div>
          )}

          {loading ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-[#C8A253]/30 border-t-[#C8A253] rounded-full animate-spin mx-auto" />
              <p className="text-sm text-[#A9B2AE]">
                جاري تحميل مصحف المدينة المنورة بالرسم العثماني...
              </p>
            </div>
          ) : error ? (
            <div className="py-20 text-center space-y-4">
              <p className="text-sm text-rose-400">{error}</p>
              <button
                type="button"
                onClick={() => setReloadNonce((n) => n + 1)}
                className="px-5 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs cursor-pointer"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {surahSections.map((section) => {
                const showBismillah =
                  section.surahNumber !== 1 &&
                  section.surahNumber !== 9 &&
                  section.ayahs[0]?.numberInSurah === 1;

                return (
                  <div key={section.surahNumber} className="space-y-5">
                    {/* Ornate Surah Banner */}
                    <div className={`py-2.5 px-6 rounded-2xl border text-center ${bannerClass}`}>
                      <h2 className={`font-display text-2xl sm:text-3xl font-bold ${goldAccentColor}`}>
                        {section.surahName}
                      </h2>
                    </div>

                    {showBismillah && (
                      <p
                        className={`font-quran text-center ${ayahTextColor}`}
                        style={{
                          fontSize: `${Math.max(22, fontSize - 2)}px`,
                          wordSpacing: 'normal',
                          letterSpacing: 0,
                        }}
                      >
                        بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                      </p>
                    )}

                    {/* Continuous Flowing Uthmani Script — Natural text-right without text-justify stretching */}
                    <div
                      className={`font-quran ${ayahTextColor} text-right leading-[2.25]`}
                      style={{
                        fontSize: `${fontSize}px`,
                        wordSpacing: 'normal',
                        letterSpacing: 0,
                      }}
                      dir="rtl"
                    >
                      {section.ayahs.map((ayah) => {
                        const cleanText = stripLeadingBismillah(
                          ayah.text,
                          ayah.surahNumber,
                          ayah.numberInSurah
                        );
                        const isSelected = selectedAyah?.number === ayah.number;
                        return (
                          <React.Fragment key={ayah.number}>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedAyah(ayah)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setSelectedAyah(ayah);
                                }
                              }}
                              className={`inline transition-colors rounded px-0.5 cursor-pointer ${
                                isSelected
                                  ? isParchment
                                    ? 'bg-[#0E6B4D]/20 text-[#0B3B2B]'
                                    : 'bg-[#0E6B4D]/35 text-[#F5F3EE]'
                                  : isParchment
                                  ? 'hover:bg-[#C8A253]/15'
                                  : 'hover:bg-white/5'
                              }`}
                            >
                              {cleanText}
                              <span
                                className={`${goldAccentColor} select-none mx-0.5 inline-block text-[0.82em]`}
                              >
                                ﴿{toArabicDigits(ayah.numberInSurah)}﴾
                              </span>
                            </span>{' '}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Prev / Next Mushaf Page Navigation */}
          <div
            className={`mt-10 pt-5 border-t ${
              isParchment ? 'border-[#9E7E3C]/25' : 'border-white/10'
            } flex items-center justify-between gap-4`}
          >
            <button
              type="button"
              onClick={() => stepNavigation('prev')}
              className={`flex items-center gap-2 min-h-[44px] px-4 sm:px-5 py-2.5 rounded-xl border text-xs sm:text-sm cursor-pointer ${
                isParchment
                  ? 'bg-[#EFE6D2] hover:bg-[#E5D8BC] border-[#9E7E3C]/35 text-[#1B1915]'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-[#F5F3EE]'
              }`}
            >
              <ChevronRight className={`w-4 h-4 ${goldAccentColor}`} />
              <span>
                {mode === 'page'
                  ? 'الصفحة السابقة'
                  : mode === 'surah'
                  ? 'السورة السابقة'
                  : 'الجزء السابق'}
              </span>
            </button>

            <div className={`text-[11px] ${mutedTextColor} hidden sm:flex items-center gap-1.5`}>
              <span>مصحف المدينة العثماني</span>
              <span>·</span>
              <span dir="ltr" className="inline-flex items-center gap-1 font-medium">
                <BadgeCheck className={`w-3.5 h-3.5 ${goldAccentColor}`} />
                <span>{DEVELOPER_NAME}</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => stepNavigation('next')}
              className="flex items-center gap-2 min-h-[44px] px-4 sm:px-5 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs sm:text-sm text-white cursor-pointer"
            >
              <span>
                {mode === 'page'
                  ? 'الصفحة التالية'
                  : mode === 'surah'
                  ? 'السورة التالية'
                  : 'الجزء التالي'}
              </span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>

      {/* Standalone Floating Bottom Page-Turn Dock (Always reachable with one thumb tap) */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 z-30 transition-all ${
          currentTrack ? 'bottom-[92px] sm:bottom-[96px]' : 'bottom-4'
        }`}
      >
        <div className="glass-panel border border-[#C8A253]/30 rounded-full px-2 py-1.5 shadow-2xl flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => stepNavigation('prev')}
            aria-label="السابق"
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs font-medium text-[#F5F3EE] cursor-pointer whitespace-nowrap"
          >
            <ChevronRight className="w-3.5 h-3.5 text-[#C8A253]" />
            <span>السابقة</span>
          </button>

          <button
            type="button"
            onClick={() => setShowIndexDrawer(true)}
            className="px-3 py-1.5 rounded-full bg-[#0A0D0C]/80 border border-white/10 text-[11px] font-mono-nums text-[#C8A253] cursor-pointer whitespace-nowrap"
            title="فتح الفهرس والانتقال السريع"
          >
            {mode === 'page'
              ? `صفحة ${toArabicDigits(activePageNumber)} / ٦٠٤`
              : mode === 'surah'
              ? activeSurahName
              : `الجزء ${toArabicDigits(activeJuzNumber)} / ٣٠`}
          </button>

          <button
            type="button"
            onClick={() => stepNavigation('next')}
            aria-label="التالي"
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#0E6B4D] hover:bg-[#178A64] text-xs font-medium text-white cursor-pointer whitespace-nowrap"
          >
            <span>التالية</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Standalone Mushaf Index (Fihris) Drawer */}
      {showIndexDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="فهرس المصحف الشريف"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-start"
        >
          <div className="w-full max-w-md bg-[#0E1311] border-l border-[#C8A253]/25 h-full flex flex-col p-5 space-y-4 overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h2 className="text-lg font-display font-bold text-[#F5F3EE]">
                  فهرس المصحف الشريف
                </h2>
                <p className="text-xs text-[#A9B2AE]">
                  ١١٤ سورة · ٣٠ جزءًا · ٦٠٤ صفحات بالرسم العثماني
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIndexDrawer(false)}
                aria-label="إغلاق الفهرس"
                className="p-2 rounded-lg text-[#A9B2AE] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Jump to Last Saved Bookmark */}
            <button
              type="button"
              onClick={() => {
                setMode('page');
                setPageNum(prefs.lastReadPage || 1);
                setShowIndexDrawer(false);
              }}
              className="w-full p-3 rounded-xl bg-[#0E6B4D]/25 border border-[#0E6B4D]/45 text-right flex items-center justify-between cursor-pointer hover:bg-[#0E6B4D]/35"
            >
              <div>
                <p className="text-xs font-semibold text-[#C8A253]">آخر موضع قراءة محفوظ</p>
                <p className="text-xs text-[#F5F3EE] mt-0.5">
                  صفحة {toArabicDigits(prefs.lastReadPage || 1)} · الآية{' '}
                  {toArabicDigits(prefs.lastReadAyah || 1)}
                </p>
              </div>
              <Bookmark className="w-4 h-4 text-[#C8A253]" />
            </button>

            {/* Quick Page Number Jump */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsed = Number(quickJumpPage.trim());
                if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 604) {
                  setMode('page');
                  setPageNum(parsed);
                  setQuickJumpPage('');
                  setShowIndexDrawer(false);
                } else {
                  notify('أدخل رقم صفحة صحيح من 1 إلى 604', 'info');
                }
              }}
              className="flex gap-2"
            >
              <input
                type="number"
                min={1}
                max={604}
                value={quickJumpPage}
                onChange={(e) => setQuickJumpPage(e.target.value)}
                placeholder="انتقال سريع لصفحة (١ - ٦٠٤)..."
                aria-label="انتقال سريع برقم الصفحة"
                className="flex-1 px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/10 text-xs text-[#F5F3EE] placeholder:text-[#A9B2AE]/60 focus:outline-none focus:border-[#C8A253]"
              />
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-[#C8A253] hover:bg-[#D8B568] text-[#0A0D0C] text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                انتقال
              </button>
            </form>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIndexTab('surahs')}
                className={`flex-1 py-2 rounded-xl text-xs font-medium cursor-pointer ${
                  indexTab === 'surahs' ? 'bg-[#0E6B4D] text-white' : 'bg-white/5 text-[#A9B2AE]'
                }`}
              >
                السور (١١٤)
              </button>
              <button
                type="button"
                onClick={() => setIndexTab('juzs')}
                className={`flex-1 py-2 rounded-xl text-xs font-medium cursor-pointer ${
                  indexTab === 'juzs' ? 'bg-[#0E6B4D] text-white' : 'bg-white/5 text-[#A9B2AE]'
                }`}
              >
                الأجزاء (٣٠)
              </button>
            </div>

            {indexTab === 'surahs' ? (
              <>
                <input
                  type="search"
                  value={indexFilter}
                  onChange={(e) => setIndexFilter(e.target.value)}
                  placeholder="ابحث باسم السورة..."
                  aria-label="تصفية فهرس السور"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0A0D0C] border border-white/10 text-xs text-[#F5F3EE] placeholder:text-[#A9B2AE]/60 focus:outline-none focus:border-[#C8A253]"
                />
                <div className="flex-1 overflow-y-auto space-y-1.5 pl-1">
                  {filteredIndexSurahs.map((s) => (
                    <button
                      key={s.number}
                      type="button"
                      onClick={() => {
                        setMode('surah');
                        setSurahNum(s.number);
                        setShowIndexDrawer(false);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#121715] hover:bg-[#171F1C] border border-white/5 hover:border-[#C8A253]/30 text-right cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-[#0A0D0C] border border-white/10 flex items-center justify-center text-xs font-mono-nums text-[#C8A253]">
                          {toArabicDigits(s.number)}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-[#F5F3EE]">{s.name}</p>
                          <p className="text-[11px] text-[#A9B2AE]">
                            {s.revelationType === 'Meccan' ? 'مكية' : 'مدنية'} ·{' '}
                            {toArabicDigits(s.numberOfAyahs)} آية
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 content-start">
                {Array.from({ length: 30 }, (_, idx) => idx + 1).map((j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => {
                      setMode('juz');
                      setJuzNum(j);
                      setShowIndexDrawer(false);
                    }}
                    className="p-3 rounded-xl bg-[#121715] hover:bg-[#171F1C] border border-white/10 hover:border-[#C8A253]/35 text-sm font-semibold text-[#F5F3EE] cursor-pointer"
                  >
                    الجزء {toArabicDigits(j)}
                  </button>
                ))}
              </div>
            )}

            {/* Verified Developer Badge inside Standalone Mushaf Drawer */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-[#A9B2AE]">
              <span>مصحف تلاوة — بدون إنترنت</span>
              <span
                dir="ltr"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0E6B4D]/20 border border-[#C8A253]/35 text-[#F5F3EE] font-semibold"
              >
                <BadgeCheck className="w-3.5 h-3.5 text-[#38BDF8] fill-[#38BDF8]/15" />
                <span>{DEVELOPER_NAME}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
