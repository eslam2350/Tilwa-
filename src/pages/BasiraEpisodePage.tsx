import React, { useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Download,
  Headphones,
  ListEnd,
  Pause,
  Play,
  RotateCcw,
  User,
} from 'lucide-react';
import { AudioWaveBars } from '../components/AudioWaveBars';
import { ReciterImage } from '../components/ReciterImage';
import { useAppData } from '../contexts/AppDataContext';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import type { AppRoute } from '../types/tilawa';
import {
  episodeToAudioTrack,
  formatBasiraDuration,
  getRelatedBasiraEpisodes,
  loadBasiraProgressMap,
} from '../utils/basiraHelpers';
import { formatTimeSeconds } from '../utils/quranHelpers';

interface BasiraEpisodePageProps {
  episodeId: string;
  navigate: (next: AppRoute) => void;
}

export const BasiraEpisodePage: React.FC<BasiraEpisodePageProps> = ({
  episodeId,
  navigate,
}) => {
  const { basiraPreachers, basiraEpisodes } = useAppData();
  const {
    currentTrack,
    isPlaying,
    playbackRate,
    setPlaybackRate,
    playBasiraEpisode,
    togglePlayPause,
    addToQueue,
  } = useAudioPlayer();

  const episode = basiraEpisodes.find((e) => e.id === episodeId);
  const preacherMap = useMemo(
    () => new Map(basiraPreachers.map((p) => [p.id, p])),
    [basiraPreachers]
  );
  const progressMap = useMemo(() => loadBasiraProgressMap(), []);

  const preacher = episode ? preacherMap.get(episode.preacherId) : undefined;
  const relatedEpisodes = useMemo(
    () => (episode ? getRelatedBasiraEpisodes(episode, basiraEpisodes, 4) : []),
    [episode, basiraEpisodes]
  );

  if (!episode) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-[#F5F3EE]">الحلقة غير موجودة</h1>
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

  const isCurrent =
    currentTrack?.kind === 'podcast' && currentTrack.episodeId === episode.id;
  const saved = progressMap[episode.id];
  const hasProgress = saved && saved.progressSeconds > 15;
  const episodeTrack = episodeToAudioTrack(episode, preacher, 1);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-28 space-y-12">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate({ page: 'basira' })}
          className="flex items-center gap-2 text-xs sm:text-sm text-[#A9B2AE] hover:text-[#C8A253] cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى بودكاست بصيرة</span>
        </button>

        <button
          type="button"
          onClick={() => navigate({ page: 'basira', category: episode.category })}
          className="text-xs text-[#C8A253] hover:underline cursor-pointer"
        >
          تصنيف: {episode.category}
        </button>
      </div>

      {/* Main Audio Episode Showcase Card (Audio-Only) */}
      <section className="glass-gold rounded-3xl p-6 sm:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-4">
            <div className="aspect-square rounded-3xl overflow-hidden border border-[#C8A253]/35 shadow-2xl bg-[#080B0A]">
              <ReciterImage
                src={episode.coverUrl}
                alt={episode.title}
                loading="eager"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-8 space-y-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#C8A253]">
              <span>{episode.category}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-[#A9B2AE]">
                <Clock className="w-3.5 h-3.5 text-[#C8A253]" />
                <span className="font-mono-nums">
                  {formatBasiraDuration(episode.durationSeconds, episode.durationLabel)}
                </span>
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-[#A9B2AE]">
                <Calendar className="w-3.5 h-3.5 text-[#C8A253]" />
                <span>{episode.publishedAt}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-display font-bold text-[#F5F3EE] leading-snug">
              {episode.title}
            </h1>

            {preacher && (
              <div className="flex items-center gap-3 pt-1">
                <ReciterImage
                  src={preacher.photoUrl}
                  alt={preacher.nameAr}
                  className="w-10 h-10 rounded-full object-cover border border-[#C8A253]/40 shrink-0"
                />
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() =>
                      navigate({ page: 'basira-preacher', preacherId: preacher.id })
                    }
                    className="text-sm font-semibold text-[#F5F3EE] hover:text-[#C8A253] cursor-pointer flex items-center gap-1.5"
                  >
                    <User className="w-3.5 h-3.5 text-[#C8A253]" />
                    <span>{preacher.nameAr}</span>
                  </button>
                  <p className="text-[11px] text-[#A9B2AE] truncate">{preacher.titleAr}</p>
                </div>
              </div>
            )}

            <p className="text-sm sm:text-base text-[#A9B2AE] leading-relaxed">
              {episode.description}
            </p>

            {episode.tags.length > 0 && (
              <p className="text-xs text-[#C8A253]/85">
                الكلمات المفتاحية: {episode.tags.join(' · ')}
              </p>
            )}

            {/* Playback Action Dock */}
            <div className="pt-3 border-t border-white/10 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    isCurrent
                      ? togglePlayPause()
                      : playBasiraEpisode(
                          episode,
                          preacher,
                          basiraPreachers,
                          [episode, ...relatedEpisodes]
                        )
                  }
                  className="inline-flex items-center gap-2 min-h-[46px] px-6 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-sm font-semibold shadow-lg cursor-pointer"
                >
                  {isCurrent && isPlaying ? (
                    <>
                      <AudioWaveBars active className="text-[#C8A253] h-3.5" />
                      <Pause className="w-4 h-4" />
                      <span>إيقاف مؤقت</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {hasProgress
                          ? `استئناف من ${formatTimeSeconds(saved.progressSeconds)}`
                          : 'تشغيل الحلقة الصوتية'}
                      </span>
                    </>
                  )}
                </button>

                {hasProgress && (
                  <button
                    type="button"
                    onClick={() =>
                      playBasiraEpisode(
                        episode,
                        preacher,
                        basiraPreachers,
                        [episode, ...relatedEpisodes],
                        { resume: false, startSeconds: 0 }
                      )
                    }
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-[#F5F3EE] cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#C8A253]" />
                    <span>من البداية</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => addToQueue(episodeTrack)}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-[#F5F3EE] cursor-pointer"
                >
                  <ListEnd className="w-4 h-4 text-[#C8A253]" />
                  <span>إضافة لقائمة الانتظار</span>
                </button>

                {episode.audioUrl && (
                  <a
                    href={episode.audioUrl}
                    download={`${episode.title}.mp3`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-[#C8A253]"
                  >
                    <Download className="w-4 h-4" />
                    <span>تنزيل (MP3)</span>
                  </a>
                )}
              </div>

              {/* Speed Quick Selector */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[#A9B2AE] flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-[#C8A253]" />
                  <span>سرعة الاستماع:</span>
                </span>
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setPlaybackRate(rate)}
                    className={`px-2.5 py-1 rounded-lg font-mono-nums cursor-pointer ${
                      playbackRate === rate
                        ? 'bg-[#C8A253] text-[#0A0D0C] font-bold'
                        : 'bg-white/5 text-[#A9B2AE] hover:text-white'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Episodes in the Same Topic */}
      {relatedEpisodes.length > 0 && (
        <section className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F5F3EE]">
              حلقات مرتبطة بالموضوع نفسه
            </h2>
            <p className="text-xs sm:text-sm text-[#A9B2AE]">
              حلقات مختارة ضمن موضوع «{episode.category}» والمواضيع القريبة منه
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relatedEpisodes.map((rel) => {
              const relPreacher = preacherMap.get(rel.preacherId);
              const isRelCurrent =
                currentTrack?.kind === 'podcast' && currentTrack.episodeId === rel.id;
              return (
                <article
                  key={rel.id}
                  className="glass-panel card-interactive rounded-2xl p-4 flex items-center justify-between gap-4 border border-white/10 hover:border-[#C8A253]/35"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <ReciterImage
                      src={rel.coverUrl}
                      alt={rel.title}
                      className="w-16 h-16 rounded-xl object-cover shrink-0 border border-[#C8A253]/25"
                    />
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] text-[#C8A253] truncate">
                        {rel.category} ·{' '}
                        {formatBasiraDuration(rel.durationSeconds, rel.durationLabel)}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate({ page: 'basira-episode', episodeId: rel.id })}
                        className="text-right cursor-pointer"
                      >
                        <h3 className="text-sm font-display font-bold text-[#F5F3EE] hover:text-[#C8A253] truncate">
                          {rel.title}
                        </h3>
                      </button>
                      {relPreacher && (
                        <p className="text-xs text-[#A9B2AE] truncate">{relPreacher.nameAr}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        isRelCurrent
                          ? togglePlayPause()
                          : playBasiraEpisode(rel, relPreacher, basiraPreachers, relatedEpisodes)
                      }
                      aria-label={`تشغيل ${rel.title}`}
                      className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white cursor-pointer"
                    >
                      {isRelCurrent && isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 fill-current" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate({ page: 'basira-episode', episodeId: rel.id })}
                      aria-label={`صفحة ${rel.title}`}
                      className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-[#C8A253] cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
};
