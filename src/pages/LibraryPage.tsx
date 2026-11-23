import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BadgeCheck,
  BookOpen,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Heart,
  ListMusic,
  Lock,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Shuffle,
  Trash2,
  Trophy,
} from 'lucide-react';
import { CertificateModal } from '../components/CertificateModal';
import { ReciterImage } from '../components/ReciterImage';
import { QURAN_META } from '../data/reciters';
import { useAppData } from '../contexts/AppDataContext';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAuth } from '../contexts/AuthContext';
import { useDynamicConfig } from '../contexts/DynamicConfigContext';
import type { AppRoute, AudioTrack } from '../types/tilawa';
import {
  computeListeningStreakDays,
  computeUserProgressLevel,
  evaluateCertificates,
  JUZ_NAMES_AR,
  LISTENER_STATS_EVENT,
  loadListenerStats,
  saveListenerStats,
  toggleMemorizedJuz,
  type CertificateEvaluation,
  type ListenerStatsState,
} from '../utils/certificateHelpers';
import {
  TOTAL_MUSHAF_PAGES,
  clampMushafPage,
  clampTargetDays,
  computeKhatmahStats,
  loadKhatmahState,
  markTodayWirdCompleted,
  saveKhatmahState,
  type KhatmahState,
} from '../utils/khatmahHelpers';
import {
  clampFontSize,
  formatTimeSeconds,
  getDefaultPlayableSurahNumber,
  toArabicDigits,
} from '../utils/quranHelpers';
import { calculateTahfeezStats, type TahfeezProgressMap } from '../utils/tahfeezHelpers';

interface LibraryPageProps {
  navigate: (next: AppRoute) => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({ navigate }) => {
  const { reciters, notify } = useAppData();
  const { config } = useDynamicConfig();
  const { playSurahByReciter, playCollection, playTrack } = useAudioPlayer();
  const {
    favorites,
    toggleFavorite,
    history,
    clearHistory,
    playlists,
    playlistTracks,
    createNewPlaylist,
    removePlaylist,
    removeTrackFromUserPlaylist,
    prefs,
    savePreferences,
    clearAllLocalData,
  } = useAuth();

  const [tab, setTab] = useState<
    'playlists' | 'khatmah' | 'certificates' | 'favorites' | 'history' | 'settings'
  >('playlists');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(
    () => playlists[0]?.id ?? null
  );
  const [khatmah, setKhatmah] = useState<KhatmahState>(() => loadKhatmahState());
  const [listenerStats, setListenerStats] = useState<ListenerStatsState>(() =>
    loadListenerStats()
  );
  const [selectedCertificateId, setSelectedCertificateId] = useState<
    CertificateEvaluation['id'] | null
  >(null);

  useEffect(() => {
    const syncStats = () => setListenerStats(loadListenerStats());
    window.addEventListener(LISTENER_STATS_EVENT, syncStats);
    window.addEventListener('storage', syncStats);
    return () => {
      window.removeEventListener(LISTENER_STATS_EVENT, syncStats);
      window.removeEventListener('storage', syncStats);
    };
  }, []);

  const tahfeezStats = useMemo(() => {
    try {
      const raw = localStorage.getItem('tilawa_tahfeez_progress_v1');
      const map: TahfeezProgressMap = raw ? (JSON.parse(raw) as TahfeezProgressMap) : {};
      return calculateTahfeezStats(map, QURAN_META.surahs);
    } catch {
      return { memorizedAyahs: 0, completedSurahs: 0, totalAyahs: 6236, percent: 0 };
    }
  }, [tab]);

  const certificates = useMemo(
    () =>
      evaluateCertificates({
        stats: listenerStats,
        memorizedAyahsCount: tahfeezStats.memorizedAyahs,
        completedSurahsCount: tahfeezStats.completedSurahs,
        historyCount: history.length,
        completedKhatmahsCount: khatmah.completedKhatmahs,
        config: config.certificates,
      }),
    [listenerStats, tahfeezStats, history.length, khatmah.completedKhatmahs, config.certificates]
  );

  const userLevel = useMemo(
    () =>
      computeUserProgressLevel({
        stats: listenerStats,
        memorizedAyahsCount: tahfeezStats.memorizedAyahs,
        completedSurahsCount: tahfeezStats.completedSurahs,
        historyCount: history.length,
        completedKhatmahsCount: khatmah.completedKhatmahs,
      }),
    [listenerStats, tahfeezStats, history.length, khatmah.completedKhatmahs]
  );

  const selectedCertificate = useMemo(
    () => certificates.find((c) => c.id === selectedCertificateId) || null,
    [certificates, selectedCertificateId]
  );

  const streakDays = useMemo(
    () => computeListeningStreakDays(listenerStats.activeDays),
    [listenerStats.activeDays]
  );

  const updateListenerStats = (next: ListenerStatsState) => {
    const clean = saveListenerStats(next);
    setListenerStats(clean);
  };

  const updateKhatmah = (next: KhatmahState) => {
    setKhatmah(next);
    saveKhatmahState(next);
  };

  const khatmahStats = computeKhatmahStats(khatmah);
  const todayIso = new Date().toISOString().slice(0, 10);
  const doneToday = khatmah.lastCompletedDate === todayIso;

  const favoriteReciters = favorites.filter((f) => f.type === 'reciter');
  const favoriteRecitations = favorites.filter((f) => f.type === 'recitation');
  const favoriteAyahs = favorites.filter((f) => f.type === 'ayah');

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const created = await createNewPlaylist(newPlaylistName);
    if (created) {
      setNewPlaylistName('');
      setActivePlaylistId(created.id);
    }
  };

