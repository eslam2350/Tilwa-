import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type Content,
  type FunctionDeclaration,
} from '@google/genai';
import type {
  AiDeveloperJobStatus,
  AiProposalChange,
  AiProposalRecord,
} from '../src/types/tilawa.ts';
import {
  computeLineDiff,
  containsSensitiveOwnerLeak,
  isAllowedProjectPath,
  normalizeProjectRelativePath,
  safeResolveProjectFile,
} from './security.ts';
import type { ServerDataStore } from './storage.ts';

const execFileAsync = promisify(execFile);
const GEMINI_MODEL = 'gemini-4-hydrogen';
const GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const GEMINI_PRIMARY_TIMEOUT_MS = 55_000;
const GEMINI_FALLBACK_TIMEOUT_MS = 70_000;
const MAX_AGENT_STEPS = 80;

export type AiThinkingPower = 'fast' | 'balanced' | 'deep';

function mapThinkingPowerToLevel(power: AiThinkingPower = 'balanced'): ThinkingLevel {
  if (power === 'fast') return ThinkingLevel.LOW;
  if (power === 'deep') return ThinkingLevel.XHIGH;
  return ThinkingLevel.HIGH;
}

export function formatGeminiErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || 'خطأ غير معروف');
  const trimmed = raw.trim();
  if (
    trimmed.startsWith('تعذر تنفيذ طلب المطور الذكي:') ||
    trimmed.startsWith('مفتاح GEMINI_API_KEY') ||
    trimmed.startsWith('رفضت خدمة Gemini') ||
    trimmed.startsWith('تم تجاوز حد الطلبات') ||
    trimmed.startsWith('النموذج المطلوب') ||
    trimmed.startsWith('استغرق اتصال الذكاء الاصطناعي')
  ) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();

  if (lower.includes('gemini_api_key') && lower.includes('غير مهيأ')) {
    return trimmed;
  }
  if (lower.includes('api_key_invalid') || lower.includes('api key not valid') || lower.includes('401')) {
    return 'مفتاح GEMINI_API_KEY في بيئة التشغيل غير صالح أو منتهي — يرجى تحديثه في إعدادات الأسرار (Secrets).';
  }
  if (lower.includes('permission_denied') || lower.includes('403')) {
    return 'رفضت خدمة Gemini الطلب (403 Permission Denied) — تأكد من تفعيل الصلاحيات ومفتاح API في الإعدادات.';
  }
  if (lower.includes('resource_exhausted') || lower.includes('429')) {
    return 'تم تجاوز حد الطلبات المؤقت لخدمة الذكاء الاصطناعي (429) — حاول مرة أخرى بعد ثوانٍ.';
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return `النموذج المطلوب (${GEMINI_MODEL}) غير متاح حاليًا في واجهة Gemini (404).`;
  }
  if (
    lower.includes('deadline_exceeded') ||
    lower.includes('504') ||
    lower.includes('abort') ||
    lower.includes('timeout') ||
    lower.includes('timed out')
  ) {
    return 'استغرق اتصال الذكاء الاصطناعي وقتًا أطول من المتوقع — أعد المحاولة أو اختر وضع "فائق السرعة".';
  }
  return `تعذر تنفيذ طلب المطور الذكي: ${trimmed.slice(0, 260)}`;
}

function isRetryableTransientError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
  return (
    msg.includes('resource_exhausted') ||
    msg.includes('429') ||
    msg.includes('deadline_exceeded') ||
    msg.includes('504') ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('abort') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('not_found') ||
    msg.includes('404')
  );
}

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('مفتاح GEMINI_API_KEY غير مهيأ في بيئة الخادم.');
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateContentResilient(
  ai: GoogleGenAI,
  request: {
    contents: Content[] | string;
    systemInstruction?: string;
    tools?: Array<{ functionDeclarations: FunctionDeclaration[] }>;
    thinkingPower?: AiThinkingPower;
  }
) {
  const primaryLevel = mapThinkingPowerToLevel(request.thinkingPower);
  let lastPrimaryErr: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: request.contents,
        config: {
          ...(request.systemInstruction ? { systemInstruction: request.systemInstruction } : {}),
          ...(request.tools ? { tools: request.tools } : {}),
          thinkingConfig: { thinkingLevel: primaryLevel },
          abortSignal: AbortSignal.timeout(GEMINI_PRIMARY_TIMEOUT_MS),
        },
      });
    } catch (err) {
      lastPrimaryErr = err;
      if (!isRetryableTransientError(err)) {
        throw err;
      }
      const msg = (err instanceof Error ? err.message : String(err || '')).toLowerCase();
      if (msg.includes('not_found') || msg.includes('404')) {
        break;
      }
      if (attempt < 2) {
        const delayMs = 600 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  if (!isRetryableTransientError(lastPrimaryErr)) {
    throw lastPrimaryErr;
  }

  return await ai.models.generateContent({
    model: GEMINI_FALLBACK_MODEL,
    contents: request.contents,
    config: {
      ...(request.systemInstruction ? { systemInstruction: request.systemInstruction } : {}),
      ...(request.tools ? { tools: request.tools } : {}),
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      abortSignal: AbortSignal.timeout(GEMINI_FALLBACK_TIMEOUT_MS),
    },
  });
}

export interface ProjectFileTreeItem {
  path: string;
  sizeBytes: number;
  writable: boolean;
}

export interface ProjectArchitectureSummary {
  totalFiles: number;
  layers: {
    pages: string[];
    components: string[];
    contextsAndServices: string[];
    utilsAndData: string[];
    backendAndSecurity: string[];
    databaseAndConfig: string[];
    stylesAndPublic: string[];
  };
}

export function listProjectSourceFiles(projectRoot: string): ProjectFileTreeItem[] {
  const out: ProjectFileTreeItem[] = [];
  const walk = (dirRel: string) => {
    const abs = path.join(projectRoot, dirRel);
    if (!fs.existsSync(abs)) return;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = dirRel ? `${dirRel}/${entry.name}` : entry.name;
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'dev-dist' ||
        entry.name === 'server-data' ||
        entry.name === '.git' ||
        entry.name.startsWith('.env')
      ) {
        continue;
      }
      if (entry.isDirectory()) {
        walk(rel);
      } else if (entry.isFile() && isAllowedProjectPath(rel, 'read')) {
        const stat = fs.statSync(path.join(projectRoot, rel));
        out.push({
          path: rel,
          sizeBytes: stat.size,
          writable: isAllowedProjectPath(rel, 'write'),
        });
      }
    }
  };

  for (const rootFile of [
    'index.html',
    'package.json',
    'vite.config.ts',
    'firebase.json',
    'firestore.rules',
    'firebase-blueprint.json',
    'metadata.json',
    'server.ts',
    'tsconfig.json',
  ]) {
    const abs = path.join(projectRoot, rootFile);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      out.push({
        path: rootFile,
        sizeBytes: fs.statSync(abs).size,
        writable: isAllowedProjectPath(rootFile, 'write'),
      });
    }
  }
  walk('src');
  walk('server');
  walk('scripts');
  walk('public');
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function getProjectArchitectureSummary(projectRoot: string): ProjectArchitectureSummary {
  const tree = listProjectSourceFiles(projectRoot);
  const paths = tree.map((f) => f.path);
  return {
    totalFiles: tree.length,
    layers: {
      pages: paths.filter((p) => p.startsWith('src/pages/')),
      components: paths.filter((p) => p.startsWith('src/components/')),
      contextsAndServices: paths.filter(
        (p) => p.startsWith('src/contexts/') || p.startsWith('src/services/') || p === 'src/App.tsx'
      ),
      utilsAndData: paths.filter(
        (p) => p.startsWith('src/utils/') || p.startsWith('src/data/') || p.startsWith('src/types/')
      ),
      backendAndSecurity: paths.filter((p) => p === 'server.ts' || p.startsWith('server/')),
      databaseAndConfig: paths.filter((p) =>
        [
          'firestore.rules',
          'firebase-blueprint.json',
          'firebase.json',
          'package.json',
          'vite.config.ts',
          'tsconfig.json',
          'metadata.json',
          'index.html',
        ].includes(p)
      ),
      stylesAndPublic: paths.filter(
        (p) => p === 'src/index.css' || p.startsWith('public/') || p.startsWith('scripts/')
      ),
    },
  };
}

