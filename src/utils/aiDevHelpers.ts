import type { DiffLineItem } from '../types/tilawa';

export type ProjectLayerFilter = 'all' | 'frontend' | 'backend' | 'config';

export type AiThinkingPower = 'fast' | 'balanced' | 'deep';

export const AI_THINKING_POWER_OPTIONS: Array<{
  id: AiThinkingPower;
  labelAr: string;
  hintAr: string;
}> = [
  { id: 'fast', labelAr: 'فائق السرعة', hintAr: 'استجابة فورية للتعديلات السريعة' },
  { id: 'balanced', labelAr: 'قوة متوازنة', hintAr: 'تحليل عميق وتعديل متعدد الملفات' },
  { id: 'deep', labelAr: 'أقصى قوة هندسية', hintAr: 'تفكير معماري متعمق للمشاريع الكبيرة' },
];

export function normalizeThinkingPower(raw: unknown): AiThinkingPower {
  if (raw === 'fast' || raw === 'balanced' || raw === 'deep') return raw;
  return 'balanced';
}

export interface ProjectFileSummary {
  path: string;
  sizeBytes: number;
  writable: boolean;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  totalLines: number;
}

export const AI_DEV_PIPELINE_STEPS = [
  'تحضير السياق',
  'فحص الكود والأدوات',
  'كتابة التعديلات',
  'الاختبار والتحقق',
] as const;

export function countDiffStats(diffLines: DiffLineItem[]): DiffStats {
  let additions = 0;
  let deletions = 0;
  for (const line of diffLines) {
    if (line.type === 'add') additions++;
    else if (line.type === 'remove') deletions++;
  }
  return {
    additions,
    deletions,
    totalLines: diffLines.length,
  };
}

export function getPipelineStepIndex(
  kind: 'plan' | 'execute' | 'analyze',
  phase: string,
  status: 'running' | 'completed' | 'failed'
): number {
  if (status === 'completed') return 3;
  const normalized = (phase || '').trim();
  if (
    normalized.includes('اختبار') ||
    normalized.includes('فحص TypeScript') ||
    normalized.includes('استرجاع') ||
    normalized.includes('إصلاح تلقائي') ||
    normalized.includes('اكتمل')
  ) {
    return 3;
  }
  if (
    normalized.includes('تجهيز تعديل') ||
    normalized.includes('تجهيز حذف') ||
    normalized.includes('تطبيق') ||
    normalized.includes('نسخة احتياطية')
  ) {
    return 2;
  }
  if (
    normalized.includes('التحليل') ||
    normalized.includes('قراءة') ||
    normalized.includes('البحث') ||
    normalized.includes('البنية') ||
    normalized.includes('استعراض') ||
    kind === 'analyze'
  ) {
    return 1;
  }
  return 0;
}

export function formatBytesCompact(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '0 B';
  if (sizeBytes < 1024) return `${Math.round(sizeBytes)} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatElapsedTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function classifyFileLayer(filePath: string): Exclude<ProjectLayerFilter, 'all'> {
  const p = filePath.trim();
  if (p === 'server.ts' || p.startsWith('server/')) return 'backend';
  if (p.startsWith('src/') || p === 'index.html' || p.startsWith('public/')) return 'frontend';
  return 'config';
}

export function filterProjectFiles(
  files: ProjectFileSummary[],
  query: string,
  layer: ProjectLayerFilter = 'all'
): ProjectFileSummary[] {
  const q = query.trim().toLowerCase();
  return files.filter((file) => {
    if (layer !== 'all' && classifyFileLayer(file.path) !== layer) {
      return false;
    }
    if (!q) return true;
    return file.path.toLowerCase().includes(q);
  });
}

export function buildPreviewIframeUrl(nonce: number, routeHash: string): string {
  const safeNonce = Number.isFinite(nonce) && nonce > 0 ? Math.floor(nonce) : 1;
  const cleanHash = routeHash.startsWith('#') ? routeHash : `#${routeHash}`;
  return `/?preview=${safeNonce}${cleanHash}`;
}
