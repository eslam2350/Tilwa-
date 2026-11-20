import React, { useEffect, useState } from 'react';
import { ListPlus, Plus, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { AudioTrack } from '../types/tilawa';

interface PlaylistPickerModalProps {
  track: AudioTrack | null;
  onClose: () => void;
}

export const PlaylistPickerModal: React.FC<PlaylistPickerModalProps> = ({ track, onClose }) => {
  const { playlists, createNewPlaylist, addTrackToUserPlaylist } = useAuth();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setNewName('');
  }, [track]);

  useEffect(() => {
    if (!track) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [track, onClose]);

  if (!track) return null;

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await createNewPlaylist(newName);
      if (created) {
        await addTrackToUserPlaylist(created.id, {
          reciterId: track.reciterId,
          reciterName: track.reciterName,
          surahNumber: track.surahNumber,
          surahName: track.surahName,
          style: track.style,
          audioUrl: track.audioUrl,
        });
        setNewName('');
        onClose();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSelect = async (playlistId: string) => {
    await addTrackToUserPlaylist(playlistId, {
      reciterId: track.reciterId,
      reciterName: track.reciterName,
      surahNumber: track.surahNumber,
      surahName: track.surahName,
      style: track.style,
      audioUrl: track.audioUrl,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="إضافة التلاوة إلى قائمة تشغيل"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md glass-gold rounded-2xl p-6 space-y-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#F5F3EE]">
            حفظ «{track.surahName}» في قائمة تشغيل
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-white/10 text-[#A9B2AE] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 max-h-52 overflow-y-auto">
          {playlists.length === 0 ? (
            <p className="text-xs text-[#A9B2AE] py-3 text-center">
              لا توجد قوائم تشغيل بعد. أنشئ قائمتك الأولى أدناه.
            </p>
          ) : (
            playlists.map((pl) => (
              <button
                key={pl.id}
                type="button"
                onClick={() => void handleSelect(pl.id)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-[#0E6B4D]/25 border border-white/10 text-sm text-[#F5F3EE] cursor-pointer transition-colors"
              >
                <span className="truncate">{pl.name}</span>
                <ListPlus className="w-4 h-4 text-[#C8A253] shrink-0" />
              </button>
            ))
          )}
        </div>

        <form onSubmit={(e) => void handleCreateAndAdd(e)} className="pt-3 border-t border-white/10 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم قائمة جديدة (مثلاً: سورة الجمعة)"
            maxLength={120}
            className="flex-1 px-3 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE] placeholder:text-[#A9B2AE]/60 focus:outline-none focus:border-[#C8A253]"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] disabled:opacity-50 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء</span>
          </button>
        </form>
      </div>
    </div>
  );
};