function searchInsideProjectFiles(
  projectRoot: string,
  tree: ProjectFileTreeItem[],
  query: string,
  directoryPrefix?: string
): Array<{ file: string; line: number; text: string }> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];
  const lowerQuery = cleanQuery.toLowerCase();
  const cleanPrefix = directoryPrefix
    ? normalizeProjectRelativePath(directoryPrefix)
    : '';
  const matches: Array<{ file: string; line: number; text: string }> = [];

  for (const item of tree) {
    if (cleanPrefix && !item.path.startsWith(cleanPrefix)) continue;
    if (item.sizeBytes > 250_000) continue;
    if (!/\.(ts|tsx|js|jsx|json|css|html|md|svg|rules)$/i.test(item.path)) continue;
    const abs = safeResolveProjectFile(projectRoot, item.path, 'read');
    if (!abs || !fs.existsSync(abs)) continue;
    const lines = fs.readFileSync(abs, 'utf8').split('\n');
    for (let idx = 0; idx < lines.length; idx++) {
      if (lines[idx].toLowerCase().includes(lowerQuery)) {
        matches.push({
          file: item.path,
          line: idx + 1,
          text: lines[idx].trim().slice(0, 180),
        });
        if (matches.length >= 60) return matches;
      }
    }
  }
  return matches;
}

let workspaceOpMutex: Promise<void> = Promise.resolve();
function withWorkspaceLock<T>(task: () => Promise<T>): Promise<T> {
  const next = workspaceOpMutex.then(task, task);
  workspaceOpMutex = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

let fileMutationHook: ((changedFiles: string[]) => void) | null = null;
export function registerAiDeveloperMutationHook(
  hook: (changedFiles: string[]) => void
): void {
  fileMutationHook = hook;
}

function notifyFilesMutated(changedFiles: string[]): void {
  try {
    fileMutationHook?.(changedFiles);
  } catch {
    // non-fatal cache invalidation error
  }
}

const AI_DEV_TOOLS: FunctionDeclaration[] = [
  {
    name: 'inspect_architecture',
    description:
      'يفحص خريطة البنية الكاملة للمشروع (الصفحات، المكونات، الخدمات، الخادم، قواعد Firestore، والملفات الأساسية).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        scope: {
          type: Type.STRING,
          description: 'نطاق الفحص الاختياري مثل all أو frontend أو backend',
        },
      },
    },
  },
  {
    name: 'list_project_files',
    description:
      'يسرد ملفات المشروع الفعلية في src/ أو server/ أو scripts/ أو public/ أو الجذر (بما فيها firestore.rules)، مع إمكانية التصفية ببادئة مسار.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prefix: {
          type: Type.STRING,
          description: 'بادئة اختيارية مثل src/pages أو server/',
        },
      },
    },
  },
  {
    name: 'read_project_file',
    description:
      'يقرأ محتوى أي ملف مسموح به في المشروع مع دعم تحديد نطاق الأسطر startLine و endLine للملفات الطويلة.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: { type: Type.STRING },
        startLine: { type: Type.INTEGER },
        endLine: { type: Type.INTEGER },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'search_project_code',
    description: 'يبحث نصيًا عن كلمة أو رمز أو اسم مكون داخل ملفات المشروع.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING },
        directoryPrefix: { type: Type.STRING },
      },
      required: ['query'],
    },
  },
  {
    name: 'stage_file_create_or_update',
    description:
      'يجهز تعديلاً أو إنشاءً كاملاً لملف داخل المشروع (src/، server/، scripts/، public/، index.html، server.ts، firestore.rules، firebase-blueprint.json، package.json، vite.config.ts، metadata.json). يجب تمرير المحتوى الكامل الصالح للترجمة.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: { type: Type.STRING },
        summary: { type: Type.STRING },
        newContent: { type: Type.STRING },
      },
      required: ['filePath', 'summary', 'newContent'],
    },
  },
  {
    name: 'stage_file_delete',
    description: 'يجهز حذف ملف قديم أو غير مستخدم من المشروع.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        filePath: { type: Type.STRING },
        summary: { type: Type.STRING },
      },
      required: ['filePath', 'summary'],
    },
  },
  {
    name: 'run_verification_check',
    description:
      'يشغل فحص TypeScript (--noEmit) واختبارات الوحدات (tsx --test) على حالة المشروع الحالية للتحقق الفوري من عدم وجود أخطاء.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        includeBuild: {
          type: Type.BOOLEAN,
          description: 'تشغيل فحص البناء الإنتاجي الكامل npm run build أيضًا',
        },
      },
    },
  },
];

