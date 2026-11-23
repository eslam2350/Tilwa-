import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CloudUpload,
  Edit3,
  Eye,
  EyeOff,
  ListMusic,
  Mic,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import { ReciterImage } from './ReciterImage';
import { useAppData } from '../contexts/AppDataContext';
import { BASIRA_COVER_FAITH, BASIRA_COVER_PRESETS } from '../data/basiraData';
import type {
  AudioProbeResult,
  BasiraCatalogData,
  BasiraCategory,
  BasiraEpisode,
  BasiraPlaylist,
  BasiraPreacher,
} from '../types/tilawa';
import { BASIRA_CATEGORIES } from '../utils/basiraHelpers';
import { moveOrderedItem } from '../utils/dynamicConfigHelpers';
import { toArabicDigits } from '../utils/quranHelpers';

interface AdminBasiraTabProps {
  ownerFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

type SubPanel = 'episodes' | 'preachers' | 'playlists';

export const AdminBasiraTab: React.FC<AdminBasiraTabProps> = ({ ownerFetch }) => {
  const { basiraCatalog, refreshBasira, notify } = useAppData();

  const [subPanel, setSubPanel] = useState<SubPanel>('episodes');
  const [draft, setDraft] = useState<BasiraCatalogData>(() => ({
    preachers: [...basiraCatalog.preachers].sort((a, b) => a.order - b.order),
    episodes: [...basiraCatalog.episodes].sort((a, b) => a.order - b.order),
    playlists: [...basiraCatalog.playlists].sort((a, b) => a.order - b.order),
    updatedAt: basiraCatalog.updatedAt,
  }));

  const [isSaving, setIsSaving] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingPreacherPhoto, setUploadingPreacherPhoto] = useState(false);
  const [probingAudio, setProbingAudio] = useState(false);
  const [probeStatus, setProbeStatus] = useState<AudioProbeResult | null>(null);

  // Preacher Form State
  const [editingPreacherId, setEditingPreacherId] = useState<string | null>(null);
  const [prName, setPrName] = useState('');
  const [prTitle, setPrTitle] = useState('');
  const [prBio, setPrBio] = useState('');
  const [prPhoto, setPrPhoto] = useState(BASIRA_COVER_FAITH);
  const [prSpecialties, setPrSpecialties] = useState('');
  const [prFeatured, setPrFeatured] = useState(true);

