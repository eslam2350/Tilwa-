import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeLineDiff,
  containsSensitiveOwnerLeak,
  createOwnerToken,
  isAllowedProjectPath,
  safeResolveProjectFile,
  verifyOwnerEmailInput,
  verifyOwnerToken,
} from './security.ts';

test('verifyOwnerEmailInput matches authorized owner case-insensitively and rejects outsiders', () => {
  assert.equal(verifyOwnerEmailInput('eslamkhalifa244@gmail.com'), true);
  assert.equal(verifyOwnerEmailInput('  ESLAMKHALIFA244@GMAIL.COM  '), true);
  assert.equal(verifyOwnerEmailInput('intruder@gmail.com'), false);
  assert.equal(verifyOwnerEmailInput(''), false);
  assert.equal(verifyOwnerEmailInput(null), false);
});

test('createOwnerToken and verifyOwnerToken enforce signature and revocation version', () => {
  const secret = 'test_secret_at_least_32_characters_long';
  const token = createOwnerToken(secret, 3, 60);
  const valid = verifyOwnerToken(token, secret, 3);
  assert.ok(valid);
  assert.equal(valid?.role, 'owner');
  assert.equal(verifyOwnerToken(token, secret, 4), null);
  assert.equal(verifyOwnerToken(token + 'x', secret, 3), null);
  assert.equal(verifyOwnerToken('invalid.token', secret, 3), null);
});

test('safeResolveProjectFile allows safe project engineering files while blocking traversal and secrets', () => {
  const root = '/app/applet';
  assert.equal(isAllowedProjectPath('src/App.tsx', 'write'), true);
  assert.equal(isAllowedProjectPath('server/security.ts', 'write'), true);
  assert.equal(isAllowedProjectPath('scripts/helper.ts', 'write'), true);
  assert.equal(isAllowedProjectPath('package.json', 'write'), true);
  assert.equal(isAllowedProjectPath('server.ts', 'write'), true);
  assert.equal(isAllowedProjectPath('.env', 'read'), false);
  assert.equal(isAllowedProjectPath('.env.local', 'write'), false);
  assert.equal(isAllowedProjectPath('firebase-applet-config.json', 'write'), false);
  assert.equal(isAllowedProjectPath('server-data/audit-log.json', 'read'), false);
  assert.equal(isAllowedProjectPath('../../../etc/passwd', 'read'), false);
  assert.ok(safeResolveProjectFile(root, 'src/pages/HomePage.tsx', 'write'));
  assert.equal(safeResolveProjectFile(root, '../outside.ts', 'read'), null);
});

test('containsSensitiveOwnerLeak blocks owner email inside client files', () => {
  assert.equal(containsSensitiveOwnerLeak('src/Footer.tsx', 'contact eslamkhalifa244@gmail.com'), true);
  assert.equal(containsSensitiveOwnerLeak('server/security.ts', 'eslamkhalifa244@gmail.com'), false);
  assert.equal(containsSensitiveOwnerLeak('src/Footer.tsx', 'Eslam — Developer'), false);
});

test('computeLineDiff generates clean add and remove operations', () => {
  const diff = computeLineDiff('const a = 1;\nconst b = 2;\nconst c = 3;', 'const a = 1;\nconst b = 99;\nconst c = 3;');
  assert.equal(diff.some((l) => l.type === 'remove' && l.text === 'const b = 2;'), true);
  assert.equal(diff.some((l) => l.type === 'add' && l.text === 'const b = 99;'), true);
});
