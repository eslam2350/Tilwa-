import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CalendarCheck,
  Clock,
  GraduationCap,
  Heart,
  ListEnd,
  ListPlus,
  Pause,
  Play,
  Radio,
  Shuffle,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { AudioWaveBars } from '../components/AudioWaveBars';
import { ReciterImage } from '../components/ReciterImage';
import {
  HERO_AYAH,
  HERO_BACKDROP_URL,
  MOST_LISTENED_SURAH_NUMBERS,
  QURAN_META,
} from '../data/reciters';
import { useAppData } from '../contexts/AppDataContext';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAuth } from '../contexts/AuthContext';
import { useDynamicConfig } from '../contexts/DynamicConfigContext';
import type { AppRoute, AudioTrack, HomeSectionId, ReciterSchool } from '../types/tilawa';
import { computeKhatmahStats, loadKhatmahState } from '../utils/khatmahHelpers';
import {
  buildSurahAudioUrl,
  formatSurahDisplayName,
  formatTimeSeconds,
  getDefaultPlayableSurahNumber,
  toArabicDigits,
} from '../utils/quranHelpers';

interface HomePageProps {
  navigate: (next: AppRoute) => void;
  onPickPlaylistForTrack: (track: AudioTrack) => void;
}

type SchoolFilter = 'الكل' | 'المفضلون' | ReciterSchool;

