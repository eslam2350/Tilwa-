import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Compass,
  Flame,
  Headphones,
  HeartHandshake,
  Layers,
  ListMusic,
  Mic,
  Pause,
  Play,
  Podcast,
  Search,
  Shuffle,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { AudioWaveBars } from '../components/AudioWaveBars';
import { ReciterImage } from '../components/ReciterImage';
import { SectionBoostWrapper } from '../components/SectionBoostWrapper';
import { BASIRA_HERO_IMAGE } from '../data/basiraData';
import { useAppData } from '../contexts/AppDataContext';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import type { AppRoute, BasiraCategory } from '../types/tilawa';
import {
  BASIRA_CATEGORIES,
  filterBasiraEpisodes,
  formatBasiraDuration,
  getPreacherStats,
  loadBasiraProgressMap,
} from '../utils/basiraHelpers';
import { formatTimeSeconds, toArabicDigits } from '../utils/quranHelpers';

interface BasiraPageProps {
  initialCategory?: string;
  navigate: (next: AppRoute) => void;
}

const EPISODES_BATCH_SIZE = 18;
type BasiraSortMode = 'curated' | 'newest' | 'shortest' | 'longest';

const CATEGORY_BOX_META: Record<
  BasiraCategory,
  { subtitle: string; accent: string; icon: React.ReactNode }
> = {
  'تصحيح المفاهيم الدينية': {
    subtitle: 'فهم متوازن ومؤصل لعقائدنا وعباداتنا',
    accent: 'border-[#C8A253]/35 bg-[#C8A253]/10 text-[#E5C67E]',
    icon: <Compass className="w-4 h-4" />,
  },
  'التوبة والذنوب': {
    subtitle: 'طرق العودة الصادقة ورجاء رحمة الله',
    accent: 'border-[#178A64]/45 bg-[#0E6B4D]/15 text-[#6EE7B7]',
    icon: <Sparkles className="w-4 h-4" />,
  },
  'قضايا الشباب': {
    subtitle: 'علو الهمة ومواجهة التحديات المعاصرة',
    accent: 'border-[#C8A253]/35 bg-[#C8A253]/10 text-[#C8A253]',
    icon: <Flame className="w-4 h-4" />,
  },
  'الأخلاق والتربية': {
    subtitle: 'تزكية النفس وبناء البيت والمربي الصالح',
    accent: 'border-[#178A64]/45 bg-[#0E6B4D]/15 text-[#6EE7B7]',
    icon: <HeartHandshake className="w-4 h-4" />,
  },
  العبادات: {
    subtitle: 'تذوق الصلاة والطهارة وروح الطاعات',
    accent: 'border-[#C8A253]/35 bg-[#C8A253]/10 text-[#E5C67E]',
    icon: <Layers className="w-4 h-4" />,
  },
  'العلاقات الاجتماعية': {
    subtitle: 'بر الوالدين والأسرة والتسامح وجبر الخواطر',
    accent: 'border-[#178A64]/45 bg-[#0E6B4D]/15 text-[#6EE7B7]',
    icon: <Users className="w-4 h-4" />,
  },
  'قصص وعبر': {
    subtitle: 'سير الأنبياء والسيرة النبوية ومواقف الصحابة',
    accent: 'border-[#C8A253]/35 bg-[#C8A253]/10 text-[#C8A253]',
    icon: <Podcast className="w-4 h-4" />,
  },
  'فتن العصر': {
    subtitle: 'ثبات القلب أمام الشبهات ومغريات الفتن',
    accent: 'border-[#178A64]/45 bg-[#0E6B4D]/15 text-[#6EE7B7]',
    icon: <Compass className="w-4 h-4" />,
  },
  'نصائح دعوية': {
    subtitle: 'مواعظ نافعة ومفاتيح للطمأنينة النفسية',
    accent: 'border-[#C8A253]/35 bg-[#C8A253]/10 text-[#E5C67E]',
    icon: <Sparkles className="w-4 h-4" />,
  },
  'حلقات قصيرة': {
    subtitle: 'ومضات صوتية مركزة في دقائق معدودة',
    accent: 'border-[#178A64]/45 bg-[#0E6B4D]/15 text-[#6EE7B7]',
    icon: <Headphones className="w-4 h-4" />,
  },
  'محاضرات طويلة': {
    subtitle: 'مجالس علمية مطوّلة للتدبر والاستيعاب',
    accent: 'border-[#C8A253]/35 bg-[#C8A253]/10 text-[#C8A253]',
    icon: <ListMusic className="w-4 h-4" />,
  },
};

