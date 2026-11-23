import type { DynamicCertificatesConfig } from '../types/tilawa';
import { DEFAULT_CERTIFICATES } from './dynamicConfigHelpers';
import { toArabicDigits } from './quranHelpers';

export const LISTENER_STATS_STORAGE_KEY = 'tilawa_listener_stats_v1';

export interface ListenerStatsState {
  recipientName: string;
  totalListeningSeconds: number;
  activeDays: string[];
  listenedSurahKeys: string[];
  verifiedMemorizedJuzs: number[];
  activePagesRead: number[];
  tahfeezSessionsCompleted: number;
}

export const DEFAULT_LISTENER_STATS: ListenerStatsState = {
  recipientName: '',
  totalListeningSeconds: 0,
  activeDays: [],
  listenedSurahKeys: [],
  verifiedMemorizedJuzs: [],
  activePagesRead: [],
  tahfeezSessionsCompleted: 0,
};

export type CertificateCategory =
  | 'juz_memorization'
  | 'continuous_listening'
  | 'khatmah_completion'
  | 'active_platform_excellence';

export interface CertificateEvaluation {
  id: CertificateCategory;
  titleAr: string;
  subtitleAr: string;
  badgeLabelAr: string;
  earned: boolean;
  activityGoalMet: boolean;
  levelMet: boolean;
  requiredLevel: number;
  requiredLevelTitleAr: string;
  requiredLevelXp: number;
  currentLevel: number;
  currentLevelTitleAr: string;
  currentXp: number;
  progressPercent: number;
  progressSummaryAr: string;
  citationAr: string;
  sealNumber: string;
}

export interface UserLevelTier {
  level: number;
  titleAr: string;
  minXp: number;
}

export const USER_LEVEL_TIERS: UserLevelTier[] = [
  { level: 1, titleAr: 'مبتدئ في رحاب القرآن', minXp: 0 },
  { level: 2, titleAr: 'مواظب على التلاوة', minXp: 120 },
  { level: 3, titleAr: 'مثابر في التدبر والحفظ', minXp: 300 },
  { level: 4, titleAr: 'حافظ ومرتّل متميز', minXp: 550 },
  { level: 5, titleAr: 'متقن للقرآن الكريم', minXp: 900 },
  { level: 6, titleAr: 'سفير أهل القرآن', minXp: 1350 },
  { level: 7, titleAr: 'خاتم ومجيز متقدم', minXp: 1900 },
  { level: 8, titleAr: 'إمام الهمة والمداومة', minXp: 2600 },
  { level: 9, titleAr: 'حامل لواء التلاوة', minXp: 3400 },
  { level: 10, titleAr: 'الوسام الأعلى لأهل القرآن', minXp: 4500 },
];

export interface UserLevelSummary {
  level: number;
  titleAr: string;
  xp: number;
  currentLevelMinXp: number;
  nextLevel: number | null;
  nextLevelTitleAr: string | null;
  nextLevelXp: number | null;
  xpToNextLevel: number;
  levelProgressPercent: number;
}

export function getLevelTierInfo(levelNumber: number): UserLevelTier {
  const clamped = Math.min(10, Math.max(1, Math.round(levelNumber)));
  return USER_LEVEL_TIERS[clamped - 1] || USER_LEVEL_TIERS[0];
}

export const LISTENER_STATS_EVENT = 'tilawa:listener-stats-updated';

