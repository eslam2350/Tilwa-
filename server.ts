import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import {
  analyzeCodebaseWithAi,
  applyAiProposalWithBackup,
  executeAiDeveloperTask,
  generateAiDeveloperProposal,
  getAiDeveloperHealth,
  getAiDeveloperJob,
  getProjectArchitectureSummary,
  listProjectSourceFiles,
  registerAiDeveloperMutationHook,
  restoreBackupSnapshot,
  startAiDeveloperJob,
  testAiProposalSafely,
} from './server/aiDeveloper.ts';
import {
  OWNER_SESSION_COOKIE,
  createOwnerToken,
  extractTokenFromRequest,
  getSessionSecret,
  makeOwnerAuthMiddleware,
  safeResolveProjectFile,
  verifyOwnerEmailInput,
  verifyOwnerToken,
} from './server/security.ts';
import { ServerDataStore } from './server/storage.ts';
import type { BasiraCatalogData, DynamicAppConfig } from './src/types/tilawa.ts';
import { mergeDynamicConfig } from './src/utils/dynamicConfigHelpers.ts';
import {
  computeFeedbackSummary,
  sortFeedbackForDisplay,
  validateAndSanitizeFeedbackInput,
} from './src/utils/feedbackHelpers.ts';

const projectRoot = process.cwd();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const store = new ServerDataStore(projectRoot);
const requireOwner = makeOwnerAuthMiddleware(projectRoot, () => store.getTokenVersion());

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16mb' }));

  // Baseline Security, CORS for live-sync & Caching Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (
      req.path.startsWith('/api/public/') ||
      req.path.startsWith('/uploads/basira')
    ) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    if (
      req.path === '/' ||
      req.path === '/index.html' ||
      req.path === '/sw.js'
    ) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
  });

  // --- Public Read-Only Site Config, Basira Podcast Catalog & Uploaded Media ---

  app.use(
    '/uploads/basira',
    express.static(store.getBasiraUploadsDir(), {
      acceptRanges: true,
      maxAge: '7d',
    })
  );

  app.get('/api/public/config', (_req, res) => {
    const saved = store.getSiteConfig();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({
      ok: true,
      config: saved,
    });
  });

  app.get('/api/public/basira', (_req, res) => {
    const saved = store.getBasiraCatalog();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({
      ok: true,
      catalog: saved,
    });
  });

  app.post('/api/public/analytics', (req, res) => {
    try {
      const body = req.body as {
        type?: string;
        route?: string;
        reciterId?: string;
        reciterName?: string;
        surahNumber?: number;
        surahName?: string;
      };
      if (body?.type === 'pageview' || body?.type === 'play') {
        store.recordAnalyticsEvent({
          type: body.type,
          route: typeof body.route === 'string' ? body.route : undefined,
          reciterId: typeof body.reciterId === 'string' ? body.reciterId : undefined,
          reciterName: typeof body.reciterName === 'string' ? body.reciterName : undefined,
          surahNumber: typeof body.surahNumber === 'number' ? body.surahNumber : undefined,
          surahName: typeof body.surahName === 'string' ? body.surahName : undefined,
        });
      }
      res.json({ ok: true });
    } catch {
      res.json({ ok: true });
    }
  });

  // --- Public Visitor Performance Feedback & Ratings ---
  app.get('/api/public/feedback', (_req, res) => {
    const all = store.listFeedback();
    const visible = sortFeedbackForDisplay(all.filter((item) => item.visible));
    const summary = computeFeedbackSummary(all);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({
      ok: true,
      feedback: visible,
      summary,
    });
  });

  app.post('/api/public/feedback', (req, res) => {
    const parsed = validateAndSanitizeFeedbackInput(
      (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>
    );
    if (!parsed.ok) {
      res.status(400).json({ ok: false, error: parsed.error });
      return;
    }

    const item = store.addFeedback(parsed.data);
    store.appendAuditLog({
      category: 'config',
      action: 'تقييم أداء جديد من زائر',
      summary: `${item.authorName} (${item.overallRating}/5): ${item.comment.slice(0, 70)}`,
    });

    const all = store.listFeedback();
    res.status(201).json({
      ok: true,
      item,
      feedback: sortFeedbackForDisplay(all.filter((f) => f.visible)),
      summary: computeFeedbackSummary(all),
    });
  });

  // --- Stealth Owner Email-Only Authentication ---
  app.post('/api/owner/login', (req, res) => {
    const email = (req.body as { email?: unknown })?.email;
    if (!verifyOwnerEmailInput(email)) {
      store.appendAuditLog({
        category: 'security',
        action: 'محاولة دخول مرفوضة',
        summary: 'تم رفض محاولة تسجيل دخول ببريد إلكتروني غير مصرح له.',
      });
      res.status(403).json({
        ok: false,
        error: 'البريد الإلكتروني غير مصرح له بالدخول إلى لوحة الإدارة.',
      });
      return;
    }

    const secret = getSessionSecret(projectRoot);
    const savedConfig = store.getSiteConfig();
    const timeoutMinutes = savedConfig?.security?.sessionTimeoutMinutes || 720;
    const token = createOwnerToken(secret, store.getTokenVersion(), timeoutMinutes);

    const isHttps =
      req.secure || req.headers['x-forwarded-proto'] === 'https';
    const cookieParts = [
      `${OWNER_SESSION_COOKIE}=${encodeURIComponent(token)}`,
      'HttpOnly',
      'Path=/',
      'SameSite=Lax',
      `Max-Age=${timeoutMinutes * 60}`,
    ];
    if (isHttps) cookieParts.push('Secure');
    res.setHeader('Set-Cookie', cookieParts.join('; '));

    store.appendAuditLog({
      category: 'security',
      action: 'تسجيل دخول المالك',
      summary: 'تم توثيق جلسة المالك بالبريد الإلكتروني بنجاح.',
    });

    // Notice: Never echo the raw owner email back in the response payload
    res.json({
      ok: true,
      authenticated: true,
      token,
    });
  });

  app.post('/api/owner/logout', (_req, res) => {
    res.setHeader(
      'Set-Cookie',
      `${OWNER_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
    );
    res.json({ ok: true });
  });

  app.get('/api/admin/session', (req, res) => {
    const token = extractTokenFromRequest(req);
    const secret = getSessionSecret(projectRoot);
    const verified = verifyOwnerToken(token, secret, store.getTokenVersion());
    res.json({
      ok: true,
      authenticated: Boolean(verified),
      expiresAt: verified ? new Date(verified.exp * 1000).toISOString() : null,
    });
  });

  // --- Protected Admin Endpoints (Require Valid Signed Owner Session) ---
  app.post('/api/admin/session/revoke-all', requireOwner, (_req, res) => {
    const nextVersion = store.bumpTokenVersion();
    res.setHeader(
      'Set-Cookie',
      `${OWNER_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
    );
    store.appendAuditLog({
      category: 'security',
      action: 'إنهاء جميع الجلسات',
      summary: `تمت ترقية إصدار الأمان للجلسات إلى #${nextVersion}.`,
    });
    res.json({ ok: true });
  });

  app.post('/api/admin/config', requireOwner, (req, res) => {
    try {
      const body = req.body as { config?: unknown; summary?: string };
      const current = store.getSiteConfig();
      const merged: DynamicAppConfig = mergeDynamicConfig(body.config);
      merged.version = Math.max((current?.version || 1) + 1, merged.version || 1);
      merged.updatedBy = 'owner';
      merged.updatedAt = new Date().toISOString();

      store.createBackupSnapshot({
        label: `إعدادات الموقع قبل الإصدار #${merged.version}`,
        reason: 'نسخة تلقائية قبل حفظ إعدادات لوحة الإدارة الشاملة',
        filePaths: [],
        includeConfig: true,
      });

      store.saveSiteConfig(merged);
      store.appendAuditLog({
        category: 'config',
        action: `تحديث إعدادات الموقع (#${merged.version})`,
        summary: (body.summary || 'تحديث شامل لإعدادات المنصة والتصميم').slice(0, 180),
      });

      res.json({ ok: true, config: merged });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر حفظ الإعدادات';
      res.status(400).json({ ok: false, error: msg });
    }
  });

  // --- Protected Basira Podcast Catalog & File Upload Endpoints ---
  app.post('/api/admin/basira/save', requireOwner, (req, res) => {
    try {
      const body = req.body as { catalog?: Partial<BasiraCatalogData>; summary?: string };
      const incoming = body?.catalog;
      if (
        !incoming ||
        !Array.isArray(incoming.preachers) ||
        !Array.isArray(incoming.episodes) ||
        !Array.isArray(incoming.playlists)
      ) {
        res.status(400).json({ ok: false, error: 'بيانات قسم بصيرة غير مكتملة' });
        return;
      }

      const nextCatalog: BasiraCatalogData = {
        preachers: incoming.preachers,
        episodes: incoming.episodes,
        playlists: incoming.playlists,
        updatedAt: new Date().toISOString(),
      };

      store.createBackupSnapshot({
        label: 'نسخة احتياطية لقسم بصيرة',
        reason: 'نسخة تلقائية قبل تحديث الدعاة وحلقات البودكاست',
        filePaths: [],
        includeConfig: false,
        includeBasira: true,
      });

      store.saveBasiraCatalog(nextCatalog);
      store.appendAuditLog({
        category: 'config',
        action: 'تحديث قسم بصيرة (البودكاست والدعاة)',
        summary: (
          body.summary ||
          `حفظ ${nextCatalog.preachers.length} دعاة و${nextCatalog.episodes.length} حلقة صوتية`
        ).slice(0, 180),
      });

      res.json({ ok: true, catalog: nextCatalog });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر حفظ بيانات بصيرة';
      res.status(400).json({ ok: false, error: msg });
    }
  });

  app.post(
    '/api/admin/basira/upload',
    requireOwner,
    express.raw({
      type: ['audio/*', 'image/*', 'application/octet-stream'],
      limit: '60mb',
    }),
    (req, res) => {
      try {
        const rawFilename =
          typeof req.query.filename === 'string'
            ? req.query.filename
            : String(req.headers['x-filename'] || 'media.mp3');
        const ext = path.extname(rawFilename).toLowerCase();
        const allowedExts = new Set([
          '.mp3',
          '.m4a',
          '.wav',
          '.ogg',
          '.aac',
          '.jpg',
          '.jpeg',
          '.png',
          '.webp',
        ]);
        if (!allowedExts.has(ext)) {
          res.status(400).json({
            ok: false,
            error: 'صيغة الملف غير مدعومة (يدعم الصوت: MP3/M4A/WAV/OGG والصور: JPG/PNG/WEBP فقط)',
          });
          return;
        }
        const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (buf.byteLength === 0) {
          res.status(400).json({ ok: false, error: 'الملف المرفوع فارغ' });
          return;
        }

        const safeStem = path
          .basename(rawFilename, ext)
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 48);
        const finalName = `${Date.now()}_${safeStem || 'basira'}${ext}`;
        const uploadsDir = store.getBasiraUploadsDir();
        const absTarget = path.resolve(uploadsDir, finalName);
        if (!absTarget.startsWith(path.resolve(uploadsDir) + path.sep)) {
          res.status(400).json({ ok: false, error: 'مسار الملف غير صالح' });
          return;
        }

        fs.writeFileSync(absTarget, buf);
        const publicUrl = `/uploads/basira/${finalName}`;
        store.appendAuditLog({
          category: 'config',
          action: 'رفع ملف وسائط لقسم بصيرة',
          summary: `تم رفع ${finalName} (${Math.round(buf.byteLength / 1024)} KB)`,
        });
        res.json({ ok: true, url: publicUrl, sizeBytes: buf.byteLength });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'تعذر رفع الملف';
        res.status(500).json({ ok: false, error: msg });
      }
    }
  );

  app.get('/api/admin/analytics', requireOwner, (_req, res) => {
    res.json({ ok: true, analytics: store.getAnalytics() });
  });

  app.get('/api/admin/audit', requireOwner, (_req, res) => {
    res.json({ ok: true, logs: store.getAuditLogs() });
  });

  app.get('/api/admin/backups', requireOwner, (_req, res) => {
    res.json({ ok: true, backups: store.listBackups() });
  });

  app.post('/api/admin/backups', requireOwner, (req, res) => {
    const label =
      typeof (req.body as { label?: unknown })?.label === 'string'
        ? (req.body as { label: string }).label.trim()
        : '';
    const backup = store.createBackupSnapshot({
      label: label || `نسخة يدوية (${new Date().toLocaleTimeString('ar-EG')})`,
      reason: 'نسخة احتياطية يدوية أنشأها المالك',
      filePaths: [
        'src/App.tsx',
        'src/index.css',
        'src/components/Footer.tsx',
        'src/components/Navbar.tsx',
        'src/pages/HomePage.tsx',
        'src/utils/dynamicConfigHelpers.ts',
        'index.html',
      ],
      includeConfig: true,
      includeBasira: true,
    });
    store.appendAuditLog({
      category: 'backup',
      action: 'إنشاء نسخة احتياطية يدوية',
      summary: `تم حفظ النسخة الاحتياطية «${backup.label}» (${backup.filesCount} ملفًا)`,
    });
    res.json({ ok: true, backup });
  });

  app.post('/api/admin/backups/restore', requireOwner, async (req, res) => {
    try {
      const backupId = (req.body as { backupId?: string })?.backupId || '';
      const result = await restoreBackupSnapshot({
        projectRoot,
        store,
        backupId,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر استعادة النسخة الاحتياطية';
      res.status(400).json({ ok: false, error: msg });
    }
  });

  app.post('/api/admin/audio/probe', requireOwner, async (req, res) => {
    const url = (req.body as { url?: string })?.url?.trim() || '';
    if (!/^https?:\/\//i.test(url)) {
      res.status(400).json({ ok: false, error: 'يرجى إدخال رابط صوتي يبدأ بـ http أو https' });
      return;
    }
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let resp = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });
      if (resp.status === 405 || resp.status === 403) {
        resp = await fetch(url, {
          method: 'GET',
          headers: { Range: 'bytes=0-1' },
          signal: controller.signal,
        });
      }
      clearTimeout(timer);
      const lenHeader = resp.headers.get('content-length');
      res.json({
        ok: true,
        result: {
          url,
          ok: resp.ok,
          status: resp.status,
          contentType: resp.headers.get('content-type') || 'unknown',
          contentLengthBytes: lenHeader ? Number(lenHeader) : null,
          latencyMs: Date.now() - start,
        },
      });
    } catch (err) {
      res.json({
        ok: true,
        result: {
          url,
          ok: false,
          status: 0,
          contentType: 'error',
          contentLengthBytes: null,
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : 'فشل الاتصال بالرابط الصوتي',
        },
      });
    }
  });

  // --- Protected Real Project Explorer + AI Developer Routes ---
  app.get('/api/admin/files', requireOwner, (_req, res) => {
    res.json({
      ok: true,
      files: listProjectSourceFiles(projectRoot),
    });
  });

  app.get('/api/admin/file', requireOwner, (req, res) => {
    const relPath = typeof req.query.path === 'string' ? req.query.path : '';
    const absPath = safeResolveProjectFile(projectRoot, relPath, 'read');
    if (!absPath || !fs.existsSync(absPath)) {
      res.status(404).json({ ok: false, error: 'الملف غير موجود أو غير مسموح بقراءته.' });
      return;
    }
    const content = fs.readFileSync(absPath, 'utf8');
    res.json({ ok: true, path: relPath, content });
  });

  app.get('/api/admin/ai/architecture', requireOwner, (_req, res) => {
    res.json({
      ok: true,
      architecture: getProjectArchitectureSummary(projectRoot),
    });
  });

  app.get('/api/admin/ai/proposals', requireOwner, (_req, res) => {
    res.json({ ok: true, proposals: store.listProposals() });
  });

  app.post('/api/admin/ai/plan', requireOwner, async (req, res) => {
    try {
      const body = req.body as {
        instruction?: string;
        targetFiles?: string[];
        history?: Array<{ role: 'owner' | 'assistant'; text: string }>;
        thinkingPower?: 'fast' | 'balanced' | 'deep';
      };
      const thinkingPower =
        body.thinkingPower === 'fast' || body.thinkingPower === 'deep'
          ? body.thinkingPower
          : 'balanced';
      const proposal = await generateAiDeveloperProposal({
        projectRoot,
        store,
        instruction: body.instruction || '',
        targetFiles: Array.isArray(body.targetFiles) ? body.targetFiles : [],
        history: Array.isArray(body.history) ? body.history : [],
        executionMode: 'plan',
        thinkingPower,
      });
      res.json({ ok: true, proposal });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تحليل الطلب عبر AI Developer';
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post('/api/admin/ai/execute', requireOwner, async (req, res) => {
    try {
      const body = req.body as {
        instruction?: string;
        targetFiles?: string[];
        history?: Array<{ role: 'owner' | 'assistant'; text: string }>;
        rollbackOnFailure?: boolean;
        runBuildCheck?: boolean;
        thinkingPower?: 'fast' | 'balanced' | 'deep';
      };
      const thinkingPower =
        body.thinkingPower === 'fast' || body.thinkingPower === 'deep'
          ? body.thinkingPower
          : 'balanced';
      const proposal = await executeAiDeveloperTask({
        projectRoot,
        store,
        instruction: body.instruction || '',
        targetFiles: Array.isArray(body.targetFiles) ? body.targetFiles : [],
        history: Array.isArray(body.history) ? body.history : [],
        rollbackOnFailure: body.rollbackOnFailure !== false,
        runBuildCheck: Boolean(body.runBuildCheck),
        thinkingPower,
      });
      res.json({ ok: true, proposal });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تنفيذ الطلب مباشرة عبر AI Engineer';
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post('/api/admin/ai/analyze', requireOwner, async (req, res) => {
    try {
      const targetFile =
        typeof (req.body as { targetFile?: unknown })?.targetFile === 'string'
          ? (req.body as { targetFile: string }).targetFile
          : undefined;
      const result = await analyzeCodebaseWithAi({ projectRoot, targetFile });
      store.appendAuditLog({
        category: 'ai-dev',
        action: 'فحص جودة وأمان الكود (AI)',
        summary: `تحليل الملفات: ${result.checkedFiles.join(', ')}`,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تحليل الكود';
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post('/api/admin/ai/test', requireOwner, async (req, res) => {
    try {
      const proposalId = (req.body as { proposalId?: string })?.proposalId || '';
      const runBuildCheck = Boolean((req.body as { runBuildCheck?: boolean })?.runBuildCheck);
      const proposal = await testAiProposalSafely({
        projectRoot,
        store,
        proposalId,
        runBuildCheck,
      });
      res.json({ ok: true, proposal });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تشغيل الاختبار';
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post('/api/admin/ai/apply', requireOwner, async (req, res) => {
    try {
      const proposalId = (req.body as { proposalId?: string })?.proposalId || '';
      const proposal = await applyAiProposalWithBackup({
        projectRoot,
        store,
        proposalId,
      });
      res.json({ ok: true, proposal });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تنفيذ التعديل';
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.get('/api/admin/feedback', requireOwner, (_req, res) => {
    const all = sortFeedbackForDisplay(store.listFeedback());
    res.json({
      ok: true,
      feedback: all,
      summary: computeFeedbackSummary(all),
    });
  });

  app.patch('/api/admin/feedback/:id', requireOwner, (req, res) => {
    const id = req.params.id || '';
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
      visible?: unknown;
      pinned?: unknown;
      adminReply?: unknown;
    };
    const updated = store.updateFeedback(id, {
      visible: typeof body.visible === 'boolean' ? body.visible : undefined,
      pinned: typeof body.pinned === 'boolean' ? body.pinned : undefined,
      adminReply: typeof body.adminReply === 'string' ? body.adminReply : undefined,
    });
    if (!updated) {
      res.status(404).json({ ok: false, error: 'التقييم المطلوب غير موجود.' });
      return;
    }
    const all = sortFeedbackForDisplay(store.listFeedback());
    res.json({
      ok: true,
      item: updated,
      feedback: all,
      summary: computeFeedbackSummary(all),
    });
  });

  app.delete('/api/admin/feedback/:id', requireOwner, (req, res) => {
    const id = req.params.id || '';
    const removed = store.deleteFeedback(id);
    if (!removed) {
      res.status(404).json({ ok: false, error: 'التقييم غير موجود.' });
      return;
    }
    const all = sortFeedbackForDisplay(store.listFeedback());
    res.json({
      ok: true,
      feedback: all,
      summary: computeFeedbackSummary(all),
    });
  });

  app.get('/api/admin/ai/health', requireOwner, (_req, res) => {
    res.json({ ok: true, ...getAiDeveloperHealth() });
  });

  app.post('/api/admin/ai/jobs', requireOwner, (req, res) => {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as {
      kind?: string;
      instruction?: string;
      targetFiles?: string[];
      targetFile?: string;
      history?: Array<{ role: 'owner' | 'assistant'; text: string }>;
      rollbackOnFailure?: boolean;
      runBuildCheck?: boolean;
      thinkingPower?: 'fast' | 'balanced' | 'deep';
    };

    const kind =
      body.kind === 'execute' || body.kind === 'analyze' ? body.kind : 'plan';

    if (kind !== 'analyze' && (!body.instruction || body.instruction.trim().length < 3)) {
      res.status(400).json({ ok: false, error: 'يرجى كتابة وصف واضح للتعديل المطلوب.' });
      return;
    }

    const thinkingPower =
      body.thinkingPower === 'fast' || body.thinkingPower === 'deep'
        ? body.thinkingPower
        : 'balanced';

    const job = startAiDeveloperJob({
      projectRoot,
      store,
      kind,
      instruction: body.instruction || '',
      targetFiles: Array.isArray(body.targetFiles) ? body.targetFiles : [],
      targetFile: typeof body.targetFile === 'string' ? body.targetFile : undefined,
      history: Array.isArray(body.history) ? body.history : [],
      rollbackOnFailure: body.rollbackOnFailure !== false,
      runBuildCheck: Boolean(body.runBuildCheck),
      thinkingPower,
    });

    res.status(202).json({ ok: true, job });
  });

  app.get('/api/admin/ai/jobs/:jobId', requireOwner, (req, res) => {
    const job = getAiDeveloperJob(req.params.jobId || '');
    if (!job) {
      res.status(404).json({ ok: false, error: 'لم يتم العثور على المهمة البرمجية.' });
      return;
    }
    res.json({ ok: true, job });
  });

  // --- Mount Vite Middleware (Dev) or Static Dist (Prod) ---
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      appType: 'spa',
    });
    registerAiDeveloperMutationHook(() => {
      vite.moduleGraph.invalidateAll();
    });
    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result?.code) {
          next();
          return;
        }
        const safeClient = result.code.replace(
          /const transport = normalizeModuleRunnerTransport\(\(\(\) => \{[\s\S]*?\}\)\(\)\);/,
          'const transport = normalizeModuleRunnerTransport({ connect() {}, disconnect() {}, send() {} });'
        );
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(safeClient);
      } catch {
        next();
      }
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(projectRoot, 'dist');
    app.use(
      express.static(distDir, {
        index: false,
        etag: true,
        maxAge: '7d',
        setHeaders(res, filePath) {
          const normalized = filePath.replace(/\\/g, '/');
          if (normalized.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
          } else if (
            normalized.includes('/images/') ||
            normalized.includes('/fonts/') ||
            normalized.includes('/src/assets/')
          ) {
            res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
          } else if (normalized.endsWith('.html') || normalized.endsWith('sw.js')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TILAWA server listening on http://0.0.0.0:${PORT} (${isProduction ? 'prod' : 'dev'})`);
  });
}

void startServer();
