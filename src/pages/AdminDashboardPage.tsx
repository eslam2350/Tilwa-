import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArchiveRestore,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Award,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Bot,
  Check,
  CloudUpload,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FileText,
  Globe,
  GraduationCap,
  HardDrive,
  History,
  LayoutList,
  LogOut,
  MessageSquareHeart,
  Mic,
  Palette,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Type,
  Users,
  Volume2,
  Wifi,
} from 'lucide-react';
import { AdminBasiraTab } from '../components/AdminBasiraTab';
import { AdminFeedbackTab } from '../components/AdminFeedbackTab';
import { AiDeveloperWorkspace } from '../components/AiDeveloperWorkspace';
import { CertificatePreviewCard } from '../components/CertificateModal';
import { OwnerLoginGate } from '../components/OwnerLoginGate';
import { useAppData } from '../contexts/AppDataContext';
import { useDynamicConfig } from '../contexts/DynamicConfigContext';
import { CANONICAL_RECITERS, HERO_BACKDROP_URL } from '../data/reciters';
import {
  deleteAdminReciter,
  fetchRawCustomReciters,
  upsertAdminReciter,
} from '../services/storeService';
import type {
  AnalyticsSummary,
  AppRoute,
  AuditLogEntry,
  AudioProbeResult,
  BackupSnapshotMeta,
  CertificateTemplateId,
  DynamicAppConfig,
  Reciter,
  SectionEnhancementConfig,
  SectionEnhancementId,
} from '../types/tilawa';
import { BASIRA_CATEGORIES } from '../utils/basiraHelpers';
import { type CertificateCategory, evaluateCertificates } from '../utils/certificateHelpers';
import {
  downloadCertificatePdf,
  downloadCertificatePng,
  renderCertificateToDataUrl,
} from '../utils/certificateRenderer';
import {
  CERTIFICATE_TEMPLATES,
  DEFAULT_AUDIO_PLAYER,
  DEFAULT_CERTIFICATES,
  DEFAULT_GENERAL,
  DEFAULT_MUSHAF,
  DEFAULT_PERFORMANCE,
  DEFAULT_SECTION_ENHANCEMENT_ITEM,
  DEFAULT_SECTION_ENHANCEMENTS,
  DEFAULT_SECURITY,
  DEFAULT_SEO,
  DEFAULT_TAHFEEZ,
  DEFAULT_TYPOGRAPHY,
  SECTION_ENHANCEMENT_TARGETS,
  SECTION_STYLE_PRESETS,
  getConfigChangedSections,
  mergeDynamicConfig,
  moveOrderedItem,
  THEME_PRESETS,
} from '../utils/dynamicConfigHelpers';
import {
  buildSurahAudioUrl,
  getDefaultPlayableSurahNumber,
  isBlockedReciter,
  toArabicDigits,
} from '../utils/quranHelpers';
import { TEACHER_RECITERS } from '../utils/tahfeezHelpers';

interface AdminDashboardPageProps {
  navigate: (next: AppRoute) => void;
}

type AdminTab =
  | 'overview'
  | 'sections-boost'
  | 'basira'
  | 'certificates-quran'
  | 'ai-dev'
  | 'content'
  | 'reciters'
  | 'design'
  | 'player'
  | 'seo-perf'
  | 'security'
  | 'feedback'
  | 'audit-backups';

interface BatchProbeItem {
  id: string;
  label: string;
  kind: string;
  url: string;
  result?: AudioProbeResult;
}