export const JUZ_NAMES_AR: string[] = [
  'الجزء الأول (آلم)',
  'الجزء الثاني (سيقول)',
  'الجزء الثالث (تلك الرسل)',
  'الجزء الرابع (لن تنالوا)',
  'الجزء الخامس (والمحصنات)',
  'الجزء السادس (لا يحب الله)',
  'الجزء السابع (وإذا سمعوا)',
  'الجزء الثامن (ولو أننا)',
  'الجزء التاسع (قال الملأ)',
  'الجزء العاشر (واعلموا)',
  'الجزء الحادي عشر (يعتذرون)',
  'الجزء الثاني عشر (وما من دابة)',
  'الجزء الثالث عشر (وما أبرئ)',
  'الجزء الرابع عشر (ربما)',
  'الجزء الخامس عشر (سبحان الذي)',
  'الجزء السادس عشر (قال ألم)',
  'الجزء السابع عشر (اقترب للناس)',
  'الجزء الثامن عشر (قد أفلح)',
  'الجزء التاسع عشر (وقال الذين)',
  'الجزء العشرون (أمن خلق)',
  'الجزء الحادي والعشرون (اتل ما أوحي)',
  'الجزء الثاني والعشرون (ومن يقنت)',
  'الجزء الثالث والعشرون (وما لي)',
  'الجزء الرابع والعشرون (فمن أظلم)',
  'الجزء الخامس والعشرون (إليه يرد)',
  'الجزء السادس والعشرون (حم)',
  'الجزء السابع والعشرون (قال فما خطبكم)',
  'الجزء الثامن والعشرون (قد سمع)',
  'الجزء التاسع والعشرون (تبارك)',
  'الجزء الثلاثون (عمّ)',
];

export function sanitizeListenerStats(raw: unknown): ListenerStatsState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_LISTENER_STATS };
  }
  const r = raw as Partial<ListenerStatsState>;
  const recipientName =
    typeof r.recipientName === 'string' ? r.recipientName.trim().slice(0, 80) : '';
  const totalListeningSeconds =
    typeof r.totalListeningSeconds === 'number' && Number.isFinite(r.totalListeningSeconds)
      ? Math.max(0, Math.floor(r.totalListeningSeconds))
      : 0;
  const activeDays = Array.isArray(r.activeDays)
    ? Array.from(
        new Set(
          r.activeDays.filter(
            (d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
          )
        )
      )
        .sort()
        .slice(-365)
    : [];
  const listenedSurahKeys = Array.isArray(r.listenedSurahKeys)
    ? Array.from(
        new Set(
          r.listenedSurahKeys.filter((k): k is string => typeof k === 'string' && k.length > 0)
        )
      ).slice(-400)
    : [];
  const verifiedMemorizedJuzs = Array.isArray(r.verifiedMemorizedJuzs)
    ? Array.from(
        new Set(
          r.verifiedMemorizedJuzs.filter(
            (j): j is number => Number.isInteger(j) && j >= 1 && j <= 30
          )
        )
      ).sort((a, b) => a - b)
    : [];
  const activePagesRead = Array.isArray(r.activePagesRead)
    ? Array.from(
        new Set(
          r.activePagesRead.filter(
            (p): p is number => Number.isInteger(p) && p >= 1 && p <= 604
          )
        )
      )
        .sort((a, b) => a - b)
        .slice(-604)
    : [];
  const tahfeezSessionsCompleted =
    typeof r.tahfeezSessionsCompleted === 'number' && Number.isFinite(r.tahfeezSessionsCompleted)
      ? Math.max(0, Math.floor(r.tahfeezSessionsCompleted))
      : 0;

  return {
    recipientName,
    totalListeningSeconds,
    activeDays,
    listenedSurahKeys,
    verifiedMemorizedJuzs,
    activePagesRead,
    tahfeezSessionsCompleted,
  };
}

export function loadListenerStats(): ListenerStatsState {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_LISTENER_STATS };
    const raw = localStorage.getItem(LISTENER_STATS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LISTENER_STATS };
    return sanitizeListenerStats(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_LISTENER_STATS };
  }
}

export function saveListenerStats(state: ListenerStatsState): ListenerStatsState {
  const clean = sanitizeListenerStats(state);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LISTENER_STATS_STORAGE_KEY, JSON.stringify(clean));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(LISTENER_STATS_EVENT, { detail: clean }));
    }
  } catch {
    // ignore storage restriction
  }
  return clean;
}

export function recordListeningTick(
  state: ListenerStatsState,
  secondsDelta: number,
  todayIso: string,
  surahKey?: string
): ListenerStatsState {
  const cleanDelta = Math.max(0, Math.floor(secondsDelta));
  const nextDays =
    todayIso && !state.activeDays.includes(todayIso)
      ? [...state.activeDays, todayIso]
      : state.activeDays;
  const nextKeys =
    surahKey && !state.listenedSurahKeys.includes(surahKey)
      ? [...state.listenedSurahKeys, surahKey]
      : state.listenedSurahKeys;

  return sanitizeListenerStats({
    ...state,
    totalListeningSeconds: state.totalListeningSeconds + cleanDelta,
    activeDays: nextDays,
    listenedSurahKeys: nextKeys,
  });
}

