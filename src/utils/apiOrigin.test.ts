import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildApiEndpointCandidates,
  extractOriginFromUrl,
  getCandidateServerOrigins,
  isEmbeddedFileRuntime,
  resolveRuntimeMediaUrl,
} from './apiOrigin';

test('extractOriginFromUrl accepts http/https origins and rejects file URLs', () => {
  assert.equal(
    extractOriginFromUrl('https://example.run.app/downloads/ota-manifest.json'),
    'https://example.run.app'
  );
  assert.equal(extractOriginFromUrl('file:///android_asset/index.html'), null);
  assert.equal(extractOriginFromUrl('not-a-url'), null);
});

test('isEmbeddedFileRuntime detects file:// and Android bridge correctly', () => {
  assert.equal(isEmbeddedFileRuntime('https:', false), false);
  assert.equal(isEmbeddedFileRuntime('http:', false), false);
  assert.equal(isEmbeddedFileRuntime('file:', false), true);
  assert.equal(isEmbeddedFileRuntime('https:', true), true);
});

test('buildApiEndpointCandidates uses relative path on web and full origin candidates inside APK', () => {
  const webCandidates = buildApiEndpointCandidates('/api/public/config', {
    protocol: 'https:',
    hasAndroidBridge: false,
  });
  assert.deepEqual(webCandidates, ['/api/public/config']);

  const apkCandidates = buildApiEndpointCandidates('/api/public/basira', {
    protocol: 'file:',
    hasAndroidBridge: true,
    bridgeOrigin: 'https://live.tilawa.app',
    storedOrigin: 'https://cached.tilawa.app',
    manifestUrl: 'https://manifest.tilawa.app/downloads/ota-manifest.json',
  });
  assert.equal(apkCandidates[0], 'https://live.tilawa.app/api/public/basira');
  assert.equal(apkCandidates[1], 'https://cached.tilawa.app/api/public/basira');
  assert.equal(apkCandidates[2], 'https://manifest.tilawa.app/api/public/basira');
  assert.ok(apkCandidates.length >= 4);
});

test('resolveRuntimeMediaUrl keeps bundled images relative and resolves /uploads/basira inside APK', () => {
  assert.equal(
    resolveRuntimeMediaUrl('/images/basira/hero.jpg', {
      protocol: 'file:',
      hasAndroidBridge: true,
      bridgeOrigin: 'https://live.tilawa.app',
    }),
    '/images/basira/hero.jpg'
  );

  assert.equal(
    resolveRuntimeMediaUrl('/uploads/basira/123_ep.mp3', {
      protocol: 'file:',
      hasAndroidBridge: true,
      bridgeOrigin: 'https://live.tilawa.app',
    }),
    'https://live.tilawa.app/uploads/basira/123_ep.mp3'
  );

  assert.equal(
    resolveRuntimeMediaUrl('/uploads/basira/123_ep.mp3', {
      protocol: 'https:',
      hasAndroidBridge: false,
    }),
    '/uploads/basira/123_ep.mp3'
  );
});

test('getCandidateServerOrigins deduplicates duplicate origins', () => {
  const origins = getCandidateServerOrigins({
    bridgeOrigin: 'https://ais-pre-yohyjyrr4bd6elu2ixq7e7-1009876701033.europe-west2.run.app',
    storedOrigin: 'https://ais-pre-yohyjyrr4bd6elu2ixq7e7-1009876701033.europe-west2.run.app/test',
    manifestUrl: 'https://ais-dev-yohyjyrr4bd6elu2ixq7e7-1009876701033.europe-west2.run.app/downloads/ota-manifest.json',
  });
  assert.equal(new Set(origins).size, origins.length);
  assert.equal(origins.length, 2);
});
