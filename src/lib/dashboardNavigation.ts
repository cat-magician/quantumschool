export type StudentDashboardState = {
  tab: 'home' | 'selection' | 'learning' | 'schedule' | 'progress';
  selectionSubTab?: 'stage1' | 'stage2' | 'results';
  learningSubTab?: 'lectures' | 'seminars' | 'homework';
  /** ID опубликованной страницы лекции/семинара/ДЗ в «Обучении» */
  contentPageId?: string;
};

export type AdminDashboardState = {
  tab:
    | 'home'
    | 'results'
    | 'students'
    | 'teachers'
    | 'schedule'
    | 'lectures'
    | 'seminars'
    | 'homework'
    | 'grading'
    | 'statistics'
    | 'site';
  selectionSubTab?: 'stage1' | 'contest' | 'results';
};

export type DashboardReturnState =
  | { kind: 'student'; student: StudentDashboardState }
  | { kind: 'admin'; admin: AdminDashboardState };

export const DASHBOARD_TAB_PARAM = 'tab';
export const DASHBOARD_SUB_PARAM = 'sub';
export const DASHBOARD_PAGE_PARAM = 'page';

const STUDENT_TABS = ['home', 'selection', 'learning', 'schedule', 'progress'] as const;
const STUDENT_SELECTION_SUBS = ['stage1', 'stage2', 'results'] as const;
const STUDENT_LEARNING_SUBS = ['lectures', 'seminars', 'homework'] as const;

const ADMIN_TABS = [
  'home',
  'results',
  'students',
  'teachers',
  'schedule',
  'lectures',
  'seminars',
  'homework',
  'grading',
  'statistics',
  'site',
] as const;
const ADMIN_SELECTION_SUBS = ['stage1', 'contest', 'results'] as const;
const LEGACY_ADMIN_LEARNING_SUBS = ['lectures', 'seminars', 'homework', 'grading'] as const;

function isStudentTab(value: string): value is StudentDashboardState['tab'] {
  return (STUDENT_TABS as readonly string[]).includes(value);
}

function isStudentSelectionSub(value: string): value is NonNullable<StudentDashboardState['selectionSubTab']> {
  return (STUDENT_SELECTION_SUBS as readonly string[]).includes(value);
}

function isStudentLearningSub(value: string): value is NonNullable<StudentDashboardState['learningSubTab']> {
  return (STUDENT_LEARNING_SUBS as readonly string[]).includes(value);
}

function isAdminTab(value: string): value is AdminDashboardState['tab'] {
  return (ADMIN_TABS as readonly string[]).includes(value);
}

function isAdminSelectionSub(value: string): value is NonNullable<AdminDashboardState['selectionSubTab']> {
  if ((ADMIN_SELECTION_SUBS as readonly string[]).includes(value)) return true;
  // Обратная совместимость со старыми ссылками
  return value === 'questionnaire' || value === 'essay';
}

function normalizeAdminSelectionSub(value: string | undefined): AdminDashboardState['selectionSubTab'] {
  if (!value) return 'results';
  if (value === 'questionnaire' || value === 'essay') return 'stage1';
  if (isAdminSelectionSub(value)) return value as AdminDashboardState['selectionSubTab'];
  return 'results';
}

function isLegacyAdminLearningSub(value: string): value is (typeof LEGACY_ADMIN_LEARNING_SUBS)[number] {
  return (LEGACY_ADMIN_LEARNING_SUBS as readonly string[]).includes(value);
}

export function defaultStudentDashboardState(): StudentDashboardState {
  return { tab: 'home' };
}

export function defaultAdminDashboardState(): AdminDashboardState {
  return { tab: 'home' };
}

export function parseStudentDashboardSearchParams(searchParams: URLSearchParams): StudentDashboardState | null {
  const tabRaw = searchParams.get(DASHBOARD_TAB_PARAM);
  if (!tabRaw || !isStudentTab(tabRaw)) return null;

  const state: StudentDashboardState = { tab: tabRaw };
  const subRaw = searchParams.get(DASHBOARD_SUB_PARAM);

  if (tabRaw === 'selection' && subRaw && isStudentSelectionSub(subRaw)) {
    state.selectionSubTab = subRaw;
  }
  if (tabRaw === 'learning' && subRaw && isStudentLearningSub(subRaw)) {
    state.learningSubTab = subRaw;
  }

  const pageRaw = searchParams.get(DASHBOARD_PAGE_PARAM)?.trim();
  if (tabRaw === 'learning' && pageRaw) {
    state.contentPageId = pageRaw;
  }

  return state;
}