export function recordPageRead(
  state: ListenerStatsState,
  pageNumber: number,
  todayIso: string
): ListenerStatsState {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 604) {
    return state;
  }
  const nextPages = state.activePagesRead.includes(pageNumber)
    ? state.activePagesRead
    : [...state.activePagesRead, pageNumber];
  const nextDays =
    todayIso && !state.activeDays.includes(todayIso)
      ? [...state.activeDays, todayIso]
      : state.activeDays;

  return sanitizeListenerStats({
    ...state,
    activePagesRead: nextPages,
    activeDays: nextDays,
  });
}

export function recordTahfeezSession(
  state: ListenerStatsState,
  todayIso: string
): ListenerStatsState {
  const nextDays =
    todayIso && !state.activeDays.includes(todayIso)
      ? [...state.activeDays, todayIso]
      : state.activeDays;

  return sanitizeListenerStats({
    ...state,
    tahfeezSessionsCompleted: state.tahfeezSessionsCompleted + 1,
    activeDays: nextDays,
  });
}

export function toggleMemorizedJuz(
  state: ListenerStatsState,
  juzNumber: number
): ListenerStatsState {
  if (!Number.isInteger(juzNumber) || juzNumber < 1 || juzNumber > 30) {
    return state;
  }
  const exists = state.verifiedMemorizedJuzs.includes(juzNumber);
  const nextJuzs = exists
    ? state.verifiedMemorizedJuzs.filter((j) => j !== juzNumber)
    : [...state.verifiedMemorizedJuzs, juzNumber].sort((a, b) => a - b);

  return sanitizeListenerStats({
    ...state,
    verifiedMemorizedJuzs: nextJuzs,
  });
}