export const HomePage: React.FC<HomePageProps> = ({ navigate, onPickPlaylistForTrack }) => {
  const { reciters, curatedRecitations } = useAppData();
  const {
    currentTrack,
    isPlaying,
    playSurahByReciter,
    playTrack,
    playCollection,
    togglePlayPause,
    addToQueue,
  } = useAudioPlayer();
  const { history, prefs, isFavorite, toggleFavorite } = useAuth();
  const { config } = useDynamicConfig();
  const [schoolFilter, setSchoolFilter] = useState<SchoolFilter>('الكل');

  const lastHistory = history[0] || null;
  const khatmahState = useMemo(() => loadKhatmahState(), []);
  const khatmahStats = useMemo(() => computeKhatmahStats(khatmahState), [khatmahState]);
  const mostListenedSurahs = MOST_LISTENED_SURAH_NUMBERS.map((num) =>
    QURAN_META.surahs.find((s) => s.number === num)
  ).filter((s): s is NonNullable<typeof s> => Boolean(s));

  const visibleReciters = useMemo(() => {
    if (schoolFilter === 'الكل') return reciters;
    if (schoolFilter === 'المفضلون') {
      return reciters.filter((r) => isFavorite(`reciter_${r.id}`));
    }
    return reciters.filter((r) => r.schoolAr === schoolFilter);
  }, [reciters, schoolFilter, isFavorite]);

  const favoriteReciterCount = useMemo(
    () => reciters.filter((r) => isFavorite(`reciter_${r.id}`)).length,
    [reciters, isFavorite]
  );

  const activePlayerReciter = useMemo(
    () =>
      (currentTrack && reciters.find((r) => r.id === currentTrack.reciterId)) || reciters[0],
    [currentTrack, reciters]
  );

  // Prebuilt Spotify-style Quran stations from verified reciters & servers
  const quickStations = useMemo(() => {
    const buildStationTracks = (
      specs: Array<{ reciterId: string; surahNumber: number; style: string }>
    ): AudioTrack[] => {
      return specs
        .map((spec) => {
          const rec = reciters.find((r) => r.id === spec.reciterId);
          const col = rec?.collections.find((c) => c.style === spec.style) || rec?.collections[0];
          const surah = QURAN_META.surahs.find((s) => s.number === spec.surahNumber);
          if (!rec || !col || !surah) return null;
          return {
            id: `st_${rec.id}_${col.id}_${surah.number}`,
            reciterId: rec.id,
            reciterName: rec.nameAr,
            reciterPhoto: rec.photoUrl,
            surahNumber: surah.number,
            surahName: surah.name,
            style: col.style,
            riwayah: col.riwayah,
            audioUrl: buildSurahAudioUrl(col.server, surah.number),
            isAvailable: true,
            sourceName: col.sourceName,
          } as AudioTrack;
        })
        .filter((t): t is AudioTrack => Boolean(t));
    };

    return [
      {
        id: 'station-khushu',
        title: 'دولة التلاوة المصرية الراحلة',
        subtitle: 'مصطفى إسماعيل · المنشاوي · عبد الباسط · الطبلاوي بأعذب المقامات المجودة',
        tracks: buildStationTracks([
          { reciterId: 'mustafa-ismail', surahNumber: 12, style: 'مجود' },
          { reciterId: 'minshawi', surahNumber: 19, style: 'مجود' },
          { reciterId: 'abdulbasit', surahNumber: 36, style: 'مجود' },
          { reciterId: 'tablawi', surahNumber: 55, style: 'مجود' },
        ]),
      },
      {
        id: 'station-haramain',
        title: 'رحاب الحرمين الشريفين',
        subtitle: 'علي جابر · السديس · الشريم · المعيقلي · الدوسري من المسجد الحرام',
        tracks: buildStationTracks([
          { reciterId: 'ali-jaber', surahNumber: 36, style: 'مرتل' },
          { reciterId: 'sudais', surahNumber: 50, style: 'مرتل' },
          { reciterId: 'muaiqly', surahNumber: 18, style: 'مرتل' },
          { reciterId: 'dosari', surahNumber: 25, style: 'مرتل' },
        ]),
      },
      {
        id: 'station-nabawi',
        title: 'نفحات المسجد النبوي الشريف',
        subtitle: 'محمد أيوب · الحذيفي · صلاح البدير · عبد المحسن القاسم',
        tracks: buildStationTracks([
          { reciterId: 'ayyub', surahNumber: 18, style: 'مجود' },
          { reciterId: 'hudhaifi', surahNumber: 2, style: 'مرتل' },
          { reciterId: 'budair', surahNumber: 55, style: 'مرتل' },
          { reciterId: 'qasim', surahNumber: 67, style: 'مرتل' },
        ]),
      },
      {
        id: 'station-friday',
        title: 'مختارات يوم الجمعة المبارك',
        subtitle: 'الكهف · الجمعة · المنافقون · الأعلى بأصوات خاشعة متتابعة',
        tracks: buildStationTracks([
          { reciterId: 'husary', surahNumber: 18, style: 'مرتل' },
          { reciterId: 'alafasy', surahNumber: 62, style: 'مرتل' },
          { reciterId: 'abdullah-kamel', surahNumber: 63, style: 'مرتل' },
          { reciterId: 'ghamdi', surahNumber: 87, style: 'مرتل' },
        ]),
      },
      {
        id: 'station-radio',
        title: 'نوادر التراث الإذاعي الخالد',
        subtitle: 'الشيخ محمد رفعت · البنا · شعبان الصياد · علي حجاج السويسي',
        tracks: buildStationTracks([
          { reciterId: 'refaat', surahNumber: 19, style: 'حفل إذاعي' },
          { reciterId: 'banna', surahNumber: 55, style: 'مجود' },
          { reciterId: 'shaban-sayyad', surahNumber: 12, style: 'مرتل' },
          { reciterId: 'ali-souissi', surahNumber: 36, style: 'مرتل' },
        ]),
      },
      {
        id: 'station-teaching',
        title: 'المصحف المعلم والقراءات العشر',
        subtitle: 'د. أيمن سويد · الحصري المعلم · المنشاوي المعلم · العيون الكوشي (ورش)',
        tracks: buildStationTracks([
          { reciterId: 'ayman-suwaid', surahNumber: 1, style: 'معلم' },
          { reciterId: 'minshawi', surahNumber: 78, style: 'معلم' },
          { reciterId: 'kushite', surahNumber: 50, style: 'مرتل' },
          { reciterId: 'alzain', surahNumber: 18, style: 'مرتل' },
        ]),
      },
    ];
  }, [reciters]);

  const handleStartListening = () => {
    if (lastHistory) {
      const r = reciters.find((item) => item.id === lastHistory.reciterId) || reciters[0];
      if (r) {
        playSurahByReciter(r, lastHistory.surahNumber, lastHistory.style, lastHistory.progressSeconds);
        return;
      }
    }
    const minshawi = reciters[0];
    if (minshawi) {
      playSurahByReciter(minshawi, 1, 'مرتل');
    }
  };

  const sectionNodes: Record<HomeSectionId, React.ReactNode> = {
    hero: (
      <section className="relative overflow-hidden rounded-3xl border border-[#C8A253]/30 bg-[#0C110F] shadow-2xl">
        <img
          src={config.images.heroBackdropUrl || HERO_BACKDROP_URL}
          alt="محراب ومصحف شريف بإضاءة هادئة"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (img.dataset.fallbackApplied === '1') {
              img.style.display = 'none';
              return;
            }
            img.dataset.fallbackApplied = '1';
            img.src = HERO_BACKDROP_URL;
          }}
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-l from-[#080B0A]/95 via-[#090D0C]/82 to-[#0A0D0C]/45"
        />
        <div aria-hidden="true" className="sanctuary-hairline absolute top-0 inset-x-0" />

        <div className="relative z-10 p-6 sm:p-10 lg:p-14 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#C8A253] font-medium">
              <span aria-hidden="true" className="w-6 h-px bg-[#C8A253]/70 inline-block" />
              <span>{config.texts.heroBadge}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[2.85rem] font-display font-bold text-[#F5F3EE] leading-[1.3] text-balance">
              {config.texts.heroTitle}
            </h1>

            <p className="text-sm sm:text-base text-[#A9B2AE] leading-relaxed max-w-2xl">
              {config.texts.heroSubtitle}
            </p>

            <p className="text-xs text-[#C8A253]/90 font-medium">
              {toArabicDigits(reciters.length)} قارئًا · {toArabicDigits(114)} سورة ·{' '}
              {toArabicDigits(604)} صفحات بالرسم العثماني دون إنترنت
            </p>

            {/* Primary CTA + Secondary Entry */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleStartListening}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 min-h-[48px] px-5 sm:px-6 py-3 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] border border-[#178A64]/45 text-[#F5F3EE] text-sm font-semibold shadow-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current shrink-0" />
                <span>{config.texts.ctaListenLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'mushaf', pageNum: prefs.lastReadPage })}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 min-h-[48px] px-5 sm:px-6 py-3 rounded-xl bg-[#121816]/85 hover:bg-white/10 border border-white/15 text-[#F5F3EE] text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 text-[#C8A253] shrink-0" />
                <span>{config.texts.ctaMushafLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'tahfeez' })}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 min-h-[48px] px-5 sm:px-6 py-3 rounded-xl bg-[#C8A253]/15 hover:bg-[#C8A253]/25 border border-[#C8A253]/40 text-[#F5F3EE] text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                <GraduationCap className="w-4 h-4 text-[#C8A253] shrink-0" />
                <span>{config.texts.ctaTahfeezLabel}</span>
              </button>
            </div>
          </div>

          {/* Curated Quranic Verse Sanctuary Frame */}
          <div className="lg:col-span-5">
            <div className="glass-gold rounded-2xl p-6 sm:p-8 space-y-5 text-center border border-[#C8A253]/30">
              <div className="flex items-center justify-center gap-3 text-xs text-[#C8A253] font-medium">
                <span aria-hidden="true" className="w-5 h-px bg-[#C8A253]/50" />
                <span>آية قرآنية مختارة</span>
                <span aria-hidden="true" className="w-5 h-px bg-[#C8A253]/50" />
              </div>
              <blockquote className="font-quran text-2xl sm:text-[28px] leading-[2.15] text-[#F5F3EE]">
                ﴿ {HERO_AYAH.text} ﴾
              </blockquote>
              <div className="sanctuary-hairline w-full" aria-hidden="true" />
              <div className="flex items-center justify-between text-xs text-[#A9B2AE]">
                <span>
                  {HERO_AYAH.surahName} · الآية {toArabicDigits(HERO_AYAH.ayahNumber)}
                </span>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'mushaf', surah: HERO_AYAH.surahNumber })}
                  className="text-[#C8A253] hover:underline font-medium cursor-pointer"
                >
                  اقرأ السورة كاملة
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    ),
    continue: (
      <section aria-labelledby="continue-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="continue-heading" className="text-xl sm:text-2xl font-display font-bold text-[#F5F3EE]">
            متابعة آخر استماع وقراءة
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="glass-panel card-interactive rounded-2xl p-5 flex items-center justify-between gap-4">
            {lastHistory ? (
              <>
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-[#0E6B4D]/25 border border-[#0E6B4D]/45 flex items-center justify-center text-[#C8A253] shrink-0">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-[#F5F3EE] truncate">
                      {lastHistory.surahName} · {lastHistory.reciterName}
                    </p>
                    <p className="text-xs text-[#A9B2AE] font-mono-nums">
                      توقفت عند {formatTimeSeconds(lastHistory.progressSeconds)}
                      {lastHistory.style ? ` · ${lastHistory.style}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const reciter =
                      reciters.find((r) => r.id === lastHistory.reciterId) || reciters[0];
                    if (reciter) {
                      playSurahByReciter(
                        reciter,
                        lastHistory.surahNumber,
                        lastHistory.style,
                        lastHistory.progressSeconds
                      );
                    }
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-medium shrink-0 cursor-pointer"
                >
                  متابعة
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-[#0E6B4D]/25 border border-[#0E6B4D]/45 flex items-center justify-center text-[#C8A253] shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-[#F5F3EE]">ابدأ جلستك الأولى</p>
                    <p className="text-xs text-[#A9B2AE]">
                      سورة الفاتحة بصوت الشيخ محمد صديق المنشاوي
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => reciters[0] && playSurahByReciter(reciters[0], 1, 'مرتل')}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-medium shrink-0 cursor-pointer"
                >
                  تشغيل
                </button>
              </>
            )}
          </div>

          <div className="glass-panel card-interactive rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[#C8A253]/15 border border-[#C8A253]/30 flex items-center justify-center text-[#C8A253] shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-[#F5F3EE] truncate">
                  آخر موضع قراءة في المصحف
                </p>
                <p className="text-xs text-[#A9B2AE]">
                  {QURAN_META.surahs.find((s) => s.number === prefs.lastReadSurah)?.name ||
                    'سُورَةُ ٱلْفَاتِحَةِ'}{' '}
                  · الصفحة {toArabicDigits(prefs.lastReadPage)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                navigate({
                  page: 'mushaf',
                  pageNum: prefs.lastReadPage,
                })
              }
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-[#F5F3EE] text-xs font-medium shrink-0 cursor-pointer"
            >
              متابعة القراءة
            </button>
          </div>

          <div className="glass-gold card-interactive rounded-2xl p-5 flex items-center justify-between gap-4 md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[#C8A253]/15 border border-[#C8A253]/35 flex items-center justify-center text-[#C8A253] shrink-0">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-[#F5F3EE] truncate">
                  ورد الختمة اليومي ({toArabicDigits(khatmahStats.progressPercent)}٪)
                </p>
                <p className="text-xs text-[#A9B2AE]">
                  من ص {toArabicDigits(khatmahState.currentPage)} إلى {toArabicDigits(khatmahStats.todayEndPage)} ·{' '}
                  {toArabicDigits(khatmahStats.dailyQuota)} صفحة يوميًا
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate({ page: 'mushaf', pageNum: khatmahState.currentPage })}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#C8A253] hover:bg-[#d6b368] text-[#0A0D0C] text-xs font-bold shrink-0 cursor-pointer"
            >
              افتح الورد
            </button>
          </div>
        </div>
      </section>
    ),
    stations: (
      <section aria-labelledby="stations-heading" className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 id="stations-heading" className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]">
              قوائم استماع جاهزة — إذاعة تلاوة
            </h2>
            <p className="text-xs sm:text-sm text-[#A9B2AE]">
              ٦ باقات إذاعية متتابعة وعشوائية تضم أعلام المدرسة المصرية وأئمة الحرمين بضغطة واحدة
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickStations.map((st, idx) => (
            <div
              key={st.id}
              className="glass-gold card-interactive rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-[#C8A253]/55"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#0E6B4D]/25 border border-[#0E6B4D]/45 flex items-center justify-center text-[#C8A253]">
                    <Radio className="w-5 h-5" />
                  </div>
                  <span className="font-mono-nums text-xs text-[#C8A253]/80">
                    {toArabicDigits(idx + 1).padStart(2, '٠')}
                  </span>
                </div>
                <h3 className="text-base font-display font-bold text-[#F5F3EE]">{st.title}</h3>
                <p className="text-xs text-[#A9B2AE] leading-relaxed">{st.subtitle}</p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => playCollection(st.tracks, { shuffle: false })}
                  className="flex-1 flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-semibold cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>تشغيل القائمة</span>
                </button>
                <button
                  type="button"
                  onClick={() => playCollection(st.tracks, { shuffle: true })}
                  aria-label={`تشغيل عشوائي لقائمة ${st.title}`}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#C8A253] cursor-pointer"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    ),
    reciters: (
      <section aria-labelledby="reciters-heading" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 id="reciters-heading" className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]">
              أعلام التلاوة ({toArabicDigits(reciters.length)} قارئًا)
            </h2>
            <p className="text-xs sm:text-sm text-[#A9B2AE]">
              مكتبة متكاملة تضم الشيوخ المصريين الراحلين وكبار قراء مصر وأئمة الحرمين والعالم الإسلامي
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'reciters' })}
            className="flex items-center gap-1.5 text-xs sm:text-sm text-[#C8A253] hover:underline shrink-0 cursor-pointer"
          >
            <span>تصفح المكتبة الكاملة والبحث</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive School Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'الكل', label: `الكل (${toArabicDigits(reciters.length)})` },
              { id: 'المفضلون', label: `المفضلون (${toArabicDigits(favoriteReciterCount)})` },
              {
                id: 'الشيوخ المصريون الراحلون',
                label: `الشيوخ المصريون الراحلون (${toArabicDigits(
                  reciters.filter((r) => r.schoolAr === 'الشيوخ المصريون الراحلون').length
                )})`,
              },
              {
                id: 'المدرسة المصرية',
                label: `المدرسة المصرية (${toArabicDigits(
                  reciters.filter((r) => r.schoolAr === 'المدرسة المصرية').length
                )})`,
              },
              {
                id: 'أئمة الحرمين والخليج',
                label: `أئمة الحرمين والخليج (${toArabicDigits(
                  reciters.filter((r) => r.schoolAr === 'أئمة الحرمين والخليج').length
                )})`,
              },
              {
                id: 'قراء العالم الإسلامي',
                label: `قراء العالم الإسلامي (${toArabicDigits(
                  reciters.filter((r) => r.schoolAr === 'قراء العالم الإسلامي').length
                )})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSchoolFilter(tab.id)}
              className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                schoolFilter === tab.id
                  ? 'bg-[#0E6B4D] text-white'
                  : 'bg-white/5 text-[#A9B2AE] hover:text-white border border-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {visibleReciters.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center space-y-3">
            <p className="text-sm text-[#A9B2AE]">
              لم تضف أي قارئ إلى المفضلة بعد — اضغط على أيقونة القلب على بطاقة أي قارئ لحفظه هنا.
            </p>
            <button
              type="button"
              onClick={() => setSchoolFilter('الكل')}
              className="px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-medium cursor-pointer"
            >
              عرض جميع القراء
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {visibleReciters.map((reciter) => {
            const playingThisReciter = currentTrack?.reciterId === reciter.id && isPlaying;
            const defaultSurah = getDefaultPlayableSurahNumber(reciter);
            const recFavId = `reciter_${reciter.id}`;
            const isRecFav = isFavorite(recFavId);
            return (
              <article
                key={reciter.id}
                className={`glass-panel card-interactive rounded-2xl overflow-hidden flex flex-col justify-between group ${
                  playingThisReciter ? 'border-[#C8A253]/60' : 'hover:border-[#C8A253]/40'
                }`}
              >
                <div>
                  <div className="aspect-[4/3] bg-[#0A0D0C] relative overflow-hidden">
                    <ReciterImage
                      src={reciter.photoUrl}
                      alt={reciter.nameAr}
                      className="w-full h-full object-cover object-top grayscale-[8%] group-hover:scale-[1.03] transition-transform duration-300"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-[#121715] via-transparent to-transparent"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void toggleFavorite({
                          id: recFavId,
                          type: 'reciter',
                          targetId: recFavId,
                          title: reciter.nameAr,
                          subtitle: reciter.titleAr,
                          reciterId: reciter.id,
                        })
                      }
                      aria-label={isRecFav ? `إزالة ${reciter.nameAr} من المفضلة` : `تفضيل ${reciter.nameAr}`}
                      className={`absolute top-2 left-2 min-w-[32px] min-h-[32px] rounded-lg backdrop-blur-md border flex items-center justify-center cursor-pointer transition-transform active:scale-90 ${
                        isRecFav
                          ? 'bg-[#C8A253]/25 border-[#C8A253]/70 text-[#C8A253]'
                          : 'bg-black/45 border-white/15 text-white/80 hover:text-[#C8A253]'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isRecFav ? 'fill-current' : ''}`} />
                    </button>
                    {playingThisReciter && (
                      <div className="absolute bottom-2.5 left-2.5 px-2 py-1 rounded-lg bg-[#0A0D0C]/85 border border-[#C8A253]/45">
                        <AudioWaveBars active className="text-[#C8A253] h-3" />
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 space-y-1">
                    <h3 className="text-sm font-display font-bold text-[#F5F3EE] line-clamp-1">
                      {reciter.nameAr}
                    </h3>
                    <p className="text-[11px] text-[#C8A253] line-clamp-1">{reciter.titleAr}</p>
                    <p className="text-[10px] text-[#A9B2AE] line-clamp-1">
                      {reciter.isDeceased
                        ? `${reciter.birthYear} – ${reciter.deathYear}`
                        : reciter.schoolAr || reciter.originAr}
                    </p>
                  </div>
                </div>

                <div className="px-3.5 pb-3.5 pt-1 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => navigate({ page: 'reciter', reciterId: reciter.id })}
                    className="flex-1 min-h-[36px] px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-[#F5F3EE] cursor-pointer"
                  >
                    صفحة القارئ
                  </button>
                  <button
                    type="button"
                    onClick={() => playSurahByReciter(reciter, defaultSurah)}
                    aria-label={`استمع إلى ${reciter.nameAr}`}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        )}
      </section>
    ),
    latest: (
      <section aria-labelledby="latest-heading" className="space-y-6">
        <div className="space-y-1">
          <h2 id="latest-heading" className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]">
            أحدث التلاوات المختارة ({toArabicDigits(curatedRecitations.length)})
          </h2>
          <p className="text-xs sm:text-sm text-[#A9B2AE]">
            مختارات خاشعة بين المصاحف المرتلة والمجودة والتسجيلات الإذاعية النادرة من جميع القراء
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {curatedRecitations.map((item) => {
            const reciter = reciters.find((r) => r.id === item.reciterId);
            if (!reciter) return null;
            const track: AudioTrack = {
              id: item.id,
              reciterId: reciter.id,
              reciterName: reciter.nameAr,
              reciterPhoto: reciter.photoUrl,
              surahNumber: item.surahNumber,
              surahName: item.surahNameAr,
              style: item.style,
              riwayah: item.riwayah,
              audioUrl: item.audioUrl,
              isAvailable: item.isAvailable,
              sourceName: item.sourceName,
            };
            const favKey = `rec_${reciter.id}_${item.surahNumber}`;
            const favored = isFavorite(favKey);
            const active =
              currentTrack?.reciterId === reciter.id &&
              currentTrack?.surahNumber === item.surahNumber &&
              currentTrack?.style === item.style;

            return (
              <div
                key={item.id}
                className={`glass-panel rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors ${
                  active ? 'border-[#C8A253]/60 bg-[#171F1C]' : 'hover:border-[#C8A253]/30'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <ReciterImage
                    src={reciter.photoUrl}
                    alt={reciter.nameAr}
                    className="w-14 h-14 rounded-xl object-cover object-top shrink-0 border border-[#C8A253]/25"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      {active && <AudioWaveBars active={isPlaying} className="text-[#C8A253] shrink-0" />}
                      <h3 className={`text-sm font-semibold truncate ${active ? 'text-[#C8A253]' : 'text-[#F5F3EE]'}`}>
                        {item.surahNameAr}
                      </h3>
                    </div>
                    <p className="text-xs text-[#A9B2AE] truncate">
                      {reciter.nameAr} · {item.style}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      void toggleFavorite({
                        id: favKey,
                        type: 'recitation',
                        targetId: favKey,
                        title: item.surahNameAr,
                        subtitle: `${reciter.nameAr} · ${item.style}`,
                        audioUrl: item.audioUrl,
                        reciterId: reciter.id,
                        surahNumber: item.surahNumber,
                      })
                    }
                    aria-label={`تفضيل ${item.surahNameAr}`}
                    className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-white/5 cursor-pointer ${
                      favored ? 'text-[#C8A253]' : 'text-[#A9B2AE]'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${favored ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => addToQueue(track)}
                    aria-label={`إضافة ${item.surahNameAr} للانتظار`}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-[#A9B2AE] hover:text-white hover:bg-white/5 cursor-pointer"
                  >
                    <ListEnd className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onPickPlaylistForTrack(track)}
                    aria-label={`إضافة ${item.surahNameAr} لقائمة تشغيل`}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-[#A9B2AE] hover:text-white hover:bg-white/5 cursor-pointer"
                  >
                    <ListPlus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => (active ? togglePlayPause() : playTrack(track))}
                    aria-label={active && isPlaying ? `إيقاف ${item.surahNameAr}` : `تشغيل ${item.surahNameAr}`}
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white cursor-pointer"
                  >
                    {active && isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    ),
    mostListened: (
      <section aria-labelledby="most-listened-heading" className="space-y-6">
        <div className="space-y-1">
          <h2 id="most-listened-heading" className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]">
            السور الأكثر استماعًا
          </h2>
          <p className="text-xs sm:text-sm text-[#A9B2AE]">
            وصول سريع إلى السور الأكثر طلبًا للاستماع والقراءة
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {mostListenedSurahs.map((surah) => {
            const targetRec = activePlayerReciter || reciters[0];
            const recCol = targetRec?.collections[0];
            const surahFavId = targetRec ? `rec_${targetRec.id}_${surah.number}` : '';
            const surahFavored = surahFavId ? isFavorite(surahFavId) : false;
            return (
              <div
                key={surah.number}
                className="glass-panel card-interactive rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-[#C8A253]/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-[#171F1C] border border-[#C8A253]/25 flex items-center justify-center text-sm font-mono-nums text-[#C8A253] shrink-0">
                    {toArabicDigits(surah.number)}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#F5F3EE] truncate">
                      {formatSurahDisplayName(surah.name)}
                    </h3>
                    <p className="text-xs text-[#A9B2AE]">
                      {surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'} ·{' '}
                      {toArabicDigits(surah.numberOfAyahs)} آية
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {targetRec && recCol && (
                    <button
                      type="button"
                      onClick={() =>
                        void toggleFavorite({
                          id: surahFavId,
                          type: 'recitation',
                          targetId: surahFavId,
                          title: surah.name,
                          subtitle: `${targetRec.nameAr} · ${recCol.style}`,
                          audioUrl: buildSurahAudioUrl(recCol.server, surah.number),
                          reciterId: targetRec.id,
                          surahNumber: surah.number,
                        })
                      }
                      aria-label={`تفضيل ${surah.name}`}
                      className={`min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg hover:bg-white/5 cursor-pointer ${
                        surahFavored ? 'text-[#C8A253]' : 'text-[#A9B2AE]'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${surahFavored ? 'fill-current' : ''}`} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => navigate({ page: 'mushaf', surah: surah.number })}
                    aria-label={`قراءة ${surah.name}`}
                    className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-[#A9B2AE] hover:text-[#C8A253] hover:bg-white/5 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      targetRec &&
                      playSurahByReciter(
                        targetRec,
                        getDefaultPlayableSurahNumber(targetRec) === 1 ||
                          targetRec.collections.some(
                            (c) => !c.missingSurahs?.includes(surah.number)
                          )
                          ? surah.number
                          : getDefaultPlayableSurahNumber(targetRec)
                      )
                    }
                    aria-label={`استماع ${surah.name}`}
                    className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg bg-[#0E6B4D]/80 hover:bg-[#0E6B4D] text-white cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    ),
    mushafShowcase: (
      <section aria-labelledby="mushaf-showcase-heading" className="mushaf-frame rounded-3xl p-7 sm:p-12">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="flex items-center justify-center gap-2.5 text-xs text-[#C8A253] font-medium">
            <span aria-hidden="true" className="w-6 h-px bg-[#C8A253]/50" />
            <Sparkles className="w-4 h-4" />
            <span>تطبيق المصحف الشريف المستقل بالرسم العثماني</span>
            <span aria-hidden="true" className="w-6 h-px bg-[#C8A253]/50" />
          </div>
          <h2 id="mushaf-showcase-heading" className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]">
            {config.texts.mushafShowcaseTitle}
          </h2>
          <div className="sanctuary-hairline max-w-md mx-auto" aria-hidden="true" />
          <p className="font-quran text-2xl sm:text-3xl leading-[2.3] text-[#F5F3EE]/95">
            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ﴿١﴾ ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ ﴿٢﴾ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ﴿٣﴾ مَٰلِكِ يَوْمِ ٱلدِّينِ ﴿٤﴾
          </p>
          <div className="sanctuary-hairline max-w-md mx-auto" aria-hidden="true" />
          <p className="text-xs sm:text-sm text-[#A9B2AE] max-w-2xl mx-auto">
            {config.texts.mushafShowcaseSubtitle}
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate({ page: 'mushaf', pageNum: prefs.lastReadPage })}
              className="min-h-[48px] px-8 py-3 rounded-xl bg-[#C8A253] hover:bg-[#d6b368] text-[#0A0D0C] text-sm font-bold shadow-lg transition-colors cursor-pointer"
            >
              فتح المصحف الشريف الآن
            </button>
          </div>
        </div>
      </section>
    ),
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 space-y-16">
      {config.texts.announcementEnabled && config.texts.announcementText.trim() && (
        <div className="glass-gold rounded-2xl px-4 py-3 text-center text-xs sm:text-sm text-[#F5F3EE] border border-[#C8A253]/35">
          {config.texts.announcementText}
        </div>
      )}
      {config.homeSections
        .filter((sec) => sec.visible)
        .map((sec) => (
          <React.Fragment key={sec.id}>{sectionNodes[sec.id]}</React.Fragment>
        ))}
    </main>
  );
};
