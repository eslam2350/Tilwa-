import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Heart, Play, Search, User } from 'lucide-react';
import { ReciterImage } from '../components/ReciterImage';
import { QURAN_META } from '../data/reciters';
import { useAppData } from '../contexts/AppDataContext';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAuth } from '../contexts/AuthContext';
import { searchQuranVerses, type QuranSearchMatch } from '../services/quranApi';
import type { AppRoute } from '../types/tilawa';
import {
  buildSurahAudioUrl,
  formatSurahDisplayName,
  getDefaultPlayableSurahNumber,
  isSurahAvailableInCollection,
  toArabicDigits,
} from '../utils/quranHelpers';
import { runLocalSearch } from '../utils/searchEngine';

interface SearchPageProps {
  initialQuery?: string;
  navigate: (next: AppRoute) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({ initialQuery = '', navigate }) => {
  const { reciters, curatedRecitations } = useAppData();
  const { playSurahByReciter, playTrack } = useAudioPlayer();
  const { isFavorite, toggleFavorite } = useAuth();

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<'all' | 'reciters' | 'surahs' | 'verses'>('all');
  const [verseMatches, setVerseMatches] = useState<QuranSearchMatch[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(false);

  const localResults = useMemo(
    () => runLocalSearch(query, reciters, QURAN_META.surahs, curatedRecitations),
    [query, reciters, curatedRecitations]
  );

  // Debounced live verse search via AlQuran.cloud
  useEffect(() => {
    const cleaned = query.trim().replace(/^سورة\s+/u, '');
    const nonVerseKeywords = [
      'المنشاوي',
      'البنا',
      'الحصري',
      'عبد الباسط',
      'رفعت',
      'مصطفى إسماعيل',
      'الطبلاوي',
      'الصياد',
      'السويسي',
      'عامر',
      'عبد الله كامل',
      'نعينع',
      'جبريل',
      'المعصراوي',
      'علي جابر',
      'محمد أيوب',
      'الحذيفي',
      'العفاسي',
      'المعيقلي',
      'السديس',
      'الشريم',
      'الدوسري',
      'الغامدي',
      'القطامي',
      'المطرود',
      'البدير',
      'القاسم',
      'الجهني',
      'بليلة',
      'الكلباني',
      'الثبيتي',
      'أيمن سويد',
      'الكوشي',
      'الزين',
      'مرتل',
      'مجود',
      'معلم',
      'حفل إذاعي',
    ];
    if (cleaned.length < 3 || (activeTab !== 'verses' && nonVerseKeywords.includes(cleaned))) {
      setVerseMatches([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingVerses(true);
      try {
        const res = await searchQuranVerses(cleaned);
        if (!cancelled) {
          setVerseMatches(res);
        }
      } catch {
        if (!cancelled) {
          setVerseMatches([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingVerses(false);
        }
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, activeTab]);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
      <div className="space-y-4">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]">
          البحث الذكي في منصة تلاوة
        </h1>

        <div className="relative">
          <Search className="w-5 h-5 text-[#C8A253] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن قارئ، سورة، آية قرآنية، تلاوة، أو نوع التسجيل (مرتل / مجود)..."
            aria-label="ابحث في المنصة"
            className="w-full pr-12 pl-4 py-4 rounded-2xl bg-[#121715] border border-[#C8A253]/30 text-base text-[#F5F3EE] placeholder:text-[#A9B2AE]/60 focus:outline-none focus:border-[#C8A253]"
          />
        </div>

        {/* Live Suggestions */}
        {localResults.suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#A9B2AE]">اقتراحات سريعة:</span>
            {localResults.suggestions.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => setQuery(sug)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#F5F3EE] cursor-pointer"
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 pt-2">
          {[
            { id: 'all' as const, label: 'الكل' },
            { id: 'reciters' as const, label: `القراء (${toArabicDigits(localResults.reciters.length)})` },
            { id: 'surahs' as const, label: `السور (${toArabicDigits(localResults.surahs.length)})` },
            { id: 'verses' as const, label: `الآيات (${toArabicDigits(verseMatches.length)})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-medium cursor-pointer ${
                activeTab === t.id
                  ? 'bg-[#0E6B4D] text-white'
                  : 'bg-white/5 text-[#A9B2AE] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!query.trim() ? (
        <div className="glass-panel rounded-2xl p-10 text-center space-y-2">
          <p className="text-base text-[#F5F3EE]">ابدأ بكتابة اسم قارئ أو سورة أو جزء من آية</p>
          <p className="text-xs text-[#A9B2AE]">
            يدعم محرك البحث التجاهل التلقائي للتشكيل ويعرض نتائج فورية أثناء الكتابة.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Reciters Matches */}
          {(activeTab === 'all' || activeTab === 'reciters') && localResults.reciters.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-display font-bold text-[#C8A253]">القراء</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {localResults.reciters.map((r) => {
                  const recFavId = `reciter_${r.id}`;
                  const isRecFav = isFavorite(recFavId);
                  return (
                    <div
                      key={r.id}
                      className="glass-panel card-interactive rounded-2xl p-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <ReciterImage
                          src={r.photoUrl}
                          alt={r.nameAr}
                          loading="lazy"
                          className="w-14 h-14 rounded-xl object-cover object-top shrink-0"
                        />
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-[#F5F3EE] truncate">{r.nameAr}</h3>
                          <p className="text-xs text-[#A9B2AE] truncate">{r.titleAr}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            void toggleFavorite({
                              id: recFavId,
                              type: 'reciter',
                              targetId: recFavId,
                              title: r.nameAr,
                              subtitle: r.titleAr,
                              reciterId: r.id,
                            })
                          }
                          aria-label={isRecFav ? `إزالة ${r.nameAr} من المفضلة` : `تفضيل ${r.nameAr}`}
                          className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl border cursor-pointer ${
                            isRecFav
                              ? 'bg-[#C8A253]/20 border-[#C8A253] text-[#C8A253]'
                              : 'bg-white/5 border-white/10 text-[#A9B2AE] hover:text-[#C8A253]'
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isRecFav ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate({ page: 'reciter', reciterId: r.id })}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#F5F3EE] cursor-pointer"
                        >
                          <User className="w-3.5 h-3.5 text-[#C8A253]" />
                          <span>الملف</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Recording Styles Matches */}
          {activeTab === 'all' && localResults.styles.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-display font-bold text-[#C8A253]">أنواع التلاوات المتاحة</h2>
              <div className="flex flex-wrap gap-3">
                {localResults.styles.map((st) => (
                  <button
                    key={st.label}
                    type="button"
                    onClick={() => navigate({ page: 'reciters' })}
                    className="glass-panel px-5 py-3 rounded-xl text-sm text-[#F5F3EE] hover:border-[#C8A253]/40 cursor-pointer"
                  >
                    {st.label} · {toArabicDigits(st.count)} مصاحف صوتية
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Curated Recitations Matches */}
          {activeTab === 'all' && localResults.recitations.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-display font-bold text-[#C8A253]">التلاوات المختارة</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {localResults.recitations.map((item) => {
                  const reciter = reciters.find((r) => r.id === item.reciterId);
                  if (!reciter) return null;
                  return (
                    <div
                      key={item.id}
                      className="glass-panel rounded-xl p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#F5F3EE] truncate">
                          {item.surahNameAr}
                        </p>
                        <p className="text-xs text-[#A9B2AE] truncate">
                          {reciter.nameAr} · {item.style}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          playTrack({
                            id: item.id,
                            reciterId: reciter.id,
                            reciterName: reciter.nameAr,
                            reciterPhoto: reciter.photoUrl,
                            surahNumber: item.surahNumber,
                            surahName: item.surahNameAr,
                            style: item.style,
                            audioUrl: item.audioUrl,
                            isAvailable: item.isAvailable,
                          })
                        }
                        aria-label={`تشغيل ${item.surahNameAr}`}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-[#0E6B4D] text-white cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Surahs Matches */}
          {(activeTab === 'all' || activeTab === 'surahs') && localResults.surahs.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-display font-bold text-[#C8A253]">السور</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {localResults.surahs.slice(0, 18).map((s) => {
                  const cleanName = formatSurahDisplayName(s.name);
                  const defaultRec = reciters[0];
                  const col = defaultRec?.collections[0];
                  const favKey = defaultRec ? `rec_${defaultRec.id}_${s.number}` : '';
                  const favored = favKey ? isFavorite(favKey) : false;
                  return (
                    <div
                      key={s.number}
                      className="glass-panel card-interactive rounded-xl p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#F5F3EE] truncate">
                          {toArabicDigits(s.number)}. {cleanName}
                        </p>
                        <p className="text-xs text-[#A9B2AE]">
                          {s.revelationType === 'Meccan' ? 'مكية' : 'مدنية'} ·{' '}
                          {toArabicDigits(s.numberOfAyahs)} آية
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {defaultRec && col && (
                          <button
                            type="button"
                            onClick={() =>
                              void toggleFavorite({
                                id: favKey,
                                type: 'recitation',
                                targetId: favKey,
                                title: cleanName,
                                subtitle: `${defaultRec.nameAr} · ${col.style}`,
                                audioUrl: buildSurahAudioUrl(col.server, s.number, col.surahUrls),
                                reciterId: defaultRec.id,
                                surahNumber: s.number,
                              })
                            }
                            aria-label={`تفضيل ${cleanName}`}
                            className={`min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg hover:bg-white/5 cursor-pointer ${
                              favored ? 'text-[#C8A253]' : 'text-[#A9B2AE]'
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${favored ? 'fill-current' : ''}`} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate({ page: 'mushaf', surah: s.number })}
                          aria-label={`قراءة ${cleanName}`}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-[#C8A253] cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!defaultRec) return;
                            const ok = defaultRec.collections.some((c) =>
                              isSurahAvailableInCollection(c, s.number)
                            );
                            playSurahByReciter(
                              defaultRec,
                              ok ? s.number : getDefaultPlayableSurahNumber(defaultRec)
                            );
                          }}
                          aria-label={`تشغيل ${s.name}`}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-[#0E6B4D] text-white cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Verses Matches */}
          {(activeTab === 'all' || activeTab === 'verses') && (
            <section className="space-y-3">
              <h2 className="text-lg font-display font-bold text-[#C8A253]">
                الآيات القرآنية {loadingVerses ? '(جاري البحث...)' : ''}
              </h2>
              {verseMatches.length === 0 && !loadingVerses ? (
                <p className="text-xs text-[#A9B2AE]">
                  {query.trim().length < 3
                    ? 'اكتب ٣ أحرف على الأقل للبحث داخل آيات القرآن الكريم.'
                    : 'لا توجد آيات مطابقة لهذا النص.'}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {verseMatches.map((m) => (
                    <button
                      key={m.number}
                      type="button"
                      onClick={() => navigate({ page: 'mushaf', surah: m.surahNumber })}
                      className="w-full text-right glass-panel rounded-xl p-4 hover:border-[#C8A253]/40 cursor-pointer space-y-1.5"
                    >
                      <p className="font-quran text-lg text-[#F5F3EE] leading-loose">{m.text}</p>
                      <p className="text-xs text-[#C8A253]">
                        {formatSurahDisplayName(m.surahName)} · الآية {toArabicDigits(m.numberInSurah)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </main>
  );
};
