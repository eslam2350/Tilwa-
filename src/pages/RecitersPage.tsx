import React, { useEffect, useMemo, useState } from 'react';
import {
  Grid2x2,
  Heart,
  LayoutGrid,
  Pause,
  Play,
  Search,
  Share2,
  Shuffle,
  UserCheck,
} from 'lucide-react';
import { AudioWaveBars } from '../components/AudioWaveBars';
import { ReciterImage } from '../components/ReciterImage';
import { SectionBoostWrapper } from '../components/SectionBoostWrapper';
import { QURAN_META } from '../data/reciters';
import { useAppData } from '../contexts/AppDataContext';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAuth } from '../contexts/AuthContext';
import type { AppRoute, ReciterSchool, RecordingStyle } from '../types/tilawa';
import {
  buildCollectionTracks,
  formatSurahDisplayName,
  getDefaultPlayableSurahNumber,
  isSurahAvailableInCollection,
  normalizeArabic,
  toArabicDigits,
} from '../utils/quranHelpers';

interface RecitersPageProps {
  navigate: (next: AppRoute) => void;
}

type RecitersFilter =
  | 'الكل'
  | 'رائجون'
  | 'نخبة المنصات'
  | 'المفضلون'
  | ReciterSchool
  | RecordingStyle;
type RecitersSort = 'default' | 'collections' | 'classic' | 'alpha';
type RecitersViewMode = 'expanded' | 'compact';

const PAGE_BATCH_SIZE = 24;

const TRENDING_SOCIAL_RECITER_IDS = new Set<string>([
  'sherif-mostafa',
  'abdulrahman-mossad',
  'abdulaziz-zahrani',
  'ahmad-suwailem',
  'salman-otaibi',
  'abdullah-khalaf',
  'abdulrahman-majed',
  'nasser-majed',
  'abdulaziz-turki',
  'islam-sobhi',
  'haitham-dukhain',
  'raad-kurdi',
  'hazza-balushi',
  'mansour-salimi',
  'hassan-saleh',
  'abdelaziz-sheim',
  'badr-turki',
  'ahmad-nufais',
  'abdullah-kamel',
  'abdulrahman-oosi',
  'wadee-yamani',
  'peshawa-kurdi',
]);

const SCHOOL_FILTERS: Array<{ id: ReciterSchool; shortLabel: string }> = [
  { id: 'الشيوخ المصريون الراحلون', shortLabel: 'الشيوخ المصريون الراحلون' },
  { id: 'المدرسة المصرية', shortLabel: 'المدرسة المصرية المعاصرة' },
  { id: 'أئمة الحرمين والخليج', shortLabel: 'أئمة الحرمين والخليج' },
  { id: 'قراء العالم الإسلامي', shortLabel: 'قراء العالم الإسلامي' },
];

