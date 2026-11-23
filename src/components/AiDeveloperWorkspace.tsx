import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Eye,
  FileCode2,
  FlaskConical,
  FolderTree,
  History,
  Layers,
  MessageSquarePlus,
  Monitor,
  Play,
  RefreshCw,
  RotateCcw,
  SearchCode,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { useAppData } from '../contexts/AppDataContext';
import { useDynamicConfig } from '../contexts/DynamicConfigContext';
import type { AiDeveloperJobStatus, AiProposalRecord } from '../types/tilawa';
import {
  AI_DEV_PIPELINE_STEPS,
  AI_THINKING_POWER_OPTIONS,
  type AiThinkingPower,
  buildPreviewIframeUrl,
  countDiffStats,
  filterProjectFiles,
  formatBytesCompact,
  formatElapsedTimer,
  getPipelineStepIndex,
  type ProjectLayerFilter,
} from '../utils/aiDevHelpers';

async function safeReadJson<T>(res: Response): Promise<{ data: T | null; rawText: string }> {
  const rawText = await res.text();
  if (!rawText) return { data: null, rawText: '' };
  try {
    return { data: JSON.parse(rawText) as T, rawText };
  } catch {
    return { data: null, rawText };
  }
}

interface ProjectFileItem {
  path: string;
  sizeBytes: number;
  writable: boolean;
}

