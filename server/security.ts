import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import type { DiffLineItem } from '../src/types/tilawa.ts';

export const OWNER_SESSION_COOKIE = 'tilawa_owner_session';

export function getAuthorizedOwnerEmail(): string {
  return (process.env.OWNER_EMAIL || 'eslamkhalifa244@gmail.com').trim().toLowerCase();
}

export function verifyOwnerEmailInput(candidate: unknown): boolean {
  if (typeof candidate !== 'string') return false;
  const cleanCandidate = candidate.trim().toLowerCase();
  const target = getAuthorizedOwnerEmail();
  if (!cleanCandidate || !target) return false;
  const a = Buffer.from(cleanCandidate, 'utf8');
  const b = Buffer.from(target, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

let cachedRuntimeSecret: string | null = null;

export function getSessionSecret(projectRoot: string): string {
  if (process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.trim().length >= 16) {
    return process.env.ADMIN_SESSION_SECRET.trim();
  }
  if (cachedRuntimeSecret) return cachedRuntimeSecret;

  const dataDir = path.join(projectRoot, 'server-data');
  const secretPath = path.join(dataDir, '.session-secret');
  try {
    if (fs.existsSync(secretPath)) {
      const existing = fs.readFileSync(secretPath, 'utf8').trim();
      if (existing.length >= 32) {
        cachedRuntimeSecret = existing;
        return existing;
      }
    }
    fs.mkdirSync(dataDir, { recursive: true });
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
    cachedRuntimeSecret = generated;
    return generated;
  } catch {
    cachedRuntimeSecret = crypto.randomBytes(32).toString('hex');
    return cachedRuntimeSecret;
  }
}

export interface OwnerTokenPayload {
  role: 'owner';
  ver: number;
  iat: number;
  exp: number;
}

export function createOwnerToken(
  secret: string,
  version: number,
  ttlMinutes = 720
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: OwnerTokenPayload = {
    role: 'owner',
    ver: version,
    iat: nowSec,
    exp: nowSec + Math.max(5, ttlMinutes) * 60,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyOwnerToken(
  token: string,
  secret: string,
  expectedVersion: number
): OwnerTokenPayload | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as Partial<OwnerTokenPayload>;
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      parsed.role !== 'owner' ||
      typeof parsed.ver !== 'number' ||
      parsed.ver !== expectedVersion ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < nowSec
    ) {
      return null;
    }
    return parsed as OwnerTokenPayload;
  } catch {
    return null;
  }
}

export function extractCookieValue(cookieHeader: string | undefined, name: string): string {
  if (!cookieHeader) return '';
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return '';
}

export function extractTokenFromRequest(req: Request): string {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const customHeader = req.headers['x-owner-session'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }
  return extractCookieValue(req.headers.cookie, OWNER_SESSION_COOKIE);
}

export function makeOwnerAuthMiddleware(
  projectRoot: string,
  getTokenVersion: () => number
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = extractTokenFromRequest(req);
    const secret = getSessionSecret(projectRoot);
    const verified = verifyOwnerToken(token, secret, getTokenVersion());
    if (!verified) {
      res.status(401).json({
        ok: false,
        error: 'غير مصرح بالوصول — هذه المنطقة محمية ومقصورة على المالك فقط.',
      });
      return;
    }
    next();
  };
}

const ALLOWED_ROOT_FILES = new Set([
  'index.html',
  'package.json',
  'vite.config.ts',
  'firebase.json',
  'firestore.rules',
  'firebase-blueprint.json',
  'metadata.json',
  'server.ts',
  'tsconfig.json',
]);

const ALLOWED_WRITE_ROOT_FILES = new Set([
  'index.html',
  'package.json',
  'vite.config.ts',
  'firestore.rules',
  'firebase-blueprint.json',
  'metadata.json',
  'server.ts',
]);

const ALLOWED_DIR_PREFIXES = ['src/', 'server/', 'scripts/', 'public/'];

const FORBIDDEN_PATTERNS = [
  '.env',
  '.git',
  'node_modules',
  'server-data',
  'dist/',
  'dev-dist/',
  '.aistudio',
  'firebase-applet-config',
];

export function normalizeProjectRelativePath(relPath: string): string {
  return relPath.replace(/\\/g, '/').replace(/^\/+/, '').trim();
}

