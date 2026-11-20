import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  Check,
  CloudUpload,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Info,
  LayoutList,
  LogIn,
  LogOut,
  Palette,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Type,
  Users,
} from 'lucide-react';
import { useAppData } from '../contexts/AppDataContext';
import { useDynamicConfig } from '../contexts/DynamicConfigContext';
import { HERO_BACKDROP_URL } from '../data/reciters';
import { upsertAdminReciter } from '../services/storeService';
import type { AppRoute, DynamicAppConfig } from '../types/tilawa';
import {
  ADMIN_EMAIL,
  moveOrderedItem,
  THEME_PRESETS,
} from '../utils/dynamicConfigHelpers';
import { toArabicDigits } from '../utils/quranHelpers';

interface AdminDashboardPageProps {
  navigate: (next: AppRoute) => void;
}

type AdminTab = 'texts' | 'theme' | 'images' | 'layout' | 'ota';

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ navigate }) => {
  const {
    config,
    publishedConfig,
    hasLocalPreview,
    isCheckingRemote,
    lastSyncedAt,
    remoteConnected,
    adminUser,
    isVerifiedAdmin,
    authLoading,
    androidOta,
    signInAsAdmin,
    signOutAdmin,
    checkRemoteConfigNow,
    triggerAndroidOtaCheck,
    applyAndroidOtaUpdate,
    resetAndroidEmbeddedBundle,
    saveLocalPreview,
    clearLocalPreview,
    publishConfigToServer,
    resetServerToDefault,
  } = useDynamicConfig();
  const { notify, refreshCatalog } = useAppData();

  const [activeTab, setActiveTab] = useState<AdminTab>('texts');
  const [draft, setDraft] = useState<DynamicAppConfig>(() => config);
  const [isPublishing, setIsPublishing] = useState(false);

  // Quick reciter publisher state
  const [newReciterId, setNewReciterId] = useState('');
  const [newReciterNameAr, setNewReciterNameAr] = useState('');
  const [newReciterNameEn, setNewReciterNameEn] = useState('');
  const [newReciterTitleAr, setNewReciterTitleAr] = useState('');
  const [newReciterBioAr, setNewReciterBioAr] = useState('');
  const [newReciterPhotoUrl, setNewReciterPhotoUrl] = useState('');
  const [isSavingReciter, setIsSavingReciter] = useState(false);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await publishConfigToServer(draft);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر نشر التحديث';
      notify(msg, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleAddReciterToFirestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerifiedAdmin) {
      notify(`سجّل الدخول بحساب المدير (${ADMIN_EMAIL}) أولًا للنشر في السيرفر`, 'error');
      return;
    }
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
      await refreshCatalog();
      notify('تم حفظ القارئ في السيرفر المركزي وتحديث المكتبة', 'success');
      setNewReciterId('');
      setNewReciterNameAr('');
      setNewReciterNameEn('');
      setNewReciterTitleAr('');
      setNewReciterBioAr('');
      setNewReciterPhotoUrl('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر حفظ القارئ';
      notify(msg, 'error');
    } finally {
      setIsSavingReciter(false);
    }
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'texts', label: 'النصوص والعناوين', icon: <Type className="w-4 h-4" /> },
    { id: 'theme', label: 'الألوان والمظهر', icon: <Palette className="w-4 h-4" /> },
    { id: 'images', label: 'الصور والخلفيات', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'layout', label: 'ترتيب الأقسام والصفحات', icon: <LayoutList className="w-4 h-4" /> },
    { id: 'ota', label: 'سيرفر التحديثات وAPK', icon: <Smartphone className="w-4 h-4" /> },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-24 space-y-6">
      {/* Top Admin Header */}
      <section className="glass-gold rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => navigate({ page: 'home' })}
              className="inline-flex items-center gap-1.5 text-xs text-[#C8A253] hover:underline cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة إلى الرئيسية</span>
            </button>
            <div className="flex flex-wrap items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-[#C8A253]" />
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#F5F3EE]">
                لوحة التحكم والتحديثات الديناميكية (Admin Dashboard)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#A9B2AE] max-w-2xl">
              عدّل النصوص والألوان والصور وترتيب الأقسام والصفحات مباشرة، وانشر التحديث لينعكس فوراً على جميع المتصفحات ونسخ Android APK المثبتة دون إعادة بناء.
            </p>
          </div>

          {/* Auth & Sync Controls */}
          <div className="flex flex-col items-end gap-2">
            {authLoading ? (
              <span className="text-xs text-[#A9B2AE]">جارٍ التحقق من الجلسة...</span>
            ) : adminUser ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-[#F5F3EE]">
                  {isVerifiedAdmin && <BadgeCheck className="w-4 h-4 text-[#38BDF8]" />}
                  <span>{adminUser.email}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void signOutAdmin()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#A9B2AE] cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>خروج</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void signInAsAdmin()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-semibold cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>تسجيل دخول المدير (Google)</span>
              </button>
            )}

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#A9B2AE]">
              <span>
                الإصدار المنشور:{' '}
                <strong className="text-[#C8A253]">#{toArabicDigits(publishedConfig.version)}</strong>
              </span>
              <span>·</span>
              <span className={remoteConnected ? 'text-emerald-400' : 'text-amber-300'}>
                {remoteConnected ? 'متصل بالسيرفر المركزي' : 'وضع التخزين المحلي المؤقت'}
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

        {/* Persistent Action Bar */}
        <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => saveLocalPreview(draft)}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-medium text-[#F5F3EE] cursor-pointer"
            >
              <Eye className="w-4 h-4 text-[#C8A253]" />
              <span>معاينة محلية فورية</span>
            </button>
            {hasLocalPreview && (
              <button
                type="button"
                onClick={clearLocalPreview}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/35 text-xs text-amber-200 cursor-pointer"
              >
                <EyeOff className="w-4 h-4" />
                <span>إلغاء المعاينة</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void checkRemoteConfigNow()}
              disabled={isCheckingRemote}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#A9B2AE] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingRemote ? 'animate-spin' : ''}`} />
              <span>جلب آخر نسخة من السيرفر</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void resetServerToDefault()}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#A9B2AE] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الافتراضي</span>
            </button>
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={isPublishing || !isVerifiedAdmin}
              title={!isVerifiedAdmin ? `يتطلب تسجيل الدخول بحساب ${ADMIN_EMAIL}` : undefined}
              className="inline-flex items-center gap-2 min-h-[42px] px-5 py-2 rounded-xl bg-[#C8A253] hover:bg-[#d6b368] disabled:opacity-50 text-[#0A0D0C] text-xs sm:text-sm font-bold cursor-pointer"
            >
              <CloudUpload className="w-4 h-4" />
              <span>{isPublishing ? 'جارٍ النشر...' : 'حفظ ونشر التحديث للجميع'}</span>
            </button>
          </div>
        </div>

        {!isVerifiedAdmin && (
          <div className="rounded-xl bg-[#0E6B4D]/15 border border-[#0E6B4D]/40 px-4 py-2.5 text-xs text-[#A9B2AE] flex items-center gap-2">
            <Info className="w-4 h-4 text-[#C8A253] shrink-0" />
            <span>
              يمكنك تجربة جميع التعديلات الآن عبر زر <strong>«معاينة محلية فورية»</strong>، وللنشر الحي على السيرفر المركزي لجميع نسخ APK يجب تسجيل الدخول بحساب الإدارة ({ADMIN_EMAIL}).
            </span>
          </div>
        )}
      </section>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-medium cursor-pointer transition-colors ${
              activeTab === tab.id
                ? 'bg-[#0E6B4D] text-white'
                : 'glass-panel text-[#A9B2AE] hover:text-[#F5F3EE]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Texts & Headings */}
      {activeTab === 'texts' && (
        <section className="glass-panel rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-display font-bold text-[#F5F3EE]">
            تعديل النصوص والعناوين والإشعارات
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1.5 block">
              <span className="text-xs text-[#A9B2AE]">اسم المنصة في الشريط والتذييل</span>
              <input
                type="text"
                value={draft.texts.siteName}
                onChange={(e) =>
                  setDraft({ ...draft, texts: { ...draft.texts, siteName: e.target.value } })
                }
                className="w-full rounded-xl bg-[#0A0D0C] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EE]"
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs text-[#A9B2AE]">الشعار النصي الفرعي</span>
              <input
                type="text"
                value={draft.texts.slogan}
                onChange={(e) =>
                  setDraft({ ...draft, texts: { ...draft.texts, slogan: e.target.value } })
                }
                className="w-full rounded-xl bg-[#0A0D0C] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EE]"
              />
            </label>
            <label className="space-y-1.5 block md:col-span-2">
              <span className="text-xs text-[#A9B2AE]">الشارة العلوية في الواجهة (Hero Badge)</span>
              <input
                type="text"
                value={draft.texts.heroBadge}
                onChange={(e) =>
                  setDraft({ ...draft, texts: { ...draft.texts, heroBadge: e.target.value } })
                }
                className="w-full rounded-xl bg-[#0A0D0C] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EE]"
              />
            </label>
            <label className="space-y-1.5 block md:col-span-2">
              <span className="text-xs text-[#A9B2AE]">العنوان الرئيسي للواجهة (Hero Title)</span>
              <input
                type="text"
                value={draft.texts.heroTitle}
                onChange={(e) =>
                  setDraft({ ...draft, texts: { ...draft.texts, heroTitle: e.target.value } })
                }
                className="w-full rounded-xl bg-[#0A0D0C] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EE]"
              />
            </label>
            <label className="space-y-1.5 block md:col-span-2">
              <span className="text-xs text-[#A9B2AE]">الوصف التعريفي للواجهة</span>
              <textarea
                rows={2}
                value={draft.texts.heroSubtitle}
                onChange={(e) =>
                  setDraft({ ...draft, texts: { ...draft.texts, heroSubtitle: e.target.value } })
                }
                className="w-full rounded-xl bg-[#0A0D0C] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EE]"
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs text-[#A9B2AE]">نص زر الاستماع الرئيسي</span>
              <input
                type="text"
                value={draft.texts.ctaListenLabel}
                onChange={(e) =>
                  setDraft({ ...draft, texts: { ...draft.texts, ctaListenLabel: e.target.value } })
                }
                className="w-full rounded-xl bg-[#0A0D0C] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EE]"
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs text-[#A9B2AE]">نص زر المصحف</span>
              <input
                type="text"
                value={draft.texts.ctaMushafLabel}
                onChange={(e) =>
                  setDraft({ ...draft, texts: { ...draft.texts, ctaMushafLabel: e.target.value } })
                }
                className="w-full rounded-xl bg-[#0A0D0C] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EE]"
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-xs text-[#A9B2AE]">نص زر التحفيظ</span>
              <input
                type="text"
                value={draft.texts.ctaTahfeezLabel}
                onChange={(e) =>
                  setDraft({ ...draft, texts: { ...draft.texts, ctaTahfeezLabel: e.target.value } })
                }
                className="w-full rounded-xl bg-[#0A0D0C] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EE]"
              />
            </label>
            <div className="space-y-1.5">
              <label className="inline-flex items-center gap-2 text-xs text-[#F5F3EE] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.texts.announcementEnabled}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      texts: { ...draft.texts, announcementEnabled: e.target.checked },
                    })
                  }
                />
                <span>إظهار شريط تنبيه/بشارة علوي في الرئيسية</span>
              </label>
              <input
                type="text"
                placeholder="مثال: أهلاً بكم في التحديث الجديد — وردك القرآني اليومي بانتظارك"
                value={draft.texts.announcementText}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    texts: { ...draft.texts, announcementText: e.target.value },
                  })
                }
                className="w-full rounded-xl bg-[#0A0D0C] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EE]"
              />
            </div>
            <label className="space-y-1.5 block md:col-span-2">
              <span className="text-xs text-[#A9B2AE]">عنوان قسم المصحف في الرئيسية</span>
              <input
                type="text"
                value={draft.texts.mushafShowcaseTitle}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    texts: { ...draft.texts, mushafShowcaseTitle: e.target.value },
                  })
                }
                className="w-full rounded-xl bg-[#0A0D0C] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EE]"
              />
            </label>
            <label className="space-y-1.5 block md:col-span-2">
              <span className="text-xs text-[#A9B2AE]">وصف التذييل (Footer)</span>
              <textarea
                rows={2}
                value={draft.texts.footerDescription}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    texts: { ...draft.texts, footerDescription: e.target.value },
                  })
                }
                className="w-full rounded-xl bg-[#0A0D0C] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EE]"
              />
            </label>
          </div>
        </section>
      )}

      {/* Tab 2: Theme & Colors */}
      {activeTab === 'theme' && (
        <section className="glass-panel rounded-2xl p-6 space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-display font-bold text-[#F5F3EE]">
              قوالب الألوان الجاهزة
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {THEME_PRESETS.map((preset) => {
                const selected = draft.theme.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, theme: { ...preset.theme } })}
                    className={`text-right rounded-2xl p-4 border transition-colors cursor-pointer space-y-2 ${
                      selected
                        ? 'border-[#C8A253] bg-[#C8A253]/10'
                        : 'border-white/10 bg-[#0A0D0C]/70 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
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
                    <div className="text-sm font-semibold text-[#F5F3EE]">{preset.nameAr}</div>
                    <p className="text-[11px] text-[#A9B2AE] leading-relaxed">
                      {preset.descriptionAr}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-white/10">
            <h3 className="text-sm font-semibold text-[#F5F3EE]">تخصيص الألوان بدقة</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(
                [
                  { key: 'bgObsidian', label: 'لون الخلفية الرئيسية' },
                  { key: 'bgSurface', label: 'لون البطاقات والأسطح' },
                  { key: 'bgElevated', label: 'لون العناصر البارزة' },
                  { key: 'emeraldDeep', label: 'لون الأزرار الرئيسي' },
                  { key: 'emeraldSoft', label: 'لون التمرير والتفاعل' },
                  { key: 'goldAntique', label: 'اللون الذهبي المميز' },
                  { key: 'textPrimary', label: 'لون النصوص الأساسية' },
                  { key: 'textSecondary', label: 'لون النصوص الفرعية' },
                ] as const
              ).map((field) => (
                <label
                  key={field.key}
                  className="rounded-xl bg-[#0A0D0C]/80 border border-white/10 p-3 flex items-center justify-between gap-2 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#F5F3EE]">{field.label}</div>
                    <div className="text-[11px] font-mono-nums text-[#A9B2AE]">
                      {draft.theme[field.key]}
                    </div>
                  </div>
                  <input
                    type="color"
                    value={draft.theme[field.key]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        theme: {
                          ...draft.theme,
                          presetId: 'custom',
                          [field.key]: e.target.value.toUpperCase(),
                        },
                      })
                    }
                    className="w-9 h-9 rounded-lg border-0 bg-transparent cursor-pointer shrink-0"
                  />
                </label>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tab 3: Images */}
      {activeTab === 'images' && (
        <section className="glass-panel rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-display font-bold text-[#F5F3EE]">
            إدارة الصور والخلفيات عن بُعد
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-3">
              <label className="space-y-1.5 block">
                <span className="text-xs text-[#A9B2AE]">
                  رابط صورة خلفية الواجهة الرئيسية (اتركه فارغاً لاستخدام الصورة المدمجة دون إنترنت)
                </span>
                <input
                  type="url"
                  dir="ltr"
                  placeholder="https://example.com/mosque-hero.jpg"
                  value={draft.images.heroBackdropUrl}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      images: { ...draft.images, heroBackdropUrl: e.target.value },
                    })
                  }
                  className="w-full rounded-xl bg-[#0A0D0C] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EE]"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    images: { ...draft.images, heroBackdropUrl: '' },
                  })
                }
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#A9B2AE] cursor-pointer"
              >
                استعادة الصورة الافتراضية المدمجة
              </button>
              <p className="text-xs text-[#A9B2AE] leading-relaxed">
                يتم حفظ أي صورة خارجية تلقائياً في ذاكرة التخزين المؤقت (Cache API) بمجرد تحميلها، وفي حال انقطاع الإنترنت أو تعطل الرابط يعود التطبيق تلقائياً للصورة المدمجة دون توقف.
              </p>
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/15 aspect-video bg-[#0A0D0C]">
              <img
                src={draft.images.heroBackdropUrl || HERO_BACKDROP_URL}
                alt="معاينة صورة الواجهة"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  if (img.dataset.fallbackApplied === '1') {
                    img.style.display = 'none';
                    return;
                  }
                  img.dataset.fallbackApplied = '1';
                  img.src = HERO_BACKDROP_URL;
                }}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </section>
      )}

      {/* Tab 4: Section & Navigation Ordering */}
      {activeTab === 'layout' && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Home Sections */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-display font-bold text-[#F5F3EE]">
              ترتيب وإظهار أقسام الصفحة الرئيسية
            </h2>
            <div className="space-y-2.5">
              {draft.homeSections.map((sec, idx) => (
                <div
                  key={sec.id}
                  className="rounded-xl bg-[#0A0D0C]/80 border border-white/10 px-3.5 py-3 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-xs font-mono-nums text-[#C8A253] w-5">
                      {toArabicDigits(idx + 1)}
                    </span>
                    <input
                      type="text"
                      value={sec.label}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          homeSections: draft.homeSections.map((s) =>
                            s.id === sec.id ? { ...s, label: e.target.value } : s
                          ),
                        })
                      }
                      className="bg-transparent text-xs sm:text-sm text-[#F5F3EE] border-b border-transparent focus:border-[#C8A253]/50 outline-none flex-1 min-w-0"
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          homeSections: moveOrderedItem(draft.homeSections, sec.id, 'up'),
                        })
                      }
                      disabled={idx === 0}
                      aria-label={`تحريك ${sec.label} لأعلى`}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          homeSections: moveOrderedItem(draft.homeSections, sec.id, 'down'),
                        })
                      }
                      disabled={idx === draft.homeSections.length - 1}
                      aria-label={`تحريك ${sec.label} لأسفل`}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          homeSections: draft.homeSections.map((s) =>
                            s.id === sec.id ? { ...s, visible: !s.visible } : s
                          ),
                        })
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer ${
                        sec.visible
                          ? 'bg-[#0E6B4D]/30 text-emerald-300 border border-[#0E6B4D]'
                          : 'bg-white/5 text-[#A9B2AE] border border-white/10'
                      }`}
                    >
                      {sec.visible ? 'ظاهر' : 'مخفي'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Nav Pages */}
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-display font-bold text-[#F5F3EE]">
              ترتيب وأسماء صفحات التنقل
            </h2>
            <div className="space-y-2.5">
              {draft.navPages.map((pg, idx) => (
                <div
                  key={pg.id}
                  className="rounded-xl bg-[#0A0D0C]/80 border border-white/10 px-3.5 py-3 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-xs font-mono-nums text-[#C8A253] w-5">
                      {toArabicDigits(idx + 1)}
                    </span>
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
                      className="bg-transparent text-xs sm:text-sm text-[#F5F3EE] border-b border-transparent focus:border-[#C8A253]/50 outline-none flex-1 min-w-0"
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          navPages: moveOrderedItem(draft.navPages, pg.id, 'up'),
                        })
                      }
                      disabled={idx === 0}
                      aria-label={`تحريك صفحة ${pg.label} لأعلى`}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          navPages: moveOrderedItem(draft.navPages, pg.id, 'down'),
                        })
                      }
                      disabled={idx === draft.navPages.length - 1}
                      aria-label={`تحريك صفحة ${pg.label} لأسفل`}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
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
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer disabled:opacity-50 ${
                        pg.visible
                          ? 'bg-[#0E6B4D]/30 text-emerald-300 border border-[#0E6B4D]'
                          : 'bg-white/5 text-[#A9B2AE] border border-white/10'
                      }`}
                    >
                      {pg.visible ? 'ظاهرة' : 'مخفية'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tab 5: OTA Updates & Custom Reciter */}
      {activeTab === 'ota' && (
        <section className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-5">
            <h2 className="text-lg font-display font-bold text-[#F5F3EE]">
              نظام التحديث الهوائي للتطبيق (Android OTA + Live Config)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1.5 block md:col-span-2">
                <span className="text-xs text-[#A9B2AE]">رابط ملف قائمة التحديث المركزي (ota-manifest.json)</span>
                <input
                  type="url"
                  dir="ltr"
                  value={draft.ota.manifestUrl}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      ota: { ...draft.ota, manifestUrl: e.target.value },
                    })
                  }
                  className="w-full rounded-xl bg-[#0A0D0C] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EE]"
                />
              </label>
              <label className="space-y-1.5 block md:col-span-2">
                <span className="text-xs text-[#A9B2AE]">ملاحظات التحديث للمستخدمين</span>
                <input
                  type="text"
                  value={draft.ota.releaseNotes}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      ota: { ...draft.ota, releaseNotes: e.target.value },
                    })
                  }
                  className="w-full rounded-xl bg-[#0A0D0C] border border-white/15 px-3.5 py-2.5 text-sm text-[#F5F3EE]"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-[#F5F3EE] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.ota.autoCheck}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      ota: { ...draft.ota, autoCheck: e.target.checked },
                    })
                  }
                />
                <span>التحقق التلقائي من وجود تحديثات عند تشغيل التطبيق</span>
              </label>
            </div>

            <div className="rounded-xl bg-[#0A0D0C]/80 border border-white/10 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1 text-xs">
                <div className="text-[#F5F3EE] font-semibold">
                  حالة الحزمة الحالية:{' '}
                  <span className="text-[#C8A253]">
                    {androidOta.isAndroidApk
                      ? androidOta.usingCachedBundle
                        ? `نسخة APK محدثة مخبأة (${androidOta.cachedVersion})`
                        : 'النسخة المدمجة داخل APK'
                      : 'نسخة الويب المباشرة'}
                  </span>
                </div>
                <p className="text-[#A9B2AE]">
                  المصحف الشريف بصفحاته الـ ٦٠٤ محفوظ بالكامل محلياً داخل الـ APK ويعمل دون إنترنت في كل الأحوال.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={triggerAndroidOtaCheck}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-medium cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${androidOta.checking ? 'animate-spin' : ''}`} />
                  <span>فحص وجود تحديث الآن</span>
                </button>
                {androidOta.otaUpdateReady && (
                  <button
                    type="button"
                    onClick={applyAndroidOtaUpdate}
                    className="px-4 py-2 rounded-xl bg-[#C8A253] text-[#0A0D0C] text-xs font-bold cursor-pointer"
                  >
                    تطبيق التحديث الجديد
                  </button>
                )}
                {androidOta.isAndroidApk && androidOta.usingCachedBundle && (
                  <button
                    type="button"
                    onClick={resetAndroidEmbeddedBundle}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-[#A9B2AE] cursor-pointer"
                  >
                    العودة للنسخة المدمجة
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Reciter Publisher */}
          <form onSubmit={(e) => void handleAddReciterToFirestore(e)} className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#C8A253]" />
              <h3 className="text-base font-display font-bold text-[#F5F3EE]">
                إضافة قارئ أو تعديل بياناته في السيرفر المركزي
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                dir="ltr"
                placeholder="المعرّف بالإنجليزية (مثل: minshawi)"
                value={newReciterId}
                onChange={(e) => setNewReciterId(e.target.value)}
                className="rounded-xl bg-[#0A0D0C] border border-white/15 px-3 py-2 text-xs text-[#F5F3EE]"
              />
              <input
                type="text"
                placeholder="الاسم بالعربية"
                value={newReciterNameAr}
                onChange={(e) => setNewReciterNameAr(e.target.value)}
                className="rounded-xl bg-[#0A0D0C] border border-white/15 px-3 py-2 text-xs text-[#F5F3EE]"
              />
              <input
                type="text"
                placeholder="اللقب / الوصف المختصر"
                value={newReciterTitleAr}
                onChange={(e) => setNewReciterTitleAr(e.target.value)}
                className="rounded-xl bg-[#0A0D0C] border border-white/15 px-3 py-2 text-xs text-[#F5F3EE]"
              />
              <input
                type="text"
                dir="ltr"
                placeholder="الاسم بالإنجليزية (اختياري)"
                value={newReciterNameEn}
                onChange={(e) => setNewReciterNameEn(e.target.value)}
                className="rounded-xl bg-[#0A0D0C] border border-white/15 px-3 py-2 text-xs text-[#F5F3EE]"
              />
              <input
                type="url"
                dir="ltr"
                placeholder="رابط الصورة (https://...)"
                value={newReciterPhotoUrl}
                onChange={(e) => setNewReciterPhotoUrl(e.target.value)}
                className="rounded-xl bg-[#0A0D0C] border border-white/15 px-3 py-2 text-xs text-[#F5F3EE] sm:col-span-2"
              />
              <textarea
                rows={2}
                placeholder="النبذة التعريفية للقارئ (١٠ أحرف على الأقل)"
                value={newReciterBioAr}
                onChange={(e) => setNewReciterBioAr(e.target.value)}
                className="rounded-xl bg-[#0A0D0C] border border-white/15 px-3 py-2 text-xs text-[#F5F3EE] sm:col-span-3"
              />
            </div>
            <button
              type="submit"
              disabled={isSavingReciter}
              className="px-5 py-2.5 rounded-xl bg-[#0E6B4D] hover:bg-[#178A64] text-white text-xs font-semibold cursor-pointer"
            >
              {isSavingReciter ? 'جارٍ الحفظ...' : 'حفظ القارئ في السيرفر'}
            </button>
          </form>
        </section>
      )}
    </main>
  );
};
