import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DYNAMIC_CONFIG,
  DEFAULT_HOME_SECTIONS,
  DEFAULT_NAV_PAGES,
  isCustomTheme,
  isNewerConfigVersion,
  isValidHexColor,
  mergeDynamicConfig,
  moveOrderedItem,
  sanitizeHexColor,
  sanitizeImageUrl,
} from './dynamicConfigHelpers';

test('isValidHexColor and sanitizeHexColor accept valid hex colors and fallback on invalid inputs', () => {
  assert.equal(isValidHexColor('#0e6b4d'), true);
  assert.equal(isValidHexColor('#C8A253'), true);
  assert.equal(isValidHexColor('red'), false);
  assert.equal(isValidHexColor('#123'), false);
  assert.equal(sanitizeHexColor(' #1a2b3c ', '#000000'), '#1A2B3C');
  assert.equal(sanitizeHexColor('javascript:alert(1)', '#0A0D0C'), '#0A0D0C');
});

test('mergeDynamicConfig preserves defaults and appends missing sections or pages safely', () => {
  const merged = mergeDynamicConfig({
    version: 7,
    texts: {
      siteName: 'منصة تلاوة الجديدة',
      announcementEnabled: true,
      announcementText: 'تحديث رمضاني جديد',
    },
    homeSections: [
      { id: 'reciters', label: 'القراء أولًا', visible: true, order: 0 },
      { id: 'hero', label: 'الواجهة', visible: false, order: 1 },
    ],
    navPages: [{ id: 'home', label: 'البداية', visible: false, order: 0 }],
  });

  assert.equal(merged.version, 7);
  assert.equal(merged.texts.siteName, 'منصة تلاوة الجديدة');
  assert.equal(merged.texts.heroTitle, DEFAULT_DYNAMIC_CONFIG.texts.heroTitle);
  assert.equal(merged.texts.announcementEnabled, true);
  assert.equal(merged.homeSections.length, DEFAULT_HOME_SECTIONS.length);
  assert.equal(merged.homeSections[0].id, 'reciters');
  assert.equal(merged.homeSections[1].visible, false);
  // Home navigation item must stay visible
  assert.equal(merged.navPages.length, DEFAULT_NAV_PAGES.length);
  assert.equal(merged.navPages.find((p) => p.id === 'home')?.visible, true);
});

test('moveOrderedItem swaps adjacent sections and reindexes order sequentially', () => {
  const movedUp = moveOrderedItem(DEFAULT_HOME_SECTIONS, 'reciters', 'up');
  assert.equal(movedUp[2].id, 'reciters');
  assert.equal(movedUp[3].id, 'stations');
  assert.deepEqual(
    movedUp.map((x) => x.order),
    [0, 1, 2, 3, 4, 5, 6]
  );

  // Moving first item up stays unchanged
  const topUnchanged = moveOrderedItem(DEFAULT_HOME_SECTIONS, 'hero', 'up');
  assert.equal(topUnchanged[0].id, 'hero');
});

test('sanitizeImageUrl rejects unsafe javascript URLs and accepts https and data URIs', () => {
  assert.equal(
    sanitizeImageUrl('https://example.com/hero.jpg', ''),
    'https://example.com/hero.jpg'
  );
  assert.equal(sanitizeImageUrl('javascript:alert(1)', 'fallback.jpg'), 'fallback.jpg');
  assert.equal(sanitizeImageUrl('', 'fallback.jpg'), '');
});

test('isCustomTheme detects modifications from default obsidian_gold theme', () => {
  assert.equal(isCustomTheme(DEFAULT_DYNAMIC_CONFIG.theme), false);
  assert.equal(
    isCustomTheme({ ...DEFAULT_DYNAMIC_CONFIG.theme, emeraldDeep: '#107D58' }),
    true
  );
  assert.equal(isNewerConfigVersion(4, 3), true);
  assert.equal(isNewerConfigVersion(3, 3), false);
});
