import React, { useMemo, useState } from 'react';
import { Heart, Play, Search, Shuffle, UserCheck } from 'lucide-react';
import { ReciterImage } from '../components/ReciterImage';
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

type RecitersFilter = 'الكل' | 'المفضلون' | ReciterSchool | RecordingStyle;

const SCHOOL_FILTERS: ReciterSchool[] = [
  'الشيوخ المصريون الراحلون',
  'المدرسة المصرية',
  'أئمة الحرمين والخليج',
  'قراء العالم الإسلامي',
];

export const RecitersPage: React.FC<RecitersPageProps> = ({ navigate }) => {
  const { reciters } = useAppData();
  const { playSurahByReciter, playCollection } = useAudioPlayer();
  const { isFavorite, toggleFavorite } = useAuth();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RecitersFilter>('الكل');
  const [selectedSurahByReciter, setSelectedSurahByReciter] = useState<Record<string, number>>({});

  const filteredReciters = useMemo(() => {
    const q = normalizeArabic(query);
    return reciters.filter((r) => {
      if (filter === 'المفضلون') {
        if (!isFavorite(`reciter_${r.id}`)) return false;
      } else if ((SCHOOL_FILTERS as readonly string[]).includes(filter)) {
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
  }, [reciters, query, filter, isFavorite]);

  const favCount = useMemo(
    () => reciters.filter((r) => isFavorite(`reciter_${r.id}`)).length,
    [reciters, isFavorite]
  );

  const filterTabs: Array<{ id: RecitersFilter; label: string }> = [
    { id: 'الكل', label: `الكل (${toArabicDigits(reciters.length)})` },
    { id: 'المفضلون', label: `المفضلون (${toArabicDigits(favCount)})` },
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

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-7">
      <div className="glass-gold rounded-3xl p-6 sm:p-8 space-y-5 border border-[#C8A253]/25">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs text-[#C8A253] font-medium">الأرشيف الصوتي الموثق</p>
            <h1 className="text-3xl font-display font-bold text-[#F5F3EE]">
              مكتبة أعلام القراء ({toArabicDigits(reciters.length)} قارئًا)
            </h1>
            <p className="text-sm text-[#A9B2AE] max-w-2xl">
              تضم الشيوخ المصريين الراحلين من الرعيل الذهبي وكبار القراء في مصر وأئمة الحرمين والعالم الإسلامي، مع تشغيل متواصل وعشوائي لجميع السور.
            </p>
          </div>

          <div className="relative w-full md:w-72">
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
        </div>

        {/* School & Style Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
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
            }}
            className="px-4 py-2 rounded-xl bg-[#0E6B4D] text-white text-xs cursor-pointer"
          >
            عرض جميع القراء
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredReciters.map((reciter) => {
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
            const uniqueStyles = Array.from(new Set(reciter.collections.map((c) => c.style)));
            return (
              <article
                key={reciter.id}
                className="glass-panel card-interactive rounded-2xl overflow-hidden flex flex-col sm:flex-row hover:border-[#C8A253]/35"
              >
                <div className="sm:w-52 aspect-[4/3] sm:aspect-auto bg-[#0A0D0C] shrink-0">
                  <ReciterImage
                    src={reciter.photoUrl}
                    alt={reciter.nameAr}
                    className="w-full h-full object-cover object-top"
                  />
                </div>

                <div className="p-5 sm:p-6 flex flex-col justify-between flex-1 space-y-4">
                  <div className="space-y-2">
                    <h2 className="text-xl font-display font-bold text-[#F5F3EE]">
                      {reciter.nameAr}
                    </h2>
                    <p className="text-xs text-[#C8A253]">{reciter.titleAr}</p>
                    <p className="text-xs text-[#A9B2AE]">
                      {reciter.birthYear} – {reciter.deathYear} · {reciter.originAr}
                    </p>
                    <p className="text-xs text-[#A9B2AE] leading-relaxed line-clamp-2">
                      {reciter.bioAr}
                    </p>
                    {uniqueStyles.length > 0 && (
                      <p className="text-xs text-[#F5F3EE]/80 pt-0.5">
                        الإصدارات المتاحة: {uniqueStyles.join(' · ')}
                        {reciter.collections.length > 1
                          ? ` (${toArabicDigits(reciter.collections.length)} مصاحف)`
                          : ''}
                      </p>
                    )}

                    {/* Quick Surah Picker right inside every reciter card */}
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
                      className="flex-1 flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-medium text-[#F5F3EE] cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4 text-[#C8A253]" />
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
                      aria-label={isRecFav ? `إزالة ${reciter.nameAr} من المفضلة` : `تفضيل ${reciter.nameAr}`}
                      title={isRecFav ? 'في المفضلة' : 'إضافة للمفضلة'}
                      className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border cursor-pointer transition-transform active:scale-95 ${
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
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-[#C8A253] cursor-pointer"
                    >
                      <Shuffle className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => playSurahByReciter(reciter, pickedSurah)}
                      aria-label={`استماع بصوت ${reciter.nameAr}`}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
};