export const BasiraPage: React.FC<BasiraPageProps> = ({ initialCategory, navigate }) => {
  const { basiraPreachers, basiraEpisodes, basiraPlaylists } = useAppData();
  const {
    currentTrack,
    isPlaying,
    playBasiraEpisode,
    playBasiraPlaylist,
    togglePlayPause,
  } = useAudioPlayer();

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'الكل');
  const [selectedPreacherId, setSelectedPreacherId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortMode, setSortMode] = useState<BasiraSortMode>('curated');
  const [visibleCount, setVisibleCount] = useState<number>(EPISODES_BATCH_SIZE);
  const episodesSectionRef = useRef<HTMLElement | null>(null);

  const progressMap = useMemo(() => loadBasiraProgressMap(), []);
  const preacherMap = useMemo(
    () => new Map(basiraPreachers.map((p) => [p.id, p])),
    [basiraPreachers]
  );

  const filteredEpisodes = useMemo(
    () =>
      filterBasiraEpisodes({
        episodes: basiraEpisodes,
        preachers: basiraPreachers,
        category: selectedCategory,
        preacherId: selectedPreacherId,
        query: searchQuery,
      }),
    [basiraEpisodes, basiraPreachers, selectedCategory, selectedPreacherId, searchQuery]
  );

  const sortedEpisodes = useMemo(() => {
    if (sortMode === 'curated') return filteredEpisodes;
    const copy = [...filteredEpisodes];
    if (sortMode === 'newest') {
      copy.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.order - a.order);
    } else if (sortMode === 'shortest') {
      copy.sort((a, b) => (a.durationSeconds || 999999) - (b.durationSeconds || 999999));
    } else if (sortMode === 'longest') {
      copy.sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0));
    }
    return copy;
  }, [filteredEpisodes, sortMode]);

  useEffect(() => {
    setVisibleCount(EPISODES_BATCH_SIZE);
  }, [selectedCategory, selectedPreacherId, searchQuery, sortMode]);

  const visibleEpisodes = useMemo(
    () => sortedEpisodes.slice(0, visibleCount),
    [sortedEpisodes, visibleCount]
  );

  const featuredEpisode = useMemo(
    () => basiraEpisodes.find((e) => e.featured) || basiraEpisodes[0] || null,
    [basiraEpisodes]
  );

  const handleSelectCategoryBox = (category: string) => {
    setSelectedCategory(category);
    episodesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePlayAllFiltered = (shuffle = false) => {
    const first = sortedEpisodes[0];
    if (!first) return;
    if (shuffle) {
      const list = [...sortedEpisodes].sort(() => Math.random() - 0.5);
      playBasiraEpisode(list[0], preacherMap.get(list[0].preacherId), basiraPreachers, list, {
        resume: false,
      });
    } else {
      playBasiraEpisode(first, preacherMap.get(first.preacherId), basiraPreachers, sortedEpisodes);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-28 space-y-12">
      {/* 1. Split Editorial Sanctuary Hero (Audio-Only Podcast Hub) */}
      <SectionBoostWrapper sectionId="basiraSection">
        <section className="relative overflow-hidden rounded-3xl border border-[#C8A253]/30 bg-[#0C110F] shadow-2xl">
          <div aria-hidden="true" className="sanctuary-hairline absolute top-0 inset-x-0" />
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#C8A253] font-medium">
                  <Podcast className="w-4 h-4 shrink-0" />
                  <span>بصيرة — بودكاست دعوي صوتي خالص دون فيديو</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-display font-bold text-[#F5F3EE] leading-[1.3] text-balance">
                  مجالس الوعي وتزكية القلوب بأصوات نخبة من المشايخ والدعاة
                </h1>

                <p className="text-sm sm:text-base text-[#A9B2AE] leading-relaxed max-w-2xl">
                  استمع مباشرة إلى حلقات وسلاسل دعوية مختارة في بوكسات موضوعية مرتبة تضم إمام الدعاة الشيخ الشعراوي، والشيخ محمد حسين يعقوب، والشيخ أمجد سمير، والشيخ محمد الغليظ، ود. عمر عبد الكافي، ود. محمد راتب النابلسي، والشيخ نبيل العوضي مع حفظ موضع الاستماع والتشغيل المتتابع.
                </p>
              </div>

              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  {featuredEpisode && (
                    <button
                      type="button"
                      onClick={() =>
                        playBasiraEpisode(
                          featuredEpisode,
                          preacherMap.get(featuredEpisode.preacherId),
                          basiraPreachers,
                          basiraEpisodes
                        )
                      }
                      className="inline-flex items-center gap-2 min-h-[44px] px-6 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-[#F5F3EE] text-sm font-semibold shadow-lg transition-colors cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>استمع للحلقة المختارة</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handlePlayAllFiltered(true)}
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-[#C8A253]/30 text-[#F5F3EE] text-sm font-medium transition-colors cursor-pointer"
                  >
                    <Shuffle className="w-4 h-4 text-[#C8A253]" />
                    <span>تشغيل عشوائي للحلقات</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#A9B2AE] pt-2 border-t border-white/10">
                  <span>
                    <strong className="text-[#C8A253] font-mono-nums">
                      {toArabicDigits(basiraPreachers.length)}
                    </strong>{' '}
                    دعاة ومشايخ
                  </span>
                  <span>·</span>
                  <span>
                    <strong className="text-[#C8A253] font-mono-nums">
                      {toArabicDigits(basiraEpisodes.length)}
                    </strong>{' '}
                    حلقة صوتية
                  </span>
                  <span>·</span>
                  <span>
                    <strong className="text-[#C8A253] font-mono-nums">
                      {toArabicDigits(basiraPlaylists.length)}
                    </strong>{' '}
                    سلسلة متتابعة
                  </span>
                  <span>·</span>
                  <span>
                    <strong className="text-[#C8A253] font-mono-nums">
                      {toArabicDigits(BASIRA_CATEGORIES.length)}
                    </strong>{' '}
                    بوكسًا موضوعيًا
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 relative min-h-[240px] lg:min-h-full bg-[#080B0A]">
              <img
                src={BASIRA_HERO_IMAGE}
                alt="استوديو بودكاست بصيرة الصوتي"
                className="w-full h-full object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-l from-[#0C110F] via-[#0C110F]/25 to-transparent"
              />
              <div className="absolute bottom-4 right-4 left-4 glass-panel rounded-2xl p-3.5 border border-[#C8A253]/25 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0E6B4D]/30 border border-[#C8A253]/40 flex items-center justify-center text-[#C8A253] shrink-0">
                  <Headphones className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#F5F3EE] truncate">
                    تجربة استماع صوتية نقية ١٠٠٪
                  </p>
                  <p className="text-[11px] text-[#A9B2AE] truncate">
                    سرعات متعددة حتى 2x · استئناف تلقائي · دون فيديو أو تشتيت
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </SectionBoostWrapper>

      {/* 2. Curated Symmetrical Basira Topic Boxes (بوكسات وتصنيفات بصيرة) */}
      <section aria-labelledby="basira-boxes-heading" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2
              id="basira-boxes-heading"
              className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]"
            >
              بوكسات وتصنيفات بصيرة الموضوعية
            </h2>
            <p className="text-xs sm:text-sm text-[#A9B2AE]">
              تقسيم متناسق لجميع الموضوعات الدعوية — اختر البوكس للانتقال الفوري إلى حلقاته الصوتية
            </p>
          </div>
          {selectedCategory !== 'الكل' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('الكل')}
              className="text-xs text-[#C8A253] hover:underline cursor-pointer"
            >
              عرض كل الحلقات ({toArabicDigits(basiraEpisodes.length)})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {BASIRA_CATEGORIES.map((cat) => {
            const meta = CATEGORY_BOX_META[cat];
            const catEpisodes = basiraEpisodes.filter((ep) => ep.category === cat);
            const active = selectedCategory === cat;
            return (
              <div
                key={cat}
                className={`rounded-2xl p-4 border flex flex-col justify-between gap-3 transition-all ${
                  active
                    ? 'glass-gold border-[#C8A253]/70 shadow-lg'
                    : 'glass-panel border-white/10 hover:border-[#C8A253]/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectCategoryBox(cat)}
                  className="text-right space-y-2 w-full cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${meta.accent}`}
                    >
                      {meta.icon}
                    </span>
                    <span className="text-[11px] font-mono-nums text-[#C8A253]">
                      {toArabicDigits(catEpisodes.length)} حلقة
                    </span>
                  </div>
                  <h3 className="text-sm font-display font-bold text-[#F5F3EE] leading-snug">
                    {cat}
                  </h3>
                  <p className="text-[11px] text-[#A9B2AE] leading-relaxed line-clamp-2">
                    {meta.subtitle}
                  </p>
                </button>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectCategoryBox(cat)}
                    className="text-[11px] text-[#C8A253] hover:underline cursor-pointer font-medium"
                  >
                    استعراض البوكس
                  </button>
                  {catEpisodes[0] && (
                    <button
                      type="button"
                      onClick={() =>
                        playBasiraEpisode(
                          catEpisodes[0],
                          preacherMap.get(catEpisodes[0].preacherId),
                          basiraPreachers,
                          catEpisodes
                        )
                      }
                      aria-label={`تشغيل حلقات ${cat}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0E6B4D] hover:bg-[#178A64] text-[10px] font-semibold text-white cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>تشغيل</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Preachers Directory with Authentic Portraits */}
      <section aria-labelledby="basira-preachers-heading" className="space-y-5">
        <div className="space-y-1">
          <h2
            id="basira-preachers-heading"
            className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]"
          >
            الدعاة والمشايخ ({toArabicDigits(basiraPreachers.length)})
          </h2>
          <p className="text-xs sm:text-sm text-[#A9B2AE]">
            اختر أي شيخ لفتح صفحته المستقلة واستعراض سيرته وتخصصاته وجميع حلقاته وقوائمه الصوتية
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {basiraPreachers.map((preacher) => {
            const stats = getPreacherStats(preacher, basiraEpisodes, basiraPlaylists);
            const latest = stats.latestEpisodes[0];
            return (
              <article
                key={preacher.id}
                className="glass-panel card-interactive perf-card rounded-2xl overflow-hidden flex flex-col justify-between border border-white/10 hover:border-[#C8A253]/45"
              >
                <div>
                  <div className="aspect-[4/3] bg-[#0A0D0C] relative overflow-hidden">
                    <ReciterImage
                      src={preacher.photoUrl}
                      alt={preacher.nameAr}
                      loading="lazy"
                      className="w-full h-full object-cover object-top"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-[#121715] via-transparent to-transparent"
                    />
                    <span className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-[#0A0D0C]/85 border border-[#C8A253]/35 text-[10px] font-mono-nums text-[#C8A253]">
                      {toArabicDigits(stats.totalEpisodes)} حلقة
                    </span>
                  </div>

                  <div className="p-4 space-y-2">
                    <h3 className="text-base font-display font-bold text-[#F5F3EE] truncate">
                      {preacher.nameAr}
                    </h3>
                    <p className="text-xs text-[#C8A253] line-clamp-2 leading-relaxed">
                      {preacher.titleAr}
                    </p>
                    <p className="text-xs text-[#A9B2AE] leading-relaxed line-clamp-2">
                      {preacher.bioAr}
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-white/10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigate({ page: 'basira-preacher', preacherId: preacher.id })
                    }
                    className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-[#F5F3EE] cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-[#C8A253]" />
                    <span>الملف الكامل</span>
                  </button>
                  {latest && (
                    <button
                      type="button"
                      onClick={() =>
                        playBasiraEpisode(
                          latest,
                          preacher,
                          basiraPreachers,
                          stats.episodesList
                        )
                      }
                      aria-label={`تشغيل أحدث حلقات ${preacher.nameAr}`}
                      className="inline-flex items-center justify-center gap-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs font-semibold text-white cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>استمع</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 4. Curated Preacher Series Boxes */}
      {basiraPlaylists.length > 0 && (
        <section aria-labelledby="basira-playlists-heading" className="space-y-5">
          <div className="space-y-1">
            <h2
              id="basira-playlists-heading"
              className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]"
            >
              بوكسات السلاسل وقوائم التشغيل المتتابعة
            </h2>
            <p className="text-xs sm:text-sm text-[#A9B2AE]">
              قوائم صوتية منظمة للتشغيل المتتابع حسب الموضوع والشيخ
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {basiraPlaylists.map((pl) => {
              const preacher = preacherMap.get(pl.preacherId);
              const count = pl.episodeIds.filter((id) =>
                basiraEpisodes.some((ep) => ep.id === id)
              ).length;
              return (
                <div
                  key={pl.id}
                  className="glass-gold card-interactive rounded-2xl p-4.5 flex flex-col justify-between gap-3.5"
                >
                  <div className="flex items-start gap-3">
                    {preacher && (
                      <ReciterImage
                        src={preacher.photoUrl}
                        alt={preacher.nameAr}
                        loading="lazy"
                        className="w-12 h-12 rounded-xl object-cover object-top border border-[#C8A253]/30 shrink-0"
                      />
                    )}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-[#C8A253]">
                        <span>{preacher?.nameAr || 'سلسلة صوتية'}</span>
                        <span>{toArabicDigits(count)} حلقات</span>
                      </div>
                      <h3 className="text-sm font-display font-bold text-[#F5F3EE] leading-snug">
                        {pl.title}
                      </h3>
                      <p className="text-xs text-[#A9B2AE] leading-relaxed line-clamp-2">
                        {pl.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() =>
                        playBasiraPlaylist(pl, basiraEpisodes, basiraPreachers, false)
                      }
                      className="flex-1 flex items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-semibold cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>تشغيل السلسلة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        playBasiraPlaylist(pl, basiraEpisodes, basiraPreachers, true)
                      }
                      aria-label={`تشغيل عشوائي لسلسلة ${pl.title}`}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-[#C8A253] cursor-pointer"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. Filterable Audio Episodes Archive */}
      <section ref={episodesSectionRef} aria-labelledby="basira-episodes-heading" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2
              id="basira-episodes-heading"
              className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]"
            >
              مكتبة الحلقات الصوتية ({toArabicDigits(filteredEpisodes.length)})
            </h2>
            <p className="text-xs sm:text-sm text-[#A9B2AE]">
              تصفّح حسب التصنيف أو الداعية أو ابحث بعنوان الحلقة والموضوع
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-[#A9B2AE] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث في الحلقات والمواضيع..."
                aria-label="ابحث في حلقات بصيرة"
                className="w-full pr-9 pl-3 py-2 rounded-xl bg-[#121715] border border-white/15 text-xs text-[#F5F3EE] placeholder:text-[#A9B2AE]/70"
              />
            </div>

            <select
              aria-label="تصفية حسب الداعية"
              value={selectedPreacherId}
              onChange={(e) => setSelectedPreacherId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#121715] border border-white/15 text-xs text-[#F5F3EE]"
            >
              <option value="">جميع الدعاة</option>
              {basiraPreachers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameAr}
                </option>
              ))}
            </select>

            <select
              aria-label="ترتيب الحلقات"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as BasiraSortMode)}
              className="px-3 py-2 rounded-xl bg-[#121715] border border-white/15 text-xs text-[#F5F3EE]"
            >
              <option value="curated">الترتيب المختار</option>
              <option value="newest">الأحدث نشرًا</option>
              <option value="shortest">الأقصر مدة أولًا</option>
              <option value="longest">المحاضرات المطوّلة أولًا</option>
            </select>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="تصنيفات البودكاست">
          <button
            type="button"
            onClick={() => setSelectedCategory('الكل')}
            className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
              selectedCategory === 'الكل'
                ? 'bg-[#0E6B4D] text-white'
                : 'bg-white/5 text-[#A9B2AE] hover:text-white border border-white/10'
            }`}
          >
            الكل ({toArabicDigits(basiraEpisodes.length)})
          </button>
          {BASIRA_CATEGORIES.map((cat) => {
            const count = basiraEpisodes.filter((ep) => ep.category === cat).length;
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#0E6B4D] text-white border border-[#C8A253]/40'
                    : 'bg-white/5 text-[#A9B2AE] hover:text-white border border-white/10'
                }`}
              >
                {cat} ({toArabicDigits(count)})
              </button>
            );
          })}
        </div>

        {sortedEpisodes.length === 0 ? (
          <div className="glass-panel rounded-2xl p-10 text-center space-y-3">
            <Mic className="w-8 h-8 text-[#C8A253] mx-auto" />
            <p className="text-sm text-[#A9B2AE]">
              لا توجد حلقات مطابقة لمعايير التصفية الحالية.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('الكل');
                setSelectedPreacherId('');
                setSearchQuery('');
                setSortMode('curated');
              }}
              className="px-4 py-2 rounded-xl bg-[#0E6B4D] text-white text-xs font-semibold cursor-pointer"
            >
              إعادة ضبط التصنيف والبحث
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleEpisodes.map((ep) => {
                const preacher = preacherMap.get(ep.preacherId);
                const isCurrent =
                  currentTrack?.kind === 'podcast' && currentTrack.episodeId === ep.id;
                const saved = progressMap[ep.id];
                const hasProgress = saved && saved.progressSeconds > 15;

                return (
                  <article
                    key={ep.id}
                    className={`glass-panel card-interactive perf-card rounded-2xl p-4 flex items-stretch gap-4 border ${
                      isCurrent ? 'border-[#C8A253]/65 bg-[#171F1C]' : 'border-white/10 hover:border-[#C8A253]/35'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        navigate({ page: 'basira-episode', episodeId: ep.id })
                      }
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 border border-[#C8A253]/25 cursor-pointer"
                    >
                      <ReciterImage
                        src={ep.coverUrl}
                        alt={ep.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </button>

                    <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-[11px] text-[#C8A253] truncate">
                          {ep.category} ·{' '}
                          <span className="font-mono-nums">
                            {formatBasiraDuration(ep.durationSeconds, ep.durationLabel)}
                          </span>{' '}
                          · {ep.publishedAt}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            navigate({ page: 'basira-episode', episodeId: ep.id })
                          }
                          className="text-right w-full cursor-pointer"
                        >
                          <h3 className="text-sm sm:text-base font-display font-bold text-[#F5F3EE] hover:text-[#C8A253] transition-colors line-clamp-1">
                            {ep.title}
                          </h3>
                        </button>
                        {preacher && (
                          <button
                            type="button"
                            onClick={() =>
                              navigate({ page: 'basira-preacher', preacherId: preacher.id })
                            }
                            className="text-xs text-[#A9B2AE] hover:text-[#C8A253] cursor-pointer text-right inline-flex items-center gap-1.5"
                          >
                            <span>{preacher.nameAr}</span>
                          </button>
                        )}
                        <p className="text-xs text-[#A9B2AE]/85 line-clamp-2 leading-relaxed">
                          {ep.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            isCurrent
                              ? togglePlayPause()
                              : playBasiraEpisode(ep, preacher, basiraPreachers, sortedEpisodes)
                          }
                          className="inline-flex items-center gap-1.5 min-h-[34px] px-3.5 py-1.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-semibold cursor-pointer"
                        >
                          {isCurrent && isPlaying ? (
                            <>
                              <AudioWaveBars active className="text-[#C8A253] h-3" />
                              <Pause className="w-3.5 h-3.5" />
                              <span>إيقاف مؤقت</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>
                                {hasProgress
                                  ? `استئناف (${formatTimeSeconds(saved.progressSeconds)})`
                                  : 'استماع'}
                              </span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            navigate({ page: 'basira-episode', episodeId: ep.id })
                          }
                          className="inline-flex items-center gap-1 text-xs text-[#C8A253] hover:underline cursor-pointer"
                        >
                          <span>تفاصيل الحلقة</span>
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {sortedEpisodes.length > visibleCount && (
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + EPISODES_BATCH_SIZE)}
                  className="min-h-[42px] px-6 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs sm:text-sm font-semibold shadow-md transition-colors cursor-pointer"
                >
                  عرض المزيد من الحلقات ({toArabicDigits(sortedEpisodes.length - visibleCount)} متبقية)
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleCount(sortedEpisodes.length)}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-[#C8A253]/30 text-[#C8A253] text-xs sm:text-sm font-medium transition-colors cursor-pointer"
                >
                  عرض كل الحلقات ({toArabicDigits(sortedEpisodes.length)})
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
};