interface ArchitectureSummary {
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

interface AiDeveloperWorkspaceProps {
  onBackupCreated?: () => void;
  onFilesApplied?: () => void;
}

const QUICK_PRESETS: Array<{ label: string; prompt: string }> = [
  {
    label: 'إضافة شريط تعريفي بالرئيسية',
    prompt:
      'أضف شريطًا تعريفيًا أنيقًا في الصفحة الرئيسية يعرض فضل قراءة سورة الكهف يوم الجمعة بتصميم متناسق مع هوية تلاوة.',
  },
  {
    label: 'تحسين تجربة القراء على الجوال',
    prompt:
      'حسّن تباين الأزرار وتجربة الاستخدام على شاشات الجوال في صفحة القراء مع الحفاظ الكامل على الوظائف الحالية.',
  },
  {
    label: 'ميزة متكاملة (API + واجهة)',
    prompt:
      'أضف مسارًا جديدًا في الخادم server.ts لإرجاع إحصاءات السور ووصّله بواجهة المكتبة بطريقة آمنة.',
  },
  {
    label: 'تدقيق الأمان وقواعد Firestore',
    prompt:
      'راجع الكود وقواعد الأمان firestore.rules واقترح تحسينات فورية لحماية البيانات ونفّذها بأمان.',
  },
];

const LAYER_FILTER_OPTIONS: Array<{ id: ProjectLayerFilter; label: string }> = [
  { id: 'all', label: 'الكل' },
  { id: 'frontend', label: 'الواجهة' },
  { id: 'backend', label: 'الخادم' },
  { id: 'config', label: 'الإعداد' },
];

const PREVIEW_ROUTES = [
  { hash: '#/', label: 'الرئيسية' },
  { hash: '#/reciters', label: 'القراء' },
  { hash: '#/basira', label: 'بصيرة' },
  { hash: '#/mushaf', label: 'المصحف' },
  { hash: '#/tahfeez', label: 'التحفيظ' },
  { hash: '#/library', label: 'المكتبة' },
];

export const AiDeveloperWorkspace: React.FC<AiDeveloperWorkspaceProps> = ({
  onBackupCreated,
  onFilesApplied,
}) => {
  const { notify } = useAppData();
  const { ownerFetch } = useDynamicConfig();

  const [files, setFiles] = useState<ProjectFileItem[]>([]);
  const [architecture, setArchitecture] = useState<ArchitectureSummary | null>(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [explorerTab, setExplorerTab] = useState<'files' | 'arch'>('files');
  const [layerFilter, setLayerFilter] = useState<ProjectLayerFilter>('all');
  const [fileFilter, setFileFilter] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState(false);

  const [instruction, setInstruction] = useState('');
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState('');
  const [executionMode, setExecutionMode] = useState<'direct' | 'plan'>('direct');
  const [thinkingPower, setThinkingPower] = useState<AiThinkingPower>('balanced');
  const [rollbackOnFailure, setRollbackOnFailure] = useState(true);
  const [runBuildCheck, setRunBuildCheck] = useState(false);

  const [threadHistory, setThreadHistory] = useState<
    Array<{ role: 'owner' | 'assistant'; text: string }>
  >([]);
  const [proposals, setProposals] = useState<AiProposalRecord[]>([]);
  const [showAllProposals, setShowAllProposals] = useState(false);
  const [activeProposal, setActiveProposal] = useState<AiProposalRecord | null>(null);
  const [collapsedDiffs, setCollapsedDiffs] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [analysisReport, setAnalysisReport] = useState<{
    report: string;
    checkedFiles: string[];
  } | null>(null);

  const [planning, setPlanning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [activeJob, setActiveJob] = useState<AiDeveloperJobStatus | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [aiHealth, setAiHealth] = useState<{
    keyConfigured: boolean;
    model: string;
  } | null>(null);

  // Embedded Live App Preview State
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [previewRouteHash, setPreviewRouteHash] = useState('#/');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewNonce, setPreviewNonce] = useState(1);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isJobRunning = planning || analyzing;
  useEffect(() => {
    if (!isJobRunning) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(0);
    const interval = window.setInterval(() => {
      setElapsedSeconds((sec) => sec + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isJobRunning]);

  const bumpLivePreview = useCallback(() => {
    setPreviewNonce((n) => n + 1);
  }, []);

  const copyToClipboard = useCallback(
    async (key: string, value: string, label: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopiedKey(key);
        notify(`تم نسخ ${label}`, 'success');
        window.setTimeout(() => {
          if (mountedRef.current) {
            setCopiedKey((prev) => (prev === key ? null : prev));
          }
        }, 1800);
      } catch {
        notify('تعذر النسخ إلى الحافظة', 'error');
      }
    },
    [notify]
  );

  const loadWorkspaceData = useCallback(async () => {
    setLoadingWorkspace(true);
    try {
      const [filesRes, propsRes, archRes, healthRes] = await Promise.all([
        ownerFetch('/api/admin/files'),
        ownerFetch('/api/admin/ai/proposals'),
        ownerFetch('/api/admin/ai/architecture'),
        ownerFetch('/api/admin/ai/health'),
      ]);

      if (filesRes.ok) {
        const { data } = await safeReadJson<{ files?: ProjectFileItem[] }>(filesRes);
        if (data?.files) setFiles(data.files);
      }

      if (propsRes.ok) {
        const { data } = await safeReadJson<{ proposals?: AiProposalRecord[] }>(propsRes);
        const list = data?.proposals || [];
        setProposals(list);
        setActiveProposal((prev) => {
          if (!prev) return list[0] || null;
          return list.find((item) => item.id === prev.id) || prev;
        });
      }

      if (archRes.ok) {
        const { data } = await safeReadJson<{ architecture?: ArchitectureSummary }>(archRes);
        if (data?.architecture) setArchitecture(data.architecture);
      }

      if (healthRes.ok) {
        const { data } = await safeReadJson<{ keyConfigured?: boolean; model?: string }>(
          healthRes
        );
        if (typeof data?.keyConfigured === 'boolean') {
          setAiHealth({
            keyConfigured: data.keyConfigured,
            model: data.model || 'gemini-4-hydrogen',
          });
        }
      }
    } catch {
      const msg = 'تعذر تحميل بيانات بيئة المطور الذكي من الخادم.';
      setErrorBanner(msg);
      notify(msg, 'error');
    } finally {
      if (mountedRef.current) {
        setLoadingWorkspace(false);
      }
    }
  }, [notify, ownerFetch]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  const pollAiJob = useCallback(
    async (jobId: string): Promise<AiDeveloperJobStatus> => {
      let lastProgressAt = Date.now();
      let lastObservedUpdatedAt = '';
      let consecutiveNetworkErrors = 0;

      while (mountedRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 450));
        if (!mountedRef.current) {
          throw new Error('تم إغلاق نافذة العمل أثناء التشغيل.');
        }

        let res: Response;
        try {
          res = await ownerFetch(`/api/admin/ai/jobs/${encodeURIComponent(jobId)}`);
        } catch {
          consecutiveNetworkErrors++;
          if (consecutiveNetworkErrors >= 5) {
            throw new Error('انقطع الاتصال بالخادم أثناء متابعة مهمة المطور الذكي.');
          }
          continue;
        }

        const { data } = await safeReadJson<{
          ok?: boolean;
          job?: AiDeveloperJobStatus;
          error?: string;
        }>(res);

        if (!res.ok || !data?.ok || !data.job) {
          if (res.status >= 500 && consecutiveNetworkErrors < 4) {
            consecutiveNetworkErrors++;
            continue;
          }
          throw new Error(data?.error || 'تعذر متابعة حالة مهمة المطور الذكي.');
        }

        consecutiveNetworkErrors = 0;
        if (data.job.updatedAt && data.job.updatedAt !== lastObservedUpdatedAt) {
          lastObservedUpdatedAt = data.job.updatedAt;
          lastProgressAt = Date.now();
        }
        setActiveJob(data.job);
        if (data.job.status === 'completed' || data.job.status === 'failed') {
          return data.job;
        }
        if (Date.now() - lastProgressAt > 180_000) {
          throw new Error('توقف الخادم عن إرسال تحديثات لأكثر من ٣ دقائق — يرجى إعادة المحاولة.');
        }
      }
      throw new Error('تم إغلاق المكون أثناء التشغيل.');
    },
    [ownerFetch]
  );

  const handlePreviewFile = async (relPath: string) => {
    setPreviewPath(relPath);
    setLoadingFile(true);
    try {
      const res = await ownerFetch(`/api/admin/file?path=${encodeURIComponent(relPath)}`);
      const { data, rawText } = await safeReadJson<{ content?: string; error?: string }>(res);
      if (res.ok && typeof data?.content === 'string') {
        setPreviewContent(data.content);
      } else {
        setPreviewContent(data?.error || rawText.slice(0, 300) || 'تعذر قراءة الملف.');
      }
    } catch {
      setPreviewContent('خطأ في الاتصال بالخادم أثناء قراءة الملف.');
    } finally {
      if (mountedRef.current) setLoadingFile(false);
    }
  };

  const toggleTargetFile = (relPath: string) => {
    setSelectedTargets((prev) =>
      prev.includes(relPath) ? prev.filter((p) => p !== relPath) : [...prev, relPath]
    );
  };

  const runPromptRequest = async (rawPrompt: string) => {
    setErrorBanner(null);
    const userPrompt = rawPrompt.trim();
    if (userPrompt.length < 4) {
      const msg = 'يرجى كتابة وصف واضح للتطوير أو الإصلاح المطلوب.';
      setErrorBanner(msg);
      notify(msg, 'error');
      return;
    }

    setLastSubmittedPrompt(userPrompt);
    setPlanning(true);
    try {
      const res = await ownerFetch('/api/admin/ai/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: executionMode === 'direct' ? 'execute' : 'plan',
          instruction: userPrompt,
          targetFiles: selectedTargets,
          history: threadHistory.slice(-30),
          thinkingPower,
          ...(executionMode === 'direct' ? { rollbackOnFailure, runBuildCheck } : {}),
        }),
      });
      const { data, rawText } = await safeReadJson<{
        ok?: boolean;
        job?: AiDeveloperJobStatus;
        error?: string;
      }>(res);

      if (!res.ok || !data?.ok || !data.job) {
        const msg =
          data?.error ||
          `تعذر بدء مهمة المطور الذكي (${res.status}). ${rawText.slice(0, 120)}`;
        setErrorBanner(msg);
        notify(msg, 'error');
        return;
      }

      setActiveJob(data.job);
      const finishedJob = await pollAiJob(data.job.id);
      if (finishedJob.status === 'failed' || !finishedJob.proposal) {
        const msg = finishedJob.error || 'تعذر إكمال طلب التطوير الذكي.';
        setErrorBanner(msg);
        notify(msg, 'error');
        return;
      }

      const prop = finishedJob.proposal;
      setActiveProposal(prop);
      setCollapsedDiffs({});
      setProposals((prev) => [prop, ...prev.filter((p) => p.id !== prop.id)]);
      setThreadHistory((prev) => [
        ...prev,
        { role: 'owner', text: userPrompt },
        { role: 'assistant', text: prop.analysis },
      ]);
      setInstruction('');

      if (executionMode === 'direct') {
        onBackupCreated?.();
        if (prop.appliedAt && !prop.autoRolledBack) {
          onFilesApplied?.();
          void loadWorkspaceData();
          bumpLivePreview();
          notify(
            `نُفّذت ${prop.changes.length} تعديلات ونجح الاختبار الآلي وتم تحديث المعاينة الحية`,
            'success'
          );
        } else if (prop.autoRolledBack) {
          const msg = 'رُصد خطأ أثناء الاختبار الآلي فتراجع النظام تلقائيًا للنسخة الآمنة السابقة';
          setErrorBanner(msg);
          notify(msg, 'error');
        } else {
          notify('تمت دراسة الطلب والإجابة الهندسية بنجاح', 'success');
        }
      } else {
        notify(
          prop.changes.length > 0
            ? `تم تحليل الطلب وتجهيز معاينة الفروقات (${prop.changes.length} ملف)`
            : 'تمت دراسة الطلب وإعداد التحليل الهندسي بنجاح',
          'success'
        );
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'فشل الاتصال بمهندس الذكاء الاصطناعي';
      setErrorBanner(msg);
      notify(msg, 'error');
    } finally {
      if (mountedRef.current) setPlanning(false);
    }
  };

  const handleSubmitPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    await runPromptRequest(instruction);
  };