function resolveLocalBin(projectRoot: string, binName: string): { cmd: string; prefixArgs: string[] } {
  const localBin = path.join(projectRoot, 'node_modules', '.bin', binName);
  if (fs.existsSync(localBin)) {
    return { cmd: localBin, prefixArgs: [] };
  }
  return { cmd: 'npx', prefixArgs: ['--no-install', binName] };
}

function collectUnitTestFiles(projectRoot: string): string[] {
  const found: string[] = [];
  const utilsDir = path.join(projectRoot, 'src', 'utils');
  if (fs.existsSync(utilsDir)) {
    for (const name of fs.readdirSync(utilsDir)) {
      if (name.endsWith('.test.ts')) {
        found.push(`src/utils/${name}`);
      }
    }
  }
  const secTest = path.join(projectRoot, 'server', 'security.test.ts');
  if (fs.existsSync(secTest)) {
    found.push('server/security.test.ts');
  }
  return found.sort();
}

async function runProjectVerificationChecks(
  projectRoot: string,
  includeBuildCheck: boolean,
  changedFiles: string[] = []
): Promise<{
  testStatus: NonNullable<AiProposalRecord['testStatus']>;
  buildStatus?: AiProposalRecord['buildStatus'];
}> {
  const tscBin = resolveLocalBin(projectRoot, 'tsc');
  const tsxBin = resolveLocalBin(projectRoot, 'tsx');
  const testFiles = collectUnitTestFiles(projectRoot);

  const tscPromise = execFileAsync(tscBin.cmd, [...tscBin.prefixArgs, '--noEmit'], {
    cwd: projectRoot,
    timeout: 45_000,
  })
    .then(async (res) => {
      let extraOut = '';
      if (changedFiles.includes('firestore.rules')) {
        const eslintBin = resolveLocalBin(projectRoot, 'eslint');
        const lintRes = await execFileAsync(
          eslintBin.cmd,
          [...eslintBin.prefixArgs, 'firestore.rules'],
          { cwd: projectRoot, timeout: 30_000 }
        );
        if (lintRes.stdout) extraOut = lintRes.stdout;
      }
      const combined = [res.stdout, extraOut].filter(Boolean).join('\n').trim();
      return {
        ok: true,
        output: combined ? combined.slice(0, 3000) : 'تخطى فحص TypeScript بنجاح (0 أخطاء).',
      };
    })
    .catch((err) => {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      return {
        ok: false,
        output: [e.stdout, e.stderr, e.message].filter(Boolean).join('\n').slice(0, 3000),
      };
    });

  const testsPromise =
    testFiles.length > 0
      ? execFileAsync(tsxBin.cmd, [...tsxBin.prefixArgs, '--test', ...testFiles], {
          cwd: projectRoot,
          timeout: 45_000,
        })
          .then((res) => ({
            ok: true,
            output: (res.stdout || res.stderr || 'نجحت جميع الاختبارات بنجاح.')
              .trim()
              .slice(0, 3000),
          }))
          .catch((err) => {
            const e = err as { stdout?: string; stderr?: string; message?: string };
            return {
              ok: false,
              output: [e.stdout, e.stderr, e.message].filter(Boolean).join('\n').slice(0, 3000),
            };
          })
      : Promise.resolve({ ok: true, output: 'لا توجد ملفات اختبار.' });

  const [tscRes, testsRes] = await Promise.all([tscPromise, testsPromise]);

  let buildStatus: AiProposalRecord['buildStatus'] | undefined;
  if (includeBuildCheck) {
    try {
      const buildRes = await execFileAsync('npm', ['run', 'build'], {
        cwd: projectRoot,
        timeout: 90_000,
      });
      buildStatus = {
        ranAt: new Date().toISOString(),
        passed: true,
        output: (buildRes.stdout || 'تم بناء الإنتاج بنجاح (dist/).').trim().slice(0, 3000),
      };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      buildStatus = {
        ranAt: new Date().toISOString(),
        passed: false,
        output: [e.stdout, e.stderr, e.message].filter(Boolean).join('\n').slice(0, 3000),
      };
    }
  }

  return {
    testStatus: {
      ranAt: new Date().toISOString(),
      passed: tscRes.ok && testsRes.ok,
      tscOutput: tscRes.output,
      testsOutput: testsRes.output,
    },
    buildStatus,
  };
}

export interface AiConversationTurnInput {
  role: 'owner' | 'assistant';
  text: string;
}

