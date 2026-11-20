import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  limit,
} from 'firebase/firestore';
import type {
  CuratedRecitation,
  DynamicAppConfig,
  FavoriteItem,
  ListeningHistoryItem,
  PlaylistTrack,
  Reciter,
  UserPlaylist,
  UserProfile,
} from '../types/tilawa';
import { mergeDynamicConfig } from '../utils/dynamicConfigHelpers';
import { sanitizeFirestoreId } from '../utils/quranHelpers';
import { db, handleFirestoreError, OperationType } from './firebase';

function trunc(val: string | undefined, max: number): string {
  return (val || '').trim().slice(0, max);
}

export async function ensureUserProfile(params: {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  isAdminUser: boolean;
}): Promise<UserProfile> {
  const userPath = `users/${params.uid}`;
  const userRef = doc(db, 'users', params.uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const profilePayload = {
        uid: params.uid,
        displayName: trunc(params.displayName, 100) || 'مستمع',
        photoURL: trunc(params.photoURL, 500),
        role: params.isAdminUser ? ('admin' as const) : ('user' as const),
        preferredFontSize: 28,
        preferredPlaybackRate: 1,
        lastReadSurah: 1,
        lastReadAyah: 1,
        lastReadPage: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, profilePayload);

      // Isolated PII document
      if (params.email) {
        const privateRef = doc(db, 'users', params.uid, 'private', 'info');
        await setDoc(privateRef, {
          uid: params.uid,
          email: trunc(params.email, 200),
          updatedAt: serverTimestamp(),
        });
      }

      return {
        ...profilePayload,
      };
    }

    const existing = snap.data() as UserProfile;
    return existing;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function updateUserSettings(
  uid: string,
  updates: Partial<
    Pick<
      UserProfile,
      | 'displayName'
      | 'preferredFontSize'
      | 'preferredPlaybackRate'
      | 'lastReadSurah'
      | 'lastReadAyah'
      | 'lastReadPage'
    >
  >
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.displayName !== undefined) {
      payload.displayName = trunc(updates.displayName, 100) || 'مستمع';
    }
    if (updates.preferredFontSize !== undefined) {
      payload.preferredFontSize = Math.min(46, Math.max(18, Math.round(updates.preferredFontSize)));
    }
    if (updates.preferredPlaybackRate !== undefined) {
      payload.preferredPlaybackRate = Math.min(2.0, Math.max(0.5, updates.preferredPlaybackRate));
    }
    if (updates.lastReadSurah !== undefined) {
      payload.lastReadSurah = Math.min(114, Math.max(1, Math.round(updates.lastReadSurah)));
    }
    if (updates.lastReadAyah !== undefined) {
      payload.lastReadAyah = Math.min(286, Math.max(1, Math.round(updates.lastReadAyah)));
    }
    if (updates.lastReadPage !== undefined) {
      payload.lastReadPage = Math.min(604, Math.max(1, Math.round(updates.lastReadPage)));
    }
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Favorites ---
export async function fetchFavorites(uid: string): Promise<FavoriteItem[]> {
  const path = `users/${uid}/favorites`;
  try {
    const q = query(collection(db, 'users', uid, 'favorites'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as FavoriteItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function addFavorite(uid: string, item: Omit<FavoriteItem, 'userId' | 'createdAt'>): Promise<void> {
  const safeId = sanitizeFirestoreId(item.id);
  const path = `users/${uid}/favorites/${safeId}`;
  try {
    const payload: Record<string, unknown> = {
      id: safeId,
      userId: uid,
      type: item.type,
      targetId: trunc(item.targetId, 120),
      title: trunc(item.title, 200),
      createdAt: serverTimestamp(),
    };
    if (item.subtitle) payload.subtitle = trunc(item.subtitle, 240);
    if (item.audioUrl) payload.audioUrl = trunc(item.audioUrl, 500);
    if (item.reciterId) payload.reciterId = trunc(item.reciterId, 64);
    if (item.surahNumber !== undefined) payload.surahNumber = item.surahNumber;
    if (item.ayahNumber !== undefined) payload.ayahNumber = item.ayahNumber;
    await setDoc(doc(db, 'users', uid, 'favorites', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeFavorite(uid: string, favId: string): Promise<void> {
  const safeId = sanitizeFirestoreId(favId);
  const path = `users/${uid}/favorites/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'favorites', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Listening History ---
export async function fetchListeningHistory(uid: string): Promise<ListeningHistoryItem[]> {
  const path = `users/${uid}/history`;
  try {
    const q = query(collection(db, 'users', uid, 'history'), orderBy('updatedAt', 'desc'), limit(30));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ListeningHistoryItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveListeningHistory(
  uid: string,
  item: Omit<ListeningHistoryItem, 'userId' | 'updatedAt'>
): Promise<void> {
  const safeId = sanitizeFirestoreId(item.id);
  const path = `users/${uid}/history/${safeId}`;
  try {
    const ref = doc(db, 'users', uid, 'history', safeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const payload: Record<string, unknown> = {
        id: safeId,
        userId: uid,
        reciterId: trunc(item.reciterId, 64),
        reciterName: trunc(item.reciterName, 120),
        surahNumber: item.surahNumber,
        surahName: trunc(item.surahName, 80),
        audioUrl: trunc(item.audioUrl, 500),
        progressSeconds: Math.max(0, item.progressSeconds),
        updatedAt: serverTimestamp(),
      };
      if (item.style) payload.style = trunc(item.style, 60);
      if (item.durationSeconds !== undefined) payload.durationSeconds = Math.max(0, item.durationSeconds);
      await setDoc(ref, payload);
    } else {
      const payload: Record<string, unknown> = {
        progressSeconds: Math.max(0, item.progressSeconds),
        audioUrl: trunc(item.audioUrl, 500),
        updatedAt: serverTimestamp(),
      };
      if (item.durationSeconds !== undefined) payload.durationSeconds = Math.max(0, item.durationSeconds);
      if (item.style) payload.style = trunc(item.style, 60);
      await updateDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Personal Playlists ---
export async function fetchPlaylists(uid: string): Promise<UserPlaylist[]> {
  const path = `users/${uid}/playlists`;
  try {
    const q = query(collection(db, 'users', uid, 'playlists'), orderBy('updatedAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as UserPlaylist);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createPlaylist(uid: string, name: string, description = ''): Promise<UserPlaylist> {
  const safeId = sanitizeFirestoreId(`pl_${Date.now()}`);
  const path = `users/${uid}/playlists/${safeId}`;
  try {
    const payload: Record<string, unknown> = {
      id: safeId,
      userId: uid,
      name: trunc(name, 120) || 'قائمة تلاوات',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (description.trim()) payload.description = trunc(description, 300);
    await setDoc(doc(db, 'users', uid, 'playlists', safeId), payload);
    return {
      id: safeId,
      userId: uid,
      name: trunc(name, 120) || 'قائمة تلاوات',
      description: trunc(description, 300),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deletePlaylist(uid: string, playlistId: string): Promise<void> {
  const safeId = sanitizeFirestoreId(playlistId);
  const path = `users/${uid}/playlists/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'playlists', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchPlaylistTracks(uid: string, playlistId: string): Promise<PlaylistTrack[]> {
  const safePlId = sanitizeFirestoreId(playlistId);
  const path = `users/${uid}/playlists/${safePlId}/tracks`;
  try {
    const q = query(
      collection(db, 'users', uid, 'playlists', safePlId, 'tracks'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as PlaylistTrack);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function addTrackToPlaylist(
  uid: string,
  playlistId: string,
  track: Omit<PlaylistTrack, 'id' | 'userId' | 'playlistId' | 'createdAt'>
): Promise<void> {
  const safePlId = sanitizeFirestoreId(playlistId);
  const trackId = sanitizeFirestoreId(`trk_${track.reciterId}_${track.surahNumber}_${Date.now()}`);
  const path = `users/${uid}/playlists/${safePlId}/tracks/${trackId}`;
  try {
    const payload: Record<string, unknown> = {
      id: trackId,
      userId: uid,
      playlistId: safePlId,
      reciterId: trunc(track.reciterId, 64),
      reciterName: trunc(track.reciterName, 120),
      surahNumber: track.surahNumber,
      surahName: trunc(track.surahName, 80),
      audioUrl: trunc(track.audioUrl, 500),
      createdAt: serverTimestamp(),
    };
    if (track.style) payload.style = trunc(track.style, 60);
    await setDoc(doc(db, 'users', uid, 'playlists', safePlId, 'tracks', trackId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeTrackFromPlaylist(
  uid: string,
  playlistId: string,
  trackId: string
): Promise<void> {
  const safePlId = sanitizeFirestoreId(playlistId);
  const safeTrkId = sanitizeFirestoreId(trackId);
  const path = `users/${uid}/playlists/${safePlId}/tracks/${safeTrkId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'playlists', safePlId, 'tracks', safeTrkId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Public Catalog & Admin Management ---
export async function fetchCustomReciters(): Promise<Reciter[]> {
  const path = 'reciters';
  try {
    const snap = await getDocs(collection(db, 'reciters'));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id,
        nameAr: data.nameAr,
        nameEn: data.nameEn,
        titleAr: data.titleAr,
        bioAr: data.bioAr,
        birthYear: data.birthYear || '',
        deathYear: data.deathYear || '',
        originAr: data.originAr || '',
        photoUrl: data.photoUrl,
        photoSource: data.photoSource || '',
        featured: Boolean(data.featured),
        collections: [],
      } as Reciter;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function upsertAdminReciter(reciter: Omit<Reciter, 'collections'>): Promise<void> {
  const safeId = sanitizeFirestoreId(reciter.id);
  const path = `reciters/${safeId}`;
  try {
    const ref = doc(db, 'reciters', safeId);
    const snap = await getDoc(ref);
    const payload: Record<string, unknown> = {
      id: safeId,
      nameAr: trunc(reciter.nameAr, 120),
      nameEn: trunc(reciter.nameEn, 120),
      titleAr: trunc(reciter.titleAr, 160),
      bioAr: trunc(reciter.bioAr, 2000),
      photoUrl: trunc(reciter.photoUrl, 500),
      featured: Boolean(reciter.featured),
      updatedAt: serverTimestamp(),
    };
    if (reciter.birthYear) payload.birthYear = trunc(reciter.birthYear, 32);
    if (reciter.deathYear) payload.deathYear = trunc(reciter.deathYear, 32);
    if (reciter.originAr) payload.originAr = trunc(reciter.originAr, 120);
    if (reciter.photoSource) payload.photoSource = trunc(reciter.photoSource, 300);

    if (!snap.exists()) {
      await setDoc(ref, payload);
    } else {
      await updateDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAdminReciter(reciterId: string): Promise<void> {
  const safeId = sanitizeFirestoreId(reciterId);
  const path = `reciters/${safeId}`;
  try {
    await deleteDoc(doc(db, 'reciters', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchAdminRecitations(): Promise<CuratedRecitation[]> {
  const path = 'recitations';
  try {
    const snap = await getDocs(collection(db, 'recitations'));
    return snap.docs.map((d) => d.data() as CuratedRecitation);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function upsertAdminRecitation(rec: CuratedRecitation): Promise<void> {
  const safeId = sanitizeFirestoreId(rec.id);
  const path = `recitations/${safeId}`;
  try {
    const ref = doc(db, 'recitations', safeId);
    const snap = await getDoc(ref);
    const basePayload: Record<string, unknown> = {
      id: safeId,
      reciterId: sanitizeFirestoreId(rec.reciterId),
      surahNumber: Math.min(114, Math.max(1, Math.round(rec.surahNumber))),
      surahNameAr: trunc(rec.surahNameAr, 80),
      style: rec.style,
      audioUrl: trunc(rec.audioUrl, 500),
      isAvailable: Boolean(rec.isAvailable),
      updatedAt: serverTimestamp(),
    };
    if (rec.riwayah) basePayload.riwayah = trunc(rec.riwayah, 80);
    if (rec.durationLabel) basePayload.durationLabel = trunc(rec.durationLabel, 32);
    if (rec.sourceName) basePayload.sourceName = trunc(rec.sourceName, 160);
    if (rec.playsCount !== undefined) basePayload.playsCount = Math.max(0, Math.round(rec.playsCount));

    if (!snap.exists()) {
      await setDoc(ref, { ...basePayload, createdAt: serverTimestamp() });
    } else {
      await updateDoc(ref, basePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAdminRecitation(recitationId: string): Promise<void> {
  const safeId = sanitizeFirestoreId(recitationId);
  const path = `recitations/${safeId}`;
  try {
    await deleteDoc(doc(db, 'recitations', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchAllUsersForAdmin(): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(100)));
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// --- Dynamic Remote App Config ---
export async function fetchDynamicAppConfig(): Promise<DynamicAppConfig | null> {
  const path = 'app_config/live';
  try {
    const snap = await getDoc(doc(db, 'app_config', 'live'));
    if (!snap.exists()) return null;
    return mergeDynamicConfig(snap.data());
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('offline') || error.message.includes('unavailable'))
    ) {
      return null;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeDynamicAppConfig(
  onUpdate: (config: DynamicAppConfig) => void,
  onError?: (err: unknown) => void
): () => void {
  const ref = doc(db, 'app_config', 'live');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onUpdate(mergeDynamicConfig(snap.data()));
      }
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function publishDynamicAppConfig(
  draft: DynamicAppConfig,
  updatedByUid: string
): Promise<DynamicAppConfig> {
  const path = 'app_config/live';
  const clean = mergeDynamicConfig(draft);
  const nextVersion = Math.max(1, Math.floor(clean.version || 1));

  const payload = {
    id: 'live',
    version: nextVersion,
    theme: {
      presetId: clean.theme.presetId,
      bgObsidian: clean.theme.bgObsidian,
      bgSurface: clean.theme.bgSurface,
      bgElevated: clean.theme.bgElevated,
      emeraldDeep: clean.theme.emeraldDeep,
      emeraldSoft: clean.theme.emeraldSoft,
      goldAntique: clean.theme.goldAntique,
      textPrimary: clean.theme.textPrimary,
      textSecondary: clean.theme.textSecondary,
    },
    texts: {
      siteName: clean.texts.siteName,
      slogan: clean.texts.slogan,
      heroBadge: clean.texts.heroBadge,
      heroTitle: clean.texts.heroTitle,
      heroSubtitle: clean.texts.heroSubtitle,
      ctaListenLabel: clean.texts.ctaListenLabel,
      ctaMushafLabel: clean.texts.ctaMushafLabel,
      ctaTahfeezLabel: clean.texts.ctaTahfeezLabel,
      announcementEnabled: Boolean(clean.texts.announcementEnabled),
      announcementText: clean.texts.announcementText,
      mushafShowcaseTitle: clean.texts.mushafShowcaseTitle,
      mushafShowcaseSubtitle: clean.texts.mushafShowcaseSubtitle,
      footerDescription: clean.texts.footerDescription,
    },
    images: {
      heroBackdropUrl: clean.images.heroBackdropUrl,
    },
    homeSections: clean.homeSections.slice(0, 12).map((s, idx) => ({
      id: s.id,
      label: s.label,
      visible: Boolean(s.visible),
      order: idx,
    })),
    navPages: clean.navPages.slice(0, 10).map((p, idx) => ({
      id: p.id,
      label: p.label,
      visible: Boolean(p.visible),
      order: idx,
    })),
    ota: {
      manifestUrl: clean.ota.manifestUrl,
      autoCheck: Boolean(clean.ota.autoCheck),
      releaseNotes: clean.ota.releaseNotes,
    },
    updatedBy: trunc(updatedByUid, 128) || 'admin',
    updatedAt: serverTimestamp(),
  };

  try {
    const ref = doc(db, 'app_config', 'live');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, payload);
    } else {
      await updateDoc(ref, {
        version: payload.version,
        theme: payload.theme,
        texts: payload.texts,
        images: payload.images,
        homeSections: payload.homeSections,
        navPages: payload.navPages,
        ota: payload.ota,
        updatedBy: payload.updatedBy,
        updatedAt: serverTimestamp(),
      });
    }
    return {
      ...clean,
      version: nextVersion,
      updatedBy: payload.updatedBy,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