  const handleAnalyzeCodebase = async () => {
    setErrorBanner(null);
    setAnalyzing(true);
    try {
      const res = await ownerFetch('/api/admin/ai/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'analyze',
          targetFile: previewPath || undefined,
        }),
      });
      const { data, rawText } = await safeReadJson<{
        ok?: boolean;
        job?: AiDeveloperJobStatus;
        error?: string;
      }>(res);
      if (!res.ok || !data?.ok || !data.job) {
        const msg = data?.error || `تعذر بدء فحص الكود (${res.status}). ${rawText.slice(0, 120)}`;
        setErrorBanner(msg);
        notify(msg, 'error');
        return;
      }

      setActiveJob(data.job);
      const finishedJob = await pollAiJob(data.job.id);
      if (finishedJob.status === 'failed' || !finishedJob.analysisReport) {
        const msg = finishedJob.error || 'تعذر إكمال فحص البنية والكود.';
        setErrorBanner(msg);
        notify(msg, 'error');
        return;
      }

      setAnalysisReport({
        report: finishedJob.analysisReport.report,
        checkedFiles: finishedJob.analysisReport.checkedFiles || [],
      });
      notify('تم إكمال فحص البنية والكود الشامل بنجاح', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل فحص الكود';
      setErrorBanner(msg);
      notify(msg, 'error');
    } finally {
      if (mountedRef.current) setAnalyzing(false);
    }
  };

  const handleRunTest = async (proposalId: string) => {
    setErrorBanner(null);
    setTesting(true);
    try {
      const res = await ownerFetch('/api/admin/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, runBuildCheck }),
      });
      const { data, rawText } = await safeReadJson<{
        ok?: boolean;
        proposal?: AiProposalRecord;
        error?: string;
      }>(res);
      if (!res.ok || !data?.ok || !data.proposal) {
        const msg = data?.error || `تعذر تشغيل الاختبار (${res.status}). ${rawText.slice(0, 120)}`;
        setErrorBanner(msg);
        notify(msg, 'error');
        return;
      }
      setActiveProposal(data.proposal);
      setProposals((prev) => prev.map((p) => (p.id === data.proposal!.id ? data.proposal! : p)));
      notify(
        data.proposal.testStatus?.passed
          ? 'نجحت اختبارات TypeScript و ESLint واختبارات الوحدات بنجاح'
          : 'رُصدت ملاحظات في الفحص البرمجي — راجع المخرجات',
        data.proposal.testStatus?.passed ? 'success' : 'error'
      );
    } catch {
      const msg = 'خطأ في الاتصال أثناء تشغيل الاختبار البرمجي.';
      setErrorBanner(msg);
      notify(msg, 'error');
    } finally {
      if (mountedRef.current) setTesting(false);
    }
  };

  const handleApplyProposal = async (proposalId: string) => {
    setErrorBanner(null);
    setApplying(true);
    try {
      const res = await ownerFetch('/api/admin/ai/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      });
      const { data, rawText } = await safeReadJson<{
        ok?: boolean;
        proposal?: AiProposalRecord;
        error?: string;
      }>(res);
      if (!res.ok || !data?.ok || !data.proposal) {
        const msg = data?.error || `تعذر اعتماد التعديل (${res.status}). ${rawText.slice(0, 120)}`;
        setErrorBanner(msg);
        notify(msg, 'error');
        return;
      }
      setActiveProposal(data.proposal);
      setProposals((prev) => prev.map((p) => (p.id === data.proposal!.id ? data.proposal! : p)));
      onBackupCreated?.();
      onFilesApplied?.();
      void loadWorkspaceData();
      bumpLivePreview();
      notify(
        `تم حفظ النسخة الاحتياطية (${data.proposal.backupId}) وتطبيق التعديلات وتحديث المعاينة الحية`,
        'success'
      );
    } catch {
      const msg = 'فشل الاتصال أثناء اعتماد وتطبيق التعديلات.';
      setErrorBanner(msg);
      notify(msg, 'error');
    } finally {
      if (mountedRef.current) setApplying(false);
    }
  };

  const handleRollbackProposalBackup = async (backupId: string) => {
    setErrorBanner(null);
    setRestoringBackup(true);
    try {
      const res = await ownerFetch('/api/admin/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId }),
      });
      const { data, rawText } = await safeReadJson<{
        ok?: boolean;
        restoredFiles?: string[];
        error?: string;
      }>(res);
      if (!res.ok || !data?.ok) {
        const msg =
          data?.error || `تعذر استرجاع النسخة الاحتياطية (${res.status}). ${rawText.slice(0, 120)}`;
        setErrorBanner(msg);
        notify(msg, 'error');
        return;
      }
      onBackupCreated?.();
      onFilesApplied?.();
      void loadWorkspaceData();
      bumpLivePreview();
      notify(
        `تم استرجاع ${data.restoredFiles?.length || 0} ملفات وتحديث المعاينة الحية`,
        'success'
      );
    } catch {
      const msg = 'فشل الاتصال أثناء استعادة النسخة الاحتياطية.';
      setErrorBanner(msg);
      notify(msg, 'error');
    } finally {
      if (mountedRef.current) setRestoringBackup(false);
    }
  };

  const filteredFiles = useMemo(
    () => filterProjectFiles(files, fileFilter, layerFilter),
    [files, fileFilter, layerFilter]
  );

  const previewIframeSrc = useMemo(
    () => buildPreviewIframeUrl(previewNonce, previewRouteHash),
    [previewNonce, previewRouteHash]
  );

  const pipelineStepIdx = activeJob
    ? getPipelineStepIndex(activeJob.kind, activeJob.phase, activeJob.status)
    : 0;

  return (
    <section aria-label="استوديو المطور الذكي AI Full-Stack Engineer" className="space-y-6">
      {/* Studio Header Bar */}
      <div className="glass-gold rounded-2xl p-5 sm:p-6 border border-[#C8A253]/30 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#C8A253]">
              <Bot className="w-4 h-4 shrink-0" />
              <span>AI Full-Stack Engineer</span>
            </span>
            <span className="text-[#A9B2AE]/50" aria-hidden="true">·</span>
            <span className="text-[#A9B2AE]">
              {aiHealth ? (aiHealth.keyConfigured ? 'المحرك جاهز ومتصل' : 'مفتاح الذكاء غير مهيأ') : 'جارٍ الفحص'}
            </span>
            <span className="text-[#A9B2AE]/50" aria-hidden="true">·</span>
            <span dir="ltr" className="font-mono text-[#A9B2AE]">
              {aiHealth?.model || 'gemini-4-hydrogen'}
            </span>
            <span className="text-[#A9B2AE]/50" aria-hidden="true">·</span>
            <span className="font-mono-nums tabular-nums text-[#A9B2AE]">
              {files.length} ملفًا في المشروع
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F5F3EE] text-balance">
            استوديو التطوير الكامل: تعديل الواجهة والخادم وقواعد البيانات مع معاينة حية
          </h2>
          <p className="text-xs text-[#A9B2AE] leading-relaxed max-w-3xl">
            يفحص المشروع بالكامل (React + Express + Firestore Rules)، وينفّذ الأوامر مباشرة مع نسخ احتياطي فوري واختبارات آلية (TypeScript + ESLint + Unit Tests) واسترجاع آمن عند الحاجة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setExecutionMode('direct');
              void runPromptRequest(
                'افحص كامل المشروع (الواجهة، الخادم، والأداء والأنواع)، وأصلح أي أخطاء TypeScript أو ثغرات أو تحذيرات متبقية وتحقق من نجاح الاختبارات 100% دون المساس بالميزات العاملة.'
              );
            }}
            disabled={analyzing || planning}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C8A253] hover:bg-[#d6b368] text-xs font-bold text-[#0A0D0C] cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 transition-colors"
          >
            <Zap className="w-4 h-4" />
            <span>فحص وإصلاح المشروع بالكامل الآن</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLivePreview((prev) => !prev)}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              showLivePreview
                ? 'bg-[#0E6B4D]/35 border-[#C8A253]/50 text-[#F5F3EE]'
                : 'bg-white/5 border-white/15 text-[#A9B2AE] hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4 text-[#C8A253]" />
            <span>{showLivePreview ? 'إخفاء المعاينة الحية' : 'عرض المعاينة الحية'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleAnalyzeCodebase()}
            disabled={analyzing || planning}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-medium text-[#F5F3EE] cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 transition-colors"
          >
            <SearchCode className="w-4 h-4 text-[#C8A253]" />
            <span>{analyzing ? 'جارٍ فحص البنية...' : 'فحص البنية والأمان'}</span>
          </button>

          <button
            type="button"
            onClick={() => void loadWorkspaceData()}
            disabled={loadingWorkspace}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#A9B2AE] hover:text-white cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingWorkspace ? 'animate-spin' : ''}`} />
            <span>تحديث الملفات</span>
          </button>
        </div>
      </div>

      {/* Main Split Grid: Explorer & File Viewer (4 cols) + Command Studio & Live Preview (8 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Column 1: Explorer & Architecture Inspector */}
        <aside className="xl:col-span-4 space-y-4">
          <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-3">
            {/* Switcher Tabs */}
            <div className="flex items-center gap-1.5 bg-[#0A0D0C] p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setExplorerTab('files')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                  explorerTab === 'files'
                    ? 'bg-[#0E6B4D] text-white'
                    : 'text-[#A9B2AE] hover:text-white'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span className="font-mono-nums tabular-nums">الملفات ({files.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setExplorerTab('arch')}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                  explorerTab === 'arch'
                    ? 'bg-[#0E6B4D] text-white'
                    : 'text-[#A9B2AE] hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>خريطة البنية</span>
              </button>
            </div>

            {explorerTab === 'files' ? (
              <>
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#A9B2AE]">
                  <span>اختر ملفات لتركيز الذكاء عليها:</span>
                  {selectedTargets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedTargets([])}
                      className="text-[#C8A253] hover:underline cursor-pointer whitespace-nowrap"
                    >
                      مسح التحديد ({selectedTargets.length})
                    </button>
                  )}
                </div>

                {/* Layer Filter Bar */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0A0D0C] border border-white/10 overflow-x-auto">
                  {LAYER_FILTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setLayerFilter(opt.id)}
                      className={`flex-1 px-2 py-1 rounded-lg text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                        layerFilter === opt.id
                          ? 'bg-[#C8A253]/25 text-[#F5F3EE]'
                          : 'text-[#A9B2AE] hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  dir="ltr"
                  aria-label="تصفية ملفات المشروع"
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                  placeholder="Filter files (e.g. Reciters, server.ts, rules)..."
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/10 text-xs text-[#F5F3EE] placeholder:text-[#A9B2AE]/50 focus:border-[#C8A253] outline-none"
                />

                {loadingWorkspace && files.length === 0 ? (
                  <div className="space-y-2 py-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className="h-8 rounded-lg bg-white/5 animate-pulse" />
                    ))}
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#0A0D0C]/60 border border-white/10 text-center space-y-2">
                    <p className="text-xs text-[#A9B2AE]">لا توجد ملفات مطابقة للبحث الحالي.</p>
                    {(fileFilter || layerFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setFileFilter('');
                          setLayerFilter('all');
                        }}
                        className="text-xs text-[#C8A253] hover:underline cursor-pointer"
                      >
                        عرض جميع الملفات
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                    {filteredFiles.map((f) => {
                      const checked = selectedTargets.includes(f.path);
                      const viewing = previewPath === f.path;
                      return (
                        <div
                          key={f.path}
                          className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                            viewing
                              ? 'bg-[#0E6B4D]/30 border border-[#0E6B4D]/60'
                              : 'border border-transparent hover:bg-white/5'
                          }`}
                        >
                          <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTargetFile(f.path)}
                              aria-label={`تحديد ${f.path} كملف مستهدف`}
                              className="accent-[#C8A253] rounded cursor-pointer shrink-0"
                            />
                            <span dir="ltr" className="truncate font-mono text-[11px] text-[#F5F3EE]">
                              {f.path}
                            </span>
                          </label>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              dir="ltr"
                              className="text-[10px] font-mono tabular-nums text-[#A9B2AE]/80"
                            >
                              {formatBytesCompact(f.sizeBytes)}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handlePreviewFile(f.path)}
                              aria-label={`عرض ${f.path}`}
                              className="p-1.5 rounded-md text-[#A9B2AE] hover:text-[#C8A253] hover:bg-white/5 cursor-pointer shrink-0"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                {architecture ? (
                  (
                    [
                      ['صفحات الواجهة (Pages)', architecture.layers.pages],
                      ['المكونات المشتركة (Components)', architecture.layers.components],
                      ['السياقات والخدمات (Contexts & APIs)', architecture.layers.contextsAndServices],
                      ['المنطق والبيانات (Utils & Data)', architecture.layers.utilsAndData],
                      ['الخادم والأمان (Express & Security)', architecture.layers.backendAndSecurity],
                      ['قواعد البيانات والإعداد (Firestore & Config)', architecture.layers.databaseAndConfig],
                    ] as const
                  ).map(([layerTitle, layerFiles]) => (
                    <div key={layerTitle} className="space-y-1">
                      <p className="text-[11px] font-semibold text-[#C8A253] flex items-center justify-between">
                        <span>{layerTitle}</span>
                        <span className="font-mono-nums tabular-nums opacity-80">
                          {layerFiles.length}
                        </span>
                      </p>
                      <div className="space-y-0.5">
                        {layerFiles.map((filePath) => (
                          <button
                            key={filePath}
                            type="button"
                            onClick={() => void handlePreviewFile(filePath)}
                            dir="ltr"
                            className="w-full text-left px-2 py-1 rounded hover:bg-white/5 font-mono text-[11px] text-[#A9B2AE] hover:text-[#F5F3EE] truncate cursor-pointer"
                          >
                            {filePath}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#A9B2AE]">جارٍ تحليل خريطة البنية...</p>
                )}
              </div>
            )}
          </div>

          {/* Code Viewer Card */}
          {previewPath && (
            <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileCode2 className="w-4 h-4 text-[#C8A253] shrink-0" />
                  <span dir="ltr" className="text-xs font-mono text-[#F5F3EE] truncate">
                    {previewPath}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleTargetFile(previewPath)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-medium cursor-pointer border whitespace-nowrap ${
                      selectedTargets.includes(previewPath)
                        ? 'bg-[#0E6B4D]/40 border-[#0E6B4D] text-emerald-200'
                        : 'bg-white/5 border-white/10 text-[#A9B2AE] hover:text-white'
                    }`}
                  >
                    {selectedTargets.includes(previewPath) ? 'مستهدف ✓' : 'تركيز'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void copyToClipboard('file-preview', previewContent, `محتوى ${previewPath}`)
                    }
                    aria-label={`نسخ محتوى ${previewPath}`}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#A9B2AE] hover:text-white cursor-pointer"
                  >
                    {copiedKey === 'file-preview' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPath(null)}
                    aria-label="إغلاق معاينة الملف"
                    className="p-1.5 rounded-lg text-[#A9B2AE] hover:text-white hover:bg-white/5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {!loadingFile && previewContent && (
                <div className="flex items-center justify-between text-[10px] text-[#A9B2AE]">
                  <span className="font-mono-nums tabular-nums">
                    {previewContent.split('\n').length} سطر ·{' '}
                    {formatBytesCompact(previewContent.length)}
                  </span>
                  {previewContent.length > 16000 && (
                    <span>يعرض أول ١٦٬٠٠٠ حرف</span>
                  )}
                </div>
              )}

              <pre
                dir="ltr"
                className="max-h-64 overflow-auto p-3 rounded-xl bg-[#070908] border border-white/10 text-[11px] font-mono text-[#A9B2AE] leading-relaxed whitespace-pre-wrap"
              >
                {loadingFile ? 'Loading...' : previewContent.slice(0, 16000)}
              </pre>
            </div>
          )}
        </aside>

        {/* Column 2: Command Console, Pipeline, Diffs, Analysis & Live Preview */}
        <div className="xl:col-span-8 space-y-5 min-w-0">
          {/* Threaded Conversation History (when active) */}
          {threadHistory.length > 0 && (
            <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#C8A253]">
                  سياق الجلسة الهندسية ({Math.floor(threadHistory.length / 2)} رسالة)
                </span>
                <button
                  type="button"
                  onClick={() => setThreadHistory([])}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-[#A9B2AE] hover:text-white cursor-pointer"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5 text-[#C8A253]" />
                  <span>جلسة جديدة</span>
                </button>
              </div>
              <div className="max-h-44 overflow-y-auto space-y-2 pr-1">
                {threadHistory.map((turn, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                      turn.role === 'owner'
                        ? 'bg-[#0E6B4D]/20 border border-[#0E6B4D]/40 text-[#F5F3EE]'
                        : 'bg-[#0A0D0C]/80 border border-white/10 text-[#A9B2AE]'
                    }`}
                  >
                    <span className="font-semibold text-[11px] text-[#C8A253] ml-2">
                      {turn.role === 'owner' ? 'أنت:' : 'المهندس:'}
                    </span>
                    <span className="whitespace-pre-wrap">{turn.text.slice(0, 320)}{turn.text.length > 320 ? '…' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request Form */}
          <form
            onSubmit={handleSubmitPrompt}
            className="glass-panel rounded-2xl p-5 border border-white/10 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="ai-dev-prompt"
                className="text-sm font-semibold text-[#F5F3EE] flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-[#C8A253]" />
                <span>أمر التطوير الهندسي المباشر (Full-Stack Command)</span>
              </label>
              <span className="text-[11px] text-[#A9B2AE]">
                اختصار الإرسال: <kbd dir="ltr" className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[10px]">Ctrl + Enter</kbd>
              </span>
            </div>

            {/* Selected Target Files Interactive Strip (Unbounded) */}
            {selectedTargets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-[#0A0D0C]/80 border border-white/10">
                <span className="text-[11px] text-[#C8A253] ml-1">
                  ملفات التركيز ({selectedTargets.length}):
                </span>
                {selectedTargets.map((target) => (
                  <button
                    key={target}
                    type="button"
                    onClick={() => toggleTargetFile(target)}
                    aria-label={`إزالة ${target} من ملفات التركيز`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0E6B4D]/30 border border-[#0E6B4D]/60 text-[11px] font-mono text-[#F5F3EE] hover:bg-rose-950/50 hover:border-rose-500/40 cursor-pointer transition-colors"
                  >
                    <span dir="ltr">{target}</span>
                    <X className="w-3 h-3 opacity-80" />
                  </button>
                ))}
                {selectedTargets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSelectedTargets([])}
                    className="text-[11px] text-[#A9B2AE] hover:text-white underline mr-1 cursor-pointer whitespace-nowrap"
                  >
                    مسح الكل
                  </button>
                )}
              </div>
            )}

            {/* Execution Mode & Thinking Power Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setExecutionMode('direct')}
                className={`text-right p-3 rounded-xl border transition-colors cursor-pointer flex items-start gap-2.5 ${
                  executionMode === 'direct'
                    ? 'bg-[#0E6B4D]/25 border-[#C8A253]/60 text-[#F5F3EE]'
                    : 'bg-[#0A0D0C]/70 border-white/10 text-[#A9B2AE] hover:text-white'
                }`}
              >
                <Zap className="w-4 h-4 text-[#C8A253] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold">تنفيذ مباشر واختبار فوري (AI Engineer)</p>
                  <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">
                    يكتب التعديلات فعليًا + يحفظ نسخة احتياطية + يشغّل tsc و lint والاختبارات + يحدّث المعاينة الحية
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setExecutionMode('plan')}
                className={`text-right p-3 rounded-xl border transition-colors cursor-pointer flex items-start gap-2.5 ${
                  executionMode === 'plan'
                    ? 'bg-[#0E6B4D]/25 border-[#C8A253]/60 text-[#F5F3EE]'
                    : 'bg-[#0A0D0C]/70 border-white/10 text-[#A9B2AE] hover:text-white'
                }`}
              >
                <Code2 className="w-4 h-4 text-[#C8A253] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold">تجهيز خطة ومعاينة الفروقات أولًا</p>
                  <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">
                    يحضّر التعديلات ويعرض الفروقات سطرًا بسطر لتراجعها وتختبرها ثم تضغط اعتماد يدويًا
                  </p>
                </div>
              </button>
            </div>

            {/* Thinking Depth Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0A0D0C]/70 border border-white/10">
              <span className="text-[11px] font-semibold text-[#C8A253]">
                درجة السرعة والعمق الهندسي:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {AI_THINKING_POWER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.hintAr}
                    onClick={() => setThinkingPower(opt.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer whitespace-nowrap transition-colors ${
                      thinkingPower === opt.id
                        ? 'bg-[#C8A253] text-[#0A0D0C] font-bold'
                        : 'bg-white/5 text-[#A9B2AE] hover:text-white'
                    }`}
                  >
                    {opt.labelAr}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              id="ai-dev-prompt"
              rows={3}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !planning && !analyzing) {
                  e.preventDefault();
                  void runPromptRequest(instruction);
                }
              }}
              placeholder="مثال: طوّر واجهة صفحة القراء، أو أضف ميزة جديدة كاملة في الواجهة والخادم، أو أصلح أي خطأ وحدّث firestore.rules..."
              className="w-full p-3.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE] placeholder:text-[#A9B2AE]/50 focus:border-[#C8A253] outline-none"
            />

            {executionMode === 'direct' && (
              <div className="flex flex-wrap gap-4 text-xs text-[#F5F3EE]">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rollbackOnFailure}
                    onChange={(e) => setRollbackOnFailure(e.target.checked)}
                    className="w-4 h-4 accent-[#C8A253]"
                  />
                  <span>استرجاع تلقائي للنسخة الاحتياطية عند فشل الاختبار</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={runBuildCheck}
                    onChange={(e) => setRunBuildCheck(e.target.checked)}
                    className="w-4 h-4 accent-[#C8A253]"
                  />
                  <span>فحص البناء الإنتاجي الكامل (npm run build)</span>
                </label>
              </div>
            )}

            {/* Single-line Preset Prompts */}
            <div className="flex flex-wrap gap-2">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setInstruction(preset.prompt)}
                  className="text-[11px] px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[#A9B2AE] hover:text-[#F5F3EE] cursor-pointer whitespace-nowrap transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-[#A9B2AE]">
                {executionMode === 'direct'
                  ? 'يعمل النظام بنسخ احتياطي تلقائي قبل أي كتابة، مع إمكانية التراجع بنقرة واحدة.'
                  : 'لن يتم تعديل أي ملف فعليًا إلا بعد معاينة الفروقات (Diff) والضغط على زر الاعتماد.'}
              </p>
              <button
                type="submit"
                disabled={planning || analyzing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] disabled:opacity-60 text-xs sm:text-sm font-semibold text-[#F5F3EE] shadow-md cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                {executionMode === 'direct' ? (
                  <Zap className="w-4 h-4 text-[#C8A253]" />
                ) : (
                  <Code2 className="w-4 h-4 text-[#C8A253]" />
                )}
                <span>
                  {planning
                    ? executionMode === 'direct'
                      ? 'جارٍ التنفيذ والاختبار الآلي...'
                      : 'جارٍ التحليل وتجهيز الكود...'
                    : executionMode === 'direct'
                    ? 'تنفيذ مباشر واختبار (AI Engineer)'
                    : 'تحليل وتوليد الخطة (AI)'}
                </span>
              </button>
            </div>

            {aiHealth && !aiHealth.keyConfigured && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200 leading-relaxed"
              >
                تنبيه: مفتاح GEMINI_API_KEY غير مهيأ حاليًا في بيئة الخادم. أضف المفتاح في لوحة الأسرار (Secrets) ثم أعد تشغيل الخادم لتفعيل المطور الذكي.
              </div>
            )}

            {/* Live 4-Stage Pipeline Tracker */}
            {(planning || analyzing) && activeJob && (
              <div className="p-4 rounded-xl bg-[#0E6B4D]/15 border border-[#C8A253]/35 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#C8A253] flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>{activeJob.phase}</span>
                  </span>
                  <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-[#A9B2AE]">
                    <span>{formatElapsedTimer(elapsedSeconds)}</span>
                    <span aria-hidden="true">·</span>
                    <span dir="ltr">{aiHealth?.model || 'gemini-4-hydrogen'}</span>
                  </div>
                </div>

                {/* 4-Step Pipeline Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {AI_DEV_PIPELINE_STEPS.map((stepLabel, idx) => {
                    const done = idx < pipelineStepIdx;
                    const active = idx === pipelineStepIdx;
                    return (
                      <div
                        key={stepLabel}
                        className={`px-2.5 py-2 rounded-lg border text-[11px] flex items-center gap-1.5 ${
                          active
                            ? 'bg-[#0E6B4D]/35 border-[#C8A253]/60 text-[#F5F3EE] font-semibold'
                            : done
                            ? 'bg-emerald-950/40 border-emerald-500/35 text-emerald-200'
                            : 'bg-[#0A0D0C]/50 border-white/10 text-[#A9B2AE]/70'
                        }`}
                      >
                        <span className="font-mono-nums tabular-nums text-[10px]">
                          {done ? '✓' : `${idx + 1}.`}
                        </span>
                        <span className="truncate">{stepLabel}</span>
                      </div>
                    );
                  })}
                </div>

                {activeJob.logs.length > 0 && (
                  <div
                    dir="ltr"
                    className="max-h-24 overflow-auto text-[11px] font-mono text-[#A9B2AE] space-y-0.5 pt-1 border-t border-white/10"
                  >
                    {activeJob.logs.slice(-6).map((line, i) => (
                      <div key={i} className="truncate">
                        &gt; {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Resilient Error Banner with Retry */}
            {errorBanner && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 flex flex-wrap items-start justify-between gap-3 text-xs text-rose-200"
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorBanner}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {lastSubmittedPrompt && !planning && !analyzing && (
                    <button
                      type="button"
                      onClick={() => void runPromptRequest(lastSubmittedPrompt)}
                      className="px-2.5 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800/70 text-[11px] text-white cursor-pointer whitespace-nowrap"
                    >
                      إعادة المحاولة
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setErrorBanner(null)}
                    className="text-[11px] text-rose-300 hover:text-white cursor-pointer whitespace-nowrap"
                  >
                    إخفاء
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Codebase Analysis Report */}
          {analysisReport && (
            <div className="glass-panel rounded-2xl p-5 border border-[#C8A253]/30 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#C8A253] flex items-center gap-2">
                  <SearchCode className="w-4 h-4" />
                  <span>تقرير فحص البنية والأمان الشامل</span>
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void copyToClipboard('analysis-report', analysisReport.report, 'التقرير')
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-[#A9B2AE] hover:text-white cursor-pointer"
                  >
                    {copiedKey === 'analysis-report' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>نسخ التقرير</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisReport(null)}
                    className="text-xs text-[#A9B2AE] hover:text-white cursor-pointer"
                  >
                    إخفاء
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-[#A9B2AE]" dir="ltr">
                Checked: {analysisReport.checkedFiles.join(', ')}
              </p>
              <div className="p-4 rounded-xl bg-[#0A0D0C] border border-white/10 text-xs text-[#F5F3EE] leading-relaxed whitespace-pre-wrap">
                {analysisReport.report}
              </div>
            </div>
          )}

          {/* Active Proposal Execution / Verification / Diff Review */}
          {activeProposal && (
            <div className="glass-panel rounded-2xl p-5 border border-[#C8A253]/30 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                    <span className="font-bold text-[#C8A253]">
                      {activeProposal.executionMode === 'direct'
                        ? 'نتيجة التنفيذ المباشر'
                        : 'معاينة التعديلات المقترحة'}
                    </span>
                    <span className="text-[#A9B2AE]/50" aria-hidden="true">·</span>
                    <span
                      className={
                        activeProposal.riskLevel === 'high'
                          ? 'text-rose-300 font-medium'
                          : activeProposal.riskLevel === 'medium'
                          ? 'text-amber-300 font-medium'
                          : 'text-emerald-300 font-medium'
                      }
                    >
                      المخاطرة:{' '}
                      {activeProposal.riskLevel === 'high'
                        ? 'مرتفعة'
                        : activeProposal.riskLevel === 'medium'
                        ? 'متوسطة'
                        : 'منخفضة'}
                    </span>
                    {activeProposal.appliedAt && !activeProposal.autoRolledBack && (
                      <>
                        <span className="text-[#A9B2AE]/50" aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>مُطبّق فعليًا في المشروع</span>
                        </span>
                      </>
                    )}
                    {activeProposal.autoRolledBack && (
                      <>
                        <span className="text-[#A9B2AE]/50" aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>تراجع تلقائي آمن</span>
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-[#F5F3EE] font-medium leading-relaxed">
                    {activeProposal.instruction}
                  </p>
                </div>

                {/* Action buttons */}
                {activeProposal.changes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {activeProposal.backupId &&
                      activeProposal.appliedAt &&
                      !activeProposal.autoRolledBack && (
                        <button
                          type="button"
                          onClick={() => void handleRollbackProposalBackup(activeProposal.backupId!)}
                          disabled={restoringBackup}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-400/35 text-xs font-semibold text-amber-200 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>
                            {restoringBackup ? 'جارٍ التراجع...' : 'تراجع فوري للنسخة السابقة'}
                          </span>
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => void handleRunTest(activeProposal.id)}
                      disabled={testing}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-medium text-[#F5F3EE] cursor-pointer disabled:opacity-60 whitespace-nowrap"
                    >
                      <FlaskConical className="w-3.5 h-3.5 text-[#C8A253]" />
                      <span>{testing ? 'جارٍ الاختبار...' : 'اختبار (tsc + lint + tests)'}</span>
                    </button>
                    {!activeProposal.appliedAt && (
                      <button
                        type="button"
                        onClick={() => void handleApplyProposal(activeProposal.id)}
                        disabled={applying}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs font-semibold text-[#F5F3EE] shadow cursor-pointer disabled:opacity-60 whitespace-nowrap"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>
                          {applying ? 'جارٍ التطبيق...' : 'حفظ نسخة وتطبيق التعديل'}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Technical Explanation & Executed Tools */}
              <div className="p-4 rounded-xl bg-[#0A0D0C]/80 border border-white/10 space-y-3">
                <p className="text-xs text-[#F5F3EE] leading-relaxed whitespace-pre-wrap">
                  {activeProposal.analysis}
                </p>
                {activeProposal.executedTools && activeProposal.executedTools.length > 0 && (
                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#A9B2AE]">
                    <span className="inline-flex items-center gap-1 text-[#C8A253] font-medium">
                      <Wrench className="w-3 h-3" />
                      <span>أدوات التنفيذ ({activeProposal.executedTools.length}):</span>
                    </span>
                    {activeProposal.executedTools.map((t, idx) => (
                      <span key={`${t}_${idx}`} dir="ltr" className="font-mono text-[10px]">
                        {t}
                        {idx < activeProposal.executedTools!.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Test & Build Output Console */}
              {(activeProposal.testStatus || activeProposal.buildStatus) && (
                <div className="space-y-2.5">
                  {activeProposal.testStatus && (
                    <div
                      className={`p-4 rounded-xl border space-y-2 ${
                        activeProposal.testStatus.passed
                          ? 'bg-emerald-950/35 border-emerald-500/35'
                          : 'bg-rose-950/35 border-rose-500/35'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                          {activeProposal.testStatus.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <ShieldAlert className="w-4 h-4 text-rose-400" />
                          )}
                          <span>
                            {activeProposal.testStatus.passed
                              ? 'فحص TypeScript و ESLint والوحدات: ناجح 100%'
                              : 'فحص TypeScript أو الاختبارات: رُصدت أخطاء'}
                          </span>
                        </span>
                        <span className="text-[11px] text-[#A9B2AE] font-mono tabular-nums" dir="ltr">
                          {new Date(activeProposal.testStatus.ranAt).toLocaleTimeString('en-GB')}
                        </span>
                      </div>
                      <pre
                        dir="ltr"
                        className="text-[11px] font-mono text-[#A9B2AE] overflow-auto max-h-36 whitespace-pre-wrap"
                      >
                        {[activeProposal.testStatus.tscOutput, activeProposal.testStatus.testsOutput]
                          .filter(Boolean)
                          .join('\n\n')}
                      </pre>
                    </div>
                  )}

                  {activeProposal.buildStatus && (
                    <div
                      className={`p-3.5 rounded-xl border space-y-1.5 ${
                        activeProposal.buildStatus.passed
                          ? 'bg-emerald-950/25 border-emerald-500/30'
                          : 'bg-rose-950/30 border-rose-500/35'
                      }`}
                    >
                      <p className="text-xs font-semibold text-[#F5F3EE]">
                        {activeProposal.buildStatus.passed
                          ? 'نجح البناء الإنتاجي الكامل (npm run build)'
                          : 'فشل البناء الإنتاجي (npm run build)'}
                      </p>
                      <pre
                        dir="ltr"
                        className="text-[11px] font-mono text-[#A9B2AE] overflow-auto max-h-28 whitespace-pre-wrap"
                      >
                        {activeProposal.buildStatus.output}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Before / After Diffs per file with +/- stats and collapse control */}
              {activeProposal.changes.length === 0 ? (
                <p className="text-xs text-[#A9B2AE]">
                  لم يتطلب التقرير تعديل أي ملفات — تم الاكتفاء بالتحليل الهندسي.
                </p>
              ) : (
                <div className="space-y-4">
                  {activeProposal.changes.map((ch) => {
                    const diffStats = countDiffStats(ch.diffLines);
                    const collapsed = Boolean(collapsedDiffs[ch.filePath]);
                    return (
                      <div
                        key={ch.filePath}
                        className="rounded-2xl border border-white/10 overflow-hidden bg-[#070908]"
                      >
                        <div className="px-4 py-2.5 bg-[#121715] border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-[10px] font-mono uppercase shrink-0 ${
                                ch.action === 'create'
                                  ? 'text-emerald-300'
                                  : ch.action === 'delete'
                                  ? 'text-rose-300'
                                  : 'text-[#C8A253]'
                              }`}
                            >
                              [{ch.action}]
                            </span>
                            <span dir="ltr" className="text-xs font-mono text-[#F5F3EE] truncate">
                              {ch.filePath}
                            </span>
                            <span
                              dir="ltr"
                              className="text-[11px] font-mono tabular-nums text-[#A9B2AE] shrink-0"
                            >
                              <span className="text-emerald-400">+{diffStats.additions}</span>
                              {' / '}
                              <span className="text-rose-400">-{diffStats.deletions}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-[#A9B2AE] hidden sm:inline">
                              {ch.summary}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedDiffs((prev) => ({
                                  ...prev,
                                  [ch.filePath]: !prev[ch.filePath],
                                }))
                              }
                              aria-label={
                                collapsed
                                  ? `توسيع الفروقات لـ ${ch.filePath}`
                                  : `طي الفروقات لـ ${ch.filePath}`
                              }
                              className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-[#A9B2AE] hover:text-white cursor-pointer"
                            >
                              {collapsed ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronUp className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {!collapsed && (
                          <div
                            dir="ltr"
                            className="max-h-72 overflow-auto font-mono text-[11px] leading-relaxed"
                          >
                            {ch.diffLines.length === 0 ? (
                              <p className="p-3 text-[#A9B2AE]">
                                {ch.action === 'create'
                                  ? `New file (${ch.afterContent.split('\n').length} lines)`
                                  : ch.action === 'delete'
                                  ? 'File deleted (backup snapshot saved automatically)'
                                  : 'File updated'}
                              </p>
                            ) : (
                              ch.diffLines.map((line, i) => (
                                <div
                                  key={i}
                                  className={`px-3 py-0.5 flex gap-3 ${
                                    line.type === 'add'
                                      ? 'bg-emerald-950/55 text-emerald-200'
                                      : line.type === 'remove'
                                      ? 'bg-rose-950/55 text-rose-200'
                                      : 'text-[#A9B2AE]/70'
                                  }`}
                                >
                                  <span className="w-8 shrink-0 text-right opacity-50 select-none tabular-nums">
                                    {line.lineNumberBefore ?? line.lineNumberAfter ?? ''}
                                  </span>
                                  <span className="w-3 shrink-0 select-none">
                                    {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                                  </span>
                                  <span className="whitespace-pre-wrap break-all">{line.text}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Embedded Interactive Live App Preview */}
          {showLivePreview && (
            <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-[#C8A253]/25 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-[#C8A253]" />
                  <h3 className="text-sm font-bold text-[#F5F3EE]">
                    معاينة حية تفاعلية للموقع (Live App Preview)
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap items-center gap-1 bg-[#0A0D0C] p-1 rounded-xl border border-white/10">
                    {PREVIEW_ROUTES.map((r) => (
                      <button
                        key={r.hash}
                        type="button"
                        onClick={() => setPreviewRouteHash(r.hash)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap ${
                          previewRouteHash === r.hash
                            ? 'bg-[#0E6B4D] text-white'
                            : 'text-[#A9B2AE] hover:text-white'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 bg-[#0A0D0C] p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setPreviewViewport('desktop')}
                      aria-label="معاينة سطح المكتب"
                      className={`p-1.5 rounded-lg cursor-pointer ${
                        previewViewport === 'desktop'
                          ? 'bg-[#C8A253]/25 text-[#C8A253]'
                          : 'text-[#A9B2AE]'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewViewport('mobile')}
                      aria-label="معاينة الجوال"
                      className={`p-1.5 rounded-lg cursor-pointer ${
                        previewViewport === 'mobile'
                          ? 'bg-[#C8A253]/25 text-[#C8A253]'
                          : 'text-[#A9B2AE]'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={bumpLivePreview}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-[#F5F3EE] cursor-pointer whitespace-nowrap"
                  >
                    <RefreshCw className="w-3 h-3 text-[#C8A253]" />
                    <span>تحديث</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-center bg-[#070908] rounded-xl p-2 border border-white/10 overflow-hidden">
                <iframe
                  title="معاينة تطبيق تلاوة المباشرة"
                  src={previewIframeSrc}
                  className={`bg-[#0A0D0C] rounded-lg border border-white/10 transition-all ${
                    previewViewport === 'mobile'
                      ? 'w-[390px] max-w-full h-[540px]'
                      : 'w-full h-[520px]'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Previous Proposals List (Unbounded with toggle) */}
          {proposals.length > 0 && (
            <div className="glass-panel rounded-2xl p-4 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-[#C8A253] flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  <span className="font-mono-nums tabular-nums">
                    سجل عمليات AI Full-Stack Engineer ({proposals.length})
                  </span>
                </h3>
                {proposals.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllProposals((v) => !v)}
                    className="text-[11px] text-[#C8A253] hover:underline cursor-pointer whitespace-nowrap"
                  >
                    {showAllProposals ? 'عرض آخر ٦ فقط' : `عرض كامل السجل (${proposals.length})`}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(showAllProposals ? proposals : proposals.slice(0, 6)).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setActiveProposal(p);
                      setCollapsedDiffs({});
                    }}
                    className={`text-right p-3 rounded-xl border transition-colors cursor-pointer ${
                      activeProposal?.id === p.id
                        ? 'bg-[#0E6B4D]/25 border-[#C8A253]/50'
                        : 'bg-[#0A0D0C]/70 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <p className="text-xs font-medium text-[#F5F3EE] truncate">{p.instruction}</p>
                    <p className="text-[11px] text-[#A9B2AE] mt-1 font-mono-nums tabular-nums">
                      {p.changes.length} ملف ·{' '}
                      {p.autoRolledBack
                        ? 'تراجع تلقائي'
                        : p.appliedAt
                        ? 'مُطبّق فعليًا'
                        : 'مسودة للمعاينة'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
