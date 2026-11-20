export const TOTAL_MUSHAF_PAGES = 604;
export const KHATMAH_STORAGE_KEY = 'tilawa_khatmah_tracker_v1';

export interface KhatmahState {
  targetDays: number;
  currentPage: number;
  completedKhatmahs: number;
  streakDays: number;
  lastCompletedDate: string | null;
}

export interface KhatmahStats {
  progressPercent: number;
  pagesRemaining: number;
  dailyQuota: number;
  todayEndPage: number;
  daysRemaining: number;
}

export const DEFAULT_KHATMAH_STATE: KhatmahState = {
  targetDays: 30,
  currentPage: 1,
  completedKhatmahs: 0,
  streakDays: 0,
  lastCompletedDate: null,
};

export function clampMushafPage(page: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(TOTAL_MUSHAF_PAGES, Math.max(1, Math.round(page)));
}

export function clampTargetDays(days: number): number {
  if (!Number.isFinite(days)) return 30;
  return Math.min(365, Math.max(3, Math.round(days)));
}

export function computeKhatmahStats(state: KhatmahState): KhatmahStats {
  const safePage = clampMushafPage(state.currentPage);
  const safeDays = clampTargetDays(state.targetDays);
  const dailyQuota = Math.max(1, Math.ceil(TOTAL_MUSHAF_PAGES / safeDays));
  const pagesRead = safePage <= 1 ? 0 : safePage;
  const pagesRemaining = Math.max(0, TOTAL_MUSHAF_PAGES - pagesRead);
  const progressPercent = Math.min(
    100,
    Math.round((pagesRead / TOTAL_MUSHAF_PAGES) * 100)
  );
  const todayEndPage = Math.min(TOTAL_MUSHAF_PAGES, safePage + dailyQuota - 1);
  const daysRemaining = Math.ceil(pagesRemaining / dailyQuota);

  return {
    progressPercent,
    pagesRemaining,
    dailyQuota,
    todayEndPage,
    daysRemaining,
  };
}

export function markTodayWirdCompleted(
  state: KhatmahState,
  todayIso: string
): KhatmahState {
  const stats = computeKhatmahStats(state);
  const reachedEnd = stats.todayEndPage >= TOTAL_MUSHAF_PAGES;
  const nextPage = reachedEnd ? 1 : stats.todayEndPage + 1;

  const isSameDay = state.lastCompletedDate === todayIso;
  let nextStreak = state.streakDays;
  if (!isSameDay) {
    if (!state.lastCompletedDate) {
      nextStreak = 1;
    } else {
      const prevMs = Date.parse(`${state.lastCompletedDate}T00:00:00Z`);
      const currMs = Date.parse(`${todayIso}T00:00:00Z`);
      const diffDays = Number.isFinite(prevMs) && Number.isFinite(currMs)
        ? Math.round((currMs - prevMs) / 86_400_000)
        : 99;
      nextStreak = diffDays === 1 ? state.streakDays + 1 : 1;
    }
  }

  return {
    targetDays: clampTargetDays(state.targetDays),
    currentPage: nextPage,
    completedKhatmahs: state.completedKhatmahs + (reachedEnd ? 1 : 0),
    streakDays: nextStreak,
    lastCompletedDate: todayIso,
  };
}

export function loadKhatmahState(): KhatmahState {
  try {
    const raw = localStorage.getItem(KHATMAH_STORAGE_KEY);
    if (!raw) return DEFAULT_KHATMAH_STATE;
    const parsed = JSON.parse(raw) as Partial<KhatmahState>;
    return {
      targetDays: clampTargetDays(parsed.targetDays ?? 30),
      currentPage: clampMushafPage(parsed.currentPage ?? 1),
      completedKhatmahs: Math.max(0, Math.round(parsed.completedKhatmahs ?? 0)),
      streakDays: Math.max(0, Math.round(parsed.streakDays ?? 0)),
      lastCompletedDate:
        typeof parsed.lastCompletedDate === 'string' ? parsed.lastCompletedDate : null,
    };
  } catch {
    return DEFAULT_KHATMAH_STATE;
  }
}

export function saveKhatmahState(state: KhatmahState): void {
  try {
    localStorage.setItem(KHATMAH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota failures
  }
}
