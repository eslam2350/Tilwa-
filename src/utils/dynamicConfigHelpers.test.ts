import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DYNAMIC_CONFIG,
  DEFAULT_HOME_SECTIONS,
  DEFAULT_NAV_PAGES,
  getConfigChangedSections,
  isCustomTheme,
  isNewerConfigVersion,
  isValidHexColor,
  mergeDynamicConfig,
  mergeSectionEnhancements,
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
  assert.equal(movedUp[1].id, 'reciters');
  assert.equal(movedUp[2].id, 'continue');
  assert.deepEqual(
    movedUp.map((x) => x.order),
    DEFAULT_HOME_SECTIONS.map((_, i) => i)
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

test('getConfigChangedSections detects modified draft categories accurately', () => {
  assert.equal(getConfigChangedSections(DEFAULT_DYNAMIC_CONFIG, DEFAULT_DYNAMIC_CONFIG).length, 0);
  const modified = {
    ...DEFAULT_DYNAMIC_CONFIG,
    texts: { ...DEFAULT_DYNAMIC_CONFIG.texts, slogan: 'شعار جديد' },
    theme: { ...DEFAULT_DYNAMIC_CONFIG.theme, goldAntique: '#FFD700' },
  };
  const diffs = getConfigChangedSections(modified, DEFAULT_DYNAMIC_CONFIG);
  assert.deepEqual(
    diffs.map((d) => d.key),
    ['texts', 'theme']
  );
});

test('mergeDynamicConfig strips legacy developer names from certificates and clamps required levels', () => {
  const merged = mergeDynamicConfig({
    certificates: {
      signerName: 'Eslam Mohammad',
      signerTitleAr: 'المشرف العام ومؤسس منصة تلاوة',
      requiredLevelListening: 99,
      requiredLevelMemorization: 0,
      requiredLevelExcellence: 4,
      requiredLevelKhatmah: 6,
    },
  });
  assert.equal(merged.certificates?.signerName, 'منصة تلاوة · TILAWA');
  assert.equal(merged.certificates?.signerTitleAr, 'إدارة منصة تلاوة للقرآن الكريم');
  assert.equal(merged.certificates?.requiredLevelListening, 10);
  assert.equal(merged.certificates?.requiredLevelMemorization, 1);
  assert.equal(merged.certificates?.requiredLevelExcellence, 4);
  assert.equal(merged.certificates?.requiredLevelKhatmah, 6);
});

test('mergeSectionEnhancements sanitizes presets, densities, lengths and flags sectionEnhancements diffs', () => {
  const merged = mergeSectionEnhancements({
    hero: {
      boosted: true,
      boostLevel: 'spotlight',
      stylePreset: 'royal_gold',
      density: 'spacious',
      glowAccent: true,
      showDivider: true,
      badgeText: '  مختارات  ',
      customHeadline: 'عنوان تجريبي',
    },
    recitersDirectory: {
      boosted: true,
      stylePreset: 'invalid_preset',
      density: 'invalid_density',
    },
  });

  assert.equal(merged.hero.boosted, true);
  assert.equal(merged.hero.stylePreset, 'royal_gold');
  assert.equal(merged.hero.badgeText, 'مختارات');
  assert.equal(merged.recitersDirectory.boosted, true);
  assert.equal(merged.recitersDirectory.stylePreset, 'default');
  assert.equal(merged.recitersDirectory.density, 'comfortable');

  const modifiedConfig = {
    ...DEFAULT_DYNAMIC_CONFIG,
    sectionEnhancements: merged,
  };
  const diffs = getConfigChangedSections(modifiedConfig, DEFAULT_DYNAMIC_CONFIG);
  assert.equal(diffs.some((d) => d.key === 'sectionEnhancements'), true);
});