  // Episode Form State
  const [editingEpId, setEditingEpId] = useState<string | null>(null);
  const [epTitle, setEpTitle] = useState('');
  const [epPreacherId, setEpPreacherId] = useState(
    basiraCatalog.preachers[0]?.id || 'amjad-samir'
  );
  const [epCategory, setEpCategory] = useState<BasiraCategory>('تصحيح المفاهيم الدينية');
  const [epAudioUrl, setEpAudioUrl] = useState('');
  const [epCoverUrl, setEpCoverUrl] = useState(BASIRA_COVER_FAITH);
  const [epDurationLabel, setEpDurationLabel] = useState('١٥:٠٠');
  const [epDurationSeconds, setEpDurationSeconds] = useState(900);
  const [epPublishedAt, setEpPublishedAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [epDescription, setEpDescription] = useState('');
  const [epTags, setEpTags] = useState('');
  const [epPublished, setEpPublished] = useState(true);

  // Playlist Form State
  const [plPreacherId, setPlPreacherId] = useState(
    basiraCatalog.preachers[0]?.id || 'amjad-samir'
  );
  const [plTitle, setPlTitle] = useState('');
  const [plDescription, setPlDescription] = useState('');
  const [plEpisodeIds, setPlEpisodeIds] = useState<string[]>([]);

  const preacherMap = useMemo(
    () => new Map(draft.preachers.map((p) => [p.id, p])),
    [draft.preachers]
  );

  const uploadMediaFile = async (file: File): Promise<string | null> => {
    const res = await ownerFetch(
      `/api/admin/basira/upload?filename=${encodeURIComponent(file.name)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'x-filename': file.name,
        },
        body: file,
      }
    );
    const data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
    if (!res.ok || !data.ok || !data.url) {
      throw new Error(data.error || 'فشل رفع الملف للخادم');
    }
    return data.url;
  };

  const handleSaveCatalogToServer = async (summary?: string) => {
    setIsSaving(true);
    try {
      const res = await ownerFetch('/api/admin/basira/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalog: {
            preachers: draft.preachers.map((p, idx) => ({ ...p, order: idx })),
            episodes: draft.episodes.map((e, idx) => ({ ...e, order: idx })),
            playlists: draft.playlists.map((pl, idx) => ({ ...pl, order: idx })),
          },
          summary,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        notify(data.error || 'تعذر حفظ بيانات بصيرة', 'error');
        return;
      }
      await refreshBasira();
      notify('تم حفظ ونشر تحديثات بصيرة للجميع فورًا', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر حفظ بيانات بصيرة';
      notify(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPreacherForm = () => {
    setEditingPreacherId(null);
    setPrName('');
    setPrTitle('');
    setPrBio('');
    setPrPhoto(BASIRA_COVER_FAITH);
    setPrSpecialties('');
    setPrFeatured(true);
  };

  const handleEditPreacher = (p: BasiraPreacher) => {
    setEditingPreacherId(p.id);
    setPrName(p.nameAr);
    setPrTitle(p.titleAr);
    setPrBio(p.bioAr);
    setPrPhoto(p.photoUrl || BASIRA_COVER_FAITH);
    setPrSpecialties(p.specialties.join('، '));
    setPrFeatured(p.featured);
  };

  const handleSubmitPreacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prName.trim()) {
      notify('يرجى إدخال الاسم الكامل للداعية', 'error');
      return;
    }
    const specialtiesArr = prSpecialties
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingPreacherId) {
      setDraft((prev) => ({
        ...prev,
        preachers: prev.preachers.map((p) =>
          p.id === editingPreacherId
            ? {
                ...p,
                nameAr: prName.trim(),
                titleAr: prTitle.trim() || 'داعية إسلامي',
                bioAr: prBio.trim(),
                photoUrl: prPhoto.trim() || BASIRA_COVER_FAITH,
                specialties: specialtiesArr,
                featured: prFeatured,
              }
            : p
        ),
      }));
      notify('تم تحديث بيانات الداعية في المسودة — اضغط حفظ ونشر للاعتماد', 'success');
    } else {
      const id = `preacher-${Date.now()}`;
      const newPr: BasiraPreacher = {
        id,
        nameAr: prName.trim(),
        titleAr: prTitle.trim() || 'داعية مصري',
        bioAr: prBio.trim() || 'داعية ومُربٍّ يساهم في نشر العلم الشرعي وتزكية النفوس.',
        photoUrl: prPhoto.trim() || BASIRA_COVER_FAITH,
        specialties: specialtiesArr.length > 0 ? specialtiesArr : ['نصائح دعوية'],
        featured: prFeatured,
        published: true,
        order: draft.preachers.length,
      };
      setDraft((prev) => ({
        ...prev,
        preachers: [...prev.preachers, newPr],
      }));
      notify(`تمت إضافة ${newPr.nameAr} إلى المسودة`, 'success');
    }
    handleResetPreacherForm();
  };

  const handleResetEpisodeForm = () => {
    setEditingEpId(null);
    setEpTitle('');
    setEpAudioUrl('');
    setEpCoverUrl(BASIRA_COVER_FAITH);
    setEpDurationLabel('١٥:٠٠');
    setEpDurationSeconds(900);
    setEpPublishedAt(new Date().toISOString().slice(0, 10));
    setEpDescription('');
    setEpTags('');
    setEpPublished(true);
    setProbeStatus(null);
  };

  const handleEditEpisode = (ep: BasiraEpisode) => {
    setEditingEpId(ep.id);
    setEpTitle(ep.title);
    setEpPreacherId(ep.preacherId);
    setEpCategory(ep.category);
    setEpAudioUrl(ep.audioUrl);
    setEpCoverUrl(ep.coverUrl);
    setEpDurationLabel(ep.durationLabel);
    setEpDurationSeconds(ep.durationSeconds);
    setEpPublishedAt(ep.publishedAt);
    setEpDescription(ep.description);
    setEpTags(ep.tags.join('، '));
    setEpPublished(ep.published !== false);
  };

  const handleSubmitEpisode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!epTitle.trim() || !epAudioUrl.trim()) {
      notify('يرجى إدخال عنوان الحلقة والملف أو الرابط الصوتي', 'error');
      return;
    }
    const tagsArr = epTags
      .split(/[،,]/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingEpId) {
      setDraft((prev) => ({
        ...prev,
        episodes: prev.episodes.map((item) =>
          item.id === editingEpId
            ? {
                ...item,
                title: epTitle.trim(),
                preacherId: epPreacherId,
                category: epCategory,
                audioUrl: epAudioUrl.trim(),
                coverUrl: epCoverUrl.trim() || BASIRA_COVER_FAITH,
                durationLabel: epDurationLabel.trim() || '١٥:٠٠',
                durationSeconds: Math.max(0, Number(epDurationSeconds) || 900),
                publishedAt: epPublishedAt.trim() || new Date().toISOString().slice(0, 10),
                description: epDescription.trim(),
                tags: tagsArr,
                published: epPublished,
              }
            : item
        ),
      }));
      notify('تم تعديل الحلقة في المسودة — اضغط حفظ ونشر لاعتمادها للزوار', 'success');
    } else {
      const newEp: BasiraEpisode = {
        id: `ep-${Date.now()}`,
        preacherId: epPreacherId,
        title: epTitle.trim(),
        description: epDescription.trim() || 'حلقة صوتية دعوية مختارة في رحاب قسم بصيرة.',
        coverUrl: epCoverUrl.trim() || BASIRA_COVER_FAITH,
        audioUrl: epAudioUrl.trim(),
        durationSeconds: Math.max(0, Number(epDurationSeconds) || 900),
        durationLabel: epDurationLabel.trim() || '١٥:٠٠',
        publishedAt: epPublishedAt.trim() || new Date().toISOString().slice(0, 10),
        category: epCategory,
        tags: tagsArr.length > 0 ? tagsArr : [epCategory],
        featured: false,
        published: epPublished,
        order: draft.episodes.length,
      };
      setDraft((prev) => ({
        ...prev,
        episodes: [newEp, ...prev.episodes].map((item, idx) => ({ ...item, order: idx })),
      }));
      notify(`تمت إضافة الحلقة «${newEp.title}» إلى المسودة`, 'success');
    }
    handleResetEpisodeForm();
  };

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plTitle.trim()) {
      notify('يرجى إدخال عنوان قائمة التشغيل', 'error');
      return;
    }
    const newPl: BasiraPlaylist = {
      id: `pl-${Date.now()}`,
      preacherId: plPreacherId,
      title: plTitle.trim(),
      description: plDescription.trim() || 'قائمة صوتية متتابعة من بودكاست بصيرة',
      coverUrl: preacherMap.get(plPreacherId)?.photoUrl || BASIRA_COVER_FAITH,
      episodeIds: plEpisodeIds,
      published: true,
      order: draft.playlists.length,
    };
    setDraft((prev) => ({
      ...prev,
      playlists: [...prev.playlists, newPl],
    }));
    setPlTitle('');
    setPlDescription('');
    setPlEpisodeIds([]);
    notify('تمت إضافة قائمة التشغيل إلى المسودة', 'success');
  };

  const handleProbeEpisodeAudio = async () => {
    if (!/^https?:\/\//i.test(epAudioUrl.trim())) {
      notify('الفحص المباشر يعمل مع الروابط الخارجية التي تبدأ بـ http أو https', 'info');
      return;
    }
    setProbingAudio(true);
    try {
      const res = await ownerFetch('/api/admin/audio/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: epAudioUrl.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; result?: AudioProbeResult };
      if (res.ok && data.ok && data.result) {
        setProbeStatus(data.result);
      }
    } finally {
      setProbingAudio(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Basira Command Header */}
      <div className="glass-gold rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 border border-[#C8A253]/30">
        <div className="space-y-1">
          <h2 className="text-lg font-display font-bold text-[#F5F3EE] flex items-center gap-2">
            <Mic className="w-5 h-5 text-[#C8A253]" />
            <span>إدارة بودكاست «بصيرة» والدعاة والملفات الصوتية</span>
          </h2>
          <p className="text-xs text-[#A9B2AE]">
            إضافة وتعديل الدعاة، رفع الحلقات الصوتية والأغلفة مباشرة على الخادم، إدارة التصنيفات الـ١١، الترتيب والنشر الفوري.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setDraft({
                preachers: [...basiraCatalog.preachers].sort((a, b) => a.order - b.order),
                episodes: [...basiraCatalog.episodes].sort((a, b) => a.order - b.order),
                playlists: [...basiraCatalog.playlists].sort((a, b) => a.order - b.order),
                updatedAt: basiraCatalog.updatedAt,
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#A9B2AE] hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>تراجع عن المسودة</span>
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSaveCatalogToServer()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] disabled:opacity-50 text-xs sm:text-sm font-semibold text-white shadow-lg cursor-pointer"
          >
            <CloudUpload className="w-4 h-4 text-[#C8A253]" />
            <span>{isSaving ? 'جارٍ الحفظ والنشر...' : 'حفظ ونشر قسم بصيرة للجميع'}</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubPanel('episodes')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
            subPanel === 'episodes'
              ? 'bg-[#C8A253] text-[#0A0D0C]'
              : 'bg-[#121715] text-[#A9B2AE] border border-white/10 hover:text-white'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>الحلقات الصوتية ({toArabicDigits(draft.episodes.length)})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubPanel('preachers')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
            subPanel === 'preachers'
              ? 'bg-[#C8A253] text-[#0A0D0C]'
              : 'bg-[#121715] text-[#A9B2AE] border border-white/10 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>الدعاة والمشايخ ({toArabicDigits(draft.preachers.length)})</span>
        </button>
        <button
          type="button"
          onClick={() => setSubPanel('playlists')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
            subPanel === 'playlists'
              ? 'bg-[#C8A253] text-[#0A0D0C]'
              : 'bg-[#121715] text-[#A9B2AE] border border-white/10 hover:text-white'
          }`}
        >
          <ListMusic className="w-3.5 h-3.5" />
          <span>قوائم التشغيل ({toArabicDigits(draft.playlists.length)})</span>
        </button>
      </div>

      {/* ─── SUBPANEL 1: EPISODES MANAGEMENT ─── */}
      {subPanel === 'episodes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Episode Form */}
          <form
            onSubmit={handleSubmitEpisode}
            className="lg:col-span-5 glass-panel rounded-2xl p-5 border border-white/10 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F3EE] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#C8A253]" />
                <span>{editingEpId ? 'تعديل حلقة صوتية' : 'إضافة حلقة بودكاست جديدة'}</span>
              </h3>
              {editingEpId && (
                <button
                  type="button"
                  onClick={handleResetEpisodeForm}
                  className="text-xs text-[#A9B2AE] hover:text-white cursor-pointer"
                >
                  إلغاء التعديل
                </button>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#A9B2AE]">عنوان الحلقة</label>
              <input
                type="text"
                value={epTitle}
                onChange={(e) => setEpTitle(e.target.value)}
                placeholder="مثال: علاج القلق والعودة إلى الطمأنينة"
                className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs text-[#A9B2AE]">الداعية</label>
                <select
                  value={epPreacherId}
                  onChange={(e) => setEpPreacherId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                >
                  {draft.preachers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#A9B2AE]">التصنيف</label>
                <select
                  value={epCategory}
                  onChange={(e) => setEpCategory(e.target.value as BasiraCategory)}
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                >
                  {BASIRA_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Audio File Upload + URL Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs text-[#A9B2AE]">الملف الصوتي أو رابط MP3</label>
                <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0E6B4D]/35 hover:bg-[#0E6B4D]/55 border border-[#C8A253]/30 text-[11px] text-[#C8A253] cursor-pointer">
                  <Upload className="w-3 h-3" />
                  <span>{uploadingAudio ? 'جارٍ الرفع...' : 'رفع ملف صوتي'}</span>
                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/mp4,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg"
                    disabled={uploadingAudio}
                    onChange={async (ev) => {
                      const file = ev.target.files?.[0];
                      ev.target.value = '';
                      if (!file) return;
                      setUploadingAudio(true);
                      try {
                        const url = await uploadMediaFile(file);
                        if (url) {
                          setEpAudioUrl(url);
                          notify('تم رفع الملف الصوتي على الخادم بنجاح', 'success');
                        }
                      } catch (err) {
                        notify(err instanceof Error ? err.message : 'فشل رفع الملف الصوتي', 'error');
                      } finally {
                        setUploadingAudio(false);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  dir="ltr"
                  value={epAudioUrl}
                  onChange={(e) => setEpAudioUrl(e.target.value)}
                  placeholder="https://...mp3 أو /uploads/basira/..."
                  className="flex-1 px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                />
                <button
                  type="button"
                  disabled={probingAudio || !epAudioUrl}
                  onClick={() => void handleProbeEpisodeAudio()}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] text-[#C8A253] cursor-pointer disabled:opacity-40"
                >
                  {probingAudio ? 'فحص...' : 'فحص'}
                </button>
              </div>
              {probeStatus && (
                <p className={`text-[11px] ${probeStatus.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {probeStatus.ok
                    ? `الرابط سليم (${probeStatus.status}) · ${probeStatus.contentType}`
                    : `تعذر الوصول للرابط (${probeStatus.error || probeStatus.status})`}
                </p>
              )}
            </div>

            {/* Cover Upload + Preset Picker */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-[#A9B2AE]">صورة غلاف الحلقة</label>
                <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-[#F5F3EE] cursor-pointer">
                  <Upload className="w-3 h-3 text-[#C8A253]" />
                  <span>{uploadingCover ? 'جارٍ الرفع...' : 'رفع صورة غلاف'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    disabled={uploadingCover}
                    onChange={async (ev) => {
                      const file = ev.target.files?.[0];
                      ev.target.value = '';
                      if (!file) return;
                      setUploadingCover(true);
                      try {
                        const url = await uploadMediaFile(file);
                        if (url) {
                          setEpCoverUrl(url);
                          notify('تم رفع صورة الغلاف بنجاح', 'success');
                        }
                      } catch (err) {
                        notify(err instanceof Error ? err.message : 'فشل رفع الغلاف', 'error');
                      } finally {
                        setUploadingCover(false);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              <input
                type="text"
                dir="ltr"
                value={epCoverUrl}
                onChange={(e) => setEpCoverUrl(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {BASIRA_COVER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setEpCoverUrl(preset.url)}
                    className={`px-2 py-1 rounded-lg text-[10px] border cursor-pointer ${
                      epCoverUrl === preset.url
                        ? 'bg-[#C8A253]/20 border-[#C8A253] text-[#C8A253]'
                        : 'bg-white/5 border-white/10 text-[#A9B2AE]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-[#A9B2AE]">المدة المعروضة</label>
                <input
                  type="text"
                  value={epDurationLabel}
                  onChange={(e) => setEpDurationLabel(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[#A9B2AE]">المدة بالثواني</label>
                <input
                  type="number"
                  min={0}
                  value={epDurationSeconds}
                  onChange={(e) => setEpDurationSeconds(Number(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[#A9B2AE]">تاريخ النشر</label>
                <input
                  type="date"
                  value={epPublishedAt}
                  onChange={(e) => setEpPublishedAt(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#A9B2AE]">وصف الحلقة التفصيلي</label>
              <textarea
                rows={3}
                value={epDescription}
                onChange={(e) => setEpDescription(e.target.value)}
                placeholder="محاور الحلقة وفوائدها..."
                className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#A9B2AE]">الوسوم (افصل بفاصلة ،)</label>
              <input
                type="text"
                value={epTags}
                onChange={(e) => setEpTags(e.target.value)}
                placeholder="النية، تزكية النفس، الشباب"
                className="w-full px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-[#F5F3EE] cursor-pointer">
              <input
                type="checkbox"
                checked={epPublished}
                onChange={(e) => setEpPublished(e.target.checked)}
                className="w-4 h-4 accent-[#C8A253]"
              />
              <span>نشر الحلقة فور الحفظ في الواجهة العامة</span>
            </label>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs font-bold text-white cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#C8A253]" />
              <span>{editingEpId ? 'تحديث الحلقة في المسودة' : 'إضافة الحلقة للمسودة'}</span>
            </button>
          </form>

          {/* Episodes List with Reorder, Publish Toggle, Edit, Delete */}
          <div className="lg:col-span-7 glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F3EE]">
                قائمة الحلقات الصوتية ({toArabicDigits(draft.episodes.length)})
              </h3>
              <span className="text-[11px] text-[#A9B2AE]">
                استخدم الأسهم لإعادة الترتيب ثم اضغط «حفظ ونشر»
              </span>
            </div>

            <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
              {draft.episodes.map((ep, idx) => {
                const preacher = preacherMap.get(ep.preacherId);
                return (
                  <div
                    key={ep.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                      ep.published !== false
                        ? 'bg-[#0A0D0C]/80 border-white/10'
                        : 'bg-amber-950/20 border-amber-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ReciterImage
                        src={ep.coverUrl}
                        alt={ep.title}
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[#C8A253]/25"
                      />
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs font-semibold text-[#F5F3EE] truncate">
                          {ep.title}
                        </p>
                        <p className="text-[11px] text-[#A9B2AE] truncate">
                          {preacher?.nameAr || ep.preacherId} · {ep.category} · {ep.durationLabel}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            episodes: moveOrderedItem(prev.episodes, ep.id, 'up'),
                          }))
                        }
                        aria-label="تحريك لأعلى"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-[#A9B2AE] cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === draft.episodes.length - 1}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            episodes: moveOrderedItem(prev.episodes, ep.id, 'down'),
                          }))
                        }
                        aria-label="تحريك لأسفل"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-[#A9B2AE] cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            episodes: prev.episodes.map((item) =>
                              item.id === ep.id
                                ? { ...item, published: item.published === false }
                                : item
                            ),
                          }))
                        }
                        title={ep.published !== false ? 'إخفاء (مسودة)' : 'نشر الحلقة'}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#C8A253] cursor-pointer"
                      >
                        {ep.published !== false ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-amber-300" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditEpisode(ep)}
                        aria-label="تعديل الحلقة"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#F5F3EE] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            episodes: prev.episodes
                              .filter((item) => item.id !== ep.id)
                              .map((item, i) => ({ ...item, order: i })),
                          }))
                        }
                        aria-label="حذف الحلقة"
                        className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── SUBPANEL 2: PREACHERS MANAGEMENT ─── */}
      {subPanel === 'preachers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSubmitPreacher}
            className="lg:col-span-5 glass-panel rounded-2xl p-5 border border-white/10 space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F3EE] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#C8A253]" />
                <span>{editingPreacherId ? 'تعديل بيانات الداعية' : 'إضافة داعية جديد'}</span>
              </h3>
              {editingPreacherId && (
                <button
                  type="button"
                  onClick={handleResetPreacherForm}
                  className="text-xs text-[#A9B2AE] hover:text-white cursor-pointer"
                >
                  إلغاء
                </button>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#A9B2AE]">الاسم الكامل للداعية</label>
              <input
                type="text"
                value={prName}
                onChange={(e) => setPrName(e.target.value)}
                placeholder="مثال: الشيخ أمجد سمير"
                className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#A9B2AE]">الصفة أو الوصف المختصر</label>
              <input
                type="text"
                value={prTitle}
                onChange={(e) => setPrTitle(e.target.value)}
                placeholder="داعية وباحث شرعي مصري"
                className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-[#A9B2AE]">الصورة الشخصية للداعية</label>
                <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0E6B4D]/35 border border-[#C8A253]/30 text-[11px] text-[#C8A253] cursor-pointer">
                  <Upload className="w-3 h-3" />
                  <span>{uploadingPreacherPhoto ? 'جارٍ الرفع...' : 'رفع صورة'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                    disabled={uploadingPreacherPhoto}
                    onChange={async (ev) => {
                      const file = ev.target.files?.[0];
                      ev.target.value = '';
                      if (!file) return;
                      setUploadingPreacherPhoto(true);
                      try {
                        const url = await uploadMediaFile(file);
                        if (url) {
                          setPrPhoto(url);
                          notify('تم رفع صورة الداعية بنجاح', 'success');
                        }
                      } catch (err) {
                        notify(err instanceof Error ? err.message : 'فشل رفع الصورة', 'error');
                      } finally {
                        setUploadingPreacherPhoto(false);
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              <input
                type="text"
                dir="ltr"
                value={prPhoto}
                onChange={(e) => setPrPhoto(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#A9B2AE]">التخصصات والموضوعات (افصل بفاصلة ،)</label>
              <input
                type="text"
                value={prSpecialties}
                onChange={(e) => setPrSpecialties(e.target.value)}
                placeholder="تزكية النفس، قضايا الشباب، تصحيح المفاهيم"
                className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#A9B2AE]">السيرة المختصرة</label>
              <textarea
                rows={4}
                value={prBio}
                onChange={(e) => setPrBio(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-[#F5F3EE] cursor-pointer">
              <input
                type="checkbox"
                checked={prFeatured}
                onChange={(e) => setPrFeatured(e.target.checked)}
                className="w-4 h-4 accent-[#C8A253]"
              />
              <span>إبراز الداعية في مقدمة قسم بصيرة</span>
            </label>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs font-bold text-white cursor-pointer"
            >
              <Save className="w-4 h-4 text-[#C8A253]" />
              <span>{editingPreacherId ? 'حفظ تعديلات الداعية' : 'إضافة الداعية للمسودة'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
            <h3 className="text-sm font-bold text-[#F5F3EE]">
              قائمة الدعاة ({toArabicDigits(draft.preachers.length)})
            </h3>
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {draft.preachers.map((p, idx) => {
                const epCount = draft.episodes.filter((e) => e.preacherId === p.id).length;
                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-[#0A0D0C]/80 border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ReciterImage
                        src={p.photoUrl}
                        alt={p.nameAr}
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[#C8A253]/25"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#F5F3EE] truncate">{p.nameAr}</p>
                        <p className="text-[11px] text-[#C8A253] truncate">{p.titleAr}</p>
                        <p className="text-[10px] text-[#A9B2AE]">
                          {toArabicDigits(epCount)} حلقة ·{' '}
                          {p.specialties.slice(0, 3).join(' · ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            preachers: moveOrderedItem(prev.preachers, p.id, 'up'),
                          }))
                        }
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-[#A9B2AE] cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === draft.preachers.length - 1}
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            preachers: moveOrderedItem(prev.preachers, p.id, 'down'),
                          }))
                        }
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-[#A9B2AE] cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            preachers: prev.preachers.map((item) =>
                              item.id === p.id
                                ? { ...item, published: item.published === false }
                                : item
                            ),
                          }))
                        }
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#C8A253] cursor-pointer"
                      >
                        {p.published !== false ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-amber-300" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditPreacher(p)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#F5F3EE] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            preachers: prev.preachers
                              .filter((item) => item.id !== p.id)
                              .map((item, i) => ({ ...item, order: i })),
                          }))
                        }
                        className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── SUBPANEL 3: PLAYLISTS MANAGEMENT ─── */}
      {subPanel === 'playlists' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreatePlaylist}
            className="lg:col-span-5 glass-panel rounded-2xl p-5 border border-white/10 space-y-3.5"
          >
            <h3 className="text-sm font-bold text-[#F5F3EE]">إنشاء قائمة تشغيل لداعية</h3>
            <div className="space-y-1">
              <label className="text-xs text-[#A9B2AE]">الداعية</label>
              <select
                value={plPreacherId}
                onChange={(e) => {
                  setPlPreacherId(e.target.value);
                  setPlEpisodeIds([]);
                }}
                className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              >
                {draft.preachers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#A9B2AE]">اسم القائمة</label>
              <input
                type="text"
                value={plTitle}
                onChange={(e) => setPlTitle(e.target.value)}
                placeholder="مثال: مختارات التزكية والإخلاص"
                className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#A9B2AE]">وصف القائمة</label>
              <textarea
                rows={2}
                value={plDescription}
                onChange={(e) => setPlDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[#A9B2AE]">الحلقات المشمولة:</label>
              <div className="max-h-40 overflow-y-auto space-y-1 bg-[#0A0D0C] rounded-xl p-2.5 border border-white/10">
                {draft.episodes
                  .filter((ep) => ep.preacherId === plPreacherId)
                  .map((ep) => (
                    <label
                      key={ep.id}
                      className="flex items-center gap-2 text-[11px] text-[#F5F3EE] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={plEpisodeIds.includes(ep.id)}
                        onChange={(e) => {
                          setPlEpisodeIds((prev) =>
                            e.target.checked
                              ? [...prev, ep.id]
                              : prev.filter((id) => id !== ep.id)
                          );
                        }}
                        className="w-3.5 h-3.5 accent-[#C8A253]"
                      />
                      <span className="truncate">{ep.title}</span>
                    </label>
                  ))}
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs font-bold text-white cursor-pointer"
            >
              إضافة القائمة للمسودة
            </button>
          </form>

          <div className="lg:col-span-7 glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
            <h3 className="text-sm font-bold text-[#F5F3EE]">
              قوائم التشغيل المسجلة ({toArabicDigits(draft.playlists.length)})
            </h3>
            <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
              {draft.playlists.map((pl) => {
                const preacher = preacherMap.get(pl.preacherId);
                return (
                  <div
                    key={pl.id}
                    className="p-3.5 rounded-xl bg-[#0A0D0C]/80 border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-bold text-[#F5F3EE] truncate">{pl.title}</p>
                      <p className="text-[11px] text-[#C8A253] truncate">
                        {preacher?.nameAr || pl.preacherId} · {toArabicDigits(pl.episodeIds.length)} حلقات
                      </p>
                      <p className="text-[11px] text-[#A9B2AE] truncate">{pl.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          playlists: prev.playlists.filter((item) => item.id !== pl.id),
                        }))
                      }
                      aria-label={`حذف قائمة ${pl.title}`}
                      className="p-1.5 rounded-lg bg-rose-950/50 text-rose-300 hover:bg-rose-900/60 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