export async function generateAiDeveloperProposal(params: {
  projectRoot: string;
  store: ServerDataStore;
  instruction: string;
  targetFiles?: string[];
  history?: AiConversationTurnInput[];
  executionMode?: 'plan' | 'direct';
  thinkingPower?: AiThinkingPower;
  onProgress?: (phase: string, logLine?: string) => void;
}): Promise<AiProposalRecord> {
  const {
    projectRoot,
    store,
    instruction,
    targetFiles = [],
    history = [],
    executionMode = 'plan',
    thinkingPower = 'balanced',
    onProgress,
  } = params;
  const trimmedInstruction = instruction.trim();
  if (trimmedInstruction.length < 3) {
    throw new Error('يرجى كتابة وصف واضح للتعديل أو الميزة المطلوبة.');
  }

  const ai = createGeminiClient();
  const tree = listProjectSourceFiles(projectRoot);
  const arch = getProjectArchitectureSummary(projectRoot);
  const stagedMap = new Map<
    string,
    {
      action: 'update' | 'create' | 'delete';
      summary: string;
      beforeContent: string;
      afterContent: string;
    }
  >();
  const executedTools: string[] = [];

  onProgress?.('تحضير سياق المشروع', `تم فحص شجرة المشروع (${tree.length} ملفًا).`);

  const preloadedHints: string[] = [];
  for (const t of targetFiles) {
    const norm = normalizeProjectRelativePath(t);
    const abs = safeResolveProjectFile(projectRoot, norm, 'read');
    if (abs && fs.existsSync(abs)) {
      const content = fs.readFileSync(abs, 'utf8');
      preloadedHints.push(`=== CONTEXT TARGET: ${norm} ===\n${content.slice(0, 35000)}`);
    }
  }

  const historyContext = history
    .slice(-24)
    .map((h) => `[${h.role === 'owner' ? 'المالك' : 'المهندس الذكي'}]: ${h.text}`)
    .join('\n');

  const systemInstruction = [
    `أنت مهندس برمجيات رئيسي متكامل بلا حدود (Unbounded AI Full-Stack Engineer) بمستوى Google AI Studio داخل منصة "تلاوة (TILAWA)" المبنية بـ React 19 + TypeScript + Tailwind CSS v4 + Express + Firebase.`,
    `تمتلك صلاحية كاملة لقراءة الكود وتحليل البنية المعمارية والبحث وتعديل وإنشاء وحذف أي ملف في الواجهة (src/) أو الخادم (server.ts, server/) أو قواعد البيانات (firestore.rules, firebase-blueprint.json) أو (scripts/, public/, index.html, package.json, vite.config.ts) بالإضافة إلى فحص الكود والأنواع عبر run_verification_check.`,
    executionMode === 'direct'
      ? `وضع التشغيل الحالي: تنفيذ مباشر فوري (Direct Execution) مع اختبار آلي ونسخ احتياطي تلقائي؛ جهّز كافة التعديلات كاملة ونظيفة لتُطبّق وتُختبر فورًا دون أي placeholders أو اختصارات.`
      : `وضع التشغيل الحالي: تخطيط ومراجعة الفروقات (Plan & Diff Review)؛ جهّز كافة التعديلات كاملة ودقيقة ليراجعها المالك ويعتمدها.`,
    `القواعد الهندسية والأمنية الصارمة:`,
    `1. اقرأ الملفات ذات الصلة بسرعة عبر الأدوات (ادمج قراءة عدة ملفات أو البحث في دفعة واحدة لتقليل الزمن) قبل تجهيز التعديلات حتى تكون مترابطة 100% ولا تكسر أي نوع TypeScript.`,
    `2. حافظ دائمًا على إبقاء الموقع العام مفتوحًا لجميع الزوار دون تسجيل دخول أو حسابات مستخدمين.`,
    `3. حافظ على السرية المطلقة لبريد المالك ولا تكتبه إطلاقًا داخل أي ملف في src/ أو index.html أو public/، ولا تُظهر رابط لوحة الإدارة بشكل مباشر.`,
    `4. عند تجهيز أي ملف عبر stage_file_create_or_update، أرسل المحتوى الكامل والنظيف للملف (وليس مقتطفات).`,
    `5. إذا كان طلب المالك سؤالًا أو استفسارًا أو مراجعة دون تعديل الكود، أجب بالتحليل الهندسي الدقيق بالعربية مباشرة.`,
    `6. عند الانتهاء من تجهيز كافة التعديلات عبر الأدوات، قدّم ملخصًا نهائيًا واضحًا بصيغة JSON بالشكل: {"analysis":"...", "riskLevel":"low|medium|high"}.`,
  ].join('\n');

  const userBootstrapPrompt = [
    `إجمالي ملفات المشروع: ${tree.length} ملفًا (صفحات: ${arch.layers.pages.length}، مكونات: ${arch.layers.components.length}، خادم: ${arch.layers.backendAndSecurity.length}، قواعد وإعدادات: ${arch.layers.databaseAndConfig.length}).`,
    `كافة ملفات المشروع:`,
    tree
      .map((f) => `- ${f.path}${f.writable ? '' : ' (readonly)'}`)
      .join('\n'),
    historyContext ? `\nسياق المحادثة السابق:\n${historyContext}` : '',
    preloadedHints.length > 0 ? `\nملفات محددة مسبقًا:\n${preloadedHints.join('\n\n')}` : '',
    `\nطلب المالك الحالي:\n${trimmedInstruction}`,
  ]
    .filter(Boolean)
    .join('\n');

  const contents: Content[] = [{ role: 'user', parts: [{ text: userBootstrapPrompt }] }];

  let finalAnalysisText = '';
  let finalRiskLevel: 'low' | 'medium' | 'high' = 'low';

  try {
    for (let step = 0; step < MAX_AGENT_STEPS; step++) {
      onProgress?.(
        `التحليل والتنفيذ الهندسي (خطوة ${step + 1})`,
        step === 0 ? 'جارٍ تحليل الطلب وفحص ملفات المشروع...' : undefined
      );

      const response = await generateContentResilient(ai, {
        contents,
        systemInstruction,
        tools: [{ functionDeclarations: AI_DEV_TOOLS }],
        thinkingPower,
      });

      const candidate = response.candidates?.[0];
      const modelContent = candidate?.content;
      if (modelContent) {
        contents.push(modelContent);
      }

      const fnCalls = response.functionCalls;
      if (!fnCalls || fnCalls.length === 0) {
        finalAnalysisText = (response.text || '').trim();
        break;
      }

      const fnResponseParts: Array<{
        functionResponse: { id?: string; name: string; response: Record<string, unknown> };
      }> = [];

      for (const call of fnCalls) {
        const name = call.name || '';
        const args = (call.args || {}) as Record<string, unknown>;
        let toolResult: Record<string, unknown> = { ok: false, error: 'أداة غير معروفة' };

        if (name === 'inspect_architecture') {
          executedTools.push('inspect_architecture()');
          onProgress?.('فحص البنية المعمارية', 'inspect_architecture()');
          toolResult = { ok: true, architecture: getProjectArchitectureSummary(projectRoot) };
        } else if (name === 'list_project_files') {
          const prefix =
            typeof args.prefix === 'string'
              ? normalizeProjectRelativePath(args.prefix)
              : '';
          const matched = tree
            .filter((f) => (!prefix ? true : f.path.startsWith(prefix)))
            .map((f) => `${f.path} (${f.sizeBytes}B${f.writable ? ', writable' : ''})`);
          const label = `list_project_files(${prefix || '*'})`;
          executedTools.push(label);
          onProgress?.('استعراض الملفات', label);
          toolResult = { ok: true, count: matched.length, files: matched };
        } else if (name === 'read_project_file') {
          const relPath = normalizeProjectRelativePath(String(args.filePath || ''));
          const staged = stagedMap.get(relPath);
          if (staged) {
            const label = `read_project_file(${relPath}) [staged]`;
            executedTools.push(label);
            onProgress?.('قراءة ملف', label);
            toolResult = {
              ok: true,
              filePath: relPath,
              stagedAction: staged.action,
              content: staged.afterContent.slice(0, 45000),
            };
          } else {
            const abs = safeResolveProjectFile(projectRoot, relPath, 'read');
            if (!abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
              toolResult = { ok: false, error: `الملف غير موجود أو غير مسموح بقراءته: ${relPath}` };
            } else {
              const raw = fs.readFileSync(abs, 'utf8');
              const lines = raw.split('\n');
              const start =
                typeof args.startLine === 'number' && args.startLine >= 1
                  ? Math.floor(args.startLine)
                  : 1;
              const end =
                typeof args.endLine === 'number' && args.endLine >= start
                  ? Math.min(lines.length, Math.floor(args.endLine))
                  : Math.min(lines.length, start + 799);
              const sliceText = lines
                .slice(start - 1, end)
                .map((line, i) => `${start + i}: ${line}`)
                .join('\n')
                .slice(0, 45000);
              const label = `read_project_file(${relPath}:${start}-${end})`;
              executedTools.push(label);
              onProgress?.('قراءة ملف', label);
              toolResult = {
                ok: true,
                filePath: relPath,
                totalLines: lines.length,
                startLine: start,
                endLine: end,
                content: sliceText,
              };
            }
          }
        } else if (name === 'search_project_code') {
          const query = String(args.query || '');
          const prefix =
            typeof args.directoryPrefix === 'string' ? args.directoryPrefix : undefined;
          const matches = searchInsideProjectFiles(projectRoot, tree, query, prefix);
          const label = `search_project_code("${query.slice(0, 32)}")`;
          executedTools.push(label);
          onProgress?.('البحث في الكود', label);
          toolResult = { ok: true, count: matches.length, matches };
        } else if (name === 'stage_file_create_or_update') {
          const relPath = normalizeProjectRelativePath(String(args.filePath || ''));
          const newContent = typeof args.newContent === 'string' ? args.newContent : '';
          const summary = String(args.summary || 'تحديث برمجي').slice(0, 220);
          const abs = safeResolveProjectFile(projectRoot, relPath, 'write');
          if (!abs) {
            toolResult = { ok: false, error: `المسار غير مسموح بالتعديل: ${relPath}` };
          } else if (!newContent.trim()) {
            toolResult = { ok: false, error: 'المحتوى المرسل فارغ' };
          } else if (containsSensitiveOwnerLeak(relPath, newContent)) {
            toolResult = {
              ok: false,
              error: 'مرفوض أمنيًا: لا يجوز تضمين بريد المالك داخل ملفات الواجهة العامة.',
            };
          } else {
            const existed = fs.existsSync(abs) && fs.statSync(abs).isFile();
            const beforeContent = existed ? fs.readFileSync(abs, 'utf8') : '';
            if (beforeContent !== newContent) {
              stagedMap.set(relPath, {
                action: existed ? 'update' : 'create',
                summary,
                beforeContent,
                afterContent: newContent,
              });
            }
            const label = `${existed ? 'stage_update' : 'stage_create'}(${relPath})`;
            executedTools.push(label);
            onProgress?.('تجهيز تعديل', label);
            toolResult = {
              ok: true,
              filePath: relPath,
              action: existed ? 'update' : 'create',
              bytes: Buffer.byteLength(newContent, 'utf8'),
            };
          }
        } else if (name === 'stage_file_delete') {
          const relPath = normalizeProjectRelativePath(String(args.filePath || ''));
          const summary = String(args.summary || 'حذف ملف').slice(0, 220);
          const abs = safeResolveProjectFile(projectRoot, relPath, 'write');
          if (!abs || !fs.existsSync(abs)) {
            toolResult = { ok: false, error: `لا يمكن حذف هذا المسار: ${relPath}` };
          } else {
            const beforeContent = fs.readFileSync(abs, 'utf8');
            stagedMap.set(relPath, {
              action: 'delete',
              summary,
              beforeContent,
              afterContent: '',
            });
            const label = `stage_delete(${relPath})`;
            executedTools.push(label);
            onProgress?.('تجهيز حذف', label);
            toolResult = { ok: true, filePath: relPath, action: 'delete' };
          }
        } else if (name === 'run_verification_check') {
          const includeBuild = Boolean(args.includeBuild);
          executedTools.push(`run_verification_check(${includeBuild ? 'build' : 'tsc+tests'})`);
          onProgress?.('اختبار المشروع عبر الأداة', 'تشغيل tsc واختبارات الوحدات...');
          const verification = await withWorkspaceLock(() =>
            runProjectVerificationChecks(projectRoot, includeBuild)
          );
          toolResult = {
            ok: true,
            passed:
              verification.testStatus.passed &&
              (!verification.buildStatus || verification.buildStatus.passed),
            tscOutput: verification.testStatus.tscOutput,
            testsOutput: verification.testStatus.testsOutput,
            buildPassed: verification.buildStatus?.passed,
            buildOutput: verification.buildStatus?.output,
          };
        }

        fnResponseParts.push({
          functionResponse: {
            ...(call.id ? { id: call.id } : {}),
            name,
            response: toolResult,
          },
        });
      }

      contents.push({
        role: 'user',
        parts: fnResponseParts as unknown as Content['parts'],
      });
    }
  } catch (err) {
    throw new Error(formatGeminiErrorMessage(err));
  }

  let parsedAnalysis = finalAnalysisText;
  if (finalAnalysisText.startsWith('{') || finalAnalysisText.includes('```json')) {
    try {
      const jsonMatch = finalAnalysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          analysis?: string;
          riskLevel?: string;
        };
        if (parsed.analysis) parsedAnalysis = parsed.analysis;
        if (
          parsed.riskLevel === 'high' ||
          parsed.riskLevel === 'medium' ||
          parsed.riskLevel === 'low'
        ) {
          finalRiskLevel = parsed.riskLevel;
        }
      }
    } catch {
      // Keep raw markdown/text analysis
    }
  }

  if (stagedMap.size >= 4 || Array.from(stagedMap.keys()).some((p) => p.startsWith('server'))) {
    if (finalRiskLevel === 'low') finalRiskLevel = 'medium';
  }

  const validatedChanges: AiProposalChange[] = [];
  for (const [filePath, item] of stagedMap.entries()) {
    validatedChanges.push({
      filePath,
      action: item.action,
      summary: item.summary,
      beforeContent: item.beforeContent,
      afterContent: item.afterContent,
      diffLines: computeLineDiff(item.beforeContent, item.afterContent),
    });
  }

  const proposal: AiProposalRecord = {
    id: `prop_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    createdAt: new Date().toISOString(),
    instruction: trimmedInstruction,
    executionMode,
    analysis:
      parsedAnalysis ||
      (validatedChanges.length > 0
        ? `تم فحص ملفات المشروع عبر الأدوات وتجهيز ${validatedChanges.length} تغييرًا برمجيًا.`
        : 'تم تحليل الكود والإجابة على الاستفسار بنجاح.'),
    riskLevel: finalRiskLevel,
    changes: validatedChanges,
    executedTools,
  };

  store.saveProposal(proposal);
  store.appendAuditLog({
    category: 'ai-dev',
    action:
      executionMode === 'direct'
        ? 'تخطيط وتجهيز تنفيذ مباشر AI'
        : 'تجهيز مقترح AI Developer الوكيل',
    summary: `نُفِّذت ${executedTools.length} أداة وفُحصت وجهّزت ${validatedChanges.length} ملفًا لطلب: ${trimmedInstruction.slice(0, 70)}`,
  });

  return proposal;
}

export async function analyzeCodebaseWithAi(params: {
  projectRoot: string;
  targetFile?: string;
}): Promise<{ report: string; checkedFiles: string[] }> {
  const ai = createGeminiClient();
  const tree = listProjectSourceFiles(params.projectRoot);
  const targets = params.targetFile
    ? [normalizeProjectRelativePath(params.targetFile)]
    : [
        'src/App.tsx',
        'src/pages/HomePage.tsx',
        'src/pages/RecitersPage.tsx',
        'src/pages/TahfeezPage.tsx',
        'src/pages/MushafPage.tsx',
        'src/pages/BasiraPage.tsx',
        'src/components/Footer.tsx',
        'src/contexts/DynamicConfigContext.tsx',
        'server.ts',
      ];

  const validTargets = targets.filter((t) => safeResolveProjectFile(params.projectRoot, t, 'read'));
  const snippets = validTargets
    .map((relPath) => {
      const abs = safeResolveProjectFile(params.projectRoot, relPath, 'read');
      if (!abs || !fs.existsSync(abs)) return '';
      const raw = fs.readFileSync(abs, 'utf8').slice(0, 24000);
      return `=== FILE: ${relPath} ===\n${raw}`;
    })
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await generateContentResilient(ai, {
      thinkingPower: 'balanced',
      contents: [
        `أنت مراجع معماري وأمني للكود في منصة تلاوة. قدّم تقريرًا عمليًا مركزًا باللغة العربية يشمل: الأداء، الأمان، جودة البنية، واقتراحات تحسين فورية قابلة للتطبيق مباشرة.`,
        `إجمالي الملفات في المشروع: ${tree.length}`,
        snippets,
      ].join('\n\n'),
    });

    return {
      report: (response.text || 'لم يتم إرجاع تقرير.').trim(),
      checkedFiles: validTargets,
    };
  } catch (err) {
    throw new Error(formatGeminiErrorMessage(err));
  }
}

export async function testAiProposalSafely(params: {
  projectRoot: string;
  store: ServerDataStore;
  proposalId: string;
  runBuildCheck?: boolean;
}): Promise<AiProposalRecord> {
  return withWorkspaceLock(async () => {
    const proposal = params.store.getProposal(params.proposalId);
    if (!proposal) {
      throw new Error('لم يتم العثور على المقترح البرمجي المطلوب اختباره.');
    }

    const snapshots: Array<{ absPath: string; existed: boolean; content: string }> = [];
    try {
      for (const ch of proposal.changes) {
        if (ch.action !== 'delete' && containsSensitiveOwnerLeak(ch.filePath, ch.afterContent)) {
          throw new Error(`انتهاك أمني في ${ch.filePath}: لا يجوز ظهور بريد المالك في ملفات الواجهة.`);
        }
        const absPath = safeResolveProjectFile(params.projectRoot, ch.filePath, 'write');
        if (!absPath) {
          throw new Error(`مسار غير مسموح به أثناء الاختبار: ${ch.filePath}`);
        }
        const existed = fs.existsSync(absPath);
        const orig = existed ? fs.readFileSync(absPath, 'utf8') : '';
        snapshots.push({ absPath, existed, content: orig });

        if (ch.action === 'delete') {
          if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
        } else {
          fs.mkdirSync(path.dirname(absPath), { recursive: true });
          fs.writeFileSync(absPath, ch.afterContent, 'utf8');
        }
      }

      const { testStatus, buildStatus } = await runProjectVerificationChecks(
        params.projectRoot,
        Boolean(params.runBuildCheck),
        proposal.changes.map((c) => c.filePath)
      );

      proposal.testStatus = testStatus;
      if (buildStatus) proposal.buildStatus = buildStatus;
      params.store.saveProposal(proposal);
      params.store.appendAuditLog({
        category: 'ai-dev',
        action: 'اختبار مقترح AI Developer',
        summary: `${testStatus.passed ? 'نجح الاختبار الكامل' : 'رُصدت ملاحظات'} للمقترح ${proposal.id}`,
      });
      return proposal;
    } finally {
      for (const snap of snapshots.reverse()) {
        if (snap.existed) {
          fs.mkdirSync(path.dirname(snap.absPath), { recursive: true });
          fs.writeFileSync(snap.absPath, snap.content, 'utf8');
        } else if (fs.existsSync(snap.absPath)) {
          fs.unlinkSync(snap.absPath);
        }
      }
    }
  });
}

export async function applyAiProposalWithBackup(params: {
  projectRoot: string;
  store: ServerDataStore;
  proposalId: string;
}): Promise<AiProposalRecord> {
  return withWorkspaceLock(async () => {
    const proposal = params.store.getProposal(params.proposalId);
    if (!proposal) {
      throw new Error('المقترح غير موجود.');
    }
    if (proposal.changes.length === 0) {
      throw new Error('لا توجد تعديلات ملفات لتطبيقها في هذا المقترح.');
    }

    const validItems: Array<{
      absPath: string;
      filePath: string;
      action: 'update' | 'create' | 'delete';
      afterContent: string;
    }> = [];

    for (const ch of proposal.changes) {
      if (ch.action !== 'delete' && containsSensitiveOwnerLeak(ch.filePath, ch.afterContent)) {
        throw new Error(`مرفوض أمنيًا: تم اكتشاف تسريب بريد المالك في ${ch.filePath}.`);
      }
      const absPath = safeResolveProjectFile(params.projectRoot, ch.filePath, 'write');
      if (!absPath) {
        throw new Error(`مسار غير مسموح به: ${ch.filePath}`);
      }
      validItems.push({
        absPath,
        filePath: ch.filePath,
        action: ch.action,
        afterContent: ch.afterContent,
      });
    }

    const backup = params.store.createBackupSnapshot({
      label: `نسخة تلقائية قبل: ${proposal.instruction.slice(0, 50)}`,
      reason: `تطبيق مقترح AI Developer (${proposal.id})`,
      filePaths: validItems.map((p) => p.filePath),
      includeConfig: true,
    });

    for (const item of validItems) {
      if (item.action === 'delete') {
        if (fs.existsSync(item.absPath)) fs.unlinkSync(item.absPath);
      } else {
        fs.mkdirSync(path.dirname(item.absPath), { recursive: true });
        fs.writeFileSync(item.absPath, item.afterContent, 'utf8');
      }
    }

    notifyFilesMutated(validItems.map((i) => i.filePath));

    proposal.appliedAt = new Date().toISOString();
    proposal.backupId = backup.id;
    proposal.autoRolledBack = false;
    params.store.saveProposal(proposal);
    params.store.appendAuditLog({
      category: 'ai-dev',
      action: 'اعتماد وتنفيذ تعديل AI Developer',
      summary: `تم تنفيذ ${validItems.length} تغيير ملفات وإنشاء النسخة الاحتياطية ${backup.id}`,
      details: validItems.map((p) => `${p.action}:${p.filePath}`).join(', '),
    });

    return proposal;
  });
}

export async function executeAiDeveloperTask(params: {
  projectRoot: string;
  store: ServerDataStore;
  instruction: string;
  targetFiles?: string[];
  history?: AiConversationTurnInput[];
  rollbackOnFailure?: boolean;
  runBuildCheck?: boolean;
  thinkingPower?: AiThinkingPower;
  onProgress?: (phase: string, logLine?: string) => void;
}): Promise<AiProposalRecord> {
  const onProgress = params.onProgress;

  const proposal = await generateAiDeveloperProposal({
    projectRoot: params.projectRoot,
    store: params.store,
    instruction: params.instruction,
    targetFiles: params.targetFiles,
    history: params.history,
    executionMode: 'direct',
    thinkingPower: params.thinkingPower,
    onProgress,
  });

  if (proposal.changes.length === 0) {
    return proposal;
  }

  onProgress?.('إنشاء نسخة احتياطية وتطبيق التعديلات', `تطبيق ${proposal.changes.length} ملفًا...`);
  let applied = await applyAiProposalWithBackup({
    projectRoot: params.projectRoot,
    store: params.store,
    proposalId: proposal.id,
  });

  let repairFiles = applied.changes.map((c) => c.filePath);

  onProgress?.('تشغيل فحص TypeScript واختبارات الوحدات', 'جارٍ التحقق من سلامة الأنواع والمنطق...');
  let verification = await withWorkspaceLock(() =>
    runProjectVerificationChecks(params.projectRoot, Boolean(params.runBuildCheck), repairFiles)
  );

  // Up to 2 automatic Self-Repair passes if verification finds TypeScript, lint, test, or build errors
  for (let pass = 1; pass <= 2; pass++) {
    const passedNow =
      verification.testStatus.passed &&
      (!verification.buildStatus || verification.buildStatus.passed);
    if (passedNow) break;

    onProgress?.(
      `إصلاح تلقائي للأخطاء البرمجية (محاولة ${pass}/2)`,
      `رُصدت ملاحظة في الفحص — جارٍ إصلاحها تلقائيًا وإعادة الاختبار...`
    );
    const errorDigest = [
      verification.testStatus.tscOutput,
      verification.testStatus.testsOutput,
      verification.buildStatus?.output,
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 5000);

    try {
      const repairProposal = await generateAiDeveloperProposal({
        projectRoot: params.projectRoot,
        store: params.store,
        instruction: `أصلح الأخطاء التالية الناتجة عن تنفيذ طلب "${params.instruction}":\n${errorDigest}\nعدّل فقط الملفات المسببة للخطأ وأرجع إصلاحًا صحيحًا 100%.`,
        targetFiles: repairFiles,
        history: params.history,
        executionMode: 'direct',
        thinkingPower: 'deep',
        onProgress,
      });

      if (repairProposal.changes.length === 0) break;

      await withWorkspaceLock(async () => {
        for (const ch of repairProposal.changes) {
          if (ch.action !== 'delete' && containsSensitiveOwnerLeak(ch.filePath, ch.afterContent)) {
            throw new Error(`مرفوض أمنيًا في ${ch.filePath}`);
          }
          const absPath = safeResolveProjectFile(params.projectRoot, ch.filePath, 'write');
          if (!absPath) continue;
          if (ch.action === 'delete') {
            if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
          } else {
            fs.mkdirSync(path.dirname(absPath), { recursive: true });
            fs.writeFileSync(absPath, ch.afterContent, 'utf8');
          }
        }
        notifyFilesMutated(repairProposal.changes.map((c) => c.filePath));
      });

      applied = {
        ...applied,
        analysis: `${applied.analysis}\n\n[إصلاح تلقائي #${pass}]: ${repairProposal.analysis}`,
        executedTools: [...(applied.executedTools || []), ...(repairProposal.executedTools || [])],
      };
      repairFiles = Array.from(
        new Set([...repairFiles, ...repairProposal.changes.map((c) => c.filePath)])
      );
      verification = await withWorkspaceLock(() =>
        runProjectVerificationChecks(params.projectRoot, Boolean(params.runBuildCheck), repairFiles)
      );
    } catch {
      break;
    }
  }

  applied.testStatus = verification.testStatus;
  if (verification.buildStatus) {
    applied.buildStatus = verification.buildStatus;
  }

  const allPassed =
    verification.testStatus.passed &&
    (!verification.buildStatus || verification.buildStatus.passed);

  if (!allPassed && params.rollbackOnFailure !== false && applied.backupId) {
    onProgress?.('استرجاع النسخة الآمنة', `استعادة ${applied.backupId} بعد فشل الفحص...`);
    await restoreBackupSnapshot({
      projectRoot: params.projectRoot,
      store: params.store,
      backupId: applied.backupId,
    });
    applied.autoRolledBack = true;
    applied.appliedAt = undefined;
    params.store.appendAuditLog({
      category: 'ai-dev',
      action: 'تراجع تلقائي بعد فشل التحقق الآلي',
      summary: `تم استرجاع الملفات تلقائيًا من ${applied.backupId} بسبب فشل الاختبار أو البناء.`,
    });
  }

  params.store.saveProposal(applied);
  return applied;
}

