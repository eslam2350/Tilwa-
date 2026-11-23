import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  GraduationCap,
  Heart,
  ListEnd,
  ListPlus,
  Pause,
  Play,
  Search,
  Share2,
  Shuffle,
} from 'lucide-react';
import { AudioWaveBars } from '../components/AudioWaveBars';
import { ReciterImage } from '../components/ReciterImage';
import { QURAN_META } from '../data/reciters';
import { useAppData } from '../contexts/AppDataContext';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAuth } from '../contexts/AuthContext';
import type { AppRoute, AudioTrack, RecordingStyle } from '../types/tilawa';
import {
  buildCollectionTracks,
  buildSurahAudioUrl,
  formatSurahDisplayName,
  getDefaultPlayableSurahNumber,
  isSurahAvailableInCollection,
  normalizeArabic,
  toArabicDigits,
} from '../utils/quranHelpers';

interface ReciterProfilePageProps {
  reciterId: string;
  navigate: (next: AppRoute) => void;
  onPickPlaylistForTrack: (track: AudioTrack) => void;
}

export const ReciterProfilePage: React.FC<ReciterProfilePageProps> = ({
  reciterId,
  navigate,
  onPickPlaylistForTrack,
}) => {
  const { reciters, curatedRecitations, notify } = useAppData();
  const {
    playTrack,
    playCollection,
    togglePlayPause,
    addToQueue,
    currentTrack,
    isPlaying,
  } = useAudioPlayer();
  const { isFavorite, toggleFavorite } = useAuth();

  const reciter = reciters.find((r) => r.id === reciterId);
  const [selectedStyle, setSelectedStyle] = useState<'الكل' | RecordingStyle>('الكل');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [surahFilter, setSurahFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'available' | 'all'>('available');
  const [revelationFilter, setRevelationFilter] = useState<'all' | 'Meccan' | 'Medinan'>('all');
  const [rangeFilter, setRangeFilter] = useState<'all' | '1-30' | '31-70' | '71-114'>('all');
  const [quickSurahNum, setQuickSurahNum] = useState<number>(1);

  useEffect(() => {
    setSelectedStyle('الكل');
    setSelectedCollectionId('');
    setSurahFilter('');
    setAvailabilityFilter('available');
    setRevelationFilter('all');
    setRangeFilter('all');
  }, [reciterId]);

  const availableCollections = useMemo(() => {
    if (!reciter) return [];
    if (selectedStyle === 'الكل') return reciter.collections;
    return reciter.collections.filter((c) => c.style === selectedStyle);
  }, [reciter, selectedStyle]);

  const activeCollection = useMemo(() => {
    if (availableCollections.length === 0) return null;
    return (
      availableCollections.find((c) => c.id === selectedCollectionId) || availableCollections[0]
    );
  }, [availableCollections, selectedCollectionId]);

  const availableSurahsInActive = useMemo(() => {
    if (!activeCollection) return [];
    return QURAN_META.surahs.filter((s) =>
      isSurahAvailableInCollection(activeCollection, s.number)
    );
  }, [activeCollection]);

  useEffect(() => {
    if (!reciter) return;
    if (availableSurahsInActive.length > 0) {
      const stillValid = availableSurahsInActive.some((s) => s.number === quickSurahNum);
      if (!stillValid) {
        setQuickSurahNum(availableSurahsInActive[0].number);
      }
    } else {
      setQuickSurahNum(getDefaultPlayableSurahNumber(reciter));
    }
  }, [reciter, availableSurahsInActive, quickSurahNum]);

  const fullCollectionQueue = useMemo(() => {
    if (!reciter || !activeCollection) return [];
    return buildCollectionTracks(reciter, activeCollection, QURAN_META.surahs);
  }, [reciter, activeCollection]);

  const extraCurated = useMemo(
    () => curatedRecitations.filter((c) => c.reciterId === reciterId),
    [curatedRecitations, reciterId]
  );

  const filteredSurahs = useMemo(() => {
    const q = normalizeArabic(surahFilter);
    let base =
      availabilityFilter === 'available' && activeCollection
        ? QURAN_META.surahs.filter((s) => isSurahAvailableInCollection(activeCollection, s.number))
        : QURAN_META.surahs;

    if (revelationFilter !== 'all') {
      base = base.filter((s) => s.revelationType === revelationFilter);
    }
    if (rangeFilter === '1-30') {
      base = base.filter((s) => s.number >= 1 && s.number <= 30);
    } else if (rangeFilter === '31-70') {
      base = base.filter((s) => s.number >= 31 && s.number <= 70);
    } else if (rangeFilter === '71-114') {
      base = base.filter((s) => s.number >= 71 && s.number <= 114);
    }

    if (!q) return base;
    return base.filter(
      (s) =>
        normalizeArabic(s.name).includes(q) ||
        normalizeArabic(formatSurahDisplayName(s.name)).includes(q) ||
        s.englishName.toLowerCase().includes(q) ||
        String(s.number) === q
    );
  }, [surahFilter, availabilityFilter, revelationFilter, rangeFilter, activeCollection]);

  if (!reciter) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-[#F5F3EE]">القارئ غير موجود</h1>
        <button
          type="button"
          onClick={() => navigate({ page: 'reciters' })}
          className="px-5 py-2.5 rounded-xl bg-[#0E6B4D] text-white text-sm cursor-pointer"
        >
          العودة إلى قائمة القراء
        </button>
      </main>
    );
  }

  const reciterFavId = `reciter_${reciter.id}`;
  const isReciterFav = isFavorite(reciterFavId);
  const styles: Array<'الكل' | RecordingStyle> = ['الكل', 'مرتل', 'مجود', 'حفل إذاعي', 'معلم'];

  const buildTrackForSurah = (surahNumber: number): AudioTrack | null => {
    const surah = QURAN_META.surahs.find((s) => s.number === surahNumber);
    if (!surah || !activeCollection) return null;
    const cleanSurahName = formatSurahDisplayName(surah.name);
    const available = isSurahAvailableInCollection(activeCollection, surahNumber);
    return {
      id: `${reciter.id}_${activeCollection.id}_${surahNumber}`,
      reciterId: reciter.id,
      reciterName: reciter.nameAr,
      reciterPhoto: reciter.photoUrl,
      surahNumber,
      surahName: cleanSurahName,
      style: activeCollection.style,
      riwayah: activeCollection.riwayah,
      audioUrl: available
        ? buildSurahAudioUrl(activeCollection.server, surahNumber, activeCollection.surahUrls)
        : '',
      isAvailable: available,
      unavailableReason: available
        ? undefined
        : `التسجيل غير متاح لـ ${cleanSurahName} ضمن ${activeCollection.riwayah}`,
      sourceName: activeCollection.sourceName,
    };
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-10">
      {/* Back breadcrumb */}
      <button
        type="button"
        onClick={() => navigate({ page: 'reciters' })}
        className="flex items-center gap-2 text-xs sm:text-sm text-[#A9B2AE] hover:text-[#C8A253] cursor-pointer"
      >
        <ArrowRight className="w-4 h-4" />
        <span>العودة إلى مكتبة القراء</span>
      </button>

      {/* Reciter Biography Hero */}
      <section className="glass-gold rounded-3xl p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-3">
          <div className="aspect-[4/4] rounded-2xl overflow-hidden border border-[#C8A253]/30 bg-[#0A0D0C]">
            <ReciterImage
              src={reciter.photoUrl}
              alt={reciter.nameAr}
              loading="eager"
              className="w-full h-full object-cover object-top"
            />
          </div>
          {reciter.photoSource && (
            <p className="text-[11px] text-[#A9B2AE] text-center">{reciter.photoSource}</p>
          )}
        </div>

        <div className="lg:col-span-8 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-4xl font-display font-bold text-[#F5F3EE]">
                {reciter.nameAr}
              </h1>
              <p className="text-sm text-[#C8A253]">{reciter.titleAr}</p>
              <p className="text-xs text-[#A9B2AE]">
                {reciter.birthYear} – {reciter.deathYear} · {reciter.originAr}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const shareUrl = `${window.location.origin}/#/reciters/${reciter.id}`;
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: `${reciter.nameAr} — منصة تلاوة`,
                        text: `استمع إلى تلاوات ${reciter.nameAr} عبر منصة تلاوة`,
                        url: shareUrl,
                      });
                      return;
                    } catch {
                      // Fallback to clipboard
                    }
                  }
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    notify('تم نسخ رابط صفحة القارئ للمشاركة', 'success');
                  } catch {
                    notify('تعذر نسخ الرابط تلقائيًا', 'error');
                  }
                }}
                aria-label={`مشاركة صفحة ${reciter.nameAr}`}
                className="flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-medium text-[#F5F3EE] cursor-pointer transition-colors"
              >
                <Share2 className="w-4 h-4 text-[#C8A253]" />
                <span>مشاركة</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  void toggleFavorite({
                    id: reciterFavId,
                    type: 'reciter',
                    targetId: reciterFavId,
                    title: reciter.nameAr,
                    subtitle: reciter.titleAr,
                    reciterId: reciter.id,
                  })
                }
                className={`flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                  isReciterFav
                    ? 'bg-[#C8A253]/20 border-[#C8A253] text-[#C8A253]'
                    : 'bg-white/5 border-white/15 text-[#F5F3EE] hover:bg-white/10'
                }`}
              >
                <Heart className={`w-4 h-4 ${isReciterFav ? 'fill-current' : ''}`} />
                <span>{isReciterFav ? 'في القراء المفضلين' : 'حفظ في القراء المفضلين'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-[#0A0D0C]/55 border border-white/10 px-3.5 py-2.5">
              <p className="text-[11px] text-[#A9B2AE]">المدرسة القرآنية</p>
              <p className="text-xs sm:text-sm font-semibold text-[#F5F3EE] truncate">
                {reciter.schoolAr || 'مدرسة التلاوة الأصيلة'}
              </p>
            </div>
            <div className="rounded-xl bg-[#0A0D0C]/55 border border-white/10 px-3.5 py-2.5">
              <p className="text-[11px] text-[#A9B2AE]">المصاحف والتسجيلات</p>
              <p className="text-xs sm:text-sm font-semibold text-[#C8A253]">
                {toArabicDigits(reciter.collections.length)}{' '}
                {reciter.collections.length === 1 ? 'مصحف' : 'مصاحف'}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-xl bg-[#0A0D0C]/55 border border-white/10 px-3.5 py-2.5">
              <p className="text-[11px] text-[#A9B2AE]">السور المتاحة حاليًا</p>
              <p className="text-xs sm:text-sm font-semibold text-[#F5F3EE]">
                {toArabicDigits(availableSurahsInActive.length)} سورة
              </p>
            </div>
          </div>

          <p className="text-sm sm:text-base text-[#F5F3EE]/90 leading-relaxed">{reciter.bioAr}</p>

          {/* Style Filter Tabs & Play All Actions */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {styles.map((style) => {
                  const count =
                    style === 'الكل'
                      ? reciter.collections.length
                      : reciter.collections.filter((c) => c.style === style).length;
                  if (style !== 'الكل' && count === 0) return null;
                  return (
                    <button
                      key={style}
                      type="button"
                      onClick={() => {
                        setSelectedStyle(style);
                        setSelectedCollectionId('');
                      }}
                      className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                        selectedStyle === style
                          ? 'bg-[#0E6B4D] text-white'
                          : 'bg-white/5 text-[#A9B2AE] hover:text-white'
                      }`}
                    >
                      {style}
                    </button>
                  );
                })}
              </div>

              {fullCollectionQueue.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => playCollection(fullCollectionQueue, { shuffle: false })}
                    className="flex items-center gap-2 min-h-[42px] px-5 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-semibold shadow-md cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>تشغيل الكل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => playCollection(fullCollectionQueue, { shuffle: true })}
                    className="flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-[#C8A253] text-xs font-medium cursor-pointer"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>تشغيل عشوائي</span>
                  </button>
                </div>
              )}
            </div>

            {availableCollections.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableCollections.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setSelectedCollectionId(col.id)}
                    className={`px-3.5 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                      activeCollection?.id === col.id
                        ? 'border-[#C8A253] bg-[#C8A253]/15 text-[#C8A253]'
                        : 'border-white/10 bg-[#0A0D0C]/50 text-[#A9B2AE] hover:text-white'
                    }`}
                  >
                    {col.riwayah.includes('سورة')
                      ? col.riwayah
                      : `${col.riwayah} (${toArabicDigits(col.surahTotal)} سورة)`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Extra Curated Audio Links if any */}
      {extraCurated.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-display font-bold text-[#F5F3EE]">
            تسجيلات مختارة ومميزة للقارئ
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {extraCurated.map((c) => {
              const trk: AudioTrack = {
                id: c.id,
                reciterId: reciter.id,
                reciterName: reciter.nameAr,
                reciterPhoto: reciter.photoUrl,
                surahNumber: c.surahNumber,
                surahName: c.surahNameAr,
                style: c.style,
                riwayah: c.riwayah,
                audioUrl: c.audioUrl,
                isAvailable: c.isAvailable,
                sourceName: c.sourceName,
              };
              return (
                <div
                  key={c.id}
                  className="glass-panel rounded-xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#F5F3EE] truncate">
                      {c.surahNameAr}
                    </p>
                    <p className="text-xs text-[#A9B2AE] truncate">
                      {c.style} · {c.sourceName || 'تسجيل موثوق'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => addToQueue(trk)}
                      aria-label={`إضافة ${c.surahNameAr} للانتظار`}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-[#A9B2AE] hover:text-white hover:bg-white/5 cursor-pointer"
                    >
                      <ListEnd className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => playTrack(trk)}
                      aria-label={`تشغيل ${c.surahNameAr}`}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Full Surah Recordings Table/List */}
      <section className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F5F3EE]">
              السور والتلاوات المتاحة ({toArabicDigits(availableSurahsInActive.length)} سورة)
            </h2>
            {activeCollection && (
              <p className="text-xs text-[#A9B2AE] mt-1">
                {activeCollection.riwayah} · المصدر: {activeCollection.sourceName}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeCollection && (
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#121715] border border-white/10">
                <button
                  type="button"
                  onClick={() => setAvailabilityFilter('available')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    availabilityFilter === 'available'
                      ? 'bg-[#0E6B4D] text-white'
                      : 'text-[#A9B2AE] hover:text-white'
                  }`}
                >
                  المتاحة فقط (<span className="font-mono-nums">{toArabicDigits(availableSurahsInActive.length)}</span>)
                </button>
                <button
                  type="button"
                  onClick={() => setAvailabilityFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    availabilityFilter === 'all'
                      ? 'bg-[#0E6B4D] text-white'
                      : 'text-[#A9B2AE] hover:text-white'
                  }`}
                >
                  كل السور (١١٤)
                </button>
              </div>
            )}

            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#121715] border border-white/10">
              {(
                [
                  { id: 'all', label: 'الكل' },
                  { id: 'Meccan', label: 'مكية' },
                  { id: 'Medinan', label: 'مدنية' },
                ] as const
              ).map((rev) => (
                <button
                  key={rev.id}
                  type="button"
                  onClick={() => setRevelationFilter(rev.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    revelationFilter === rev.id
                      ? 'bg-[#C8A253] text-[#0A0D0C] font-bold'
                      : 'text-[#A9B2AE] hover:text-white'
                  }`}
                >
                  {rev.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#121715] border border-white/10">
              {(
                [
                  { id: 'all', label: '١–١١٤' },
                  { id: '1-30', label: '١–٣٠' },
                  { id: '31-70', label: '٣١–٧٠' },
                  { id: '71-114', label: '٧١–١١٤' },
                ] as const
              ).map((rng) => (
                <button
                  key={rng.id}
                  type="button"
                  onClick={() => setRangeFilter(rng.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-nums cursor-pointer transition-colors ${
                    rangeFilter === rng.id
                      ? 'bg-[#0E6B4D] text-white'
                      : 'text-[#A9B2AE] hover:text-white'
                  }`}
                >
                  {rng.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-[#A9B2AE] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={surahFilter}
                onChange={(e) => setSurahFilter(e.target.value)}
                placeholder="ابحث باسم السورة أو رقمها..."
                aria-label="تصفية السور"
                className="w-full pr-10 pl-4 py-2 rounded-xl bg-[#121715] border border-white/10 text-sm text-[#F5F3EE] placeholder:text-[#A9B2AE]/60 focus:outline-none focus:border-[#C8A253]"
              />
            </div>
          </div>
        </div>

        {/* Quick Surah Selector & Direct Listen Bar */}
        {activeCollection && availableSurahsInActive.length > 0 && (
          <div className="glass-panel rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-[#C8A253]/20">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <label
                htmlFor="quick-reciter-surah-select"
                className="text-xs font-medium text-[#C8A253] whitespace-nowrap"
              >
                اختر السورة التي تريد سماعها:
              </label>
              <select
                id="quick-reciter-surah-select"
                value={quickSurahNum}
                onChange={(e) => setQuickSurahNum(Number(e.target.value))}
                className="flex-1 sm:max-w-xs px-3.5 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE] focus:outline-none focus:border-[#C8A253]"
              >
                {availableSurahsInActive.map((s) => (
                  <option key={s.number} value={s.number}>
                    {toArabicDigits(s.number)}. {formatSurahDisplayName(s.name)} ({toArabicDigits(s.numberOfAyahs)} آية)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate({ page: 'tahfeez', surah: quickSurahNum })}
                className="flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#C8A253]/15 hover:bg-[#C8A253]/25 border border-[#C8A253]/40 text-xs font-medium text-[#C8A253] cursor-pointer"
              >
                <GraduationCap className="w-4 h-4" />
                <span>تحفيظ</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const chosen = buildTrackForSurah(quickSurahNum);
                  if (chosen) playTrack(chosen, fullCollectionQueue);
                }}
                className="flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-semibold cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>تشغيل السورة المختارة</span>
              </button>
            </div>
          </div>
        )}

        {!activeCollection ? (
          <div className="glass-panel rounded-2xl p-8 text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-[#C8A253] mx-auto" />
            <p className="text-sm text-[#F5F3EE]">
              لا تتوفر مصاحف صوتية كاملة مضافة لهذا القارئ حاليًا.
            </p>
          </div>
        ) : filteredSurahs.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center space-y-3">
            <p className="text-sm text-[#A9B2AE]">لا توجد سورة مطابقة لبحثك في هذه القائمة.</p>
            <button
              type="button"
              onClick={() => {
                setSurahFilter('');
                setAvailabilityFilter('all');
              }}
              className="px-4 py-2 rounded-xl bg-[#0E6B4D] text-white text-xs cursor-pointer"
            >
              عرض جميع السور
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredSurahs.map((surah) => {
              const cleanName = formatSurahDisplayName(surah.name);
              const available = isSurahAvailableInCollection(activeCollection, surah.number);
              const track = buildTrackForSurah(surah.number);
              const isCurrent =
                currentTrack?.reciterId === reciter.id &&
                currentTrack?.surahNumber === surah.number &&
                currentTrack?.style === activeCollection.style;
              const favId = `rec_${reciter.id}_${surah.number}`;
              const favored = isFavorite(favId);

              const handlePlayCard = () => {
                if (!available || !track) return;
                if (isCurrent) {
                  togglePlayPause();
                } else {
                  playTrack(track, fullCollectionQueue);
                }
              };

              return (
                <div
                  key={surah.number}
                  className={`glass-panel card-interactive rounded-2xl p-4 flex items-center justify-between gap-3 ${
                    isCurrent
                      ? 'border-[#C8A253]/75 bg-[#171F1C]'
                      : available
                      ? 'hover:border-[#C8A253]/35'
                      : 'opacity-70'
                  }`}
                >
                  <button
                    type="button"
                    onClick={handlePlayCard}
                    disabled={!available}
                    aria-label={
                      available
                        ? `تشغيل ${cleanName} بصوت ${reciter.nameAr}`
                        : `${cleanName} غير متاحة في هذا الأرشيف`
                    }
                    className="flex items-center gap-3.5 min-w-0 flex-1 text-right cursor-pointer disabled:cursor-default"
                  >
                    <span
                      className={`w-10 h-10 rounded-xl bg-[#0A0D0C] border flex items-center justify-center text-sm font-mono-nums shrink-0 ${
                        isCurrent ? 'border-[#C8A253]/60 text-[#C8A253]' : 'border-white/10 text-[#C8A253]'
                      }`}
                    >
                      {isCurrent ? (
                        <AudioWaveBars active={isPlaying} />
                      ) : (
                        toArabicDigits(surah.number)
                      )}
                    </span>
                    <div className="min-w-0">
                      <h3
                        className={`text-sm sm:text-base font-semibold truncate ${
                          isCurrent ? 'text-[#C8A253]' : 'text-[#F5F3EE]'
                        }`}
                      >
                        {cleanName}
                      </h3>
                      <p className="text-xs text-[#A9B2AE] truncate">
                        {surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'} ·{' '}
                        {toArabicDigits(surah.numberOfAyahs)} آية
                        {!available ? ' · غير متاحة بهذا المصحف' : ''}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate({ page: 'tahfeez', surah: surah.number })}
                      aria-label={`تحفيظ ${cleanName}`}
                      title="تحفيظ السورة مع المعلم"
                      className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl text-[#A9B2AE] hover:text-[#C8A253] hover:bg-white/5 cursor-pointer"
                    >
                      <GraduationCap className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate({ page: 'mushaf', surah: surah.number })}
                      aria-label={`قراءة ${cleanName} في المصحف`}
                      title="قراءة في المصحف"
                      className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl text-[#A9B2AE] hover:text-[#C8A253] hover:bg-white/5 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>

                    {available && track ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void toggleFavorite({
                              id: favId,
                              type: 'recitation',
                              targetId: favId,
                              title: cleanName,
                              subtitle: `${reciter.nameAr} · ${activeCollection.style}`,
                              audioUrl: track.audioUrl,
                              reciterId: reciter.id,
                              surahNumber: surah.number,
                            })
                          }
                          aria-label={`تفضيل ${cleanName}`}
                          className={`min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl hover:bg-white/5 cursor-pointer ${
                            favored ? 'text-[#C8A253]' : 'text-[#A9B2AE]'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${favored ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => addToQueue(track)}
                          aria-label={`إضافة ${cleanName} إلى قائمة الانتظار`}
                          className="hidden sm:flex min-w-[34px] min-h-[34px] items-center justify-center rounded-xl text-[#A9B2AE] hover:text-white hover:bg-white/5 cursor-pointer"
                        >
                          <ListEnd className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onPickPlaylistForTrack(track)}
                          aria-label={`حفظ ${cleanName} في قائمة`}
                          className="hidden sm:flex min-w-[34px] min-h-[34px] items-center justify-center rounded-xl text-[#A9B2AE] hover:text-white hover:bg-white/5 cursor-pointer"
                        >
                          <ListPlus className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handlePlayCard}
                          aria-label={isCurrent && isPlaying ? `إيقاف ${cleanName}` : `تشغيل ${cleanName}`}
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white cursor-pointer"
                        >
                          {isCurrent && isPlaying ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4 fill-current" />
                          )}
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-[#A9B2AE] px-2">غير متاح</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};