type AdminTabGroup = 'all' | 'content-media' | 'design-system' | 'ai-security';

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ navigate }) => {
  const {
    config,
    publishedConfig,
    hasLocalPreview,
    isCheckingRemote,
    lastSyncedAt,
    remoteConnected,
    ownerAuth,
    androidOta,
    signOutAdmin,
    revokeAllOwnerSessions,
    ownerFetch,
    checkRemoteConfigNow,
    triggerAndroidOtaCheck,
    applyAndroidOtaUpdate,
    resetAndroidEmbeddedBundle,
    saveLocalPreview,
    clearLocalPreview,
    publishConfigToServer,
    resetServerToDefault,
  } = useDynamicConfig();
  const { reciters, basiraPreachers, basiraEpisodes, basiraPlaylists, notify, refreshCatalog } =
    useAppData();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [tabGroup, setTabGroup] = useState<AdminTabGroup>('all');
  const [selectedBoostSectionId, setSelectedBoostSectionId] =
    useState<SectionEnhancementId>('hero');
  const [draft, setDraft] = useState<DynamicAppConfig>(() => config);
  const [isPublishing, setIsPublishing] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const commandInputRef = React.useRef<HTMLInputElement | null>(null);
  const quickPublishRef = React.useRef<() => void>(() => {});

  // System Health & Certificate Studio Preview state
  const [certPreviewRecipient, setCertPreviewRecipient] = useState('أحمد بن عبد الله المنصوري');
  const [certPreviewCategory, setCertPreviewCategory] =
    useState<CertificateCategory>('juz_memorization');
  const [certRenderedPngUrl, setCertRenderedPngUrl] = useState('');
  const [certRenderingPng, setCertRenderingPng] = useState(false);
  const [batchProbing, setBatchProbing] = useState(false);
  const [batchProbeResults, setBatchProbeResults] = useState<BatchProbeItem[]>([]);

  // Analytics, Audit & Backups state
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [backups, setBackups] = useState<BackupSnapshotMeta[]>([]);
  const [loadingAdminData, setLoadingAdminData] = useState(false);
  const [manualBackupLabel, setManualBackupLabel] = useState('');
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Reciters & Audio Probe state
  const [reciterSearch, setReciterSearch] = useState('');
  const [probeUrl, setProbeUrl] = useState(
    'https://archive.org/download/KamelYoussefAlBahtimi_201809/001.mp3'
  );
  const [probingAudio, setProbingAudio] = useState(false);
  const [probeResult, setProbeResult] = useState<AudioProbeResult | null>(null);

  // Optional Firestore custom reciter form
  const [newReciterId, setNewReciterId] = useState('');
  const [newReciterNameAr, setNewReciterNameAr] = useState('');
  const [newReciterNameEn, setNewReciterNameEn] = useState('');
  const [newReciterTitleAr, setNewReciterTitleAr] = useState('');
  const [newReciterBioAr, setNewReciterBioAr] = useState('');
  const [newReciterPhotoUrl, setNewReciterPhotoUrl] = useState('');
  const [isSavingReciter, setIsSavingReciter] = useState(false);
  const [serverReciters, setServerReciters] = useState<Reciter[]>([]);

  // Security tags temp inputs
  const [newBlockedKeyword, setNewBlockedKeyword] = useState('');
  const [newAllowedDomain, setNewAllowedDomain] = useState('');

  useEffect(() => {
    setDraft(config);
  }, [config]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        commandInputRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        quickPublishRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const loadAnalytics = useCallback(async () => {
    if (!ownerAuth.authenticated) return;
    try {
      const res = await ownerFetch('/api/admin/analytics');
      if (res.ok) {
        const data = (await res.json()) as { analytics?: AnalyticsSummary };
        if (data.analytics) setAnalytics(data.analytics);
      }
    } catch {
      // ignore transient analytics fetch errors
    }
  }, [ownerAuth.authenticated, ownerFetch]);

  const loadAuditAndBackups = useCallback(async () => {
    if (!ownerAuth.authenticated) return;
    setLoadingAdminData(true);
    try {
      const [auditRes, backupRes] = await Promise.all([
        ownerFetch('/api/admin/audit'),
        ownerFetch('/api/admin/backups'),
      ]);
      if (auditRes.ok) {
        const aData = (await auditRes.json()) as { logs?: AuditLogEntry[] };
        setAuditLogs(aData.logs || []);
      }
      if (backupRes.ok) {
        const bData = (await backupRes.json()) as { backups?: BackupSnapshotMeta[] };
        setBackups(bData.backups || []);
      }
    } finally {
      setLoadingAdminData(false);
    }
  }, [ownerAuth.authenticated, ownerFetch]);

  const loadServerReciters = useCallback(async () => {
    try {
      const list = await fetchRawCustomReciters();
      setServerReciters(list);
    } catch {
      setServerReciters([]);
    }
  }, []);

  useEffect(() => {
    if (!ownerAuth.authenticated) return;
    void loadAnalytics();
    void loadAuditAndBackups();
    void loadServerReciters();
  }, [ownerAuth.authenticated, loadAnalytics, loadAuditAndBackups, loadServerReciters]);

  // STRICT AUTH GATE: Unauthenticated visitors ONLY see Email Owner Login Gate
  if (!ownerAuth.checked) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="glass-panel rounded-2xl px-6 py-4 text-xs text-[#A9B2AE]">
          جارٍ التحقق من الجلسة...
        </div>
      </main>
    );
  }

  if (!ownerAuth.authenticated) {
    return <OwnerLoginGate navigate={navigate} />;
  }

  const typo = draft.typography || DEFAULT_TYPOGRAPHY;
  const ply = draft.audioPlayer || DEFAULT_AUDIO_PLAYER;
  const seo = draft.seo || DEFAULT_SEO;
  const perf = draft.performance || DEFAULT_PERFORMANCE;
  const sec = draft.security || DEFAULT_SECURITY;
  const gen = draft.general || DEFAULT_GENERAL;
  const certCfg = draft.certificates || DEFAULT_CERTIFICATES;
  const mushafCfg = draft.mushaf || DEFAULT_MUSHAF;
  const tahfeezCfg = draft.tahfeez || DEFAULT_TAHFEEZ;

  const previewCertificatesList = evaluateCertificates({
    stats: {
      recipientName: certPreviewRecipient,
      totalListeningSeconds: 7200,
      activeDays: [
        '2026-11-15',
        '2026-11-16',
        '2026-11-17',
        '2026-11-18',
        '2026-11-19',
        '2026-11-20',
        '2026-11-21',
        '2026-11-22',
      ],
      listenedSurahKeys: ['minshawi:18', 'husary:36', 'alafasy:67', 'abdulbasit:12', 'maher:55'],
      verifiedMemorizedJuzs: [1, 29, 30],
      activePagesRead: Array.from({ length: 30 }, (_, idx) => idx + 1),
      tahfeezSessionsCompleted: 12,
    },
    memorizedAyahsCount: 600,
    completedSurahsCount: 4,
    historyCount: 24,
    completedKhatmahsCount: 2,
    config: certCfg,
  });

  const selectedAdminCert =
    previewCertificatesList.find((c) => c.id === certPreviewCategory) ||
    previewCertificatesList[0];

  const handleRenderAdminCertPng = async (shouldDownload: boolean) => {
    setCertRenderingPng(true);
    try {
      const dataUrl = shouldDownload
        ? await downloadCertificatePng(
            selectedAdminCert,
            certPreviewRecipient,
            certCfg,
            certCfg.defaultTemplate
          )
        : await renderCertificateToDataUrl(
            selectedAdminCert,
            certPreviewRecipient,
            certCfg,
            certCfg.defaultTemplate
          );
      if (dataUrl) {
        setCertRenderedPngUrl(dataUrl);
      }
      if (shouldDownload) {
        notify('تم تجهيز وتحميل صورة شهادة التقدير بدقة 1800×1260 PNG', 'success');
      }
    } finally {
      setCertRenderingPng(false);
    }
  };

  const handleRenderAdminCertPdf = async () => {
    setCertRenderingPng(true);
    try {
      const ok = await downloadCertificatePdf(
        selectedAdminCert,
        certPreviewRecipient,
        certCfg,
        certCfg.defaultTemplate
      );
      if (ok) {
        notify('تم تجهيز وتحميل ملف الشهادة بصيغة PDF قياس A4', 'success');
      }
    } finally {
      setCertRenderingPng(false);
    }
  };

  const handleSelectAdminCertTemplate = (tplId: CertificateTemplateId) => {
    setCertRenderedPngUrl('');
    setDraft((prev) => ({
      ...prev,
      certificates: {
        ...(prev.certificates || DEFAULT_CERTIFICATES),
        defaultTemplate: tplId,
      },
    }));
  };

  const handlePublish = async (summary?: string) => {
    setIsPublishing(true);
    try {
      await publishConfigToServer(draft, summary);
      void loadAuditAndBackups();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر نشر التحديث';
      notify(msg, 'error');
    } finally {
      setIsPublishing(false);
    }
  };
  quickPublishRef.current = () => {
    if (!isPublishing) void handlePublish();
  };

  const handleProbeAudio = async (targetUrl?: string) => {
    const urlToTest = (targetUrl || probeUrl).trim();
    if (!urlToTest) return;
    setProbeUrl(urlToTest);
    setProbingAudio(true);
    try {
      const res = await ownerFetch('/api/admin/audio/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToTest }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        result?: AudioProbeResult;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.result) {
        notify(data.error || 'تعذر فحص الرابط الصوتي', 'error');
        return;
      }
      setProbeResult(data.result);
    } catch {
      notify('خطأ في الاتصال بخادم فحص الروابط الصوتية', 'error');
    } finally {
      setProbingAudio(false);
    }
  };

  const toggleDisabledReciter = (id: string) => {
    setDraft((prev) => {
      const current = prev.security?.disabledReciterIds || [];
      const nextIds = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      return {
        ...prev,
        security: {
          ...(prev.security || DEFAULT_SECURITY),
          disabledReciterIds: nextIds,
        },
      };
    });
  };

  const handleCreateManualBackup = async () => {
    setCreatingBackup(true);
    try {
      const res = await ownerFetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: manualBackupLabel.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; backup?: BackupSnapshotMeta };
      if (res.ok && data.ok) {
        setManualBackupLabel('');
        await loadAuditAndBackups();
        notify('تم إنشاء نسخة احتياطية كاملة للملفات والإعدادات بنجاح', 'success');
      } else {
        notify('تعذر إنشاء النسخة الاحتياطية', 'error');
      }
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (backupId: string, label: string) => {
    setRestoringId(backupId);
    try {
      const res = await ownerFetch('/api/admin/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        restoredFiles?: string[];
        restoredConfig?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        notify(data.error || 'فشلت استعادة النسخة الاحتياطية', 'error');
        return;
      }
      await Promise.all([checkRemoteConfigNow(), loadAuditAndBackups()]);
      notify(
        `تم التراجع بنجاح إلى «${label}» (${data.restoredFiles?.length || 0} ملفًا)`,
        'success'
      );
    } finally {
      setRestoringId(null);
    }
  };

  const handleAddReciterToFirestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReciterId.trim() || !newReciterNameAr.trim() || newReciterBioAr.trim().length < 10) {
      notify('أكمل معرف القارئ والاسم والنبذة (١٠ أحرف على الأقل)', 'error');
      return;
    }
    setIsSavingReciter(true);
    try {
      await upsertAdminReciter({
        id: newReciterId.trim(),
        nameAr: newReciterNameAr.trim(),
        nameEn: newReciterNameEn.trim() || newReciterId.trim(),
        titleAr: newReciterTitleAr.trim() || 'قارئ للقرآن الكريم',
        bioAr: newReciterBioAr.trim(),
        birthYear: '',
        deathYear: '',
        originAr: 'العالم الإسلامي',
        photoUrl: newReciterPhotoUrl.trim() || '/images/reciters/minshawi.jpg',
        photoSource: 'لوحة إدارة تلاوة',
        featured: false,
      });
      await Promise.all([refreshCatalog(), loadServerReciters()]);
      notify('تم حفظ القارئ في السحابة وتحديث المكتبة', 'success');
      setNewReciterId('');
      setNewReciterNameAr('');
      setNewReciterNameEn('');
      setNewReciterTitleAr('');
      setNewReciterBioAr('');
      setNewReciterPhotoUrl('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر حفظ القارئ (تأكد من صلاحية السحابة)';
      notify(msg, 'error');
    } finally {
      setIsSavingReciter(false);
    }
  };

  const handleDeleteServerReciter = async (reciterId: string, nameAr: string) => {
    try {
      await deleteAdminReciter(reciterId);
      await Promise.all([loadServerReciters(), refreshCatalog()]);
      notify(`تم حذف «${nameAr || reciterId}» من السحابة`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر حذف القارئ';
      notify(msg, 'error');
    }
  };

  const handleExportConfigJson = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tilawa-config-v${draft.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfigJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = mergeDynamicConfig(JSON.parse(String(reader.result || '{}')));
        setDraft({ ...parsed, version: draft.version });
        notify('تم استيراد الإعدادات إلى المسودة — اضغط حفظ ونشر لاعتمادها', 'success');
      } catch {
        notify('ملف الإعدادات غير صالح', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRunBatchDiagnostics = async () => {
    const sampleReciterUrls: BatchProbeItem[] = reciters.slice(0, 3).map((r) => {
      const col = r.collections[0];
      const surahNum = getDefaultPlayableSurahNumber(r);
      return {
        id: `rec_${r.id}`,
        label: `${r.nameAr} — سورة #${surahNum}`,
        kind: 'تلاوة قرآنية',
        url: col ? buildSurahAudioUrl(col.server, surahNum, col.surahUrls) : '',
      };
    });
    const sampleBasiraUrls: BatchProbeItem[] = basiraEpisodes.slice(0, 3).map((ep) => ({
      id: `ep_${ep.id}`,
      label: ep.title,
      kind: 'بودكاست بصيرة',
      url: ep.audioUrl,
    }));

    const targets = [...sampleReciterUrls, ...sampleBasiraUrls].filter((t) =>
      /^https?:\/\//i.test(t.url)
    );
    setBatchProbing(true);
    setBatchProbeResults(targets);
    try {
      const updated: BatchProbeItem[] = [...targets];
      for (let i = 0; i < targets.length; i += 1) {
        try {
          const res = await ownerFetch('/api/admin/audio/probe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targets[i].url }),
          });
          const data = (await res.json()) as { ok?: boolean; result?: AudioProbeResult };
          if (data.ok && data.result) {
            updated[i] = { ...targets[i], result: data.result };
            setBatchProbeResults([...updated]);
          }
        } catch {
          // continue checking remaining streams
        }
      }
      const passedCount = updated.filter((u) => u.result?.ok).length;
      notify(
        `اكتمل الفحص الدفعي: ${toArabicDigits(passedCount)} من ${toArabicDigits(updated.length)} روابط تعمل بكفاءة`,
        passedCount === updated.length ? 'success' : 'info'
      );
    } finally {
      setBatchProbing(false);
    }
  };

  const diffSections = getConfigChangedSections(draft, publishedConfig);

  const tabs: Array<{
    id: AdminTab;
    label: string;
    keywords: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'overview',
      label: 'الإحصائيات والنظرة العامة',
      keywords: 'overview احصائيات تشخيص صحة روابط',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: 'sections-boost',
      label: 'تعزيز الأقسام والشكل',
      keywords: 'sections boost شكل تصميم أقسام إطار عنوان إبراز',
      icon: <Sparkles className="w-4 h-4" />,
    },
    {
      id: 'basira',
      label: 'بودكاست بصيرة والدعاة',
      keywords: 'basira بصيرة بودكاست دعاة امجد سمير الغليظ حلقات رفع',
      icon: <Mic className="w-4 h-4" />,
    },
    {
      id: 'certificates-quran',
      label: 'الشهادات والتحفيظ والمصحف',
      keywords: 'certificates شهادات توقيع ختم تحفيظ مصحف signature',
      icon: <Award className="w-4 h-4" />,
    },
    {
      id: 'ai-dev',
      label: 'المطور الذكي AI',
      keywords: 'ai developer برمجة كود ذكاء اصطناعي',
      icon: <Bot className="w-4 h-4" />,
    },
    {
      id: 'content',
      label: 'المحتوى والصفحات والأقسام',
      keywords: 'content نصوص اعلان رئيسية تنقل صور شيوخ',
      icon: <Type className="w-4 h-4" />,
    },
    {
      id: 'reciters',
      label: 'القراء والروابط الصوتية',
      keywords: 'reciters قراء شيوخ تلاوات فحص رابط',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'design',
      label: 'التصميم والألوان والخطوط',
      keywords: 'design ثيم الوان خطوط زجاجية',
      icon: <Palette className="w-4 h-4" />,
    },
    {
      id: 'player',
      label: 'مشغل الصوت',
      keywords: 'player صوت سرعة مؤقت نوم تكرار',
      icon: <Volume2 className="w-4 h-4" />,
    },
    {
      id: 'seo-perf',
      label: 'SEO والأداء والتزامن',
      keywords: 'seo google كاش offline pwa sync تحديث',
      icon: <Globe className="w-4 h-4" />,
    },
    {
      id: 'security',
      label: 'الأمان والإعدادات العامة',
      keywords: 'security صيانة حظر جلسات json',
      icon: <ShieldAlert className="w-4 h-4" />,
    },
    {
      id: 'feedback',
      label: 'آراء المستخدمين والأداء',
      keywords: 'feedback تقييم اراء زوار اداء سرعة شكاوى اقتراحات',
      icon: <MessageSquareHeart className="w-4 h-4" />,
    },
    {
      id: 'audit-backups',
      label: 'النسخ الاحتياطية والسجل',
      keywords: 'backups rollback سجل تعديلات استعادة',
      icon: <History className="w-4 h-4" />,
    },
  ];

  const TAB_GROUP_MAP: Record<AdminTab, Exclude<AdminTabGroup, 'all'>> = {
    overview: 'ai-security',
    basira: 'content-media',
    reciters: 'content-media',
    content: 'content-media',
    'certificates-quran': 'content-media',
    'sections-boost': 'design-system',
    design: 'design-system',
    player: 'design-system',
    'seo-perf': 'design-system',
    'ai-dev': 'ai-security',
    security: 'ai-security',
    feedback: 'content-media',
    'audit-backups': 'ai-security',
  };

  const matchingTabs = tabs.filter((t) => {
    if (tabGroup !== 'all' && TAB_GROUP_MAP[t.id] !== tabGroup) return false;
    const q = commandSearch.trim();
    if (!q) return true;
    return t.label.includes(q) || t.keywords.toLowerCase().includes(q.toLowerCase());
  });

  const allEditableReciters = CANONICAL_RECITERS.filter((r) => !isBlockedReciter(r)).filter(
    (r) =>
      !reciterSearch.trim() ||
      r.nameAr.includes(reciterSearch.trim()) ||
      r.id.toLowerCase().includes(reciterSearch.trim().toLowerCase())
  );

  const topReciters = analytics
    ? Object.entries(analytics.reciterPlays)
        .map(([id, info]) => ({ id, ...info }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    : [];

  const topSurahs = analytics
    ? Object.entries(analytics.surahPlays)
        .map(([num, info]) => ({ num, ...info }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    : [];

  const topRoutes = analytics
    ? Object.entries(analytics.routeCounts || {})
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6)
    : [];

  const dailyEntries = analytics
    ? Object.entries(analytics.dailyViews)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-7)
    : [];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-28 space-y-6">
      {/* Owner Command Header */}
      <section className="glass-gold rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => navigate({ page: 'home' })}
              className="inline-flex items-center gap-1.5 text-xs text-[#C8A253] hover:underline cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة إلى الموقع العام</span>
            </button>
            <div className="flex flex-wrap items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-[#C8A253]" />
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]">
                مركز التحكم الشامل — لوحة المالك
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#A9B2AE] max-w-2xl">
              تحكم كامل في المحتوى، القراء، الصوتيات، التصميم، الخطوط، المشغل، SEO، الأداء، الأمان، السجلات، ومطور الذكاء الاصطناعي المرتبط فعليًا بالكود.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0E6B4D]/25 border border-[#C8A253]/35 text-xs text-[#F5F3EE]">
                <BadgeCheck className="w-4 h-4 text-[#38BDF8]" />
                <span>جلسة المالك الموثقة</span>
              </span>
              <button
                type="button"
                onClick={() => void signOutAdmin()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#A9B2AE] hover:text-white cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#A9B2AE]">
              <span>
                الإصدار الحي:{' '}
                <strong className="text-[#C8A253]">#{toArabicDigits(publishedConfig.version)}</strong>
              </span>
              <span>·</span>
              <span className={remoteConnected ? 'text-emerald-400' : 'text-amber-300'}>
                {remoteConnected ? 'الخادم متصل ومزامن' : 'وضع المزامنة المحلية'}
              </span>
              {lastSyncedAt && (
                <>
                  <span>·</span>
                  <span>آخر مزامنة: {new Date(lastSyncedAt).toLocaleTimeString('ar-EG')}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Draft vs Published Live Diff Indicator & Quick Command Search */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-2">
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 text-[#A9B2AE] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={commandInputRef}
              type="search"
              value={commandSearch}
              onChange={(e) => setCommandSearch(e.target.value)}
              placeholder="انتقال سريع للأقسام (Ctrl+K): بصيرة، الشهادات، الألوان، القراء..."
              className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-[#0A0D0C]/90 border border-white/15 focus:border-[#C8A253]/60 text-xs text-[#F5F3EE] outline-none"
            />
          </div>

          <div className="lg:col-span-7 flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-xl bg-[#0A0D0C]/70 border border-white/10 text-xs">
            {diffSections.length === 0 ? (
              <span className="inline-flex items-center gap-2 text-emerald-300">
                <Check className="w-4 h-4" />
                <span>المسودة متطابقة تمامًا مع النسخة الحية المنشورة لجميع الزوار والتطبيق.</span>
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-2 text-amber-200">
                  <Sparkles className="w-4 h-4 text-[#C8A253]" />
                  <span>
                    {toArabicDigits(diffSections.length)} تعديلات في المسودة (
                    {diffSections.map((d) => d.labelAr).join(' · ')})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setDraft(publishedConfig)}
                  className="text-[11px] text-[#A9B2AE] hover:text-white underline cursor-pointer"
                >
                  تجاهل التعديلات
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sticky / Quick Publish Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => saveLocalPreview(draft)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-medium text-[#F5F3EE] cursor-pointer"
            >
              <Eye className="w-4 h-4 text-[#C8A253]" />
              <span>معاينة محلية فورية</span>
            </button>

            {hasLocalPreview && (
              <button
                type="button"
                onClick={clearLocalPreview}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-400/30 text-xs text-amber-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إلغاء المعاينة</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={isPublishing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] disabled:opacity-50 text-xs sm:text-sm font-semibold text-[#F5F3EE] shadow-lg cursor-pointer"
            >
              <CloudUpload className="w-4 h-4 text-[#C8A253]" />
              <span>{isPublishing ? 'جارٍ الحفظ والنشر...' : 'حفظ ونشر للجميع'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void checkRemoteConfigNow()}
              disabled={isCheckingRemote}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#A9B2AE] hover:text-white cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingRemote ? 'animate-spin' : ''}`} />
              <span>تحديث البيانات</span>
            </button>
            <button
              type="button"
              onClick={() => void resetServerToDefault()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-rose-950/50 text-xs text-[#A9B2AE] hover:text-rose-200 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الافتراضي</span>
            </button>
          </div>
        </div>
      </section>

      {/* Grouped Filter + Navigation Tabs */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-[#A9B2AE] ml-1">تصفية التبويبات:</span>
          {[
            { id: 'all' as const, label: 'جميع الأقسام (١٣)' },
            { id: 'content-media' as const, label: 'المحتوى وبصيرة والقراء' },
            { id: 'design-system' as const, label: 'الأقسام والتصميم والأداء' },
            { id: 'ai-security' as const, label: 'المطور الذكي والأمان والسجلات' },
          ].map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setTabGroup(g.id)}
              className={`px-2.5 py-1 rounded-lg cursor-pointer transition-colors ${
                tabGroup === g.id
                  ? 'bg-[#C8A253]/20 border border-[#C8A253]/60 text-[#C8A253] font-semibold'
                  : 'bg-[#121715] border border-white/10 text-[#A9B2AE] hover:text-white'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <nav aria-label="أقسام مركز التحكم" className="flex flex-wrap gap-2">
          {(matchingTabs.length > 0 ? matchingTabs : tabs).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  if (commandSearch) setCommandSearch('');
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#0E6B4D] text-[#F5F3EE] border border-[#C8A253]/50 shadow-md'
                    : 'bg-[#121715] text-[#A9B2AE] hover:text-[#F5F3EE] border border-white/10'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB 1: OVERVIEW, HEALTH DIAGNOSTICS & LIVE ANALYTICS */}
      {activeTab === 'overview' && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-1">
              <div className="flex items-center justify-between text-xs text-[#A9B2AE]">
                <span>مشاهدات الصفحات</span>
                <Activity className="w-4 h-4 text-[#C8A253]" />
              </div>
              <p className="text-2xl font-display font-bold text-[#F5F3EE]">
                {toArabicDigits(analytics?.totalPageViews ?? 0)}
              </p>
              <p className="text-[11px] text-[#A9B2AE]">الموقع وتطبيق الويب دون إنترنت</p>
            </div>

            <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-1">
              <div className="flex items-center justify-between text-xs text-[#A9B2AE]">
                <span>مرات التشغيل</span>
                <Radio className="w-4 h-4 text-[#C8A253]" />
              </div>
              <p className="text-2xl font-display font-bold text-[#F5F3EE]">
                {toArabicDigits(analytics?.totalPlays ?? 0)}
              </p>
              <p className="text-[11px] text-[#A9B2AE]">التلاوات والمحطات</p>
            </div>

            <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-1">
              <div className="flex items-center justify-between text-xs text-[#A9B2AE]">
                <span>القراء المفعّلون</span>
                <Users className="w-4 h-4 text-[#C8A253]" />
              </div>
              <p className="text-2xl font-display font-bold text-[#F5F3EE]">
                {toArabicDigits(reciters.length)}
              </p>
              <p className="text-[11px] text-[#A9B2AE]">
                المعطّلون: {toArabicDigits(sec.disabledReciterIds.length)}
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-1">
              <div className="flex items-center justify-between text-xs text-[#A9B2AE]">
                <span>بودكاست بصيرة</span>
                <Mic className="w-4 h-4 text-[#C8A253]" />
              </div>
              <p className="text-2xl font-display font-bold text-[#F5F3EE]">
                {toArabicDigits(basiraEpisodes.length)} حلقة
              </p>
              <p className="text-[11px] text-[#A9B2AE]">
                {toArabicDigits(basiraPreachers.length)} دعاة · {toArabicDigits(basiraPlaylists.length)} قوائم
              </p>
            </div>

            <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-1">
              <div className="flex items-center justify-between text-xs text-[#A9B2AE]">
                <span>النسخ الاحتياطية</span>
                <HardDrive className="w-4 h-4 text-[#C8A253]" />
              </div>
              <p className="text-2xl font-display font-bold text-[#F5F3EE]">
                {toArabicDigits(backups.length)}
              </p>
              <p className="text-[11px] text-[#A9B2AE]">
                السجل: {toArabicDigits(auditLogs.length)} عملية
              </p>
            </div>
          </div>

          {/* System Health & Batch Audio Stream Scanner */}
          <div className="glass-gold rounded-2xl p-5 sm:p-6 border border-[#C8A253]/30 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-display font-bold text-[#F5F3EE] flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-[#C8A253]" />
                  <span>مركز فحص صحة المنصة والبث الصوتي</span>
                </h2>
                <p className="text-xs text-[#A9B2AE] mt-0.5">
                  تحقق فوري من جاهزية البث الصوتي، والشهادات، وأقسام المنصة وتطبيق الويب دون إنترنت.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('certificates-quran')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-[#C8A253] cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>معاينة الشهادات والتوقيع</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleRunBatchDiagnostics()}
                  disabled={batchProbing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] disabled:opacity-60 text-xs font-semibold text-white cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${batchProbing ? 'animate-spin' : ''}`} />
                  <span>{batchProbing ? 'جارٍ فحص الروابط...' : 'فحص دفعي شامل للروابط الصوتية'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#0A0D0C]/80 border border-white/10 flex items-center justify-between">
                <span className="text-[#A9B2AE]">تطبيق الويب دون إنترنت</span>
                <span className="text-emerald-300 font-semibold">PWA مفعّل</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0A0D0C]/80 border border-white/10 flex items-center justify-between">
                <span className="text-[#A9B2AE]">مزامنة الإعدادات الحية</span>
                <span className={remoteConnected ? 'text-emerald-300 font-semibold' : 'text-amber-300'}>
                  {remoteConnected ? `متصل (#${toArabicDigits(publishedConfig.version)})` : 'محلي'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#0A0D0C]/80 border border-white/10 flex items-center justify-between">
                <span className="text-[#A9B2AE]">تصنيفات بصيرة</span>
                <span className="text-[#C8A253] font-semibold">
                  {toArabicDigits(BASIRA_CATEGORIES.length)} تصنيفات صوتية
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#0A0D0C]/80 border border-white/10 flex items-center justify-between">
                <span className="text-[#A9B2AE]">بوابة المالك</span>
                <span className="text-emerald-300 font-semibold">محمية وموثقة</span>
              </div>
            </div>

            {batchProbeResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2">
                {batchProbeResults.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[#0A0D0C]/85 border border-white/10 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="text-[#F5F3EE] font-medium truncate">{item.label}</p>
                      <p className="text-[10px] text-[#A9B2AE]">{item.kind}</p>
                    </div>
                    {item.result ? (
                      <span
                        dir="ltr"
                        className={`px-2 py-1 rounded-lg font-mono text-[10px] shrink-0 ${
                          item.result.ok
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {item.result.ok ? `OK ${item.result.status}` : `ERR ${item.result.status}`} · {item.result.latencyMs}ms
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#C8A253] shrink-0">جارٍ الفحص...</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Certificate of Appreciation Showcase (Visible directly in Admin Overview) */}
          <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-[#C8A253]/35 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-display font-bold text-[#F5F3EE] flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#C8A253]" />
                  <span>عرض شهادة التقدير وتصميمها الرسمي داخل لوحة الإدارة</span>
                </h2>
                <p className="text-xs text-[#A9B2AE] mt-0.5">
                  معاينة حية للشهادة التي يحصل عليها المستخدم بعد بلوغ المستوى المطلوب ({toArabicDigits(selectedAdminCert.requiredLevel)}) وإتمام الشرط القرآني باعتماد منصة تلاوة.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleRenderAdminCertPng(true)}
                  disabled={certRenderingPng}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#C8A253] hover:bg-[#d6b368] text-[#0A0D0C] text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{certRenderingPng ? 'جارٍ التجهيز...' : 'تحميل صورة PNG'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleRenderAdminCertPdf()}
                  disabled={certRenderingPng}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-[#F5F3EE] text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  <FileText className="w-3.5 h-3.5 text-[#C8A253]" />
                  <span>تحميل ملف PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('certificates-quran')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-semibold cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#C8A253]" />
                  <span>استوديو التصميم والتوقيع</span>
                </button>
              </div>
            </div>

            {/* 4 Design Models Swatches in Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {CERTIFICATE_TEMPLATES.map((tpl) => {
                const active = (certCfg.defaultTemplate || 'royal_emerald') === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleSelectAdminCertTemplate(tpl.id)}
                    className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                      active
                        ? 'border-[#C8A253] bg-[#C8A253]/12'
                        : 'border-white/10 bg-[#0A0D0C]/70 hover:border-white/25'
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-full border shrink-0"
                      style={{
                        background: tpl.bgGradientCss,
                        borderColor: tpl.accentColor,
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#F5F3EE] truncate">{tpl.nameAr}</p>
                      <p className="text-[10px] text-[#A9B2AE] truncate">{tpl.taglineAr}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'juz_memorization', label: 'حفظ جزء قرآني' },
                    { id: 'continuous_listening', label: 'الاستماع المتواصل' },
                    { id: 'active_platform_excellence', label: 'النشاط والتميز' },
                    { id: 'khatmah_completion', label: 'إتمام الختمة' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCertPreviewCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                      certPreviewCategory === cat.id
                        ? 'bg-[#C8A253] text-[#0A0D0C] font-bold'
                        : 'bg-[#0A0D0C]/80 text-[#A9B2AE] hover:text-[#F5F3EE] border border-white/10'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                aria-label="اسم المستلم في معاينة الشهادة"
                value={certPreviewRecipient}
                onChange={(e) => setCertPreviewRecipient(e.target.value)}
                placeholder="اكتب اسمًا لتجربة الشهادة..."
                className="px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE] w-60"
              />
            </div>

            <CertificatePreviewCard
              certificate={selectedAdminCert}
              recipientName={certPreviewRecipient}
              certificatesConfig={certCfg}
              templateId={certCfg.defaultTemplate}
              compact
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5">
            {/* Daily Views Bar Chart */}
            <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#F5F3EE]">نشاط الزيارات (آخر ٧ أيام)</h2>
                <button
                  type="button"
                  onClick={() => void loadAnalytics()}
                  className="text-xs text-[#C8A253] hover:underline cursor-pointer"
                >
                  تحديث
                </button>
              </div>
              {dailyEntries.length === 0 ? (
                <p className="text-xs text-[#A9B2AE]">لا توجد زيارات مسجلة بعد في هذه الجلسة.</p>
              ) : (
                <div className="space-y-2.5">
                  {dailyEntries.map(([day, count]) => {
                    const max = Math.max(...dailyEntries.map(([, c]) => c), 1);
                    const pct = Math.max(8, Math.round((count / max) * 100));
                    return (
                      <div key={day} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-[#A9B2AE]">
                          <span dir="ltr">{day}</span>
                          <span className="text-[#F5F3EE] font-mono-nums">{toArabicDigits(count)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#C8A253]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Routes */}
            <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
              <h2 className="text-sm font-bold text-[#F5F3EE]">الأقسام الأكثر زيارة</h2>
              {topRoutes.length === 0 ? (
                <p className="text-xs text-[#A9B2AE]">سيظهر ترتيب الصفحات فور تصفح الزوار.</p>
              ) : (
                <div className="space-y-2.5">
                  {topRoutes.map(([routeKey, count]) => {
                    const max = Math.max(...topRoutes.map(([, c]) => c), 1);
                    const pct = Math.max(10, Math.round((count / max) * 100));
                    return (
                      <div key={routeKey} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#F5F3EE] font-mono">{routeKey}</span>
                          <span className="text-[#C8A253] font-mono-nums">{toArabicDigits(count)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full bg-[#178A64]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Reciters */}
            <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
              <h2 className="text-sm font-bold text-[#F5F3EE]">القراء الأكثر استماعًا</h2>
              {topReciters.length === 0 ? (
                <p className="text-xs text-[#A9B2AE]">سيظهر الترتيب فور بدء الزوار بالاستماع.</p>
              ) : (
                <div className="space-y-2.5">
                  {topReciters.map((item, idx) => {
                    const max = Math.max(...topReciters.map((r) => r.count), 1);
                    const pct = Math.max(10, Math.round((item.count / max) * 100));
                    return (
                      <div key={item.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#F5F3EE] truncate">
                            {toArabicDigits(idx + 1)}. {item.name}
                          </span>
                          <span className="text-[#C8A253] font-mono-nums shrink-0">
                            {toArabicDigits(item.count)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full bg-[#0E6B4D]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Surahs */}
            <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
              <h2 className="text-sm font-bold text-[#F5F3EE]">السور الأكثر تشغيلًا</h2>
              {topSurahs.length === 0 ? (
                <p className="text-xs text-[#A9B2AE]">لا توجد إحصائيات سور مسجلة بعد.</p>
              ) : (
                <div className="space-y-2.5">
                  {topSurahs.map((item, idx) => {
                    const max = Math.max(...topSurahs.map((s) => s.count), 1);
                    const pct = Math.max(10, Math.round((item.count / max) * 100));
                    return (
                      <div key={item.num} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#F5F3EE] truncate">
                            {toArabicDigits(idx + 1)}. {item.name}
                          </span>
                          <span className="text-[#C8A253] font-mono-nums shrink-0">
                            {toArabicDigits(item.count)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full bg-[#C8A253]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent Audit Snapshot */}
          <div className="glass-panel rounded-2xl p-5 border border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-[#F5F3EE]">آخر الإجراءات الإدارية والتطويرية</h2>
              <p className="text-xs text-[#A9B2AE] mt-0.5">
                {auditLogs[0]
                  ? `${auditLogs[0].action}: ${auditLogs[0].summary}`
                  : 'لم يتم تسجيل إجراءات جديدة بعد.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('basira')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#F5F3EE] cursor-pointer"
              >
                <Mic className="w-4 h-4 text-[#C8A253]" />
                <span>إدارة بصيرة والدعاة</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ai-dev')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs font-semibold text-[#F5F3EE] cursor-pointer"
              >
                <Bot className="w-4 h-4 text-[#C8A253]" />
                <span>فتح المطور الذكي AI</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('audit-backups')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#F5F3EE] cursor-pointer"
              >
                <ArchiveRestore className="w-4 h-4 text-[#C8A253]" />
                <span>إدارة النسخ الاحتياطية</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: BASIRA AUDIO PODCAST & PREACHERS */}
      {activeTab === 'basira' && <AdminBasiraTab ownerFetch={ownerFetch} />}

      {/* TAB: CERTIFICATES, SIGNATURE, MUSHAF & TAHFEEZ */}
      {activeTab === 'certificates-quran' && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Certificate Live Visual Preview (shows user name + platform signature & stamp) */}
            <div className="xl:col-span-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-display font-bold text-[#F5F3EE] flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#C8A253]" />
                  <span>المعاينة الحية لشهادة التقدير وتوقيع الموقع</span>
                </h2>
                <input
                  type="text"
                  aria-label="اسم تجريبي للمعاينة على الشهادة"
                  value={certPreviewRecipient}
                  onChange={(e) => setCertPreviewRecipient(e.target.value)}
                  placeholder="اسم تجريبي للمعاينة..."
                  className="px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE] w-52"
                />
              </div>

              {/* 4 Visual Design Models Selector in Certificates Studio */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CERTIFICATE_TEMPLATES.map((tpl) => {
                  const active = (certCfg.defaultTemplate || 'royal_emerald') === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectAdminCertTemplate(tpl.id)}
                      className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2 ${
                        active
                          ? 'border-[#C8A253] bg-[#C8A253]/12'
                          : 'border-white/10 bg-[#0A0D0C]/70 hover:border-white/25'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full border shrink-0"
                        style={{
                          background: tpl.bgGradientCss,
                          borderColor: tpl.accentColor,
                        }}
                      />
                      <span className="text-[11px] font-semibold text-[#F5F3EE] truncate">
                        {tpl.nameAr}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'juz_memorization', label: '١. حفظ جزء قرآني' },
                    { id: 'continuous_listening', label: '٢. الاستماع المتواصل' },
                    { id: 'active_platform_excellence', label: '٣. النشاط والتميز' },
                    { id: 'khatmah_completion', label: '٤. إتمام الختمة' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCertPreviewCategory(cat.id);
                      setCertRenderedPngUrl('');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                      certPreviewCategory === cat.id
                        ? 'bg-[#C8A253] text-[#0A0D0C] font-bold'
                        : 'bg-[#0A0D0C]/80 text-[#A9B2AE] hover:text-[#F5F3EE] border border-white/10'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <CertificatePreviewCard
                certificate={selectedAdminCert}
                recipientName={certPreviewRecipient}
                certificatesConfig={certCfg}
                templateId={certCfg.defaultTemplate}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void handleRenderAdminCertPng(false)}
                  disabled={certRenderingPng}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-[#F5F3EE] cursor-pointer disabled:opacity-60"
                >
                  <Eye className="w-3.5 h-3.5 text-[#C8A253]" />
                  <span>{certRenderingPng ? 'جارٍ التصيير...' : 'معاينة صورة الطباعة (1800×1260)'}</span>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRenderAdminCertPng(true)}
                    disabled={certRenderingPng}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#C8A253] hover:bg-[#d6b368] text-[#0A0D0C] text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل صورة PNG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRenderAdminCertPdf()}
                    disabled={certRenderingPng}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>تحميل ملف PDF</span>
                  </button>
                </div>
              </div>

              {certRenderedPngUrl && (
                <div className="rounded-2xl border border-[#C8A253]/35 bg-[#0A0D0C]/90 p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#A9B2AE]">
                    <span>نسخة الصورة النهائية الجاهزة للطباعة (1800×1260 PNG)</span>
                    <a
                      href={certRenderedPngUrl}
                      download={`tilawa-certificate-${selectedAdminCert.sealNumber.toLowerCase()}.png`}
                      className="text-[#C8A253] hover:underline font-medium"
                    >
                      حفظ الصورة
                    </a>
                  </div>
                  <img
                    src={certRenderedPngUrl}
                    alt="معاينة شهادة التقدير بدقة عالية"
                    className="w-full h-auto rounded-xl border border-white/10"
                  />
                </div>
              )}
            </div>

            {/* Certificate Text, Signature & Threshold Controls */}
            <div className="xl:col-span-6 glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-[#F5F3EE]">
                إعدادات الشهادة التقديرية والتوقيع والختم
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs text-[#A9B2AE]">العنوان الرسمي للشهادة</label>
                  <input
                    type="text"
                    value={certCfg.platformTitleAr}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        certificates: { ...certCfg, platformTitleAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[#A9B2AE]">اسم المنصة في التوقيع أسفل الشهادة</label>
                  <input
                    type="text"
                    value={certCfg.signerName}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        certificates: { ...certCfg, signerName: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[#A9B2AE]">صفة الجهة المانحة أسفل الشهادة</label>
                  <input
                    type="text"
                    value={certCfg.signerTitleAr}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        certificates: { ...certCfg, signerTitleAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[#A9B2AE]">نص الختم الدائري المعتمد</label>
                  <input
                    type="text"
                    value={certCfg.stampLabelAr}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        certificates: { ...certCfg, stampLabelAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs text-[#A9B2AE]">الآية أو العبارة القرآنية أعلى الشهادة</label>
                  <input
                    type="text"
                    value={certCfg.blessingVerseAr}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        certificates: { ...certCfg, blessingVerseAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs text-[#A9B2AE] block">نمط التوقيع الفني على الشهادة</span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'calligraphic_gold', label: 'خط رقعة مذهب' },
                      { id: 'royal_emblem', label: 'زخرفي ملوكي' },
                      { id: 'modern_minimal', label: 'ختم رسمي مبسط' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          certificates: { ...certCfg, signatureStyle: st.id },
                        })
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer ${
                        certCfg.signatureStyle === st.id
                          ? 'bg-[#C8A253] text-[#0A0D0C] font-bold'
                          : 'bg-white/5 text-[#A9B2AE] border border-white/10'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-white/10">
                <div className="space-y-1">
                  <label className="text-[11px] text-[#A9B2AE]">دقائق الاستماع للتميز</label>
                  <input
                    type="number"
                    min={3}
                    max={600}
                    value={certCfg.listeningMinutesGoal}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        certificates: {
                          ...certCfg,
                          listeningMinutesGoal: Math.max(3, Number(e.target.value) || 30),
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#A9B2AE]">صفحات المصحف للتميز</label>
                  <input
                    type="number"
                    min={5}
                    max={604}
                    value={certCfg.readingPagesGoal}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        certificates: {
                          ...certCfg,
                          readingPagesGoal: Math.max(5, Number(e.target.value) || 10),
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#A9B2AE]">آيات الحفظ للاستحقاق</label>
                  <input
                    type="number"
                    min={20}
                    max={6236}
                    value={certCfg.memorizationAyahGoal}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        certificates: {
                          ...certCfg,
                          memorizationAyahGoal: Math.max(20, Number(e.target.value) || 30),
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-[#A9B2AE]">جلسات التحفيظ المنجزة</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={certCfg.tahfeezSessionsGoal}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        certificates: {
                          ...certCfg,
                          tahfeezSessionsGoal: Math.max(1, Number(e.target.value) || 3),
                        },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  />
                </div>
              </div>

              {/* Required User Level per Certificate */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <span className="text-xs font-semibold text-[#C8A253] block">
                  المستوى المطلوب للوصول إلى كل شهادة (١ – ١٠)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#A9B2AE]">مستوى شهادة الاستماع</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={certCfg.requiredLevelListening ?? DEFAULT_CERTIFICATES.requiredLevelListening}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          certificates: {
                            ...certCfg,
                            requiredLevelListening: Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                          },
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#A9B2AE]">مستوى شهادة حفظ جزء</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={certCfg.requiredLevelMemorization ?? DEFAULT_CERTIFICATES.requiredLevelMemorization}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          certificates: {
                            ...certCfg,
                            requiredLevelMemorization: Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                          },
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#A9B2AE]">مستوى شهادة التميز</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={certCfg.requiredLevelExcellence ?? DEFAULT_CERTIFICATES.requiredLevelExcellence}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          certificates: {
                            ...certCfg,
                            requiredLevelExcellence: Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                          },
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-[#A9B2AE]">مستوى شهادة الختمة</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={certCfg.requiredLevelKhatmah ?? DEFAULT_CERTIFICATES.requiredLevelKhatmah}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          certificates: {
                            ...certCfg,
                            requiredLevelKhatmah: Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                          },
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mushaf & Tahfeez Studio Defaults */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-[#F5F3EE] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#C8A253]" />
                <span>إعدادات المصحف الشريف الافتراضية</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-[#A9B2AE]">مظهر الورق الافتراضي</label>
                  <select
                    value={mushafCfg.defaultTheme}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        mushaf: {
                          ...mushafCfg,
                          defaultTheme: e.target.value as typeof mushafCfg.defaultTheme,
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  >
                    <option value="obsidian">ليلي فحمي</option>
                    <option value="sepia">ورق المصحف الكريمي</option>
                    <option value="light">مضيء هادئ</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[#A9B2AE]">
                    حجم الخط الافتراضي ({toArabicDigits(mushafCfg.defaultFontSizePx)}px)
                  </label>
                  <input
                    type="range"
                    min={18}
                    max={42}
                    step={2}
                    value={mushafCfg.defaultFontSizePx}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        mushaf: { ...mushafCfg, defaultFontSizePx: Number(e.target.value) },
                      })
                    }
                    className="w-full accent-[#C8A253]"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#A9B2AE]">القارئ الافتراضي داخل المصحف</label>
                <select
                  value={mushafCfg.defaultReciterId}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      mushaf: { ...mushafCfg, defaultReciterId: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                >
                  {CANONICAL_RECITERS.filter((r) => !isBlockedReciter(r)).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-[#F5F3EE] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mushafCfg.showTafsirByDefault}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        mushaf: { ...mushafCfg, showTafsirByDefault: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-[#C8A253]"
                  />
                  <span>تفعيل التفسير الميسر تلقائيًا</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-[#F5F3EE] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mushafCfg.enableJuzQuickNav}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        mushaf: { ...mushafCfg, enableJuzQuickNav: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-[#C8A253]"
                  />
                  <span>إظهار شريط الانتقال السريع للأجزاء</span>
                </label>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-[#F5F3EE] flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#C8A253]" />
                <span>إعدادات المعلم الذكي للتحفيظ</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-[#A9B2AE]">التكرار الافتراضي لكل آية</label>
                  <select
                    value={tahfeezCfg.defaultRepeatsPerAyah}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        tahfeez: { ...tahfeezCfg, defaultRepeatsPerAyah: Number(e.target.value) },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  >
                    {[1, 2, 3, 5, 7].map((n) => (
                      <option key={n} value={n}>
                        {toArabicDigits(n)} مرات
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[#A9B2AE]">مهلة الترديد بالثواني</label>
                  <select
                    value={tahfeezCfg.defaultPauseSeconds}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        tahfeez: {
                          ...tahfeezCfg,
                          defaultPauseSeconds: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  >
                    <option value={0}>دون مهلة (متواصل)</option>
                    <option value={2}>٢ ثانية</option>
                    <option value={3}>٣ ثوانٍ</option>
                    <option value={5}>٥ ثوانٍ</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-[#F5F3EE] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tahfeezCfg.enableVoiceHideByDefault}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        tahfeez: { ...tahfeezCfg, enableVoiceHideByDefault: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-[#C8A253]"
                  />
                  <span>تفعيل وضع اختبار الحفظ (إخفاء الكلمات) افتراضيًا</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-[#F5F3EE] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tahfeezCfg.autoAdvanceAyah}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        tahfeez: { ...tahfeezCfg, autoAdvanceAyah: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-[#C8A253]"
                  />
                  <span>الانتقال التلقائي للآية التالية</span>
                </label>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: REAL AI DEVELOPER */}
      {activeTab === 'ai-dev' && (
        <AiDeveloperWorkspace
          onBackupCreated={() => void loadAuditAndBackups()}
          onFilesApplied={() => void checkRemoteConfigNow()}
        />
      )}

      {activeTab === 'feedback' && <AdminFeedbackTab ownerFetch={ownerFetch} />}

      {/* TAB 3: CONTENT, IMAGES, SECTIONS & NAV PAGES */}
      {activeTab === 'content' && (
        <section className="space-y-6">
          {/* Announcement & Texts */}
          <div className="glass-panel rounded-2xl p-6 space-y-5 border border-white/10">
            <h2 className="text-lg font-display font-bold text-[#F5F3EE]">
              النصوص الرئيسية والإعلانات
            </h2>

            <div className="p-4 rounded-2xl bg-[#0E6B4D]/15 border border-[#0E6B4D]/40 space-y-3">
              <label className="flex items-center gap-2.5 text-sm font-semibold text-[#F5F3EE] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.texts.announcementEnabled}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      texts: { ...draft.texts, announcementEnabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 accent-[#C8A253]"
                />
                <span>تفعيل شريط تنبيه وإعلان أعلى الصفحة الرئيسية</span>
              </label>
              <input
                type="text"
                value={draft.texts.announcementText}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    texts: { ...draft.texts, announcementText: e.target.value },
                  })
                }
                placeholder="مثال: نسأل الله أن يتقبل منا ومنكم صالح الأعمال..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-[#A9B2AE]">اسم المنصة</label>
                <input
                  type="text"
                  value={draft.texts.siteName}
                  onChange={(e) =>
                    setDraft({ ...draft, texts: { ...draft.texts, siteName: e.target.value } })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[#A9B2AE]">الشعار اللفظي (Slogan)</label>
                <input
                  type="text"
                  value={draft.texts.slogan}
                  onChange={(e) =>
                    setDraft({ ...draft, texts: { ...draft.texts, slogan: e.target.value } })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-[#A9B2AE]">عنوان الترحيب الرئيسي</label>
                <input
                  type="text"
                  value={draft.texts.heroTitle}
                  onChange={(e) =>
                    setDraft({ ...draft, texts: { ...draft.texts, heroTitle: e.target.value } })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-[#A9B2AE]">الوصف الترحيبي</label>
                <textarea
                  rows={2}
                  value={draft.texts.heroSubtitle}
                  onChange={(e) =>
                    setDraft({ ...draft, texts: { ...draft.texts, heroSubtitle: e.target.value } })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[#A9B2AE]">زر الاستماع</label>
                <input
                  type="text"
                  value={draft.texts.ctaListenLabel}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      texts: { ...draft.texts, ctaListenLabel: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[#A9B2AE]">زر المصحف الشريف</label>
                <input
                  type="text"
                  value={draft.texts.ctaMushafLabel}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      texts: { ...draft.texts, ctaMushafLabel: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-[#A9B2AE]">رابط صورة خلفية الترحيب (Hero Backdrop URL)</label>
                <input
                  type="url"
                  dir="ltr"
                  value={draft.images.heroBackdropUrl}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      images: { ...draft.images, heroBackdropUrl: e.target.value },
                    })
                  }
                  placeholder={HERO_BACKDROP_URL || 'https://... or /images/...'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-[#A9B2AE]">وصف الفوتر</label>
                <textarea
                  rows={2}
                  value={draft.texts.footerDescription}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      texts: { ...draft.texts, footerDescription: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
                />
              </div>
            </div>
          </div>

          {/* Sections & Nav Ordering */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-panel rounded-2xl p-6 space-y-3 border border-white/10">
              <h3 className="text-sm font-bold text-[#F5F3EE] flex items-center gap-2">
                <LayoutList className="w-4 h-4 text-[#C8A253]" />
                <span>ترتيب وإظهار أقسام الرئيسية</span>
              </h3>
              <div className="space-y-2">
                {draft.homeSections.map((secItem, idx) => (
                  <div
                    key={secItem.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0A0D0C] border border-white/10"
                  >
                    <input
                      type="text"
                      value={secItem.label}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          homeSections: draft.homeSections.map((s) =>
                            s.id === secItem.id ? { ...s, label: e.target.value } : s
                          ),
                        })
                      }
                      className="flex-1 bg-transparent text-xs text-[#F5F3EE] px-2 py-1 rounded border border-transparent focus:border-white/20"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            homeSections: draft.homeSections.map((s) =>
                              s.id === secItem.id ? { ...s, visible: !s.visible } : s
                            ),
                          })
                        }
                        className={`p-1.5 rounded-lg cursor-pointer ${
                          secItem.visible ? 'text-emerald-400 bg-emerald-950/40' : 'text-[#A9B2AE]'
                        }`}
                      >
                        {secItem.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            homeSections: moveOrderedItem(draft.homeSections, secItem.id, 'up'),
                          })
                        }
                        className="p-1.5 rounded-lg text-[#A9B2AE] hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === draft.homeSections.length - 1}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            homeSections: moveOrderedItem(draft.homeSections, secItem.id, 'down'),
                          })
                        }
                        className="p-1.5 rounded-lg text-[#A9B2AE] hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 space-y-3 border border-white/10">
              <h3 className="text-sm font-bold text-[#F5F3EE]">صفحات شريط التنقل والفوتر</h3>
              <div className="space-y-2">
                {draft.navPages.map((pg, idx) => (
                  <div
                    key={pg.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0A0D0C] border border-white/10"
                  >
                    <input
                      type="text"
                      value={pg.label}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          navPages: draft.navPages.map((p) =>
                            p.id === pg.id ? { ...p, label: e.target.value } : p
                          ),
                        })
                      }
                      className="flex-1 bg-transparent text-xs text-[#F5F3EE] px-2 py-1 rounded border border-transparent focus:border-white/20"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={pg.id === 'home'}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            navPages: draft.navPages.map((p) =>
                              p.id === pg.id ? { ...p, visible: !p.visible } : p
                            ),
                          })
                        }
                        className={`p-1.5 rounded-lg cursor-pointer ${
                          pg.visible ? 'text-emerald-400 bg-emerald-950/40' : 'text-[#A9B2AE]'
                        }`}
                      >
                        {pg.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            navPages: moveOrderedItem(draft.navPages, pg.id, 'up'),
                          })
                        }
                        className="p-1.5 rounded-lg text-[#A9B2AE] hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === draft.navPages.length - 1}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            navPages: moveOrderedItem(draft.navPages, pg.id, 'down'),
                          })
                        }
                        className="p-1.5 rounded-lg text-[#A9B2AE] hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* HomePage Featured 8 Reciters Selector */}
          <div className="glass-panel rounded-2xl p-6 space-y-4 border border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#F5F3EE]">
                  الشيوخ المميزون في الصفحة الرئيسية ({toArabicDigits((draft.featuredReciterOverrides || []).length)} / ٨ مختارين)
                </h3>
                <p className="text-xs text-[#A9B2AE]">
                  اتركها فارغة لعرض الترتيب الافتراضي لأبرز ٨ قراء، أو اختر حتى ٨ شيوخ يظهرون في الواجهة دون إطالة الصفحة.
                </p>
              </div>
              {(draft.featuredReciterOverrides || []).length > 0 && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, featuredReciterOverrides: [] })}
                  className="text-xs text-[#C8A253] hover:underline cursor-pointer"
                >
                  استعادة الاختيار الافتراضي
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
              {CANONICAL_RECITERS.filter((r) => !isBlockedReciter(r)).map((r) => {
                const picked = (draft.featuredReciterOverrides || []).includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      const cur = draft.featuredReciterOverrides || [];
                      const next = picked
                        ? cur.filter((id) => id !== r.id)
                        : [...cur, r.id].slice(0, 8);
                      setDraft({ ...draft, featuredReciterOverrides: next });
                    }}
                    className={`px-3 py-2 rounded-xl border text-right text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      picked
                        ? 'bg-[#0E6B4D]/35 border-[#178A64] text-[#F5F3EE] font-semibold'
                        : 'bg-[#0A0D0C]/70 border-white/10 text-[#A9B2AE] hover:text-white'
                    }`}
                  >
                    <span className="truncate">{r.nameAr}</span>
                    {picked && <Check className="w-3.5 h-3.5 text-[#6EE7B7] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: RECITERS, AUDIO PROBE & CATALOG CONTROLS */}
      {activeTab === 'reciters' && (
        <section className="space-y-6">
          {/* Real Audio Stream Probe */}
          <div className="glass-panel rounded-2xl p-6 border border-[#C8A253]/25 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-[#F5F3EE] flex items-center gap-2">
                <Wifi className="w-4 h-4 text-[#C8A253]" />
                <span>فاحص روابط التلاوات الصوتية المباشر</span>
              </h2>
              <p className="text-xs text-[#A9B2AE]">
                تحقق فعليًا من استجابة الخادم وجودة الملف الصوتي وزمن الاستجابة قبل الاعتماد.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                dir="ltr"
                value={probeUrl}
                onChange={(e) => setProbeUrl(e.target.value)}
                placeholder="https://server.../001.mp3"
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
              <button
                type="button"
                onClick={() => void handleProbeAudio()}
                disabled={probingAudio}
                className="px-4 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs font-semibold text-[#F5F3EE] cursor-pointer disabled:opacity-60"
              >
                {probingAudio ? 'جارٍ الفحص...' : 'فحص الرابط الآن'}
              </button>
            </div>
            {probeResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
                  probeResult.ok
                    ? 'bg-emerald-950/40 border-emerald-500/35 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-500/35 text-rose-200'
                }`}
              >
                <span>
                  {probeResult.ok ? 'الرابط يعمل بشكل سليم' : `تعذر التشغيل (${probeResult.error || probeResult.status})`}
                </span>
                <span dir="ltr" className="font-mono text-[11px]">
                  HTTP {probeResult.status} · {probeResult.contentType} · {probeResult.latencyMs}ms
                  {probeResult.contentLengthBytes
                    ? ` · ${(probeResult.contentLengthBytes / 1024).toFixed(0)} KB`
                    : ''}
                </span>
              </div>
            )}
          </div>

          {/* All Reciters Enable/Disable + Quick Stream Probe */}
          <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#F5F3EE]">
                  التحكم في القراء ({toArabicDigits(CANONICAL_RECITERS.filter((r) => !isBlockedReciter(r)).length)})
                </h3>
                <p className="text-xs text-[#A9B2AE]">
                  أوقف أو أعد تفعيل أي قارئ، ثم اضغط «حفظ ونشر للجميع» ليختفي أو يظهر فورًا عند كل الزوار.
                </p>
              </div>
              <input
                type="search"
                value={reciterSearch}
                onChange={(e) => setReciterSearch(e.target.value)}
                placeholder="ابحث باسم القارئ..."
                className="w-full sm:w-64 px-3.5 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
              {allEditableReciters.map((r) => {
                const disabled = sec.disabledReciterIds.includes(r.id);
                const sampleCol = r.collections[0];
                const sampleUrl = sampleCol
                  ? buildSurahAudioUrl(
                      sampleCol.server,
                      getDefaultPlayableSurahNumber(r),
                      sampleCol.surahUrls
                    )
                  : '';
                return (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                      disabled
                        ? 'bg-rose-950/20 border-rose-500/25 opacity-75'
                        : 'bg-[#0A0D0C]/75 border-white/10'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#F5F3EE] truncate">{r.nameAr}</p>
                      <p className="text-[11px] text-[#A9B2AE] truncate">
                        {r.collections.length} رواية · {r.titleAr}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {sampleUrl && (
                        <button
                          type="button"
                          onClick={() => void handleProbeAudio(sampleUrl)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-[#C8A253] cursor-pointer"
                        >
                          فحص البث
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleDisabledReciter(r.id)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-medium cursor-pointer ${
                          disabled
                            ? 'bg-emerald-950/50 text-emerald-200 border border-emerald-500/35'
                            : 'bg-rose-950/40 text-rose-200 border border-rose-500/30'
                        }`}
                      >
                        {disabled ? 'إعادة التفعيل' : 'إخفاء مؤقت'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add / Delete Cloud Reciters (Firestore) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleAddReciterToFirestore}
              className="glass-panel rounded-2xl p-6 space-y-3 border border-white/10"
            >
              <h3 className="text-sm font-bold text-[#F5F3EE]">إضافة قارئ سحابي مخصص</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  dir="ltr"
                  placeholder="slug-id (مثال: new-reciter)"
                  value={newReciterId}
                  onChange={(e) => setNewReciterId(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                />
                <input
                  type="text"
                  placeholder="الاسم بالعربية"
                  value={newReciterNameAr}
                  onChange={(e) => setNewReciterNameAr(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                />
                <input
                  type="text"
                  dir="ltr"
                  placeholder="English Name"
                  value={newReciterNameEn}
                  onChange={(e) => setNewReciterNameEn(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                />
                <input
                  type="text"
                  placeholder="اللقب (مثال: قارئ للقرآن الكريم)"
                  value={newReciterTitleAr}
                  onChange={(e) => setNewReciterTitleAr(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                />
                <input
                  type="url"
                  dir="ltr"
                  placeholder="رابط الصورة https://..."
                  value={newReciterPhotoUrl}
                  onChange={(e) => setNewReciterPhotoUrl(e.target.value)}
                  className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                />
                <textarea
                  rows={2}
                  placeholder="نبذة تعريفية عن القارئ"
                  value={newReciterBioAr}
                  onChange={(e) => setNewReciterBioAr(e.target.value)}
                  className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                />
              </div>
              <button
                type="submit"
                disabled={isSavingReciter}
                className="px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs font-semibold text-white cursor-pointer"
              >
                {isSavingReciter ? 'جارٍ الحفظ...' : 'إضافة القارئ للسحابة'}
              </button>
            </form>

            <div className="glass-panel rounded-2xl p-6 space-y-3 border border-white/10">
              <h3 className="text-sm font-bold text-[#F5F3EE]">
                القراء السحابيون المضافون ({toArabicDigits(serverReciters.length)})
              </h3>
              {serverReciters.length === 0 ? (
                <p className="text-xs text-[#A9B2AE]">لا يوجد قراء مخصصون في السحابة حاليًا.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {serverReciters.map((sr) => (
                    <div
                      key={sr.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#0A0D0C] border border-white/10 text-xs"
                    >
                      <span className="truncate text-[#F5F3EE]">
                        {sr.nameAr} ({sr.id})
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleDeleteServerReciter(sr.id, sr.nameAr)}
                        className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-950/50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TAB 5: DESIGN, COLORS & TYPOGRAPHY */}
      {activeTab === 'design' && (
        <section className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-5 border border-white/10">
            <h2 className="text-lg font-display font-bold text-[#F5F3EE]">
              لوحة الألوان والخطوط والهوية البصرية
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {THEME_PRESETS.map((preset) => {
                const selected = draft.theme.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, theme: { ...preset.theme } })}
                    className={`text-right p-4 rounded-2xl border transition-all cursor-pointer ${
                      selected
                        ? 'bg-[#0E6B4D]/25 border-[#C8A253]'
                        : 'bg-[#0A0D0C]/70 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-4 h-4 rounded-full border border-white/20"
                          style={{ backgroundColor: preset.theme.bgObsidian }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-white/20"
                          style={{ backgroundColor: preset.theme.emeraldDeep }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-white/20"
                          style={{ backgroundColor: preset.theme.goldAntique }}
                        />
                      </div>
                      {selected && <Check className="w-4 h-4 text-[#C8A253]" />}
                    </div>
                    <p className="text-xs font-bold text-[#F5F3EE]">{preset.nameAr}</p>
                    <p className="text-[11px] text-[#A9B2AE] mt-1">{preset.descriptionAr}</p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              {[
                { key: 'bgObsidian', label: 'الخلفية الرئيسية' },
                { key: 'bgSurface', label: 'خلفية البطاقات' },
                { key: 'bgElevated', label: 'البطاقات البارزة' },
                { key: 'emeraldDeep', label: 'الزمردي الأساسي' },
                { key: 'emeraldSoft', label: 'الزمردي المضيء' },
                { key: 'goldAntique', label: 'الذهبي العتيق' },
                { key: 'textPrimary', label: 'لون النص الأساسي' },
                { key: 'textSecondary', label: 'لون النص الفرعي' },
              ].map((item) => {
                const key = item.key as keyof typeof draft.theme;
                return (
                  <div key={item.key} className="space-y-1.5">
                    <label className="text-xs text-[#A9B2AE] block">{item.label}</label>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-[#0A0D0C] border border-white/10">
                      <input
                        type="color"
                        value={draft.theme[key]}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            theme: {
                              ...draft.theme,
                              presetId: 'custom',
                              [key]: e.target.value,
                            },
                          })
                        }
                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                      />
                      <span dir="ltr" className="text-xs font-mono text-[#F5F3EE]">
                        {draft.theme[key]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Typography Controls */}
          <div className="glass-panel rounded-2xl p-6 space-y-4 border border-white/10">
            <h3 className="text-base font-bold text-[#F5F3EE]">الخطوط والأبعاد والتأثيرات الزجاجية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-[#A9B2AE]">خط العناوين (.font-display)</label>
                <select
                  value={typo.displayFont}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      typography: {
                        ...typo,
                        displayFont: e.target.value as typeof typo.displayFont,
                      },
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
                >
                  <option value="Amiri">Amiri — أميري (تراثي أنيق)</option>
                  <option value="Noto Naskh Arabic">Noto Naskh Arabic — النسخ</option>
                  <option value="Cairo">Cairo — القاهرة الحديث</option>
                  <option value="IBM Plex Sans Arabic">IBM Plex Sans Arabic</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[#A9B2AE]">خط النصوص والقوائم الأساسي</label>
                <select
                  value={typo.bodyFont}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      typography: { ...typo, bodyFont: e.target.value as typeof typo.bodyFont },
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
                >
                  <option value="IBM Plex Sans Arabic">IBM Plex Sans Arabic</option>
                  <option value="Cairo">Cairo</option>
                  <option value="Readex Pro">Readex Pro</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[#A9B2AE]">
                  حجم الخط الأساسي: {toArabicDigits(typo.baseFontSizePx)}px
                </label>
                <input
                  type="range"
                  min={14}
                  max={19}
                  value={typo.baseFontSizePx}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      typography: { ...typo, baseFontSizePx: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-[#C8A253]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[#A9B2AE]">
                  شدة ضبابية الزجاج (Glass Blur): {toArabicDigits(typo.glassBlurPx)}px
                </label>
                <input
                  type="range"
                  min={0}
                  max={28}
                  value={typo.glassBlurPx}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      typography: { ...typo, glassBlurPx: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-[#C8A253]"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 6: AUDIO PLAYER CONTROLS */}
      {activeTab === 'player' && (
        <section className="glass-panel rounded-2xl p-6 space-y-5 border border-white/10">
          <h2 className="text-lg font-display font-bold text-[#F5F3EE] flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#C8A253]" />
            <span>إعدادات مشغل التلاوة الصوتي الافتراضية</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-4 rounded-2xl bg-[#0A0D0C] border border-white/10 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#A9B2AE]">مستوى الصوت الافتراضي</span>
                <span className="text-[#C8A253] font-mono-nums">
                  {Math.round(ply.defaultVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={ply.defaultVolume}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    audioPlayer: { ...ply, defaultVolume: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#0E6B4D]"
              />
            </div>

            <div className="p-4 rounded-2xl bg-[#0A0D0C] border border-white/10 space-y-2">
              <span className="text-xs text-[#A9B2AE] block">سرعة التلاوة الافتراضية</span>
              <div className="flex gap-2">
                {[0.75, 1, 1.25, 1.5].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        audioPlayer: { ...ply, defaultPlaybackRate: r },
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono-nums cursor-pointer ${
                      ply.defaultPlaybackRate === r
                        ? 'bg-[#0E6B4D] text-white'
                        : 'bg-white/5 text-[#A9B2AE]'
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'autoPlayNext', label: 'تشغيل السورة التالية تلقائيًا (Auto-Play Next)' },
              { key: 'showWaveform', label: 'إظهار أعمدة الموجة الصوتية الحية' },
              { key: 'enableSleepTimer', label: 'تفعيل ميزة مؤقت النوم في المشغل' },
              { key: 'enableSegmentLoop', label: 'تفعيل ميزة تكرار المقطع (أ - ب) للتحفيظ' },
            ].map((flag) => {
              const k = flag.key as keyof typeof ply;
              return (
                <label
                  key={flag.key}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0A0D0C] border border-white/10 text-xs text-[#F5F3EE] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(ply[k])}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        audioPlayer: { ...ply, [k]: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-[#C8A253]"
                  />
                  <span>{flag.label}</span>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 7: SEO, PERFORMANCE & ANDROID OTA */}
      {activeTab === 'seo-perf' && (
        <section className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-4 border border-white/10">
            <h2 className="text-lg font-display font-bold text-[#F5F3EE]">
              تحسين محركات البحث (SEO) والبيانات الوصفية
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-[#A9B2AE]">عنوان المتصفح لمحركات البحث (Meta Title)</label>
                <input
                  type="text"
                  value={seo.metaTitle}
                  onChange={(e) => setDraft({ ...draft, seo: { ...seo, metaTitle: e.target.value } })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-[#A9B2AE]">وصف الموقع في نتائج جوجل (Meta Description)</label>
                <textarea
                  rows={2}
                  value={seo.metaDescription}
                  onChange={(e) =>
                    setDraft({ ...draft, seo: { ...seo, metaDescription: e.target.value } })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs text-[#A9B2AE]">الكلمات المفتاحية (Meta Keywords)</label>
                <input
                  type="text"
                  value={seo.metaKeywords}
                  onChange={(e) =>
                    setDraft({ ...draft, seo: { ...seo, metaKeywords: e.target.value } })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[#A9B2AE]">عنوان المشاركة (OpenGraph Title)</label>
                <input
                  type="text"
                  value={seo.ogTitle}
                  onChange={(e) => setDraft({ ...draft, seo: { ...seo, ogTitle: e.target.value } })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-[#A9B2AE]">الرابط الرسمي (Canonical URL)</label>
                <input
                  type="url"
                  dir="ltr"
                  value={seo.canonicalUrl}
                  onChange={(e) =>
                    setDraft({ ...draft, seo: { ...seo, canonicalUrl: e.target.value } })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-sm text-[#F5F3EE]"
                />
              </div>
              <label className="flex items-center gap-2.5 text-xs text-[#F5F3EE] md:col-span-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seo.robotsIndex}
                  onChange={(e) =>
                    setDraft({ ...draft, seo: { ...seo, robotsIndex: e.target.checked } })
                  }
                  className="w-4 h-4 accent-[#C8A253]"
                />
                <span>السماح لمحركات البحث (Google / Bing) بفهرسة الموقع</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Settings */}
            <div className="glass-panel rounded-2xl p-6 space-y-4 border border-white/10">
              <h3 className="text-base font-bold text-[#F5F3EE]">الأداء والتخزين المؤقت دون إنترنت</h3>
              <label className="flex items-center gap-2.5 text-xs text-[#F5F3EE] cursor-pointer">
                <input
                  type="checkbox"
                  checked={perf.precacheQuranOffline}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      performance: { ...perf, precacheQuranOffline: e.target.checked },
                    })
                  }
                  className="w-4 h-4 accent-[#C8A253]"
                />
                <span>تجهيز وتخزين نص المصحف الشريف للعمل دون إنترنت تلقائيًا</span>
              </label>
              <label className="flex items-center gap-2.5 text-xs text-[#F5F3EE] cursor-pointer">
                <input
                  type="checkbox"
                  checked={perf.prefetchNextSurah}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      performance: { ...perf, prefetchNextSurah: e.target.checked },
                    })
                  }
                  className="w-4 h-4 accent-[#C8A253]"
                />
                <span>التهيئة المسبقة للسورة التالية لتحسين سرعة الانتقال</span>
              </label>
              <div className="space-y-1">
                <label className="text-xs text-[#A9B2AE]">
                  مدة بقاء الكاش (ساعة): {toArabicDigits(perf.cacheTtlHours)}
                </label>
                <input
                  type="range"
                  min={1}
                  max={168}
                  value={perf.cacheTtlHours}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      performance: { ...perf, cacheTtlHours: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-[#C8A253]"
                />
              </div>
            </div>

            {/* Offline PWA & OTA Live Sync Controls */}
            <div className="glass-panel rounded-2xl p-6 space-y-4 border border-white/10">
              <h3 className="text-base font-bold text-[#F5F3EE] flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#C8A253]" />
                <span>تحديثات الموقع الحية والعمل دون إنترنت (PWA Sync)</span>
              </h3>
              <p className="text-xs text-[#A9B2AE] leading-relaxed">
                يتم حفظ التحديثات الفورية للمحتوى والإعدادات مباشرة على الموقع وتطبيق الويب المثبت عبر مزامنة الخادم الحية دون الحاجة لحزم تثبيت خارجية.
              </p>
              <input
                type="url"
                dir="ltr"
                value={draft.ota.manifestUrl}
                onChange={(e) =>
                  setDraft({ ...draft, ota: { ...draft.ota, manifestUrl: e.target.value } })
                }
                className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
              <input
                type="text"
                value={draft.ota.releaseNotes}
                onChange={(e) =>
                  setDraft({ ...draft, ota: { ...draft.ota, releaseNotes: e.target.value } })
                }
                placeholder="ملاحظات الإصدار الحالية..."
                className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={triggerAndroidOtaCheck}
                  className="px-3.5 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs font-semibold text-white cursor-pointer"
                >
                  التحقق من مزامنة الإصدار الحي
                </button>
                {androidOta.otaUpdateReady && (
                  <button
                    type="button"
                    onClick={applyAndroidOtaUpdate}
                    className="px-3.5 py-2 rounded-xl bg-[#C8A253] text-[#0A0D0C] text-xs font-bold cursor-pointer"
                  >
                    تطبيق التحديث الجديد الآن
                  </button>
                )}
                {androidOta.isAndroidApk && (
                  <button
                    type="button"
                    onClick={resetAndroidEmbeddedBundle}
                    className="px-3 py-2 rounded-xl bg-white/5 text-xs text-[#A9B2AE] cursor-pointer"
                  >
                    استعادة الافتراضي
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 8: SECURITY & GENERAL SETTINGS */}
      {activeTab === 'security' && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* General / Maintenance Mode */}
            <div className="glass-panel rounded-2xl p-6 space-y-4 border border-white/10">
              <h2 className="text-base font-bold text-[#F5F3EE]">الإعدادات العامة ووضع الصيانة</h2>
              <label className="flex items-center gap-2.5 text-xs text-[#F5F3EE] cursor-pointer">
                <input
                  type="checkbox"
                  checked={gen.maintenanceMode}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      general: { ...gen, maintenanceMode: e.target.checked },
                    })
                  }
                  className="w-4 h-4 accent-[#C8A253]"
                />
                <span>تفعيل إشعار الصيانة والتحديث أعلى الموقع للزوار</span>
              </label>
              <input
                type="text"
                value={gen.maintenanceMessage}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    general: { ...gen, maintenanceMessage: e.target.value },
                  })
                }
                className="w-full px-3.5 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
              <label className="flex items-center gap-2.5 text-xs text-[#F5F3EE] cursor-pointer">
                <input
                  type="checkbox"
                  checked={gen.showHijriDate}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      general: { ...gen, showHijriDate: e.target.checked },
                    })
                  }
                  className="w-4 h-4 accent-[#C8A253]"
                />
                <span>إظهار التاريخ الهجري في شريط الترحيب والشهادات</span>
              </label>

              <div className="pt-3 border-t border-white/10 space-y-3">
                <h3 className="text-xs font-bold text-[#C8A253]">أمان جلسة المالك</h3>
                <div className="space-y-1">
                  <label className="text-xs text-[#A9B2AE]">
                    مدة صلاحية الجلسة (بالدقائق): {toArabicDigits(sec.sessionTimeoutMinutes)}
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={43200}
                    value={sec.sessionTimeoutMinutes}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        security: {
                          ...sec,
                          sessionTimeoutMinutes: Math.max(15, Number(e.target.value) || 720),
                        },
                      })
                    }
                    className="w-40 px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void revokeAllOwnerSessions()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/40 text-xs font-semibold text-rose-200 cursor-pointer"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>إنهاء جميع جلسات المالك المفتوحة فورًا</span>
                </button>
              </div>
            </div>

            {/* Blocked Keywords, Allowed Domains & Config Export/Import */}
            <div className="glass-panel rounded-2xl p-6 space-y-4 border border-white/10">
              <h2 className="text-base font-bold text-[#F5F3EE]">
                تصفية القراء الممنوعين ونطاقات الصوت الموثوقة
              </h2>
              <div className="space-y-2">
                <label className="text-xs text-[#A9B2AE]">كلمات محظورة لإخفاء القراء غير المرغوب بهم:</label>
                <div className="flex flex-wrap gap-1.5">
                  {sec.blockedReciterKeywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-500/30 text-[11px] text-rose-200"
                    >
                      <span>{kw}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            security: {
                              ...sec,
                              blockedReciterKeywords: sec.blockedReciterKeywords.filter(
                                (item) => item !== kw
                              ),
                            },
                          })
                        }
                        className="hover:text-white cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newBlockedKeyword}
                    onChange={(e) => setNewBlockedKeyword(e.target.value)}
                    placeholder="أضف اسم قارئ أو كلمة محظورة..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = newBlockedKeyword.trim();
                      if (!val) return;
                      setDraft({
                        ...draft,
                        security: {
                          ...sec,
                          blockedReciterKeywords: Array.from(
                            new Set([...sec.blockedReciterKeywords, val])
                          ),
                        },
                      });
                      setNewBlockedKeyword('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/10 text-xs text-[#F5F3EE] cursor-pointer"
                  >
                    إضافة
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="text-xs text-[#A9B2AE]">نطاقات البث الصوتي الموثوقة:</label>
                <div className="flex flex-wrap gap-1.5">
                  {sec.allowedAudioDomains.map((dom) => (
                    <span
                      key={dom}
                      dir="ltr"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono text-[#A9B2AE]"
                    >
                      <span>{dom}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            security: {
                              ...sec,
                              allowedAudioDomains: sec.allowedAudioDomains.filter((d) => d !== dom),
                            },
                          })
                        }
                        className="hover:text-rose-300 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={newAllowedDomain}
                    onChange={(e) => setNewAllowedDomain(e.target.value)}
                    placeholder="cdn.example.org"
                    className="flex-1 px-3 py-1.5 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = newAllowedDomain.trim().toLowerCase();
                      if (!val) return;
                      setDraft({
                        ...draft,
                        security: {
                          ...sec,
                          allowedAudioDomains: Array.from(new Set([...sec.allowedAudioDomains, val])),
                        },
                      });
                      setNewAllowedDomain('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/10 text-xs text-[#F5F3EE] cursor-pointer"
                  >
                    إضافة
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportConfigJson}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#F5F3EE] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#C8A253]" />
                  <span>تصدير الإعدادات (JSON)</span>
                </button>
                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#F5F3EE] cursor-pointer">
                  <FileJson className="w-3.5 h-3.5 text-[#C8A253]" />
                  <span>استيراد ملف إعدادات (JSON)</span>
                  <input
                    type="file"
                    accept="application/json"
                    onChange={handleImportConfigJson}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 9: BACKUPS, ROLLBACK & AUDIT LOG */}
      {activeTab === 'audit-backups' && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Backups & Rollback */}
          <div className="lg:col-span-6 glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#F5F3EE] flex items-center gap-2">
                <ArchiveRestore className="w-4 h-4 text-[#C8A253]" />
                <span>النسخ الاحتياطية والتراجع الفوري</span>
              </h2>
              <button
                type="button"
                onClick={() => void loadAuditAndBackups()}
                className="text-xs text-[#C8A253] hover:underline cursor-pointer"
              >
                {loadingAdminData ? 'تحديث...' : 'تحديث'}
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={manualBackupLabel}
                onChange={(e) => setManualBackupLabel(e.target.value)}
                placeholder="اسم النسخة الاحتياطية (اختياري)..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
              />
              <button
                type="button"
                onClick={() => void handleCreateManualBackup()}
                disabled={creatingBackup}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{creatingBackup ? 'جارٍ الحفظ...' : 'حفظ نسخة الآن'}</span>
              </button>
            </div>

            {backups.length === 0 ? (
              <p className="text-xs text-[#A9B2AE]">
                تُنشأ النسخ الاحتياطية تلقائيًا عند كل نشر إعدادات أو تعديل كود من AI Developer، أو يدويًا من الزر أعلاه.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {backups.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl bg-[#0A0D0C]/80 border border-white/10 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-semibold text-[#F5F3EE] truncate">{b.label}</p>
                      <p className="text-[11px] text-[#A9B2AE]">
                        {b.reason} · {toArabicDigits(b.filesCount)} ملف
                      </p>
                      <p className="text-[10px] text-[#A9B2AE]/70">
                        {new Date(b.createdAt).toLocaleString('ar-EG')}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={restoringId === b.id}
                      onClick={() => void handleRestoreBackup(b.id, b.label)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C8A253]/20 hover:bg-[#C8A253]/30 border border-[#C8A253]/40 text-xs font-semibold text-[#C8A253] cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{restoringId === b.id ? 'جارٍ الاستعادة...' : 'استعادة (Rollback)'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit Log */}
          <div className="lg:col-span-6 glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
            <h2 className="text-base font-bold text-[#F5F3EE] flex items-center gap-2">
              <History className="w-4 h-4 text-[#C8A253]" />
              <span>سجل التعديلات والأمان (Audit Log)</span>
            </h2>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-[#A9B2AE]">لا توجد عمليات مسجلة بعد.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {auditLogs.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-xl bg-[#0A0D0C]/75 border border-white/10 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#F5F3EE]">{entry.action}</span>
                      <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] text-[#C8A253]">
                        {entry.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#A9B2AE]">{entry.summary}</p>
                    <p className="text-[10px] text-[#A9B2AE]/65">
                      {new Date(entry.timestamp).toLocaleString('ar-EG')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB: SECTION BOOSTER & VISUAL APPEARANCE STUDIO */}
      {activeTab === 'sections-boost' && (() => {
        const enhancementsMap = draft.sectionEnhancements || DEFAULT_SECTION_ENHANCEMENTS;
        const activeTarget =
          SECTION_ENHANCEMENT_TARGETS.find((t) => t.id === selectedBoostSectionId) ||
          SECTION_ENHANCEMENT_TARGETS[0];
        const activeCfg: SectionEnhancementConfig =
          enhancementsMap[activeTarget.id] || DEFAULT_SECTION_ENHANCEMENT_ITEM;
        const boostedCount = SECTION_ENHANCEMENT_TARGETS.filter(
          (t) => enhancementsMap[t.id]?.boosted
        ).length;

        const updateActiveEnhancement = (patch: Partial<SectionEnhancementConfig>) => {
          setDraft((prev) => ({
            ...prev,
            sectionEnhancements: {
              ...(prev.sectionEnhancements || DEFAULT_SECTION_ENHANCEMENTS),
              [activeTarget.id]: {
                ...((prev.sectionEnhancements || DEFAULT_SECTION_ENHANCEMENTS)[activeTarget.id] ||
                  DEFAULT_SECTION_ENHANCEMENT_ITEM),
                ...patch,
              },
            },
          }));
        };

        const activePresetMeta =
          SECTION_STYLE_PRESETS.find((p) => p.id === activeCfg.stylePreset) ||
          SECTION_STYLE_PRESETS[0];

        return (
          <section className="space-y-6">
            {/* Header Summary Bar */}
            <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-[#C8A253]/25 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#C8A253]">
                  <Sparkles className="w-4 h-4" />
                  <span>محرك تعزيز الأقسام وتطوير مظهرها الحي</span>
                </div>
                <h2 className="text-lg sm:text-xl font-display font-bold text-[#F5F3EE]">
                  تحكم مباشر في إبراز وتصميم أقسام الصفحة الرئيسية والصفحات المستقلة
                </h2>
                <p className="text-xs text-[#A9B2AE]">
                  الأقسام المفعّل فيها التعزيز حاليًا:{' '}
                  <strong className="font-mono-nums text-[#C8A253]">
                    {toArabicDigits(boostedCount)} / {toArabicDigits(SECTION_ENHANCEMENT_TARGETS.length)}
                  </strong>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => saveLocalPreview(draft)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-medium text-[#F5F3EE] cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Eye className="w-3.5 h-3.5 text-[#C8A253]" />
                  <span>معاينة فورية</span>
                </button>
                <button
                  type="button"
                  disabled={isPublishing}
                  onClick={() =>
                    void handlePublish(
                      `تحديث تعزيز وشكل قسم ${activeTarget.labelAr}`
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] disabled:opacity-50 text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
                >
                  <CloudUpload className="w-3.5 h-3.5 text-[#C8A253]" />
                  <span>{isPublishing ? 'جارٍ النشر...' : 'اعتماد ونشر التعزيزات'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Section Selector Column */}
              <div className="lg:col-span-4 glass-panel rounded-2xl p-4 border border-white/10 space-y-4">
                {(['الرئيسية', 'الأقسام المستقلة'] as const).map((groupName) => {
                  const groupItems = SECTION_ENHANCEMENT_TARGETS.filter(
                    (item) => item.groupAr === groupName
                  );
                  return (
                    <div key={groupName} className="space-y-2">
                      <p className="text-[11px] font-semibold text-[#C8A253] px-1">
                        {groupName === 'الرئيسية' ? 'أقسام الصفحة الرئيسية' : groupName} ({toArabicDigits(groupItems.length)})
                      </p>
                      <div className="space-y-1.5">
                        {groupItems.map((target) => {
                          const itemCfg =
                            enhancementsMap[target.id] || DEFAULT_SECTION_ENHANCEMENT_ITEM;
                          const isSelected = activeTarget.id === target.id;
                          return (
                            <button
                              key={target.id}
                              type="button"
                              onClick={() => setSelectedBoostSectionId(target.id)}
                              className={`w-full text-right px-3 py-2.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                                isSelected
                                  ? 'bg-[#0E6B4D]/25 border-[#C8A253]/60 text-[#F5F3EE]'
                                  : 'bg-[#0A0D0C]/70 border-white/10 text-[#A9B2AE] hover:text-[#F5F3EE] hover:border-white/20'
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate">{target.labelAr}</p>
                                <p className="text-[10px] opacity-80 truncate">
                                  {target.descriptionAr}
                                </p>
                              </div>
                              <span
                                className={`text-[10px] font-mono-nums px-2 py-0.5 rounded shrink-0 ${
                                  itemCfg.boosted
                                    ? 'bg-[#C8A253]/20 text-[#C8A253] border border-[#C8A253]/35'
                                    : 'bg-white/5 text-[#A9B2AE]/70'
                                }`}
                              >
                                {itemCfg.boosted ? 'مُعزَّز' : 'قياسي'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active Section Enhancement Editor + Live Mini Preview */}
              <div className="lg:col-span-8 space-y-5">
                <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-base font-display font-bold text-[#F5F3EE]">
                        {activeTarget.labelAr}
                      </h3>
                      <p className="text-xs text-[#A9B2AE]">{activeTarget.descriptionAr}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveEnhancement({
                            boosted: true,
                            stylePreset: 'royal_gold',
                            boostLevel: 'featured',
                            density: 'comfortable',
                            glowAccent: true,
                            showDivider: true,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C8A253]/20 hover:bg-[#C8A253]/30 border border-[#C8A253]/45 text-xs font-semibold text-[#C8A253] cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>تعزيز وتنسيق ذكي تلقائي</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateActiveEnhancement({ ...DEFAULT_SECTION_ENHANCEMENT_ITEM })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#A9B2AE] hover:text-white cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إعادة للافتراضي</span>
                      </button>
                    </div>
                  </div>

                  {/* Primary Boost Toggle */}
                  <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#0A0D0C]/80 border border-white/10 cursor-pointer">
                    <div>
                      <p className="text-xs font-semibold text-[#F5F3EE]">
                        تفعيل تعزيز القسم وإبراز شكله
                      </p>
                      <p className="text-[11px] text-[#A9B2AE]">
                        عند التفعيل يُطبق القالب البصري والوسم والفاصل الزخرفي مباشرة على هذا القسم.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={activeCfg.boosted}
                      onChange={(e) => updateActiveEnhancement({ boosted: e.target.checked })}
                      className="w-5 h-5 accent-[#C8A253] cursor-pointer shrink-0"
                    />
                  </label>

                  {/* Style Preset Swatches */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#C8A253]">
                      نمط التصميم والإطار (Visual Preset)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {SECTION_STYLE_PRESETS.map((preset) => {
                        const chosen = activeCfg.stylePreset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() =>
                              updateActiveEnhancement({
                                boosted: true,
                                stylePreset: preset.id,
                              })
                            }
                            className={`text-right p-3 rounded-xl border transition-colors cursor-pointer space-y-1.5 ${
                              chosen
                                ? 'border-[#C8A253] bg-[#0E6B4D]/20'
                                : 'border-white/10 bg-[#0A0D0C]/70 hover:border-white/25'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-[#F5F3EE]">
                                {preset.nameAr}
                              </span>
                              <span
                                className="w-4 h-4 rounded border shrink-0"
                                style={{
                                  borderColor: preset.previewBorder,
                                  background: preset.previewBg,
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-[#A9B2AE] leading-relaxed">
                              {preset.taglineAr}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Boost Level + Density */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-[#A9B2AE]">درجة الإبراز</label>
                      <select
                        value={activeCfg.boostLevel}
                        onChange={(e) =>
                          updateActiveEnhancement({
                            boostLevel: e.target.value as SectionEnhancementConfig['boostLevel'],
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                      >
                        <option value="standard">قياسي هادئ</option>
                        <option value="featured">مُمَيَّز (حلقة تأطير ناعمة)</option>
                        <option value="spotlight">واجهة مركزة (إطار ذهبي بارز)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-[#A9B2AE]">اتساع الحواف والتنفس البصري</label>
                      <select
                        value={activeCfg.density}
                        onChange={(e) =>
                          updateActiveEnhancement({
                            density: e.target.value as SectionEnhancementConfig['density'],
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                      >
                        <option value="compact">مدمج (Compact)</option>
                        <option value="comfortable">متوازن (Comfortable)</option>
                        <option value="spacious">رحب وموسع (Spacious)</option>
                      </select>
                    </div>
                  </div>

                  {/* Visual Effects Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#0A0D0C]/70 border border-white/10 text-xs text-[#F5F3EE] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeCfg.glowAccent}
                        onChange={(e) =>
                          updateActiveEnhancement({ glowAccent: e.target.checked })
                        }
                        className="w-4 h-4 accent-[#C8A253]"
                      />
                      <span>إضافة هالة إضاءة ذهبية خفيفة أعلى القسم</span>
                    </label>
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#0A0D0C]/70 border border-white/10 text-xs text-[#F5F3EE] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeCfg.showDivider}
                        onChange={(e) =>
                          updateActiveEnhancement({ showDivider: e.target.checked })
                        }
                        className="w-4 h-4 accent-[#C8A253]"
                      />
                      <span>إظهار خط فاصل ذهبي زخرفي أعلى القسم</span>
                    </label>
                  </div>

                  {/* Custom Copy / Badge Overrides */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-[#A9B2AE]">
                        وسم تعريفي قصير (اختياري)
                      </label>
                      <input
                        type="text"
                        maxLength={50}
                        value={activeCfg.badgeText}
                        onChange={(e) =>
                          updateActiveEnhancement({ badgeText: e.target.value })
                        }
                        placeholder="مثال: مختارات الشهر أو تحديث حصري"
                        className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[#A9B2AE]">
                        عنوان تعزيز إضافي (اختياري)
                      </label>
                      <input
                        type="text"
                        maxLength={120}
                        value={activeCfg.customHeadline}
                        onChange={(e) =>
                          updateActiveEnhancement({ customHeadline: e.target.value })
                        }
                        placeholder="عنوان مختصر يبرز القسم للزوار"
                        className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-xs text-[#A9B2AE]">
                        وصف توضيحي إضافي (اختياري)
                      </label>
                      <input
                        type="text"
                        maxLength={240}
                        value={activeCfg.customSubtitle}
                        onChange={(e) =>
                          updateActiveEnhancement({ customSubtitle: e.target.value })
                        }
                        placeholder="سطر توضيحي يظهر أعلى القسم عند تفعيل التعزيز"
                        className="w-full px-3 py-2 rounded-xl bg-[#0A0D0C] border border-white/15 text-xs text-[#F5F3EE]"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Mini Preview Box */}
                <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#A9B2AE]">
                    <span>معاينة حية لمظهر القسم الحالي:</span>
                    <span className="font-mono-nums text-[#C8A253]">
                      {activePresetMeta.nameAr}
                    </span>
                  </div>
                  <div
                    className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${
                      activeCfg.boosted && activeCfg.stylePreset !== 'default'
                        ? `section-boost-${activeCfg.stylePreset}`
                        : 'border-white/10 bg-[#0A0D0C]/80'
                    } ${
                      activeCfg.boosted && activeCfg.boostLevel === 'spotlight'
                        ? 'ring-1 ring-[#C8A253]/35'
                        : activeCfg.boosted && activeCfg.boostLevel === 'featured'
                        ? 'ring-1 ring-white/10'
                        : ''
                    }`}
                  >
                    {activeCfg.boosted && activeCfg.showDivider && (
                      <div aria-hidden="true" className="sanctuary-hairline mb-3" />
                    )}
                    <div className="space-y-1.5">
                      {activeCfg.badgeText.trim() && (
                        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C8A253]">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{activeCfg.badgeText.trim()}</span>
                        </p>
                      )}
                      <h4 className="text-base font-display font-bold text-[#F5F3EE]">
                        {activeCfg.customHeadline.trim() || activeTarget.labelAr}
                      </h4>
                      <p className="text-xs text-[#A9B2AE]">
                        {activeCfg.customSubtitle.trim() || activeTarget.descriptionAr}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}
      {/* Sticky Quick-Publish Action Bar when draft has unpublished changes */}
      {diffSections.length > 0 && (
        <div className="fixed bottom-16 md:bottom-4 inset-x-0 z-30 pointer-events-none px-4">
          <div className="max-w-4xl mx-auto pointer-events-auto glass-bar rounded-2xl border border-[#C8A253]/50 px-4 py-3 shadow-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[#F5F3EE] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C8A253] shrink-0" />
              <span>
                لديك <strong className="text-[#C8A253] font-mono-nums">{toArabicDigits(diffSections.length)}</strong> تعديلات غير منشورة ({diffSections.slice(0, 3).map((d) => d.labelAr).join(' · ')})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraft(publishedConfig)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#A9B2AE] hover:text-white cursor-pointer"
              >
                تجاهل
              </button>
              <button
                type="button"
                onClick={() => saveLocalPreview(draft)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-[#F5F3EE] cursor-pointer"
              >
                معاينة
              </button>
              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={isPublishing}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-xs font-semibold text-white cursor-pointer"
              >
                <CloudUpload className="w-3.5 h-3.5 text-[#C8A253]" />
                <span>{isPublishing ? 'جارٍ النشر...' : 'حفظ ونشر (Ctrl+S)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
