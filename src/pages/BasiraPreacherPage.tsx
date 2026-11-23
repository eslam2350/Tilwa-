import React, { useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Headphones,
  ListMusic,
  Pause,
  Play,
  Shuffle,
} from 'lucide-react';
import { AudioWaveBars } from '../components/AudioWaveBars';
import { ReciterImage } from '../components/ReciterImage';
import { useAppData } from '../contexts/AppDataContext';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import type { AppRoute } from '../types/tilawa';
import {
  formatBasiraDuration,
  getPreacherStats,
  loadBasiraProgressMap,
} from '../utils/basiraHelpers';
import { formatTimeSeconds, toArabicDigits } from '../utils/quranHelpers';

interface BasiraPreacherPageProps {
  preacherId: string;
  navigate: (next: AppRoute) => void;
}

export const BasiraPreacherPage: React.FC<BasiraPreacherPageProps> = ({
  preacherId,
  navigate,
}) => {
  const { basiraPreachers, basiraEpisodes, basiraPlaylists } = useAppData();
  const {
    currentTrack,
    isPlaying,
    playBasiraEpisode,
    playBasiraPlaylist,
    togglePlayPause,
  } = useAudioPlayer();

  const preacher = basiraPreachers.find((p) => p.id === preacherId);
  const progressMap = useMemo(() => loadBasiraProgressMap(), []);

  const stats = useMemo(() => {
    if (!preacher) return null;
    return getPreacherStats(preacher, basiraEpisodes, basiraPlaylists);
  }, [preacher, basiraEpisodes, basiraPlaylists]);

  if (!preacher || !stats) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-[#F5F3EE]">
          صفحة الداعية غير متوفرة
        </h1>
        <button
          type="button"
          onClick={() => navigate({ page: 'basira' })}
          className="px-5 py-2.5 rounded-xl bg-[#0E6B4D] text-white text-sm cursor-pointer"
        >
          العودة إلى قسم بصيرة
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-28 space-y-12">
      {/* Breadcrumb */}
      <button
        type="button"
        onClick={() => navigate({ page: 'basira' })}
        className="flex items-center gap-2 text-xs sm:text-sm text-[#A9B2AE] hover:text-[#C8A253] cursor-pointer"
      >
        <ArrowRight className="w-4 h-4" />
        <span>العودة إلى بودكاست بصيرة</span>
      </button>

      {/* Preacher Identity Header Card */}
      <section className="glass-gold rounded-3xl p-6 sm:p-10 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <ReciterImage
            src={preacher.photoUrl}
            alt={preacher.nameAr}
            loading="eager"
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl object-cover border border-[#C8A253]/40 shadow-2xl shrink-0"
          />

          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#C8A253]">
              <span>صفحة الداعية المستقلة</span>
              <span>·</span>
              <span>{toArabicDigits(stats.totalEpisodes)} حلقة صوتية</span>
              <span>·</span>
              <span>{toArabicDigits(stats.playlistsList.length)} قوائم تشغيل</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-display font-bold text-[#F5F3EE]">
              {preacher.nameAr}
            </h1>
            <p className="text-sm text-[#C8A253]">{preacher.titleAr}</p>
            <p className="text-xs sm:text-sm text-[#A9B2AE] leading-relaxed max-w-3xl">
              {preacher.bioAr}
            </p>

            {preacher.specialties.length > 0 && (
              <div className="pt-1 flex flex-wrap items-center gap-2 text-xs text-[#F5F3EE]">
                <span className="text-[#A9B2AE]">التخصصات والموضوعات:</span>
                <span className="text-[#C8A253]">{preacher.specialties.join(' · ')}</span>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-3">
              {stats.episodesList[0] && (
                <button
                  type="button"
                  onClick={() =>
                    playBasiraEpisode(
                      stats.episodesList[0],
                      preacher,
                      basiraPreachers,
                      stats.episodesList
                    )
                  }
                  className="inline-flex items-center gap-2 min-h-[42px] px-5 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs sm:text-sm font-semibold shadow-md cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>تشغيل جميع الحلقات متتابعة</span>
                </button>
              )}
              {stats.episodesList.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const shuffled = [...stats.episodesList].sort(() => Math.random() - 0.5);
                    playBasiraEpisode(shuffled[0], preacher, basiraPreachers, shuffled, {
                      resume: false,
                    });
                  }}
                  className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-[#C8A253]/30 text-[#F5F3EE] text-xs sm:text-sm cursor-pointer"
                >
                  <Shuffle className="w-4 h-4 text-[#C8A253]" />
                  <span>تشغيل عشوائي</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Latest Episodes Spotlight */}
      {stats.latestEpisodes.length > 0 && (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F5F3EE]">
              أحدث الحلقات المضافة
            </h2>
            <p className="text-xs text-[#A9B2AE]">آخر ما نُشر من تسجيلات {preacher.nameAr}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.latestEpisodes.map((ep) => {
              const isCurrent =
                currentTrack?.kind === 'podcast' && currentTrack.episodeId === ep.id;
              return (
                <div
                  key={ep.id}
                  className="glass-panel rounded-2xl p-4 border border-white/10 hover:border-[#C8A253]/35 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <ReciterImage
                      src={ep.coverUrl}
                      alt={ep.title}
                      className="w-16 h-16 rounded-xl object-cover shrink-0 border border-[#C8A253]/25"
                    />
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] text-[#C8A253] truncate">
                        {ep.category} · {ep.publishedAt}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate({ page: 'basira-episode', episodeId: ep.id })}
                        className="text-right cursor-pointer"
                      >
                        <h3 className="text-sm font-display font-bold text-[#F5F3EE] hover:text-[#C8A253] line-clamp-2">
                          {ep.title}
                        </h3>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() =>
                        isCurrent
                          ? togglePlayPause()
                          : playBasiraEpisode(ep, preacher, basiraPreachers, stats.episodesList)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-semibold cursor-pointer"
                    >
                      {isCurrent && isPlaying ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>{isCurrent && isPlaying ? 'إيقاف' : 'تشغيل'}</span>
                    </button>
                    <span className="text-[11px] font-mono-nums text-[#A9B2AE] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#C8A253]" />
                      {formatBasiraDuration(ep.durationSeconds, ep.durationLabel)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Preacher Playlists */}
      {stats.playlistsList.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F5F3EE]">
            قوائم التشغيل الخاصة بـ {preacher.nameAr}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.playlistsList.map((pl) => {
              const count = pl.episodeIds.filter((id) =>
                basiraEpisodes.some((ep) => ep.id === id)
              ).length;
              return (
                <div
                  key={pl.id}
                  className="glass-gold rounded-2xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-[#C8A253]">
                      <ListMusic className="w-4 h-4" />
                      <span>{toArabicDigits(count)} حلقات</span>
                    </div>
                    <h3 className="text-base font-display font-bold text-[#F5F3EE]">{pl.title}</h3>
                    <p className="text-xs text-[#A9B2AE] leading-relaxed">{pl.description}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() =>
                        playBasiraPlaylist(pl, basiraEpisodes, basiraPreachers, false)
                      }
                      className="flex-1 flex items-center justify-center gap-1.5 min-h-[38px] px-3 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-semibold cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>تشغيل القائمة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        playBasiraPlaylist(pl, basiraEpisodes, basiraPreachers, true)
                      }
                      aria-label={`عشوائي ${pl.title}`}
                      className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-[#C8A253] cursor-pointer"
                    >
                      <Shuffle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Full List of Preacher's Audio Episodes */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F5F3EE]">
            جميع الحلقات الصوتية ({toArabicDigits(stats.totalEpisodes)})
          </h2>
        </div>

        <div className="space-y-3">
          {stats.episodesList.map((ep, idx) => {
            const isCurrent =
              currentTrack?.kind === 'podcast' && currentTrack.episodeId === ep.id;
            const saved = progressMap[ep.id];
            const hasProgress = saved && saved.progressSeconds > 15;
            return (
              <div
                key={ep.id}
                className={`glass-panel rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border ${
                  isCurrent ? 'border-[#C8A253]/65 bg-[#171F1C]' : 'border-white/10'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-[#0A0D0C] border border-[#C8A253]/25 flex items-center justify-center text-xs font-mono-nums text-[#C8A253] shrink-0">
                    {toArabicDigits(idx + 1)}
                  </span>
                  <ReciterImage
                    src={ep.coverUrl}
                    alt={ep.title}
                    className="w-14 h-14 rounded-xl object-cover shrink-0 border border-[#C8A253]/20"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] text-[#C8A253] truncate">
                      {ep.category} · {formatBasiraDuration(ep.durationSeconds, ep.durationLabel)} ·{' '}
                      {ep.publishedAt}
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate({ page: 'basira-episode', episodeId: ep.id })}
                      className="text-right cursor-pointer"
                    >
                      <h3 className="text-sm sm:text-base font-semibold text-[#F5F3EE] hover:text-[#C8A253] truncate">
                        {ep.title}
                      </h3>
                    </button>
                    <p className="text-xs text-[#A9B2AE] line-clamp-1">{ep.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      isCurrent
                        ? togglePlayPause()
                        : playBasiraEpisode(ep, preacher, basiraPreachers, stats.episodesList)
                    }
                    className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-1.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-semibold cursor-pointer"
                  >
                    {isCurrent && isPlaying ? (
                      <>
                        <AudioWaveBars active className="text-[#C8A253] h-3" />
                        <Pause className="w-3.5 h-3.5" />
                        <span>إيقاف</span>
                      </>
                    ) : (
                      <>
                        <Headphones className="w-3.5 h-3.5" />
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
                    onClick={() => navigate({ page: 'basira-episode', episodeId: ep.id })}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#C8A253] cursor-pointer"
                  >
                    <span>التفاصيل</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
};