export function isAllowedProjectPath(
  relPath: string,
  mode: 'read' | 'write' = 'read'
): boolean {
  const clean = normalizeProjectRelativePath(relPath);
  if (!clean || clean.includes('..') || clean.includes('\0')) return false;

  for (const forbidden of FORBIDDEN_PATTERNS) {
    if (clean === forbidden || clean.includes(forbidden)) return false;
  }

  if (mode === 'write') {
    if (ALLOWED_WRITE_ROOT_FILES.has(clean)) return true;
    return ALLOWED_DIR_PREFIXES.some((prefix) => clean.startsWith(prefix));
  }

  if (ALLOWED_ROOT_FILES.has(clean)) return true;
  return ALLOWED_DIR_PREFIXES.some((prefix) => clean.startsWith(prefix));
}

export function containsSensitiveOwnerLeak(relPath: string, content: string): boolean {
  const clean = normalizeProjectRelativePath(relPath);
  const isClientFile =
    clean === 'index.html' || clean.startsWith('src/') || clean.startsWith('public/');
  if (!isClientFile) return false;
  const targetEmail = getAuthorizedOwnerEmail();
  if (!targetEmail) return false;
  return content.toLowerCase().includes(targetEmail);
}

export function safeResolveProjectFile(
  projectRoot: string,
  relPath: string,
  mode: 'read' | 'write' = 'read'
): string | null {
  const clean = normalizeProjectRelativePath(relPath);
  if (!isAllowedProjectPath(clean, mode)) return null;
  const absRoot = path.resolve(projectRoot);
  const resolved = path.resolve(absRoot, clean);
  if (!resolved.startsWith(absRoot + path.sep) && resolved !== absRoot) {
    return null;
  }
  return resolved;
}

export function computeLineDiff(beforeText: string, afterText: string): DiffLineItem[] {
  const a = beforeText.split('\n');
  const b = afterText.split('\n');
  const m = a.length;
  const n = b.length;

  // For very large files (> 1200 lines), fall back to bounded prefix/suffix diff to stay fast
  if (m * n > 900_000) {
    const out: DiffLineItem[] = [];
    let prefix = 0;
    while (prefix < m && prefix < n && a[prefix] === b[prefix]) prefix++;
    let suffix = 0;
    while (
      suffix < m - prefix &&
      suffix < n - prefix &&
      a[m - 1 - suffix] === b[n - 1 - suffix]
    ) {
      suffix++;
    }
    const ctxStart = Math.max(0, prefix - 2);
    for (let i = ctxStart; i < prefix; i++) {
      out.push({ type: 'context', lineNumberBefore: i + 1, lineNumberAfter: i + 1, text: a[i] });
    }
    for (let i = prefix; i < m - suffix; i++) {
      out.push({ type: 'remove', lineNumberBefore: i + 1, lineNumberAfter: null, text: a[i] });
    }
    for (let j = prefix; j < n - suffix; j++) {
      out.push({ type: 'add', lineNumberBefore: null, lineNumberAfter: j + 1, text: b[j] });
    }
    const ctxEnd = Math.min(m, m - suffix + 2);
    for (let i = m - suffix; i < ctxEnd; i++) {
      const afterIdx = i - (m - n);
      out.push({ type: 'context', lineNumberBefore: i + 1, lineNumberAfter: afterIdx + 1, text: a[i] });
    }
    return out;
  }

  const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rawOps: DiffLineItem[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      rawOps.push({ type: 'context', lineNumberBefore: i + 1, lineNumberAfter: j + 1, text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rawOps.push({ type: 'remove', lineNumberBefore: i + 1, lineNumberAfter: null, text: a[i] });
      i++;
    } else {
      rawOps.push({ type: 'add', lineNumberBefore: null, lineNumberAfter: j + 1, text: b[j] });
      j++;
    }
  }
  while (i < m) {
    rawOps.push({ type: 'remove', lineNumberBefore: i + 1, lineNumberAfter: null, text: a[i] });
    i++;
  }
  while (j < n) {
    rawOps.push({ type: 'add', lineNumberBefore: null, lineNumberAfter: j + 1, text: b[j] });
    j++;
  }

  // Filter long runs of unchanged context lines to keep diff concise & readable
  const changedIndices = new Set<number>();
  rawOps.forEach((op, idx) => {
    if (op.type !== 'context') {
      for (let k = Math.max(0, idx - 2); k <= Math.min(rawOps.length - 1, idx + 2); k++) {
        changedIndices.add(k);
      }
    }
  });

  return rawOps.filter((_, idx) => changedIndices.has(idx)).slice(0, 350);
}
