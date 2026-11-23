import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_THINKING_POWER_OPTIONS,
  buildPreviewIframeUrl,
  classifyFileLayer,
  countDiffStats,
  filterProjectFiles,
  formatBytesCompact,
  formatElapsedTimer,
  getPipelineStepIndex,
  normalizeThinkingPower,
} from './aiDevHelpers';

test('countDiffStats accurately counts additions, deletions, and context lines', () => {
  const stats = countDiffStats([
    { type: 'context', lineNumberBefore: 1, lineNumberAfter: 1, text: 'line1' },
    { type: 'remove', lineNumberBefore: 2, lineNumberAfter: null, text: 'old' },
    { type: 'add', lineNumberBefore: null, lineNumberAfter: 2, text: 'new1' },
    { type: 'add', lineNumberBefore: null, lineNumberAfter: 3, text: 'new2' },
  ]);
  assert.deepEqual(stats, { additions: 2, deletions: 1, totalLines: 4 });
});

test('getPipelineStepIndex maps phases deterministically across job lifecycle', () => {
  assert.equal(getPipelineStepIndex('execute', 'بدء تشغيل المهندس الذكي...', 'running'), 0);
  assert.equal(getPipelineStepIndex('execute', 'قراءة ملف', 'running'), 1);
  assert.equal(getPipelineStepIndex('execute', 'تجهيز تعديل', 'running'), 2);
  assert.equal(getPipelineStepIndex('execute', 'تشغيل فحص TypeScript واختبارات الوحدات', 'running'), 3);
  assert.equal(getPipelineStepIndex('plan', 'أي مرحلة', 'completed'), 3);
});

test('formatBytesCompact and formatElapsedTimer format values predictably', () => {
  assert.equal(formatBytesCompact(0), '0 B');
  assert.equal(formatBytesCompact(512), '512 B');
  assert.equal(formatBytesCompact(2048), '2.0 KB');
  assert.equal(formatElapsedTimer(0), '00:00');
  assert.equal(formatElapsedTimer(65), '01:05');
});

test('filterProjectFiles filters by search query and architectural layer', () => {
  const sample = [
    { path: 'src/pages/HomePage.tsx', sizeBytes: 1200, writable: true },
    { path: 'server.ts', sizeBytes: 4200, writable: true },
    { path: 'server/aiDeveloper.ts', sizeBytes: 9800, writable: true },
    { path: 'firestore.rules', sizeBytes: 900, writable: true },
  ];

  assert.equal(classifyFileLayer('server/aiDeveloper.ts'), 'backend');
  assert.equal(classifyFileLayer('src/pages/HomePage.tsx'), 'frontend');
  assert.equal(classifyFileLayer('firestore.rules'), 'config');

  assert.equal(filterProjectFiles(sample, '', 'backend').length, 2);
  assert.equal(filterProjectFiles(sample, 'home', 'frontend').length, 1);
  assert.equal(filterProjectFiles(sample, 'home', 'backend').length, 0);
  assert.equal(filterProjectFiles(sample, '', 'config')[0]?.path, 'firestore.rules');
});

test('buildPreviewIframeUrl normalizes nonce and route hash', () => {
  assert.equal(buildPreviewIframeUrl(3, '#/reciters'), '/?preview=3#/reciters');
  assert.equal(buildPreviewIframeUrl(0, '/mushaf'), '/?preview=1#/mushaf');
});

test('normalizeThinkingPower clamps valid power levels and falls back to balanced', () => {
  assert.equal(normalizeThinkingPower('fast'), 'fast');
  assert.equal(normalizeThinkingPower('balanced'), 'balanced');
  assert.equal(normalizeThinkingPower('deep'), 'deep');
  assert.equal(normalizeThinkingPower('invalid'), 'balanced');
  assert.equal(normalizeThinkingPower(null), 'balanced');
  assert.equal(AI_THINKING_POWER_OPTIONS.length, 3);
});