export async function restoreBackupSnapshot(params: {
  projectRoot: string;
  store: ServerDataStore;
  backupId: string;
}): Promise<{ restoredFiles: string[]; restoredConfig: boolean; safetyBackupId: string }> {
  return withWorkspaceLock(async () => {
    const backup = params.store.getBackup(params.backupId);
    if (!backup) {
      throw new Error('النسخة الاحتياطية المطلوبة غير موجودة.');
    }

    const safety = params.store.createBackupSnapshot({
      label: `نسخة أمان قبل التراجع إلى ${backup.id}`,
      reason: `تراجع المالك إلى النسخة ${backup.label}`,
      filePaths: backup.files.map((f) => f.filePath),
      includeConfig: true,
      includeBasira: true,
    });

    const restoredFiles: string[] = [];
    for (const f of backup.files) {
      const absPath = safeResolveProjectFile(params.projectRoot, f.filePath, 'write');
      if (!absPath) continue;
      if (f.existedBefore) {
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, f.content, 'utf8');
      } else if (fs.existsSync(absPath)) {
        fs.unlinkSync(absPath);
      }
      restoredFiles.push(f.filePath);
    }

    notifyFilesMutated(restoredFiles);

    let restoredConfig = false;
    if (backup.configSnapshot) {
      params.store.saveSiteConfig(backup.configSnapshot);
      restoredConfig = true;
    }
    if (backup.basiraSnapshot) {
      params.store.saveBasiraCatalog(backup.basiraSnapshot);
      restoredConfig = true;
    }

    params.store.appendAuditLog({
      category: 'backup',
      action: 'استعادة نسخة احتياطية (Rollback)',
      summary: `تمت الاستعادة إلى «${backup.label}» (${restoredFiles.length} ملفًا)`,
      details: `نسخة الأمان السابقة: ${safety.id}`,
    });

    return {
      restoredFiles,
      restoredConfig,
      safetyBackupId: safety.id,
    };
  });
}

