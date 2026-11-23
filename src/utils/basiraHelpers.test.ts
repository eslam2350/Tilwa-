import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { DEFAULT_BASIRA_CATALOG } from '../data/basiraData.ts';
import type { BasiraEpisode, BasiraPlaylist, BasiraPreacher } from '../types/tilawa';
import {
  BASIRA_CATEGORIES,
  episodeToAudioTrack,
  filterBasiraEpisodes,
  getPreacherStats,
  getRelatedBasiraEpisodes,
  mergeBasiraCatalog,
} from './basiraHelpers.ts';

const SAMPLE_PREACHERS: BasiraPreacher[] = [
  {
    id: 'amjad-samir',
    nameAr: 'الشيخ أمجد سمير',
    titleAr: 'داعية مصري',
    bioAr: 'سيرة مختصرة',
    photoUrl: '/cover.jpg',
    specialties: ['تصحيح المفاهيم الدينية'],
    featured: true,
    published: true,
    order: 0,
  },
  {
    id: 'mahmoud-al-ghaliz',
    nameAr: 'الشيخ محمود الغليظ',
    titleAr: 'داعية مصري',
    bioAr: 'سيرة مختصرة',
    photoUrl: '/cover2.jpg',
    specialties: ['قضايا الشباب'],
    featured: true,
    published: true,
    order: 1,
  },
];

const SAMPLE_EPISODES: BasiraEpisode[] = [
  {
    id: 'ep1',
    preacherId: 'amjad-samir',
    title: 'الإخلاص وتصحيح النية',
    description: 'وصف تفصيلي للحلقة الأولى',
    coverUrl: '/c1.jpg',
    audioUrl: 'https://archive.org/download/demo/1.mp3',
    durationSeconds: 1800,
    durationLabel: '٣٠:٠٠',
    publishedAt: '2025-02-10',
    category: 'تصحيح المفاهيم الدينية',
    tags: ['النية', 'القلب'],
    published: true,
    order: 0,
  },
  {
    id: 'ep2',
    preacherId: 'mahmoud-al-ghaliz',
    title: 'توبة الشباب وعلو الهمة',
    description: 'وصف تفصيلي للحلقة الثانية',
    coverUrl: '/c2.jpg',
    audioUrl: 'https://archive.org/download/demo/2.mp3',
    durationSeconds: 900,
    durationLabel: '١٥:٠٠',
    publishedAt: '2025-02-18',
    category: 'التوبة والذنوب',
    tags: ['توبة', 'الشباب'],
    published: true,
    order: 1,
  },
  {
    id: 'ep3',
    preacherId: 'amjad-samir',
    title: 'أخطاء شائعة في المفاهيم',
    description: 'حلقة في نفس التصنيف',
    coverUrl: '/c3.jpg',
    audioUrl: 'https://archive.org/download/demo/3.mp3',
    durationSeconds: 1200,
    durationLabel: '٢٠:٠٠',
    publishedAt: '2025-02-20',
    category: 'تصحيح المفاهيم الدينية',
    tags: ['تصحيح', 'النية'],
    published: true,
    order: 2,
  },
  {
    id: 'ep4-draft',
    preacherId: 'amjad-samir',
    title: 'حلقة مسودة غير منشورة',
    description: 'مخفية',
    coverUrl: '/c4.jpg',
    audioUrl: 'https://archive.org/download/demo/4.mp3',
    durationSeconds: 600,
    durationLabel: '١٠:٠٠',
    publishedAt: '2025-02-21',
    category: 'تصحيح المفاهيم الدينية',
    tags: [],
    published: false,
    order: 3,
  },
];

const SAMPLE_PLAYLISTS: BasiraPlaylist[] = [
  {
    id: 'pl1',
    preacherId: 'amjad-samir',
    title: 'قائمة أمجد سمير المختارة',
    description: 'سلسلة إيمانية',
    episodeIds: ['ep1', 'ep3'],
    published: true,
    order: 0,
  },
];

test('BASIRA_CATEGORIES includes all 11 requested categories', () => {
  assert.equal(BASIRA_CATEGORIES.length, 11);
  assert.ok(BASIRA_CATEGORIES.includes('تصحيح المفاهيم الدينية'));
  assert.ok(BASIRA_CATEGORIES.includes('التوبة والذنوب'));
  assert.ok(BASIRA_CATEGORIES.includes('قضايا الشباب'));
  assert.ok(BASIRA_CATEGORIES.includes('محاضرات طويلة'));
});