  const buildPlaylistQueue = (playlistId: string): AudioTrack[] => {
    const tracks = playlistTracks[playlistId] || [];
    return tracks.map((t) => {
      const rec = reciters.find((r) => r.id === t.reciterId);
      return {
        id: t.id,
        reciterId: t.reciterId,
        reciterName: t.reciterName,
        reciterPhoto: rec?.photoUrl || '/images/reciters/minshawi.jpg',
        surahNumber: t.surahNumber,
        surahName: t.surahName,
        style: t.style || 'مرتل',
        audioUrl: t.audioUrl,
        isAvailable: Boolean(t.audioUrl),
      };
    });
  };

  const handlePlayPlaylist = (playlistId: string, shuffle = false) => {
    const audioQueue = buildPlaylistQueue(playlistId);
    if (audioQueue.length === 0) {
      notify('هذه القائمة فارغة حاليًا', 'info');
      return;
    }
    playCollection(audioQueue, { shuffle });
  };

  const handlePlayFavoriteRecitations = (shuffle = false) => {
    const queue: AudioTrack[] = favoriteRecitations
      .filter((f) => f.audioUrl && f.reciterId && f.surahNumber)
      .map((f) => {
        const rec = reciters.find((r) => r.id === f.reciterId);
        return {
          id: f.id,
          reciterId: f.reciterId || 'minshawi',
          reciterName: rec?.nameAr || 'قارئ القرآن',
          reciterPhoto: rec?.photoUrl || '/images/reciters/minshawi.jpg',
          surahNumber: f.surahNumber || 1,
          surahName: f.title,
          style: f.subtitle?.split('·')[1]?.trim() || 'مرتل',
          audioUrl: f.audioUrl || '',
          isAvailable: Boolean(f.audioUrl),
        };
      });
    if (queue.length === 0) {
      notify('لا توجد تلاوات مفضلة صالحة للتشغيل بعد', 'info');
      return;
    }
    playCollection(queue, { shuffle });
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
      {/* Instant Login-Free Library Banner */}
      <section className="glass-gold rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]">
            مكتبتي القرآنية
          </h1>
          <p className="text-xs sm:text-sm text-[#A9B2AE]">
            قوائمك الشخصية ومفضلتك وسجل استماعك وموضع قراءتك محفوظة تلقائيًا على جهازك — استمع وتحكم مباشرةً دون تسجيل دخول.
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0 text-center">
          <div className="px-4 py-2.5 rounded-2xl bg-[#0A0D0C]/70 border border-white/10">
            <p className="text-lg font-mono-nums font-bold text-[#C8A253]">
              {toArabicDigits(playlists.length)}
            </p>
            <p className="text-[11px] text-[#A9B2AE]">قائمة تشغيل</p>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-[#0A0D0C]/70 border border-white/10">
            <p className="text-lg font-mono-nums font-bold text-[#F5F3EE]">
              {toArabicDigits(favorites.length)}
            </p>
            <p className="text-[11px] text-[#A9B2AE]">في المفضلة</p>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-[#0A0D0C]/70 border border-white/10">
            <p className="text-lg font-mono-nums font-bold text-[#178A64]">
              {toArabicDigits(history.length)}
            </p>
            <p className="text-[11px] text-[#A9B2AE]">في السجل</p>
          </div>
        </div>
      </section>

      {/* Last Reading Position Resume */}
      <section className="glass-panel rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <BookOpen className="w-5 h-5 text-[#C8A253]" />
          <div>
            <p className="text-sm font-semibold text-[#F5F3EE]">
              آخر موضع قراءة محفوظ:{' '}
              {QURAN_META.surahs.find((s) => s.number === prefs.lastReadSurah)?.name || 'الفاتحة'}
            </p>
            <p className="text-xs text-[#A9B2AE]">
              الصفحة {toArabicDigits(prefs.lastReadPage)} · الآية {toArabicDigits(prefs.lastReadAyah)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            navigate({ page: 'mushaf', pageNum: prefs.lastReadPage })
          }
          className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-medium cursor-pointer"
        >
          فتح المصحف عند هذا الموضع
        </button>
      </section>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {[
          { id: 'playlists' as const, label: 'قوائم التشغيل', icon: <ListMusic className="w-4 h-4" /> },
          { id: 'khatmah' as const, label: 'الختمة اليومية', icon: <CalendarCheck className="w-4 h-4" /> },
          { id: 'certificates' as const, label: 'شهادات التقدير', icon: <Award className="w-4 h-4" /> },
          { id: 'favorites' as const, label: 'المفضلة', icon: <Heart className="w-4 h-4" /> },
          { id: 'history' as const, label: 'سجل الاستماع', icon: <Clock className="w-4 h-4" /> },
          { id: 'settings' as const, label: 'الإعدادات', icon: <Settings className="w-4 h-4" /> },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-medium cursor-pointer ${
              tab === t.id ? 'bg-[#0E6B4D] text-white' : 'bg-white/5 text-[#A9B2AE] hover:text-white'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Khatmah & Daily Wird Tracker Tab */}
      {tab === 'khatmah' && (
        <section className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-display font-bold text-[#F5F3EE]">
                  متابع الختمة والورد القرآني اليومي
                </h2>
                <p className="text-xs text-[#A9B2AE]">
                  حدد مدة الختمة وسيتولى النظام تقسيم صفحات المصحف الـ٦٠٤ تلقائيًا مع متابعة التزامك اليومي.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-3.5 py-2 rounded-xl bg-[#0A0D0C] border border-[#C8A253]/30 text-center">
                  <div className="flex items-center justify-center gap-1 text-[#C8A253] text-sm font-bold font-mono-nums">
                    <Flame className="w-4 h-4" />
                    <span>{toArabicDigits(khatmah.streakDays)}</span>
                  </div>
                  <p className="text-[10px] text-[#A9B2AE]">أيام متتالية</p>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-[#0A0D0C] border border-[#0E6B4D]/50 text-center">
                  <div className="text-emerald-300 text-sm font-bold font-mono-nums">
                    {toArabicDigits(khatmah.completedKhatmahs)}
                  </div>
                  <p className="text-[10px] text-[#A9B2AE]">ختمات مكتملة</p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#F5F3EE] font-medium">
                  نسبة الإنجاز الحالية: {toArabicDigits(khatmahStats.progressPercent)}٪
                </span>
                <span className="text-[#A9B2AE]">
                  صفحة {toArabicDigits(khatmah.currentPage)} من {toArabicDigits(TOTAL_MUSHAF_PAGES)} (المتبقي{' '}
                  {toArabicDigits(khatmahStats.pagesRemaining)} صفحة)
                </span>
              </div>
              <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-[#178A64] to-[#C8A253] transition-all duration-300"
                  style={{ width: `${khatmahStats.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Today's Wird Card */}
            <div className="rounded-2xl bg-[#0A0D0C]/80 border border-[#C8A253]/25 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#C8A253]">
                  ورد اليوم المقترح ({toArabicDigits(khatmahStats.dailyQuota)} صفحة يوميًا)
                </p>
                <p className="text-base font-display font-bold text-[#F5F3EE]">
                  من صفحة {toArabicDigits(khatmah.currentPage)} إلى صفحة{' '}
                  {toArabicDigits(khatmahStats.todayEndPage)}
                </p>
                <p className="text-[11px] text-[#A9B2AE]">
                  {doneToday
                    ? 'أحسنت! سجّلت إتمام وردك لهذا اليوم — يمكنك متابعة القراءة متى شئت.'
                    : `يتبقى قرابة ${toArabicDigits(khatmahStats.daysRemaining)} يومًا لإتمام الختمة بهذه الوتيرة.`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate({ page: 'mushaf', pageNum: khatmah.currentPage })}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-medium text-[#F5F3EE] cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-[#C8A253]" />
                  <span>اقرأ الورد الآن</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = markTodayWirdCompleted(khatmah, todayIso);
                    updateKhatmah(next);
                    notify(
                      next.completedKhatmahs > khatmah.completedKhatmahs
                        ? 'مبارك! أتممت الختمة كاملة تقبل الله طاعتكم'
                        : 'تم تسجيل إتمام ورد اليوم بنجاح',
                      'success'
                    );
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs font-semibold text-white cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>إتمام ورد اليوم</span>
                </button>
              </div>
            </div>

            {/* Duration Presets & Page Sync */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/10">
              <div className="space-y-2">
                <span className="text-xs text-[#A9B2AE] block">مدة الختمة المستهدفة:</span>
                <div className="flex flex-wrap gap-2">
                  {[15, 30, 60, 90].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() =>
                        updateKhatmah({ ...khatmah, targetDays: clampTargetDays(days) })
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer ${
                        khatmah.targetDays === days
                          ? 'bg-[#C8A253] text-[#0A0D0C] font-bold'
                          : 'bg-white/5 text-[#A9B2AE] hover:text-white border border-white/10'
                      }`}
                    >
                      {toArabicDigits(days)} يومًا
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs text-[#A9B2AE] block">تعديل صفحة البداية أو المزامنة:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateKhatmah({
                        ...khatmah,
                        currentPage: clampMushafPage(prefs.lastReadPage || 1),
                      });
                      notify('تمت مزامنة الختمة مع آخر صفحة قرأتها في المصحف', 'info');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-[#F5F3EE] cursor-pointer"
                  >
                    مزامنة مع آخر صفحة ({toArabicDigits(prefs.lastReadPage || 1)})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateKhatmah({ ...khatmah, currentPage: 1 });
                      notify('تم إعادة الورد إلى الصفحة ١', 'info');
                    }}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#A9B2AE] cursor-pointer"
                  >
                    البدء من صفحة ١
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Professional Certificates Tab */}
      {tab === 'certificates' && (
        <section aria-label="شهادات التقدير القرآنية" className="space-y-6">
          {/* Recipient Personalization & Activity Overview */}
          <div className="glass-gold rounded-2xl p-6 space-y-5 border border-[#C8A253]/30">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#C8A253]">
                  <Award className="w-4 h-4" />
                  <span>نظام الشهادات المعتمدة من منصة تلاوة</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F5F3EE]">
                  شهادات تقدير الحفظ والمواظبة على سماع القرآن الكريم
                </h2>
                <p className="text-xs sm:text-sm text-[#A9B2AE] max-w-2xl">
                  تُمنح شهادات التقدير المعتمدة عند الوصول إلى <strong className="text-[#C8A253]">المستوى المطلوب</strong> وإتمام شرط الشهادة، مع إمكانية كتابة اسمك وتحميلها بصيغة PNG أو PDF.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0 text-center">
                <div className="px-3 py-2.5 rounded-xl bg-[#0A0D0C]/80 border border-[#C8A253]/35">
                  <p className="text-base sm:text-lg font-mono-nums font-bold text-[#C8A253]">
                    {toArabicDigits(userLevel.level)} / ١٠
                  </p>
                  <p className="text-[10px] text-[#A9B2AE]">المستوى الحالي</p>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-[#0A0D0C]/80 border border-white/10">
                  <p className="text-base sm:text-lg font-mono-nums font-bold text-emerald-300">
                    {toArabicDigits(userLevel.xp)}
                  </p>
                  <p className="text-[10px] text-[#A9B2AE]">مجموع النقاط</p>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-[#0A0D0C]/80 border border-white/10">
                  <p className="text-base sm:text-lg font-mono-nums font-bold text-[#F5F3EE]">
                    {toArabicDigits(Math.floor(listenerStats.totalListeningSeconds / 60))}
                  </p>
                  <p className="text-[10px] text-[#A9B2AE]">دقيقة استماع</p>
                </div>
                <div className="px-3 py-2.5 rounded-xl bg-[#0A0D0C]/80 border border-white/10">
                  <p className="text-base sm:text-lg font-mono-nums font-bold text-[#F5F3EE]">
                    {toArabicDigits(Math.max(1, streakDays || listenerStats.activeDays.length))}
                  </p>
                  <p className="text-[10px] text-[#A9B2AE]">أيام المداومة</p>
                </div>
              </div>
            </div>

            {/* Level Progress & XP Bar */}
            <div className="rounded-xl bg-[#0A0D0C]/80 border border-[#C8A253]/25 p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="inline-flex items-center gap-2 font-bold text-[#F5F3EE]">
                  <Trophy className="w-4 h-4 text-[#C8A253]" />
                  <span>
                    المستوى {toArabicDigits(userLevel.level)}: {userLevel.titleAr}
                  </span>
                </div>
                <span className="text-[#C8A253] font-medium">
                  {userLevel.nextLevel
                    ? `متبقٍّ ${toArabicDigits(userLevel.xpToNextLevel)} نقطة للوصول إلى المستوى ${toArabicDigits(userLevel.nextLevel)} (${userLevel.nextLevelTitleAr})`
                    : 'وصلت إلى أعلى مستوى في منصة تلاوة بحمد الله'}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-[#C8A253] to-[#178A64] transition-all duration-300"
                  style={{ width: `${userLevel.levelProgressPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-[#A9B2AE]">
                تكتسب النقاط تلقائيًا مع كل دقيقة استماع (+٥) · صفحة مصحف (+١٥) · سورة مسموعة (+٢٠) · يوم مداومة (+٤٠) · جلسة تحفيظ (+٤٥) · جزء محفوظ (+١٨٠) · ختمة كاملة (+٤٠٠).
              </p>
            </div>

            <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-end gap-3">
              <label className="flex-1 space-y-1.5 block">
                <span className="text-xs font-medium text-[#C8A253] block">
                  اسم صاحب الشهادة (يُطبع مباشرة داخل الشهادة بالخط العربي)
                </span>
                <input
                  type="text"
                  value={listenerStats.recipientName}
                  onChange={(e) =>
                    updateListenerStats({
                      ...listenerStats,
                      recipientName: e.target.value,
                    })
                  }
                  maxLength={80}
                  placeholder="اكتب اسمك الكامل هنا..."
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0A0D0C] border border-[#C8A253]/35 text-sm text-[#F5F3EE] placeholder:text-[#A9B2AE]/55 focus:outline-none focus:border-[#C8A253]"
                />
              </label>
              <button
                type="button"
                onClick={() => navigate({ page: 'tahfeez' })}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-[#F5F3EE] cursor-pointer shrink-0"
              >
                الانتقال إلى قسم التحفيظ
              </button>
            </div>
          </div>

          {/* 4 Earned / Progress Certificate Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certificates.map((cert) => (
              <article
                key={cert.id}
                className={`rounded-2xl p-5 flex flex-col justify-between gap-4 border transition-colors ${
                  cert.earned
                    ? 'glass-gold border-[#C8A253]/55'
                    : 'glass-panel border-white/10'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
                        cert.earned
                          ? 'bg-[#0E6B4D] text-white'
                          : 'bg-white/5 text-[#A9B2AE] border border-white/10'
                      }`}
                    >
                      {cert.earned ? (
                        <>
                          <BadgeCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
                          <span>مؤهلة للإصدار</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-[#C8A253]" />
                          <span>يتطلب المستوى {toArabicDigits(cert.requiredLevel)}</span>
                        </>
                      )}
                    </span>
                    <span dir="ltr" className="text-[10px] font-mono-nums text-[#C8A253]/85">
                      {cert.sealNumber}
                    </span>
                  </div>

                  <h3 className="text-base font-display font-bold text-[#F5F3EE] leading-snug">
                    {cert.titleAr}
                  </h3>
                  <p className="text-xs text-[#A9B2AE] leading-relaxed">{cert.subtitleAr}</p>

                  {/* Two-Part Unlock Criteria: Level + Activity */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
                        cert.levelMet
                          ? 'bg-emerald-950/50 border-emerald-500/35 text-emerald-300'
                          : 'bg-amber-950/40 border-[#C8A253]/30 text-amber-200'
                      }`}
                    >
                      {cert.levelMet ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Lock className="w-3 h-3" />
                      )}
                      <span>
                        المستوى المطلوب: {toArabicDigits(cert.requiredLevel)} (مستواك:{' '}
                        {toArabicDigits(cert.currentLevel)})
                      </span>
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border ${
                        cert.activityGoalMet
                          ? 'bg-emerald-950/50 border-emerald-500/35 text-emerald-300'
                          : 'bg-white/5 border-white/10 text-[#A9B2AE]'
                      }`}
                    >
                      {cert.activityGoalMet ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      <span>{cert.activityGoalMet ? 'تم شرط النشاط' : 'شرط النشاط قيد التقدم'}</span>
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#C8A253] font-medium">{cert.progressSummaryAr}</span>
                      <span className="font-mono-nums text-[#F5F3EE]">
                        {toArabicDigits(cert.progressPercent)}٪
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          cert.earned ? 'bg-[#C8A253]' : 'bg-[#0E6B4D]'
                        }`}
                        style={{ width: `${cert.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCertificateId(cert.id)}
                  className={`w-full min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    cert.earned
                      ? 'bg-[#C8A253] hover:bg-[#d6b368] text-[#0A0D0C]'
                      : 'bg-white/5 hover:bg-white/10 border border-white/15 text-[#F5F3EE]'
                  }`}
                >
                  {cert.earned ? <Award className="w-4 h-4" /> : <Lock className="w-4 h-4 text-[#C8A253]" />}
                  <span>
                    {cert.earned
                      ? 'عرض وتحميل الشهادة'
                      : `معاينة الشهادة (تفتح عند المستوى ${toArabicDigits(cert.requiredLevel)})`}
                  </span>
                </button>
              </article>
            ))}
          </div>

          {/* 30 Juz Memorization Quick Verification Checklist */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-display font-bold text-[#F5F3EE]">
                توثيق الأجزاء المحفوظة من القرآن الكريم (١ – ٣٠)
              </h3>
              <p className="text-xs text-[#A9B2AE]">
                حدّد أي جزء أتممت حفظه من كتاب الله لتفعيل شهادة التقدير الخاصة بحفظ الأجزاء فورًا وتوثيق عدد الأجزاء داخلها:
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {JUZ_NAMES_AR.map((juzName, idx) => {
                const juzNum = idx + 1;
                const checked = listenerStats.verifiedMemorizedJuzs.includes(juzNum);
                return (
                  <button
                    key={juzNum}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => updateListenerStats(toggleMemorizedJuz(listenerStats, juzNum))}
                    className={`px-3 py-2.5 rounded-xl border text-right text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      checked
                        ? 'bg-[#0E6B4D]/35 border-[#178A64] text-[#F5F3EE] font-semibold'
                        : 'bg-[#0A0D0C]/70 border-white/10 text-[#A9B2AE] hover:border-[#C8A253]/40 hover:text-white'
                    }`}
                  >
                    <span className="truncate">{juzName}</span>
                    {checked && <Check className="w-3.5 h-3.5 text-[#6EE7B7] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Playlists Tab */}
      {tab === 'playlists' && (
        <div className="space-y-6">
          <form onSubmit={(e) => void handleCreatePlaylist(e)} className="flex gap-2 max-w-lg">
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="إنشاء قائمة تشغيل جديدة (مثلاً: تلاوات المساء)"
              maxLength={120}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#121715] border border-white/15 text-sm text-[#F5F3EE] placeholder:text-[#A9B2AE]/60 focus:outline-none focus:border-[#C8A253]"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء</span>
            </button>
          </form>

          {playlists.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center text-sm text-[#A9B2AE]">
              لا توجد قوائم تشغيل شخصية بعد. أنشئ قائمتك الأولى أعلاه.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {playlists.map((pl) => {
                const tracks = playlistTracks[pl.id] || [];
                const expanded = activePlaylistId === pl.id;
                return (
                  <div key={pl.id} className="glass-panel rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setActivePlaylistId(expanded ? null : pl.id)}
                        className="text-right flex-1 min-w-0 cursor-pointer"
                      >
                        <h3 className="text-base font-semibold text-[#F5F3EE] truncate">{pl.name}</h3>
                        <p className="text-xs text-[#A9B2AE]">
                          {toArabicDigits(tracks.length)} تلاوة · اضغط لعرض التفاصيل
                        </p>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handlePlayPlaylist(pl.id, false)}
                          aria-label={`تشغيل قائمة ${pl.name}`}
                          className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePlayPlaylist(pl.id, true)}
                          aria-label={`تشغيل عشوائي لقائمة ${pl.name}`}
                          className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-[#C8A253] cursor-pointer"
                        >
                          <Shuffle className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removePlaylist(pl.id)}
                          aria-label={`حذف قائمة ${pl.name}`}
                          className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl text-rose-300 hover:bg-white/5 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="pt-3 border-t border-white/10 space-y-2">
                        {tracks.length === 0 ? (
                          <p className="text-xs text-[#A9B2AE]">
                            القائمة فارغة — أضف تلاوات إليها من صفحة أي قارئ أو من المشغل.
                          </p>
                        ) : (
                          tracks.map((t) => {
                            const rec = reciters.find((r) => r.id === t.reciterId);
                            const singleTrack: AudioTrack = {
                              id: t.id,
                              reciterId: t.reciterId,
                              reciterName: t.reciterName,
                              reciterPhoto: rec?.photoUrl || '/images/reciters/minshawi.jpg',
                              surahNumber: t.surahNumber,
                              surahName: t.surahName,
                              style: t.style || 'مرتل',
                              audioUrl: t.audioUrl,
                              isAvailable: Boolean(t.audioUrl),
                            };
                            return (
                              <div
                                key={t.id}
                                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0A0D0C]/70 hover:bg-[#0A0D0C]"
                              >
                                <button
                                  type="button"
                                  onClick={() => playTrack(singleTrack, buildPlaylistQueue(pl.id))}
                                  className="text-right flex-1 min-w-0 text-xs text-[#F5F3EE] hover:text-[#C8A253] truncate cursor-pointer"
                                >
                                  {t.surahName} — {t.reciterName}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void removeTrackFromUserPlaylist(pl.id, t.id)}
                                  aria-label={`إزالة ${t.surahName}`}
                                  className="p-1 text-rose-300 hover:text-rose-200 cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Favorites Tab */}
      {tab === 'favorites' && (
        <div className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-lg font-display font-bold text-[#C8A253]">القراء المفضلون</h2>
            {favoriteReciters.length === 0 ? (
              <p className="text-xs text-[#A9B2AE]">لم تحفظ أي قارئ في المفضلة بعد.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {favoriteReciters.map((f) => {
                  const matchedReciter = reciters.find((r) => r.id === f.reciterId);
                  return (
                    <div
                      key={f.id}
                      className="glass-panel card-interactive rounded-xl p-3.5 flex items-center justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          f.reciterId && navigate({ page: 'reciter', reciterId: f.reciterId })
                        }
                        className="flex items-center gap-3 text-right flex-1 min-w-0 cursor-pointer"
                      >
                        {matchedReciter && (
                          <ReciterImage
                            src={matchedReciter.photoUrl}
                            alt={matchedReciter.nameAr}
                            className="w-11 h-11 rounded-xl object-cover object-top border border-white/10 shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#F5F3EE] truncate">{f.title}</p>
                          <p className="text-xs text-[#A9B2AE] truncate">{f.subtitle}</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        {matchedReciter && (
                          <button
                            type="button"
                            onClick={() =>
                              playSurahByReciter(
                                matchedReciter,
                                getDefaultPlayableSurahNumber(matchedReciter)
                              )
                            }
                            aria-label={`استماع بصوت ${matchedReciter.nameAr}`}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-[#0E6B4D] hover:bg-[#178A64] text-white cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void toggleFavorite(f)}
                          aria-label={`إزالة ${f.title} من المفضلة`}
                          className="p-2 text-rose-300 hover:bg-white/5 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-display font-bold text-[#C8A253]">التلاوات المفضلة</h2>
              {favoriteRecitations.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePlayFavoriteRecitations(false)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0E6B4D] text-white text-xs cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>تشغيل الكل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePlayFavoriteRecitations(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 text-[#C8A253] text-xs cursor-pointer"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>عشوائي</span>
                  </button>
                </div>
              )}
            </div>
            {favoriteRecitations.length === 0 ? (
              <p className="text-xs text-[#A9B2AE]">لم تحفظ أي تلاوة في المفضلة بعد.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {favoriteRecitations.map((f) => (
                  <div
                    key={f.id}
                    className="glass-panel rounded-xl p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#F5F3EE] truncate">{f.title}</p>
                      <p className="text-xs text-[#A9B2AE] truncate">{f.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {f.reciterId && f.surahNumber && (
                        <button
                          type="button"
                          onClick={() => {
                            const rec = reciters.find((r) => r.id === f.reciterId);
                            const savedStyle = f.subtitle?.split('·')[1]?.trim();
                            if (rec && f.surahNumber) {
                              playSurahByReciter(rec, f.surahNumber, savedStyle);
                            }
                          }}
                          aria-label={`تشغيل ${f.title}`}
                          className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg bg-[#0E6B4D] text-white cursor-pointer"
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void toggleFavorite(f)}
                        aria-label={`حذف ${f.title}`}
                        className="p-2 text-rose-300 hover:bg-white/5 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-display font-bold text-[#C8A253]">الآيات المحفوظة</h2>
            {favoriteAyahs.length === 0 ? (
              <p className="text-xs text-[#A9B2AE]">لم تحفظ أي آية من المصحف الشريف بعد.</p>
            ) : (
              <div className="space-y-3">
                {favoriteAyahs.map((f) => (
                  <div
                    key={f.id}
                    className="glass-panel rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <button
                      type="button"
                      onClick={() => f.surahNumber && navigate({ page: 'mushaf', surah: f.surahNumber })}
                      className="text-right flex-1 min-w-0 cursor-pointer space-y-1"
                    >
                      <p className="font-quran text-lg text-[#F5F3EE]">{f.title}</p>
                      <p className="text-xs text-[#C8A253]">{f.subtitle}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleFavorite(f)}
                      aria-label="إزالة الآية من المفضلة"
                      className="p-2 text-rose-300 hover:bg-white/5 rounded-lg cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="space-y-3">
          {history.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearHistory}
                className="text-xs text-rose-300 hover:underline cursor-pointer"
              >
                مسح سجل الاستماع
              </button>
            </div>
          )}
          {history.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center text-sm text-[#A9B2AE]">
              سجل الاستماع فارغ حاليًا. ابدأ بتشغيل أي تلاوة ليُحفظ تقدمك تلقائيًا.
            </div>
          ) : (
            history.map((h) => {
              const pct =
                h.durationSeconds && h.durationSeconds > 0
                  ? Math.min(100, Math.round((h.progressSeconds / h.durationSeconds) * 100))
                  : 0;
              return (
                <div
                  key={h.id}
                  className="glass-panel rounded-xl p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-sm font-semibold text-[#F5F3EE] truncate">
                      {h.surahName} · {h.reciterName}
                    </p>
                    <p className="text-xs text-[#A9B2AE] font-mono-nums">
                      موضع التوقف: {formatTimeSeconds(h.progressSeconds)}
                      {h.style ? ` · ${h.style}` : ''}
                    </p>
                    {pct > 0 && (
                      <div className="h-1 w-full max-w-xs bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-[#C8A253]" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const rec = reciters.find((r) => r.id === h.reciterId) || reciters[0];
                      if (rec) playSurahByReciter(rec, h.surahNumber, h.style, h.progressSeconds);
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs cursor-pointer shrink-0"
                  >
                    متابعة
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div className="glass-panel rounded-2xl p-6 max-w-xl space-y-6">
          <div className="space-y-2">
            <label htmlFor="pref-font-size" className="text-sm font-medium text-[#F5F3EE] block">
              حجم خط المصحف الافتراضي ({toArabicDigits(prefs.fontSize)}px)
            </label>
            <input
              id="pref-font-size"
              type="range"
              min={18}
              max={46}
              step={2}
              value={prefs.fontSize}
              onChange={(e) =>
                void savePreferences({ fontSize: clampFontSize(Number(e.target.value)) })
              }
              className="w-full accent-[#C8A253]"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="pref-speed" className="text-sm font-medium text-[#F5F3EE] block">
              سرعة التشغيل الافتراضية ({prefs.playbackRate}x)
            </label>
            <select
              id="pref-speed"
              value={prefs.playbackRate}
              onChange={(e) => void savePreferences({ playbackRate: Number(e.target.value) })}
              className="w-full px-3 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
            >
              <option value={0.75}>0.75x (تمهل)</option>
              <option value={1}>1.0x (عادي)</option>
              <option value={1.25}>1.25x (متوسط)</option>
              <option value={1.5}>1.5x (سريع)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={clearAllLocalData}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/50 border border-rose-500/30 text-xs text-rose-200 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة ضبط المكتبة المحلية إلى الوضع الافتراضي</span>
            </button>
          </div>
        </div>
      )}
      <CertificateModal
        certificate={selectedCertificate}
        certificatesConfig={config.certificates}
        recipientName={listenerStats.recipientName}
        onRecipientNameChange={(nextName) =>
          updateListenerStats({ ...listenerStats, recipientName: nextName })
        }
        onClose={() => setSelectedCertificateId(null)}
        onDownloaded={() => notify('تم تنزيل شهادة التقدير بنجاح بارك الله فيك', 'success')}
      />
    </main>
  );
};