export function parseAdminDashboardSearchParams(searchParams: URLSearchParams): AdminDashboardState | null {
  const tabRaw = searchParams.get(DASHBOARD_TAB_PARAM);
  if (!tabRaw) return null;

  if (tabRaw === 'learning') {
    const subRaw = searchParams.get(DASHBOARD_SUB_PARAM);
    if (subRaw && isLegacyAdminLearningSub(subRaw)) {
      return { tab: subRaw };
    }
    return { tab: 'lectures' };
  }

  if (!isAdminTab(tabRaw)) return null;

  const state: AdminDashboardState = { tab: tabRaw };
  const subRaw = searchParams.get(DASHBOARD_SUB_PARAM);

  if (tabRaw === 'results' && subRaw) {
    state.selectionSubTab = normalizeAdminSelectionSub(subRaw);
  }

  return state;
}

export function normalizeStudentDashboardState(
  state: StudentDashboardState,
  isEnrolled: boolean,
): StudentDashboardState {
  const lockedTabs = new Set<StudentDashboardState['tab']>(['schedule', 'learning', 'progress']);
  if (!isEnrolled && lockedTabs.has(state.tab)) {
    return { tab: 'home' };
  }

  const normalized = { ...state };

  if (normalized.tab === 'home') {
    return normalized;
  }

  if (normalized.tab === 'selection') {
    if (isEnrolled) {
      normalized.selectionSubTab = 'results';
    } else if (!normalized.selectionSubTab || !isStudentSelectionSub(normalized.selectionSubTab)) {
      normalized.selectionSubTab = 'stage1';
    }
  }

  if (normalized.tab === 'learning') {
    if (!normalized.learningSubTab || !isStudentLearningSub(normalized.learningSubTab)) {
      normalized.learningSubTab = 'lectures';
    }
  } else {
    normalized.contentPageId = undefined;
  }

  return normalized;
}

export function normalizeAdminDashboardState(
  state: AdminDashboardState,
  isSuperAdmin: boolean,
): AdminDashboardState {
  const normalized = { ...state };

  if (normalized.tab === 'home') {
    return normalized;
  }

  if (normalized.tab === 'teachers' && !isSuperAdmin) {
    return { tab: 'home' };
  }

  if (normalized.tab === 'site' && !isSuperAdmin) {
    return { tab: 'home' };
  }

  if (normalized.tab === 'results') {
    normalized.selectionSubTab = normalizeAdminSelectionSub(normalized.selectionSubTab);
  }

  return normalized;
}

export function studentDashboardStateToSearchParams(state: StudentDashboardState): URLSearchParams {
  if (state.tab === 'home') return new URLSearchParams();

  const params = new URLSearchParams();
  params.set(DASHBOARD_TAB_PARAM, state.tab);

  const sub =
    state.tab === 'selection'
      ? state.selectionSubTab
      : state.tab === 'learning'
        ? state.learningSubTab
        : undefined;

  if (sub) params.set(DASHBOARD_SUB_PARAM, sub);
  if (state.tab === 'learning' && state.contentPageId) {
    params.set(DASHBOARD_PAGE_PARAM, state.contentPageId);
  }
  return params;
}

export function studentDashboardPath(state: StudentDashboardState, isEnrolled: boolean): string {
  const params = studentDashboardStateToSearchParams(
    normalizeStudentDashboardState(state, isEnrolled),
  );
  const qs = params.toString();
  return qs ? `/dashboard?${qs}` : '/dashboard';
}

export function adminDashboardStateToSearchParams(state: AdminDashboardState): URLSearchParams {
  if (state.tab === 'home') return new URLSearchParams();

  const params = new URLSearchParams();
  params.set(DASHBOARD_TAB_PARAM, state.tab);

  const sub = state.tab === 'results' ? state.selectionSubTab : undefined;

  if (sub) params.set(DASHBOARD_SUB_PARAM, sub);
  return params;
}

export function dashboardSearchFromReturnState(state: DashboardReturnState): string {
  const params =
    state.kind === 'student'
      ? studentDashboardStateToSearchParams(state.student)
      : adminDashboardStateToSearchParams(state.admin);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function dashboardPathWithState(state: DashboardReturnState): {
  pathname: string;
  search: string;
  state: { returnTo: DashboardReturnState };
} {
  const search = dashboardSearchFromReturnState(state);
  return { pathname: '/dashboard', search, state: { returnTo: state } };
}

export function profilePathFromDashboardSearch(searchParams: URLSearchParams): string {
  const tab = searchParams.get(DASHBOARD_TAB_PARAM);
  if (!tab) return '/profile';
  const qs = searchParams.toString();
  return qs ? `/profile?${qs}` : '/profile';
}

export function dashboardPathFromProfileSearch(searchParams: URLSearchParams): string {
  const tab = searchParams.get(DASHBOARD_TAB_PARAM);
  if (!tab) return '/dashboard';
  const qs = searchParams.toString();
  return qs ? `/dashboard?${qs}` : '/dashboard';
}

export function dashboardSearchParamsEqual(a: URLSearchParams, b: URLSearchParams): boolean {
  return a.toString() === b.toString();
}
