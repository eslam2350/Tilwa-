import React, { useMemo } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CalendarCheck,
  Clock,
  GraduationCap,
  Heart,
  ListEnd,
  ListPlus,
  Pause,
  Play,
  Podcast,
  Radio,
  Shuffle,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { AudioWaveBars } from '../components/AudioWaveBars';
import { FeedbackShowcaseSection } from '../components/FeedbackShowcaseSection';
import { ReciterImage } from '../components/ReciterImage';
import { SectionBoostWrapper } from '../components/SectionBoostWrapper';
import { HERO_AYAH, HERO_BACKDROP_URL, MOST_LISTENED_SURAH_NUMBERS, QURAN_META } from '../data/reciters';
import { useAppData } from '../contexts/AppDataContext';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAuth } from '../contexts/AuthContext';
import { useDynamicConfig } from '../contexts/DynamicConfigContext';
import type { AppRoute, AudioTrack, HomeSectionId } from '../types/tilawa';
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

const DEFAULT_FEATURED_IDS = [
  'minshawi',
  'abdulbasit',
  'alafasy',
  'islam-sobhi',
  'hassan-saleh',
  'badr-turki',
  'ahmad-nufais',
  'muhammad-ahmad-hassan',
];

export const HomePage: React.FC<HomePageProps> = ({ navigate, onPickPlaylistForTrack }) => {
  const { reciters, curatedRecitations, basiraPreachers, basiraEpisodes, basiraPlaylists } = useAppData();
  const {
    currentTrack,
    isPlaying,
    playSurahByReciter,
    playBasiraEpisode,
    playTrack,
    playCollection,
    togglePlayPause,
    addToQueue,
  } = useAudioPlayer();
  const { history, prefs, isFavorite, toggleFavorite } = useAuth();
  const { config } = useDynamicConfig();

  const lastHistory = history[0] || null;
  const khatmahState = useMemo(() => loadKhatmahState(), []);
  const khatmahStats = useMemo(() => computeKhatmahStats(khatmahState), [khatmahState]);

  const mostListenedSurahs = useMemo(
    () =>
      MOST_LISTENED_SURAH_NUMBERS.slice(0, 4)
        .map((num) => QURAN_META.surahs.find((s) => s.number === num))
        .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    []
  );

  // Strictly curated cap of 8 featured reciters so HomePage stays concise and uncluttered
  const featuredReciters = useMemo(() => {
    const preferredIds =
      config.featuredReciterOverrides && config.featuredReciterOverrides.length > 0
        ? config.featuredReciterOverrides
        : DEFAULT_FEATURED_IDS;

    const picked = preferredIds
      .map((id) => reciters.find((r) => r.id === id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));

    for (const r of reciters) {
      if (picked.length >= 8) break;
      if (r.featured && !picked.some((p) => p.id === r.id)) {
        picked.push(r);
      }
    }
    for (const r of reciters) {
      if (picked.length >= 8) break;
      if (!picked.some((p) => p.id === r.id)) {
        picked.push(r);
      }
    }
    return picked.slice(0, 8);
  }, [reciters, config.featuredReciterOverrides]);

  const activePlayerReciter = useMemo(
    () => (currentTrack && reciters.find((r) => r.id === currentTrack.reciterId)) || reciters[0],
    [currentTrack, reciters]
  );

  // Curated 4 primary radio stations for clean grid balance on HomePage
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
            audioUrl: buildSurahAudioUrl(col.server, surah.number, col.surahUrls),
            isAvailable: true,
            sourceName: col.sourceName,
          } as AudioTrack;
        })
        .filter((t): t is AudioTrack => Boolean(t));
    };

    return [
      {
        id: 'station-khushu',
        title: 'دولة التلاوة المصرية',
        subtitle: 'مصطفى إسماعيل · المنشاوي · عبد الباسط · البهتيمي',
        tracks: buildStationTracks([
          { reciterId: 'mustafa-ismail', surahNumber: 12, style: 'مجود' },
          { reciterId: 'minshawi', surahNumber: 19, style: 'مجود' },
          { reciterId: 'abdulbasit', surahNumber: 36, style: 'مجود' },
          { reciterId: 'kamel-bahtimi', surahNumber: 19, style: 'مجود' },
        ]),
      },
      {
        id: 'station-calm-social',
        title: 'أصوات معاصرة ورائجة',
        subtitle: 'شريف مصطفى · عبد الرحمن مسعد · إسلام صبحي · عبد العزيز الزهراني',
        tracks: buildStationTracks([
          { reciterId: 'sherif-mostafa', surahNumber: 55, style: 'مرتل' },
          { reciterId: 'abdulrahman-mossad', surahNumber: 15, style: 'مرتل' },
          { reciterId: 'islam-sobhi', surahNumber: 12, style: 'مرتل' },
          { reciterId: 'abdulaziz-zahrani', surahNumber: 12, style: 'مرتل' },
        ]),
      },
      {
        id: 'station-haramain',
        title: 'رحاب الحرمين الشريفين',
        subtitle: 'علي جابر · الحذيفي · المعيقلي · ياسر الدوسري',
        tracks: buildStationTracks([
          { reciterId: 'ali-jaber', surahNumber: 36, style: 'مرتل' },
          { reciterId: 'hudhaifi', surahNumber: 2, style: 'مرتل' },
          { reciterId: 'muaiqly', surahNumber: 18, style: 'مرتل' },
          { reciterId: 'dosari', surahNumber: 25, style: 'مرتل' },
        ]),
      },
      {
        id: 'station-teaching',
        title: 'التلاوة المعلمة والمجودة',
        subtitle: 'أيمن سويد · الحصري · علي البنا · محمد أيوب',
        tracks: buildStationTracks([
          { reciterId: 'ayman-suwaid', surahNumber: 1, style: 'معلم' },
          { reciterId: 'husary', surahNumber: 18, style: 'مرتل' },
          { reciterId: 'banna', surahNumber: 55, style: 'مجود' },
          { reciterId: 'ayyub', surahNumber: 18, style: 'مجود' },
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

        <div className="relative z-10 p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#C8A253] font-medium">
              <span aria-hidden="true" className="w-6 h-px bg-[#C8A253]/70 inline-block" />
              <span>{config.texts.heroBadge}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-display font-bold text-[#F5F3EE] leading-[1.28] text-balance">
              {config.texts.heroTitle}
            </h1>

            <p className="text-sm sm:text-base text-[#A9B2AE] leading-relaxed max-w-2xl">
              {config.texts.heroSubtitle}
            </p>

            <p className="text-xs text-[#C8A253]/90 font-medium">
              {toArabicDigits(reciters.length)} قارئًا · {toArabicDigits(114)} سورة ·{' '}
              {toArabicDigits(604)} صفحة بالرسم العثماني · بودكاست بصيرة الصوتي
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleStartListening}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 min-h-[46px] px-5 sm:px-6 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] border border-[#178A64]/45 text-[#F5F3EE] text-sm font-semibold shadow-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current shrink-0" />
                <span>{config.texts.ctaListenLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'mushaf', pageNum: prefs.lastReadPage })}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 min-h-[46px] px-5 sm:px-6 py-2.5 rounded-xl bg-[#121816]/85 hover:bg-white/10 border border-white/15 text-[#F5F3EE] text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 text-[#C8A253] shrink-0" />
                <span>{config.texts.ctaMushafLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate({ page: 'tahfeez' })}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 min-h-[46px] px-5 sm:px-6 py-2.5 rounded-xl bg-[#C8A253]/15 hover:bg-[#C8A253]/25 border border-[#C8A253]/40 text-[#F5F3EE] text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                <GraduationCap className="w-4 h-4 text-[#C8A253] shrink-0" />
                <span>{config.texts.ctaTahfeezLabel}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="glass-gold rounded-2xl p-6 sm:p-7 space-y-4 text-center border border-[#C8A253]/30">
              <div className="flex items-center justify-center gap-3 text-xs text-[#C8A253] font-medium">
                <span aria-hidden="true" className="w-5 h-px bg-[#C8A253]/50" />
                <span>آية قرآنية مختارة</span>
                <span aria-hidden="true" className="w-5 h-px bg-[#C8A253]/50" />
              </div>
              <blockquote className="font-quran text-2xl sm:text-[26px] leading-[2.1] text-[#F5F3EE]">
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
          <div className="glass-panel card-interactive rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4">
            {lastHistory ? (
              <>
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#0E6B4D]/25 border border-[#0E6B4D]/45 flex items-center justify-center text-[#C8A253] shrink-0">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-[#F5F3EE] truncate">
                      {lastHistory.surahName} · {lastHistory.reciterName}
                    </p>
                    <p className="text-xs text-[#A9B2AE] font-mono-nums">
                      توقفت عند {formatTimeSeconds(lastHistory.progressSeconds)}
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
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-medium shrink-0 cursor-pointer"
                >
                  متابعة
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#0E6B4D]/25 border border-[#0E6B4D]/45 flex items-center justify-center text-[#C8A253] shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-[#F5F3EE]">ابدأ جلستك الأولى</p>
                    <p className="text-xs text-[#A9B2AE] truncate">
                      سورة الفاتحة بصوت الشيخ المنشاوي
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => reciters[0] && playSurahByReciter(reciters[0], 1, 'مرتل')}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-medium shrink-0 cursor-pointer"
                >
                  تشغيل
                </button>
              </>
            )}
          </div>

          <div className="glass-panel card-interactive rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[#C8A253]/15 border border-[#C8A253]/30 flex items-center justify-center text-[#C8A253] shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-[#F5F3EE] truncate">آخر موضع في المصحف</p>
                <p className="text-xs text-[#A9B2AE]">
                  {QURAN_META.surahs.find((s) => s.number === prefs.lastReadSurah)?.name ||
                    'الفاتحة'}{' '}
                  · صفحة {toArabicDigits(prefs.lastReadPage)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate({ page: 'mushaf', pageNum: prefs.lastReadPage })}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-[#F5F3EE] text-xs font-medium shrink-0 cursor-pointer"
            >
              قراءة
            </button>
          </div>

          <div className="glass-gold card-interactive rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[#C8A253]/15 border border-[#C8A253]/35 flex items-center justify-center text-[#C8A253] shrink-0">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-[#F5F3EE] truncate">
                  ورد الختمة ({toArabicDigits(khatmahStats.progressPercent)}٪)
                </p>
                <p className="text-xs text-[#A9B2AE]">
                  ص {toArabicDigits(khatmahState.currentPage)} – {toArabicDigits(khatmahStats.todayEndPage)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate({ page: 'mushaf', pageNum: khatmahState.currentPage })}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#C8A253] hover:bg-[#d6b368] text-[#0A0D0C] text-xs font-bold shrink-0 cursor-pointer"
            >
              افتح الورد
            </button>
          </div>
        </div>
      </section>
    ),
    reciters: (
      <section aria-labelledby="reciters-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 id="reciters-heading" className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]">
              نخبة أعلام التلاوة ({toArabicDigits(featuredReciters.length)} من {toArabicDigits(reciters.length)} قارئًا)
            </h2>
            <p className="text-xs sm:text-sm text-[#A9B2AE]">
              مختارات من أعلام المدرسة المصرية، والأصوات الهادئة، وأئمة الحرمين
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'reciters' })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0E6B4D]/25 hover:bg-[#0E6B4D]/40 border border-[#C8A253]/35 text-xs sm:text-sm text-[#C8A253] font-semibold shrink-0 cursor-pointer"
          >
            <span>تصفح المكتبة الكاملة ({toArabicDigits(reciters.length)} قارئًا)</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {featuredReciters.map((reciter) => {
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
                      loading="lazy"
                      className="w-full h-full object-cover object-top grayscale-[6%] group-hover:scale-[1.03] transition-transform duration-300"
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
      </section>
    ),
    stations: (
      <section aria-labelledby="stations-heading" className="space-y-4">
        <div className="space-y-1">
          <h2 id="stations-heading" className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]">
            إذاعة تلاوة — باقات استماع جاهزة
          </h2>
          <p className="text-xs sm:text-sm text-[#A9B2AE]">
            باقات صوتية متتابعة وعشوائية بضغطة واحدة
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickStations.map((st, idx) => (
            <div
              key={st.id}
              className="glass-gold card-interactive rounded-2xl p-4.5 flex flex-col justify-between gap-4 hover:border-[#C8A253]/55"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-[#0E6B4D]/25 border border-[#0E6B4D]/45 flex items-center justify-center text-[#C8A253]">
                    <Radio className="w-4 h-4" />
                  </div>
                  <span className="font-mono-nums text-xs text-[#C8A253]/80">
                    {toArabicDigits(idx + 1).padStart(2, '٠')}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-display font-bold text-[#F5F3EE]">{st.title}</h3>
                <p className="text-xs text-[#A9B2AE] leading-relaxed line-clamp-2">{st.subtitle}</p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => playCollection(st.tracks, { shuffle: false })}
                  className="flex-1 flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-semibold cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>تشغيل</span>
                </button>
                <button
                  type="button"
                  onClick={() => playCollection(st.tracks, { shuffle: true })}
                  aria-label={`تشغيل عشوائي لقائمة ${st.title}`}
                  className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#C8A253] cursor-pointer"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    ),
    basiraShowcase: (
      <section aria-labelledby="home-basira-heading" className="glass-gold rounded-3xl p-5 sm:p-7 space-y-5 border border-[#C8A253]/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[#C8A253] font-medium">
              <Podcast className="w-4 h-4" />
              <span>بصيرة — بودكاست دعوي صوتي خالص</span>
            </div>
            <h2 id="home-basira-heading" className="text-2xl font-display font-bold text-[#F5F3EE]">
              مجالس الوعي وتزكية القلوب ({toArabicDigits(basiraPreachers.length)} دعاة · {toArabicDigits(basiraEpisodes.length)} حلقة · {toArabicDigits(basiraPlaylists.length)} سلسلة)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'basira' })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-semibold cursor-pointer"
          >
            <span>تصفح قسم بصيرة والبوكسات</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* All Basira Preachers Avatar Grid + 4 Curated Episodes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-5 rounded-2xl bg-[#0A0D0C]/75 border border-white/10 p-4 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#C8A253]">
              <span>نخبة الدعاة والمشايخ</span>
              <span className="text-[11px] font-mono-nums text-[#A9B2AE]">
                {toArabicDigits(basiraPreachers.length)} شيخًا وداعية
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {basiraPreachers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate({ page: 'basira-preacher', preacherId: p.id })}
                  title={p.nameAr}
                  className="group flex flex-col items-center gap-1 cursor-pointer"
                >
                  <ReciterImage
                    src={p.photoUrl}
                    alt={p.nameAr}
                    loading="lazy"
                    className="w-11 h-11 rounded-full object-cover object-top border border-[#C8A253]/35 group-hover:border-[#C8A253] transition-colors"
                  />
                  <span className="text-[10px] text-[#A9B2AE] group-hover:text-[#F5F3EE] truncate w-full text-center">
                    {p.nameAr.replace(/^(الشيخ|الدكتور|الداعية د\.|المهندس)\s+/u, '')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {basiraEpisodes.slice(0, 4).map((ep) => {
              const preacher = basiraPreachers.find((p) => p.id === ep.preacherId);
              const isCurrent =
                currentTrack?.kind === 'podcast' && currentTrack.episodeId === ep.id;
              return (
                <div
                  key={ep.id}
                  className="bg-[#0A0D0C]/70 rounded-2xl p-3.5 border border-white/10 hover:border-[#C8A253]/35 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ReciterImage
                      src={preacher?.photoUrl || ep.coverUrl}
                      alt={ep.title}
                      loading="lazy"
                      className="w-12 h-12 rounded-xl object-cover object-top shrink-0 border border-[#C8A253]/20"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[10px] text-[#C8A253] truncate">
                        {ep.category} · {ep.durationLabel}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate({ page: 'basira-episode', episodeId: ep.id })}
                        className="text-right cursor-pointer block w-full"
                      >
                        <h3 className="text-xs sm:text-sm font-semibold text-[#F5F3EE] hover:text-[#C8A253] truncate">
                          {ep.title}
                        </h3>
                      </button>
                      {preacher && (
                        <p className="text-[11px] text-[#A9B2AE] truncate">{preacher.nameAr}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      isCurrent
                        ? togglePlayPause()
                        : playBasiraEpisode(ep, preacher, basiraPreachers, basiraEpisodes)
                    }
                    aria-label={isCurrent && isPlaying ? `إيقاف ${ep.title}` : `تشغيل ${ep.title}`}
                    className="min-w-[38px] min-h-[38px] rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    {isCurrent && isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    ),
    latest: (
      <section aria-labelledby="latest-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 id="latest-heading" className="text-2xl font-display font-bold text-[#F5F3EE]">
              مختارات من التلاوات
            </h2>
            <p className="text-xs sm:text-sm text-[#A9B2AE]">
              تلاوات منتقاة بين المرتل والمجود والنوادر الإذاعية
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'reciters' })}
            className="text-xs text-[#C8A253] hover:underline cursor-pointer"
          >
            عرض المزيد من القراء
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {curatedRecitations.slice(0, 6).map((item) => {
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
                className={`glass-panel rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-colors ${
                  active ? 'border-[#C8A253]/60 bg-[#171F1C]' : 'hover:border-[#C8A253]/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ReciterImage
                    src={reciter.photoUrl}
                    alt={reciter.nameAr}
                    loading="lazy"
                    className="w-12 h-12 rounded-xl object-cover object-top shrink-0 border border-[#C8A253]/25"
                  />
                  <div className="min-w-0 space-y-0.5">
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
                    className={`min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl hover:bg-white/5 cursor-pointer ${
                      favored ? 'text-[#C8A253]' : 'text-[#A9B2AE]'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${favored ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => addToQueue(track)}
                    aria-label={`إضافة ${item.surahNameAr} للانتظار`}
                    className="hidden sm:flex min-w-[34px] min-h-[34px] items-center justify-center rounded-xl text-[#A9B2AE] hover:text-white hover:bg-white/5 cursor-pointer"
                  >
                    <ListEnd className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onPickPlaylistForTrack(track)}
                    aria-label={`إضافة ${item.surahNameAr} لقائمة تشغيل`}
                    className="hidden sm:flex min-w-[34px] min-h-[34px] items-center justify-center rounded-xl text-[#A9B2AE] hover:text-white hover:bg-white/5 cursor-pointer"
                  >
                    <ListPlus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => (active ? togglePlayPause() : playTrack(track))}
                    aria-label={active && isPlaying ? `إيقاف ${item.surahNameAr}` : `تشغيل ${item.surahNameAr}`}
                    className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white cursor-pointer"
                  >
                    {active && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    ),
    mostListened: (
      <section aria-labelledby="most-listened-heading" className="space-y-4">
        <div className="space-y-1">
          <h2 id="most-listened-heading" className="text-2xl font-display font-bold text-[#F5F3EE]">
            وصول سريع للسور الأكثر طلبًا
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {mostListenedSurahs.map((surah) => {
            const targetRec = activePlayerReciter || reciters[0];
            return (
              <div
                key={surah.number}
                className="glass-panel card-interactive rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-[#C8A253]/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-[#171F1C] border border-[#C8A253]/25 flex items-center justify-center text-sm font-mono-nums text-[#C8A253] shrink-0">
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
                        targetRec.collections.some(
                          (c) => !c.missingSurahs?.includes(surah.number)
                        )
                          ? surah.number
                          : getDefaultPlayableSurahNumber(targetRec)
                      )
                    }
                    aria-label={`استماع ${surah.name}`}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-[#0E6B4D]/80 hover:bg-[#0E6B4D] text-white cursor-pointer"
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
      <section aria-labelledby="mushaf-showcase-heading" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="mushaf-frame rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-[#C8A253] font-medium">
              <Sparkles className="w-4 h-4" />
              <span>المصحف الشريف بالرسم العثماني</span>
            </div>
            <h2 id="mushaf-showcase-heading" className="text-xl sm:text-2xl font-display font-bold text-[#F5F3EE]">
              {config.texts.mushafShowcaseTitle}
            </h2>
            <p className="font-quran text-xl sm:text-2xl leading-[2.1] text-[#F5F3EE]/95">
              بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ﴿١﴾ ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ ﴿٢﴾
            </p>
            <p className="text-xs sm:text-sm text-[#A9B2AE] leading-relaxed">
              {config.texts.mushafShowcaseSubtitle}
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => navigate({ page: 'mushaf', pageNum: prefs.lastReadPage })}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#C8A253] hover:bg-[#d6b368] text-[#0A0D0C] text-xs sm:text-sm font-bold shadow-lg transition-colors cursor-pointer"
            >
              فتح المصحف الشريف الآن
            </button>
          </div>
        </div>

        <div className="glass-gold rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-4 border border-[#C8A253]/30">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-[#C8A253] font-medium">
              <Award className="w-4 h-4" />
              <span>التحفيظ وشهادات التقدير المعتمدة</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F5F3EE]">
              احفظ القرآن بالتكرار واحصل على شهادتك باسمك وتوقيع المنصة
            </h2>
            <p className="text-xs sm:text-sm text-[#A9B2AE] leading-relaxed">
              نظام تحفيظ آية بآية مع الشيخ المعلم وتوثيق الأجزاء الثلاثين وإصدار شهادات التقدير الاحترافية للطباعة والحفظ فورًا.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => navigate({ page: 'tahfeez' })}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs sm:text-sm font-semibold cursor-pointer"
            >
              بدء التحفيظ الآن
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'library' })}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-[#F5F3EE] text-xs sm:text-sm font-medium cursor-pointer"
            >
              عرض شهادات التقدير
            </button>
          </div>
        </div>
      </section>
    ),
    feedback: <FeedbackShowcaseSection />,
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-11">
      {config.texts.announcementEnabled && config.texts.announcementText.trim() && (
        <div className="glass-gold rounded-2xl px-4 py-3 text-center text-xs sm:text-sm text-[#F5F3EE] border border-[#C8A253]/35">
          {config.texts.announcementText}
        </div>
      )}
      {config.homeSections
        .filter((sec) => sec.visible)
        .map((sec) => (
          <SectionBoostWrapper key={sec.id} sectionId={sec.id}>
            {sectionNodes[sec.id]}
          </SectionBoostWrapper>
        ))}
    </main>
  );
};