export const RecitersPage: React.FC<RecitersPageProps> = ({ navigate }) => {
  const { reciters, notify } = useAppData();
  const { currentTrack, isPlaying, playSurahByReciter, playCollection, togglePlayPause } =
    useAudioPlayer();
  const { isFavorite, toggleFavorite } = useAuth();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RecitersFilter>('الكل');
  const [sortBy, setSortBy] = useState<RecitersSort>('default');
  const [viewMode, setViewMode] = useState<RecitersViewMode>('expanded');
  const [visibleLimit, setVisibleLimit] = useState<number>(PAGE_BATCH_SIZE);
  const [selectedSurahByReciter, setSelectedSurahByReciter] = useState<Record<string, number>>({});

  useEffect(() => {
    setVisibleLimit(PAGE_BATCH_SIZE);
  }, [query, filter, sortBy]);

  const schoolCounts = useMemo(
    () =>
      SCHOOL_FILTERS.map((s) => ({
        ...s,
        count: reciters.filter((r) => r.schoolAr === s.id).length,
      })),
    [reciters]
  );

  const filteredReciters = useMemo(() => {
    const q = normalizeArabic(query);
    const list = reciters.filter((r) => {
      if (filter === 'رائجون') {
        if (!TRENDING_SOCIAL_RECITER_IDS.has(r.id)) return false;
      } else if (filter === 'نخبة المنصات') {
        if (!r.featured) return false;
      } else if (filter === 'المفضلون') {
        if (!isFavorite(`reciter_${r.id}`)) return false;
      } else if (SCHOOL_FILTERS.some((s) => s.id === filter)) {
        if (r.schoolAr !== filter) return false;
      } else if (filter !== 'الكل') {
        if (!r.collections.some((c) => c.style === filter)) return false;
      }
      if (!q) return true;
      const hay = normalizeArabic(
        `${r.nameAr} ${r.nameEn} ${r.titleAr} ${r.originAr} ${r.schoolAr || ''}`
      );
      return hay.includes(q);
    });

    if (sortBy === 'collections') {
      return [...list].sort((a, b) => b.collections.length - a.collections.length);
    }
    if (sortBy === 'classic') {
      return [...list].sort((a, b) => {
        const aDeceased = a.isDeceased || (a.deathYear && a.deathYear !== 'حي يُرزق') ? 1 : 0;
        const bDeceased = b.isDeceased || (b.deathYear && b.deathYear !== 'حي يُرزق') ? 1 : 0;
        if (bDeceased !== aDeceased) return bDeceased - aDeceased;
        return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
      });
    }
    if (sortBy === 'alpha') {
      return [...list].sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
    }
    return list;
  }, [reciters, query, filter, sortBy, isFavorite]);

  const displayedReciters = useMemo(
    () => (query.trim() ? filteredReciters : filteredReciters.slice(0, visibleLimit)),
    [filteredReciters, visibleLimit, query]
  );

  const favCount = useMemo(
    () => reciters.filter((r) => isFavorite(`reciter_${r.id}`)).length,
    [reciters, isFavorite]
  );

  const trendingCount = useMemo(
    () => reciters.filter((r) => TRENDING_SOCIAL_RECITER_IDS.has(r.id)).length,
    [reciters]
  );

  const styleFilterTabs: Array<{ id: RecitersFilter; label: string }> = [
    { id: 'الكل', label: `الكل (${toArabicDigits(reciters.length)})` },
    { id: 'رائجون', label: `الأكثر رواجًا على السوشيال ميديا (${toArabicDigits(trendingCount)})` },
    {
      id: 'نخبة المنصات',
      label: `نخبة المنصات (${toArabicDigits(reciters.filter((r) => r.featured).length)})`,
    },
    { id: 'المفضلون', label: `المفضلون (${toArabicDigits(favCount)})` },
    { id: 'مرتل', label: 'مرتل' },
    { id: 'مجود', label: 'مجود' },
    { id: 'حفل إذاعي', label: 'حفل إذاعي' },
    { id: 'معلم', label: 'معلم' },
  ];

  const handleShuffleReciter = (reciterId: string) => {
    const rec = reciters.find((r) => r.id === reciterId);
    const col = rec?.collections[0];
    if (!rec || !col) return;
    const tracks = buildCollectionTracks(rec, col, QURAN_META.surahs);
    playCollection(tracks, { shuffle: true });
  };

  const handleCopyReciterLink = async (reciterId: string, nameAr: string) => {
    const shareUrl = `${window.location.origin}/#/reciters/${reciterId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      notify(`تم نسخ رابط صفحة ${nameAr}`, 'success');
    } catch {
      notify('تعذر نسخ الرابط تلقائيًا', 'error');
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-24 space-y-7">
      <SectionBoostWrapper sectionId="recitersDirectory">
        <div className="space-y-6">
          <div className="glass-gold rounded-3xl p-6 sm:p-8 space-y-5 border border-[#C8A253]/25">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs text-[#C8A253] font-medium">الأرشيف الصوتي الموثق</p>
                <h1 className="text-3xl font-display font-bold text-[#F5F3EE]">
                  مكتبة أعلام القراء ({toArabicDigits(reciters.length)} قارئًا)
                </h1>
                <p className="text-sm text-[#A9B2AE] max-w-2xl">
                  تضم الشيوخ المصريين الراحلين من الرعيل الذهبي وكبار القراء في مصر وأئمة الحرمين والأصوات الشبابية الأكثر رواجًا على منصات التواصل، مع تشغيل متواصل وعشوائي لجميع السور.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-4 h-4 text-[#A9B2AE] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ابحث باسم القارئ أو البلد..."
                    aria-label="ابحث في القراء"
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-[#0A0D0C]/80 border border-white/15 text-sm text-[#F5F3EE] placeholder:text-[#A9B2AE]/60 focus:outline-none focus:border-[#C8A253]"
                  />
                </div>

                <select
                  aria-label="ترتيب القراء"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as RecitersSort)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#0A0D0C]/80 border border-white/15 text-xs sm:text-sm text-[#F5F3EE] focus:outline-none focus:border-[#C8A253]"
                >
                  <option value="default">الترتيب الافتراضي</option>
                  <option value="collections">الأكثر مصاحفًا</option>
                  <option value="classic">أعلام الرعيل الأول</option>
                  <option value="alpha">ترتيب أبجدي</option>
                </select>

                <div className="inline-flex items-center p-1 rounded-xl bg-[#0A0D0C]/80 border border-white/15 shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setViewMode('expanded')}
                    aria-label="عرض موسع"
                    title="عرض موسع (بطاقات تفصيلية)"
                    className={`min-h-[34px] px-2.5 rounded-lg flex items-center gap-1.5 text-xs cursor-pointer transition-colors ${
                      viewMode === 'expanded'
                        ? 'bg-[#0E6B4D] text-white'
                        : 'text-[#A9B2AE] hover:text-white'
                    }`}
                  >
                    <Grid2x2 className="w-3.5 h-3.5" />
                    <span>موسّع</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('compact')}
                    aria-label="عرض مدمج"
                    title="عرض مدمج (شبكة سريعة)"
                    className={`min-h-[34px] px-2.5 rounded-lg flex items-center gap-1.5 text-xs cursor-pointer transition-colors ${
                      viewMode === 'compact'
                        ? 'bg-[#0E6B4D] text-white'
                        : 'text-[#A9B2AE] hover:text-white'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>مدمج</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Schools Overview Strip (Quick jump across the 4 Quranic recitation schools) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {schoolCounts.map((sch) => {
                const active = filter === sch.id;
                return (
                  <button
                    key={sch.id}
                    type="button"
                    onClick={() => setFilter(active ? 'الكل' : sch.id)}
                    className={`p-3 rounded-2xl border text-right transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      active
                        ? 'bg-[#0E6B4D]/30 border-[#C8A253]/60 text-[#F5F3EE]'
                        : 'bg-[#0A0D0C]/55 border-white/10 hover:border-[#C8A253]/35 text-[#A9B2AE] hover:text-[#F5F3EE]'
                    }`}
                  >
                    <span className="text-xs font-semibold truncate">{sch.shortLabel}</span>
                    <span className="text-xs font-mono-nums font-bold text-[#C8A253] shrink-0">
                      {toArabicDigits(sch.count)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Primary & Style Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {styleFilterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    filter === tab.id
                      ? 'bg-[#0E6B4D] text-white'
                      : 'bg-white/5 text-[#A9B2AE] hover:text-white border border-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredReciters.length === 0 ? (
            <div className="glass-panel rounded-2xl p-10 text-center space-y-3">
              <p className="text-sm text-[#A9B2AE]">
                {filter === 'المفضلون'
                  ? 'لم تحفظ أي قارئ في المفضلة بعد — اضغط على القلب بجانب أي قارئ لإضافته.'
                  : 'لا يوجد قارئ مطابق لمعايير البحث أو التصفية الحالية.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setFilter('الكل');
                  setSortBy('default');
                }}
                className="px-4 py-2 rounded-xl bg-[#0E6B4D] text-white text-xs cursor-pointer"
              >
                عرض جميع القراء
              </button>
            </div>
          ) : (
            <>
              <div
                className={
                  viewMode === 'compact'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                    : 'grid grid-cols-1 md:grid-cols-2 gap-6'
                }
              >
                {displayedReciters.map((reciter) => {
                  const defaultSurah = getDefaultPlayableSurahNumber(reciter);
                  const availableSurahs = QURAN_META.surahs.filter((s) =>
                    reciter.collections.some((c) => isSurahAvailableInCollection(c, s.number))
                  );
                  const pickedSurah =
                    selectedSurahByReciter[reciter.id] &&
                    availableSurahs.some((s) => s.number === selectedSurahByReciter[reciter.id])
                      ? selectedSurahByReciter[reciter.id]
                      : defaultSurah;
                  const recFavId = `reciter_${reciter.id}`;
                  const isRecFav = isFavorite(recFavId);
                  const uniqueStyles = Array.from(
                    new Set(reciter.collections.map((c) => c.style))
                  );
                  const uniqueRiwayahs = Array.from(
                    new Set(reciter.collections.map((c) => c.riwayah.split('(')[0].trim()))
                  ).slice(0, 2);
                  const isReciterActive =
                    currentTrack?.kind !== 'podcast' && currentTrack?.reciterId === reciter.id;

                  const handlePlayOrToggle = () => {
                    if (isReciterActive && currentTrack?.surahNumber === pickedSurah) {
                      togglePlayPause();
                    } else {
                      playSurahByReciter(reciter, pickedSurah);
                    }
                  };

                  return (
                    <article
                      key={reciter.id}
                      className={`glass-panel card-interactive perf-card rounded-2xl overflow-hidden flex transition-colors ${
                        viewMode === 'compact' ? 'flex-col' : 'flex-col sm:flex-row'
                      } ${
                        isReciterActive
                          ? 'border-[#C8A253]/70 bg-[#131E19]'
                          : 'hover:border-[#C8A253]/35'
                      }`}
                    >
                      <div
                        className={`relative bg-[#0A0D0C] shrink-0 ${
                          viewMode === 'compact'
                            ? 'aspect-[16/10] w-full'
                            : 'sm:w-52 aspect-[4/3] sm:aspect-auto'
                        }`}
                      >
                        <ReciterImage
                          src={reciter.photoUrl}
                          alt={reciter.nameAr}
                          className="w-full h-full object-cover object-top"
                        />
                        {isReciterActive && (
                          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0A0D0C]/85 border border-[#C8A253]/50 text-[11px] text-[#C8A253]">
                            <AudioWaveBars active={isPlaying} />
                            <span>{isPlaying ? 'يُتلى الآن' : 'متوقف مؤقتًا'}</span>
                          </div>
                        )}
                      </div>

                      <div className="p-5 flex flex-col justify-between flex-1 space-y-3.5 min-w-0">
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h2
                              className={`font-display font-bold text-[#F5F3EE] truncate ${
                                viewMode === 'compact' ? 'text-lg' : 'text-xl'
                              }`}
                            >
                              {reciter.nameAr}
                            </h2>
                            <button
                              type="button"
                              onClick={() => void handleCopyReciterLink(reciter.id, reciter.nameAr)}
                              aria-label={`نسخ رابط ${reciter.nameAr}`}
                              title="نسخ رابط القارئ"
                              className="p-1.5 rounded-lg text-[#A9B2AE] hover:text-[#C8A253] hover:bg-white/5 cursor-pointer shrink-0"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <p className="text-xs text-[#C8A253] truncate">{reciter.titleAr}</p>
                          <p className="text-xs text-[#A9B2AE] truncate">
                            {reciter.birthYear} – {reciter.deathYear} · {reciter.originAr}
                          </p>
                          {viewMode === 'expanded' && (
                            <p className="text-xs text-[#A9B2AE] leading-relaxed line-clamp-2">
                              {reciter.bioAr}
                            </p>
                          )}
                          {(uniqueStyles.length > 0 || uniqueRiwayahs.length > 0) && (
                            <p className="text-[11px] text-[#F5F3EE]/80 pt-0.5 truncate">
                              {uniqueStyles.join(' · ')}
                              {uniqueRiwayahs.length > 0 ? ` · ${uniqueRiwayahs[0]}` : ''}
                              {reciter.collections.length > 1
                                ? ` · ${toArabicDigits(reciter.collections.length)} مصاحف`
                                : ''}
                            </p>
                          )}

                          {/* Quick Surah Picker */}
                          {availableSurahs.length > 0 && (
                            <div className="pt-1 flex items-center gap-2">
                              <label
                                htmlFor={`reciter-surah-${reciter.id}`}
                                className="text-[11px] text-[#A9B2AE] shrink-0"
                              >
                                السورة:
                              </label>
                              <select
                                id={`reciter-surah-${reciter.id}`}
                                aria-label={`اختر السورة لسماعها بصوت ${reciter.nameAr}`}
                                value={pickedSurah}
                                onChange={(e) =>
                                  setSelectedSurahByReciter((prev) => ({
                                    ...prev,
                                    [reciter.id]: Number(e.target.value),
                                  }))
                                }
                                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE] focus:outline-none focus:border-[#C8A253]"
                              >
                                {availableSurahs.map((s) => (
                                  <option key={s.number} value={s.number}>
                                    {toArabicDigits(s.number)}. {formatSurahDisplayName(s.name)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => navigate({ page: 'reciter', reciterId: reciter.id })}
                            className="flex-1 flex items-center justify-center gap-2 min-h-[42px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-medium text-[#F5F3EE] cursor-pointer whitespace-nowrap"
                          >
                            <UserCheck className="w-4 h-4 text-[#C8A253] shrink-0" />
                            <span>ملف السور</span>
                          </button>
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
                            aria-label={
                              isRecFav
                                ? `إزالة ${reciter.nameAr} من المفضلة`
                                : `تفضيل ${reciter.nameAr}`
                            }
                            title={isRecFav ? 'في المفضلة' : 'إضافة للمفضلة'}
                            className={`min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl border cursor-pointer transition-transform active:scale-95 ${
                              isRecFav
                                ? 'bg-[#C8A253]/20 border-[#C8A253] text-[#C8A253]'
                                : 'bg-white/5 hover:bg-white/10 border-white/15 text-[#A9B2AE] hover:text-[#C8A253]'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${isRecFav ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShuffleReciter(reciter.id)}
                            aria-label={`تشغيل عشوائي لتلاوات ${reciter.nameAr}`}
                            title="تشغيل عشوائي"
                            className="min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-[#C8A253] cursor-pointer"
                          >
                            <Shuffle className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handlePlayOrToggle}
                            aria-label={
                              isReciterActive && isPlaying
                                ? `إيقاف ${reciter.nameAr}`
                                : `استماع بصوت ${reciter.nameAr}`
                            }
                            className="min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white cursor-pointer"
                          >
                            {isReciterActive &&
                            isPlaying &&
                            currentTrack?.surahNumber === pickedSurah ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 fill-current" />
                            )}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {!query.trim() && filteredReciters.length > visibleLimit && (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <p className="text-xs text-[#A9B2AE]">
                    يُعرض الآن{' '}
                    <span className="font-mono-nums text-[#C8A253]">
                      {toArabicDigits(displayedReciters.length)}
                    </span>{' '}
                    من أصل{' '}
                    <span className="font-mono-nums text-[#F5F3EE]">
                      {toArabicDigits(filteredReciters.length)}
                    </span>{' '}
                    قارئًا
                  </p>
                  <button
                    type="button"
                    onClick={() => setVisibleLimit((prev) => prev + PAGE_BATCH_SIZE)}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-white/5 hover:bg-[#0E6B4D] border border-[#C8A253]/30 hover:border-[#0E6B4D] text-sm font-medium text-[#F5F3EE] cursor-pointer transition-colors"
                  >
                    عرض{' '}
                    {toArabicDigits(Math.min(PAGE_BATCH_SIZE, filteredReciters.length - visibleLimit))}{' '}
                    قارئًا إضافيًا
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </SectionBoostWrapper>
    </main>
  );
};