export function computeListeningStreakDays(activeDays: string[]): number {
  if (activeDays.length === 0) return 0;
  const sorted = [...activeDays].sort();
  let streak = 1;
  for (let i = sorted.length - 1; i > 0; i--) {
    const curr = Date.parse(`${sorted[i]}T00:00:00Z`);
    const prev = Date.parse(`${sorted[i - 1]}T00:00:00Z`);
    const diffDays = Math.round((curr - prev) / 86400000);
    if (diffDays === 1) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

export interface EvaluateCertificatesParams {
  stats: ListenerStatsState;
  memorizedAyahsCount: number;
  completedSurahsCount: number;
  historyCount: number;
  completedKhatmahsCount: number;
  config?: DynamicCertificatesConfig;
}

export function computeUserProgressLevel(
  params: Omit<EvaluateCertificatesParams, 'config'>
): UserLevelSummary {
  const {
    stats,
    memorizedAyahsCount,
    historyCount,
    completedKhatmahsCount,
  } = params;

  const totalMinutes = Math.floor(Math.max(0, stats.totalListeningSeconds) / 60);
  const effectiveSurahsListened = Math.max(stats.listenedSurahKeys.length, Math.max(0, historyCount));

  const xp =
    totalMinutes * 5 +
    stats.activeDays.length * 40 +
    effectiveSurahsListened * 20 +
    stats.activePagesRead.length * 15 +
    Math.max(0, memorizedAyahsCount) * 5 +
    stats.verifiedMemorizedJuzs.length * 180 +
    stats.tahfeezSessionsCompleted * 45 +
    Math.max(0, completedKhatmahsCount) * 400;

  let currentTier = USER_LEVEL_TIERS[0];
  for (const tier of USER_LEVEL_TIERS) {
    if (xp >= tier.minXp) {
      currentTier = tier;
    }
  }

  const nextTier =
    USER_LEVEL_TIERS.find((tier) => tier.level === currentTier.level + 1) || null;
  const span = nextTier ? Math.max(1, nextTier.minXp - currentTier.minXp) : 1;
  const earnedInTier = Math.max(0, xp - currentTier.minXp);
  const levelProgressPercent = nextTier
    ? Math.min(99, Math.round((earnedInTier / span) * 100))
    : 100;

  return {
    level: currentTier.level,
    titleAr: currentTier.titleAr,
    xp,
    currentLevelMinXp: currentTier.minXp,
    nextLevel: nextTier ? nextTier.level : null,
    nextLevelTitleAr: nextTier ? nextTier.titleAr : null,
    nextLevelXp: nextTier ? nextTier.minXp : null,
    xpToNextLevel: nextTier ? Math.max(0, nextTier.minXp - xp) : 0,
    levelProgressPercent,
  };
}

export function evaluateCertificates(
  params: EvaluateCertificatesParams
): CertificateEvaluation[] {
  const {
    stats,
    memorizedAyahsCount,
    completedSurahsCount,
    historyCount,
    completedKhatmahsCount,
    config = DEFAULT_CERTIFICATES,
  } = params;

  const userLevel = computeUserProgressLevel({
    stats,
    memorizedAyahsCount,
    completedSurahsCount,
    historyCount,
    completedKhatmahsCount,
  });

  const reqLevelMemorization = Math.min(
    10,
    Math.max(1, Math.round(config.requiredLevelMemorization ?? DEFAULT_CERTIFICATES.requiredLevelMemorization))
  );
  const reqLevelListening = Math.min(
    10,
    Math.max(1, Math.round(config.requiredLevelListening ?? DEFAULT_CERTIFICATES.requiredLevelListening))
  );
  const reqLevelExcellence = Math.min(
    10,
    Math.max(1, Math.round(config.requiredLevelExcellence ?? DEFAULT_CERTIFICATES.requiredLevelExcellence))
  );
  const reqLevelKhatmah = Math.min(
    10,
    Math.max(1, Math.round(config.requiredLevelKhatmah ?? DEFAULT_CERTIFICATES.requiredLevelKhatmah))
  );

  const tierMem = getLevelTierInfo(reqLevelMemorization);
  const tierList = getLevelTierInfo(reqLevelListening);
  const tierExc = getLevelTierInfo(reqLevelExcellence);
  const tierKhtm = getLevelTierInfo(reqLevelKhatmah);

  const ayahsGoal = Math.max(20, config.memorizationAyahGoal || 140);
  const listeningSecondsGoal = Math.max(180, (config.listeningMinutesGoal || 15) * 60);
  const listeningSurahsGoal = Math.max(2, config.listeningSurahsGoal || 5);
  const listeningDaysGoal = 3;
  const pagesGoal = Math.max(5, config.readingPagesGoal || 20);
  const tahfeezGoal = Math.max(1, config.tahfeezSessionsGoal || 5);

  const totalMinutes = Math.floor(stats.totalListeningSeconds / 60);
  const effectiveSurahsListened = Math.max(stats.listenedSurahKeys.length, historyCount);
  const streakDays = computeListeningStreakDays(stats.activeDays);
  const effectiveActiveDays = Math.max(stats.activeDays.length, streakDays);

  // 1. Juz Memorization Certificate
  const manualJuzCount = stats.verifiedMemorizedJuzs.length;
  const ayahsJuzEquivalent = Math.floor(memorizedAyahsCount / ayahsGoal);
  const totalJuzAchieved = Math.max(manualJuzCount, ayahsJuzEquivalent);
  const juzActivityMet =
    manualJuzCount >= 1 ||
    memorizedAyahsCount >= ayahsGoal ||
    completedSurahsCount >= 1;
  const juzLevelMet = userLevel.level >= reqLevelMemorization;
  const juzEarned = juzActivityMet && juzLevelMet;

  const juzProgressPct = juzEarned
    ? 100
    : juzActivityMet
    ? Math.min(95, Math.max(15, Math.round((userLevel.xp / Math.max(1, tierMem.minXp)) * 100)))
    : Math.min(92, Math.round((memorizedAyahsCount / ayahsGoal) * 100));

  const juzDescriptor =
    manualJuzCount > 0
      ? manualJuzCount === 1
        ? JUZ_NAMES_AR[stats.verifiedMemorizedJuzs[0] - 1]
        : `${toArabicDigits(manualJuzCount)} أجزاء من كتاب الله العزيز`
      : completedSurahsCount >= 1
      ? `${toArabicDigits(completedSurahsCount)} سورة و ${toArabicDigits(memorizedAyahsCount)} آية`
      : `${toArabicDigits(memorizedAyahsCount)} آية مباركة من القرآن الكريم`;

  // 2. Continuous Listening Certificate
  const listeningActivityMet =
    stats.totalListeningSeconds >= listeningSecondsGoal ||
    effectiveActiveDays >= listeningDaysGoal ||
    effectiveSurahsListened >= listeningSurahsGoal;
  const listeningLevelMet = userLevel.level >= reqLevelListening;
  const listeningEarned = listeningActivityMet && listeningLevelMet;

  const pctTime = Math.round((stats.totalListeningSeconds / listeningSecondsGoal) * 100);
  const pctSurahs = Math.round((effectiveSurahsListened / listeningSurahsGoal) * 100);
  const pctDays = Math.round((effectiveActiveDays / listeningDaysGoal) * 100);
  const listeningProgressPct = listeningEarned
    ? 100
    : listeningActivityMet
    ? Math.min(95, Math.max(15, Math.round((userLevel.xp / Math.max(1, tierList.minXp)) * 100)))
    : Math.min(92, Math.max(pctTime, pctSurahs, pctDays, 0));

  const rankTier =
    stats.totalListeningSeconds >= 3600 || effectiveActiveDays >= 7
      ? 'وسام المواظبة الماسية على سماع الذكر الحكيم'
      : 'وسام المداومة المباركة على سماع القرآن الكريم';

  // 3. Active Platform Engagement Excellence Certificate
  const pagesReadCount = stats.activePagesRead.length;
  const tahfeezSessionsCount = stats.tahfeezSessionsCompleted;
  const pctPages = Math.min(100, Math.round((pagesReadCount / pagesGoal) * 100));
  const pctTahfeez = Math.min(100, Math.round((tahfeezSessionsCount / tahfeezGoal) * 100));
  const pctListenedEngaged = Math.min(100, Math.round((effectiveSurahsListened / listeningSurahsGoal) * 100));
  const excellenceCombinedPct = Math.round((pctPages + pctTahfeez + pctListenedEngaged) / 3);
  const excellenceActivityMet =
    pagesReadCount >= pagesGoal ||
    tahfeezSessionsCount >= tahfeezGoal ||
    (pagesReadCount >= Math.ceil(pagesGoal / 2) &&
      effectiveSurahsListened >= Math.ceil(listeningSurahsGoal / 2) &&
      effectiveActiveDays >= 2);
  const excellenceLevelMet = userLevel.level >= reqLevelExcellence;
  const excellenceEarned = excellenceActivityMet && excellenceLevelMet;

  // 4. Khatmah Completion Certificate
  const khatmahActivityMet = completedKhatmahsCount >= 1;
  const khatmahLevelMet = userLevel.level >= reqLevelKhatmah;
  const khatmahEarned = khatmahActivityMet && khatmahLevelMet;

  return [
    {
      id: 'juz_memorization',
      titleAr: 'شهادة تقدير لإتقان وحفظ جزء من القرآن الكريم',
      subtitleAr: `تُمنح عند بلوغ المستوى ${toArabicDigits(reqLevelMemorization)} (${tierMem.titleAr}) مع إتمام حفظ جزء أو سورة كاملة في قسم التحفيظ`,
      badgeLabelAr: totalJuzAchieved >= 1 ? `${toArabicDigits(totalJuzAchieved)} جزء محفوظ` : 'شهادة الحفظ',
      earned: juzEarned,
      activityGoalMet: juzActivityMet,
      levelMet: juzLevelMet,
      requiredLevel: reqLevelMemorization,
      requiredLevelTitleAr: tierMem.titleAr,
      requiredLevelXp: tierMem.minXp,
      currentLevel: userLevel.level,
      currentLevelTitleAr: userLevel.titleAr,
      currentXp: userLevel.xp,
      progressPercent: juzProgressPct,
      progressSummaryAr: juzEarned
        ? `مُنجَز — ${juzDescriptor}`
        : juzActivityMet
        ? `أتممت شرط الحفظ — يتبقّى الوصول إلى المستوى ${toArabicDigits(reqLevelMemorization)} (${toArabicDigits(userLevel.xp)} / ${toArabicDigits(tierMem.minXp)} نقطة)`
        : `التقدم: ${toArabicDigits(memorizedAyahsCount)} / ${toArabicDigits(
            ayahsGoal
          )} آية · يتطلب المستوى ${toArabicDigits(reqLevelMemorization)}`,
      citationAr: `تقديرًا لجهوده المباركة ومثابرته في حفظ كتاب الله وتثبيت تلاوته (${juzDescriptor})، سائلين المولى عز وجل أن يرفع به درجاته ويجعله من أهل القرآن وخاصته.`,
      sealNumber: `TLW-HIFZ-${String(Math.max(1, totalJuzAchieved || completedSurahsCount)).padStart(
        2,
        '0'
      )}`,
    },
    {
      id: 'continuous_listening',
      titleAr: 'شهادة شكر وتقدير للمواظبة على سماع القرآن الكريم',
      subtitleAr: `تُمنح عند بلوغ المستوى ${toArabicDigits(reqLevelListening)} (${tierList.titleAr}) والمواظبة على سماع ${toArabicDigits(listeningSurahsGoal)} سور أو ${toArabicDigits(Math.round(listeningSecondsGoal / 60))} دقيقة استماع متواصل`,
      badgeLabelAr: listeningEarned ? rankTier : 'المواظبة القرآنية',
      earned: listeningEarned,
      activityGoalMet: listeningActivityMet,
      levelMet: listeningLevelMet,
      requiredLevel: reqLevelListening,
      requiredLevelTitleAr: tierList.titleAr,
      requiredLevelXp: tierList.minXp,
      currentLevel: userLevel.level,
      currentLevelTitleAr: userLevel.titleAr,
      currentXp: userLevel.xp,
      progressPercent: listeningProgressPct,
      progressSummaryAr: listeningEarned
        ? `مُنجَز — ${toArabicDigits(totalMinutes)} دقيقة · ${toArabicDigits(
            effectiveSurahsListened
          )} تلاوة · ${toArabicDigits(Math.max(1, effectiveActiveDays))} يوم`
        : listeningActivityMet
        ? `أتممت شرط الاستماع — يتبقّى الوصول إلى المستوى ${toArabicDigits(reqLevelListening)} (${toArabicDigits(userLevel.xp)} / ${toArabicDigits(tierList.minXp)} نقطة)`
        : `استمع إلى ${toArabicDigits(effectiveSurahsListened)} / ${toArabicDigits(
            listeningSurahsGoal
          )} سور (${toArabicDigits(totalMinutes)} دقيقة) · المستوى المطلوب: ${toArabicDigits(reqLevelListening)}`,
      citationAr: `تشريفًا لمداومته الكريمة وقلبه المعلق بتلاوة آيات الله البينات عبر منصة تلاوة (بواقع ${toArabicDigits(
        effectiveSurahsListened
      )} تلاوة و ${toArabicDigits(Math.max(1, totalMinutes))} دقيقة من الإنصات والخشوع).`,
      sealNumber: `TLW-LIST-${String(Math.max(1, effectiveSurahsListened)).padStart(3, '0')}`,
    },
    {
      id: 'active_platform_excellence',
      titleAr: 'شهادة التميز والنشاط المتكامل في رحاب تلاوة',
      subtitleAr: `تُمنح عند بلوغ المستوى ${toArabicDigits(reqLevelExcellence)} (${tierExc.titleAr}) بتصفح ${toArabicDigits(pagesGoal)} صفحة مصحف أو إتمام ${toArabicDigits(tahfeezGoal)} جلسات تحفيظ`,
      badgeLabelAr: excellenceEarned ? 'سفير التميز القرآني' : 'النشاط والتدبر',
      earned: excellenceEarned,
      activityGoalMet: excellenceActivityMet,
      levelMet: excellenceLevelMet,
      requiredLevel: reqLevelExcellence,
      requiredLevelTitleAr: tierExc.titleAr,
      requiredLevelXp: tierExc.minXp,
      currentLevel: userLevel.level,
      currentLevelTitleAr: userLevel.titleAr,
      currentXp: userLevel.xp,
      progressPercent: excellenceEarned
        ? 100
        : excellenceActivityMet
        ? Math.min(95, Math.max(15, Math.round((userLevel.xp / Math.max(1, tierExc.minXp)) * 100)))
        : Math.min(92, excellenceCombinedPct),
      progressSummaryAr: excellenceEarned
        ? `مُنجَز — ${toArabicDigits(pagesReadCount)} صفحة مصحف · ${toArabicDigits(tahfeezSessionsCount)} جلسات تحفيظ · ${toArabicDigits(effectiveSurahsListened)} تلاوات`
        : excellenceActivityMet
        ? `أتممت شرط النشاط — يتبقّى الوصول إلى المستوى ${toArabicDigits(reqLevelExcellence)} (${toArabicDigits(userLevel.xp)} / ${toArabicDigits(tierExc.minXp)} نقطة)`
        : `صفحات المصحف: ${toArabicDigits(pagesReadCount)}/${toArabicDigits(pagesGoal)} · التحفيظ: ${toArabicDigits(tahfeezSessionsCount)}/${toArabicDigits(tahfeezGoal)} · المستوى المطلوب: ${toArabicDigits(reqLevelExcellence)}`,
      citationAr: `اعتزازًا بنشاطه المتواصل وهمته العالية بين تلاوة المصحف الشريف (${toArabicDigits(
        pagesReadCount
      )} صفحة) وحلقات التحفيظ (${toArabicDigits(tahfeezSessionsCount)} جلسات) والاستماع الخاشع عبر منصة تلاوة.`,
      sealNumber: `TLW-ACTV-${String(Math.max(1, pagesReadCount + tahfeezSessionsCount)).padStart(3, '0')}`,
    },
    {
      id: 'khatmah_completion',
      titleAr: 'شهادة إتمام ختمة القرآن الكريم المباركة',
      subtitleAr: `تُمنح عند بلوغ المستوى ${toArabicDigits(reqLevelKhatmah)} (${tierKhtm.titleAr}) وإكمال ورد الختمة (٦٠٤ صفحات) في متابع الختمة اليومية`,
      badgeLabelAr: khatmahEarned
        ? `${toArabicDigits(completedKhatmahsCount)} ختمة مكتملة`
        : 'شهادة الختمة',
      earned: khatmahEarned,
      activityGoalMet: khatmahActivityMet,
      levelMet: khatmahLevelMet,
      requiredLevel: reqLevelKhatmah,
      requiredLevelTitleAr: tierKhtm.titleAr,
      requiredLevelXp: tierKhtm.minXp,
      currentLevel: userLevel.level,
      currentLevelTitleAr: userLevel.titleAr,
      currentXp: userLevel.xp,
      progressPercent: khatmahEarned
        ? 100
        : khatmahActivityMet
        ? Math.min(95, Math.max(15, Math.round((userLevel.xp / Math.max(1, tierKhtm.minXp)) * 100)))
        : Math.min(75, Math.round((userLevel.xp / Math.max(1, tierKhtm.minXp)) * 75)),
      progressSummaryAr: khatmahEarned
        ? `مُنجَز — أتممت ${toArabicDigits(completedKhatmahsCount)} ختمة كاملة بحمد الله`
        : khatmahActivityMet
        ? `أتممت الختمة — يتبقّى الوصول إلى المستوى ${toArabicDigits(reqLevelKhatmah)} (${toArabicDigits(userLevel.xp)} / ${toArabicDigits(tierKhtm.minXp)} نقطة)`
        : `أكمل ورد الختمة اليومية وبلوغ المستوى ${toArabicDigits(reqLevelKhatmah)} لإصدار الشهادة`,
      citationAr: `بمناسبة إتمام ختم القرآن الكريم تلاوةً وتدبرًا (${toArabicDigits(
        Math.max(1, completedKhatmahsCount)
      )} ختمة مباركة)، نسأل الله تعالى أن يتقبلها ويجعل القرآن العظيم ربيع قلوبنا ونور صدورنا.`,
      sealNumber: `TLW-KHTM-${String(Math.max(1, completedKhatmahsCount)).padStart(2, '0')}`,
    },
  ];
}