test('filterBasiraEpisodes filters by category, preacher, query, and excludes unpublished by default', () => {
  const allPublished = filterBasiraEpisodes({
    episodes: SAMPLE_EPISODES,
    preachers: SAMPLE_PREACHERS,
  });
  assert.equal(allPublished.length, 3);

  const byCat = filterBasiraEpisodes({
    episodes: SAMPLE_EPISODES,
    preachers: SAMPLE_PREACHERS,
    category: 'تصحيح المفاهيم الدينية',
  });
  assert.deepEqual(
    byCat.map((e) => e.id),
    ['ep1', 'ep3']
  );

  const byPreacherSearch = filterBasiraEpisodes({
    episodes: SAMPLE_EPISODES,
    preachers: SAMPLE_PREACHERS,
    query: 'الغليظ',
  });
  assert.deepEqual(
    byPreacherSearch.map((e) => e.id),
    ['ep2']
  );
});

test('getRelatedBasiraEpisodes prioritizes same category and shared tags and skips target and drafts', () => {
  const related = getRelatedBasiraEpisodes(SAMPLE_EPISODES[0], SAMPLE_EPISODES, 2);
  assert.equal(related[0].id, 'ep3');
  assert.equal(related.some((e) => e.id === 'ep4-draft'), false);
});

test('getPreacherStats aggregates published episodes, latest sorted descending, and playlists', () => {
  const stats = getPreacherStats(SAMPLE_PREACHERS[0], SAMPLE_EPISODES, SAMPLE_PLAYLISTS);
  assert.equal(stats.totalEpisodes, 2);
  assert.equal(stats.latestEpisodes[0].id, 'ep3');
  assert.equal(stats.playlistsList.length, 1);
});

test('episodeToAudioTrack creates a valid podcast AudioTrack for persistent audio playback', () => {
  const track = episodeToAudioTrack(SAMPLE_EPISODES[0], SAMPLE_PREACHERS[0], 1);
  assert.equal(track.kind, 'podcast');
  assert.equal(track.episodeId, 'ep1');
  assert.equal(track.preacherId, 'amjad-samir');
  assert.equal(track.reciterName, 'الشيخ أمجد سمير');
  assert.equal(track.isAvailable, true);
});

test('mergeBasiraCatalog falls back safely or honors persisted server deletions/orders', () => {
  const fallback = mergeBasiraCatalog(
    { preachers: SAMPLE_PREACHERS, episodes: SAMPLE_EPISODES, playlists: SAMPLE_PLAYLISTS },
    null
  );
  assert.equal(fallback.preachers.length, 2);

  const merged = mergeBasiraCatalog(
    { preachers: SAMPLE_PREACHERS, episodes: SAMPLE_EPISODES, playlists: SAMPLE_PLAYLISTS },
    {
      preachers: [SAMPLE_PREACHERS[1]],
      episodes: [SAMPLE_EPISODES[1]],
      playlists: SAMPLE_PLAYLISTS,
    }
  );
  assert.equal(merged.preachers.length, 1);
  assert.equal(merged.preachers[0].id, 'mahmoud-al-ghaliz');
});

test('DEFAULT_BASIRA_CATALOG integrity holds 120 published unique episodes with valid audio URLs, playlists, and local portraits', () => {
  assert.equal(DEFAULT_BASIRA_CATALOG.preachers.length, 11);
  assert.equal(DEFAULT_BASIRA_CATALOG.episodes.length, 120);
  assert.equal(DEFAULT_BASIRA_CATALOG.playlists.length, 15);
  const epIds = new Set<string>();
  const preacherIds = new Set(DEFAULT_BASIRA_CATALOG.preachers.map((p) => p.id));

  for (const preacher of DEFAULT_BASIRA_CATALOG.preachers) {
    assert.ok(
      preacher.photoUrl.startsWith('/images/basira/preachers/'),
      `Preacher ${preacher.id} photoUrl should be local portrait: ${preacher.photoUrl}`
    );
    const localPortraitPath = path.join(process.cwd(), 'public', preacher.photoUrl);
    assert.equal(
      fs.existsSync(localPortraitPath),
      true,
      `Missing local portrait file: ${localPortraitPath}`
    );
  }

  for (const ep of DEFAULT_BASIRA_CATALOG.episodes) {
    assert.equal(epIds.has(ep.id), false, `Duplicate episode id: ${ep.id}`);
    epIds.add(ep.id);
    assert.equal(preacherIds.has(ep.preacherId), true, `Missing preacher: ${ep.preacherId}`);
    assert.equal(ep.published, true);
    assert.ok(/^https:\/\/archive\.org\/download\//i.test(ep.audioUrl));
  }

  for (const pl of DEFAULT_BASIRA_CATALOG.playlists) {
    assert.equal(preacherIds.has(pl.preacherId), true);
    for (const id of pl.episodeIds) {
      assert.equal(epIds.has(id), true, `Playlist ${pl.id} references missing episode ${id}`);
    }
  }
});