// --- Asynchronous Background Job Manager (Prevents 60s Reverse-Proxy HTTP Timeouts) ---

const aiJobs = new Map<string, AiDeveloperJobStatus>();

function pruneOldJobs(): void {
  if (aiJobs.size <= 120) return;
  const entries = Array.from(aiJobs.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  for (const old of entries.slice(120)) {
    aiJobs.delete(old.id);
  }
}

export function getAiDeveloperHealth(): {
  keyConfigured: boolean;
  model: string;
  activeJobs: number;
} {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  const activeJobs = Array.from(aiJobs.values()).filter((j) => j.status === 'running').length;
  return {
    keyConfigured: Boolean(key && key !== 'MY_GEMINI_API_KEY'),
    model: GEMINI_MODEL,
    activeJobs,
  };
}

export function getAiDeveloperJob(jobId: string): AiDeveloperJobStatus | null {
  return aiJobs.get(jobId) || null;
}

export function startAiDeveloperJob(params: {
  projectRoot: string;
  store: ServerDataStore;
  kind: 'plan' | 'execute' | 'analyze';
  instruction?: string;
  targetFiles?: string[];
  targetFile?: string;
  history?: AiConversationTurnInput[];
  rollbackOnFailure?: boolean;
  runBuildCheck?: boolean;
  thinkingPower?: AiThinkingPower;
}): AiDeveloperJobStatus {
  pruneOldJobs();
  const id = `job_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const now = new Date().toISOString();
  const job: AiDeveloperJobStatus = {
    id,
    kind: params.kind,
    status: 'running',
    phase:
      params.kind === 'analyze'
        ? 'بدء فحص البنية والأمان...'
        : 'بدء تشغيل المهندس الذكي...',
    logs: [],
    createdAt: now,
    updatedAt: now,
  };
  aiJobs.set(id, job);

  const pushProgress = (phase: string, logLine?: string) => {
    job.phase = phase;
    job.updatedAt = new Date().toISOString();
    if (logLine && !job.logs.includes(logLine)) {
      job.logs.push(logLine);
      if (job.logs.length > 80) job.logs.shift();
    }
  };

  void (async () => {
    try {
      if (params.kind === 'analyze') {
        pushProgress('جارٍ قراءة وتحليل ملفات المشروع...', 'بدء الفحص الأمني والمعماري');
        const report = await analyzeCodebaseWithAi({
          projectRoot: params.projectRoot,
          targetFile: params.targetFile,
        });
        params.store.appendAuditLog({
          category: 'ai-dev',
          action: 'فحص جودة وأمان الكود (AI)',
          summary: `تحليل الملفات: ${report.checkedFiles.join(', ')}`,
        });
        job.analysisReport = report;
        job.phase = 'اكتمل الفحص بنجاح';
        job.status = 'completed';
      } else if (params.kind === 'execute') {
        const proposal = await executeAiDeveloperTask({
          projectRoot: params.projectRoot,
          store: params.store,
          instruction: params.instruction || '',
          targetFiles: params.targetFiles,
          history: params.history,
          rollbackOnFailure: params.rollbackOnFailure,
          runBuildCheck: params.runBuildCheck,
          thinkingPower: params.thinkingPower,
          onProgress: pushProgress,
        });
        job.proposal = proposal;
        job.phase = proposal.autoRolledBack
          ? 'فشل الفحص وتم التراجع التلقائي للنسخة الآمنة'
          : 'اكتمل التنفيذ والفحص بنجاح';
        job.status = 'completed';
      } else {
        const proposal = await generateAiDeveloperProposal({
          projectRoot: params.projectRoot,
          store: params.store,
          instruction: params.instruction || '',
          targetFiles: params.targetFiles,
          history: params.history,
          executionMode: 'plan',
          thinkingPower: params.thinkingPower,
          onProgress: pushProgress,
        });
        job.proposal = proposal;
        job.phase = 'تم إعداد الخطة ومعاينة الفروقات';
        job.status = 'completed';
      }
      job.updatedAt = new Date().toISOString();
    } catch (err) {
      job.status = 'failed';
      job.error = formatGeminiErrorMessage(err);
      job.phase = 'تعذر إكمال المهمة';
      job.updatedAt = new Date().toISOString();
    }
  })();

  return job;
}
