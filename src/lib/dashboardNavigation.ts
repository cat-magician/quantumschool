export type StudentDashboardState = {
  tab: 'home' | 'selection' | 'learning' | 'schedule' | 'progress';
  selectionSubTab?: 'stage1' | 'stage2' | 'results';
  learningSubTab?: 'lectures' | 'seminars' | 'homework';
};

export type AdminDashboardState = {
  tab: 'home' | 'results' | 'students' | 'teachers' | 'learning' | 'schedule' | 'statistics' | 'site';
  selectionSubTab?: 'essay' | 'contest' | 'results';
  learningSubTab?: 'lectures' | 'seminars' | 'homework';
};

export type DashboardReturnState =
  | { kind: 'student'; student: StudentDashboardState }
  | { kind: 'admin'; admin: AdminDashboardState };

export const DASHBOARD_TAB_PARAM = 'tab';
export const DASHBOARD_SUB_PARAM = 'sub';

const STUDENT_TABS = ['home', 'selection', 'learning', 'schedule', 'progress'] as const;
const STUDENT_SELECTION_SUBS = ['stage1', 'stage2', 'results'] as const;
const STUDENT_LEARNING_SUBS = ['lectures', 'seminars', 'homework'] as const;

const ADMIN_TABS = ['home', 'results', 'students', 'teachers', 'learning', 'schedule', 'statistics', 'site'] as const;
const ADMIN_SELECTION_SUBS = ['essay', 'contest', 'results'] as const;
const ADMIN_LEARNING_SUBS = ['lectures', 'seminars', 'homework'] as const;

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
  return (ADMIN_SELECTION_SUBS as readonly string[]).includes(value);
}

function isAdminLearningSub(value: string): value is NonNullable<AdminDashboardState['learningSubTab']> {
  return (ADMIN_LEARNING_SUBS as readonly string[]).includes(value);
}

export function defaultStudentDashboardState(_isEnrolled: boolean): StudentDashboardState {
  return { tab: 'home' };
}

export function defaultAdminDashboardState(_isSuperAdmin: boolean): AdminDashboardState {
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

  return state;
}

export function parseAdminDashboardSearchParams(searchParams: URLSearchParams): AdminDashboardState | null {
  const tabRaw = searchParams.get(DASHBOARD_TAB_PARAM);
  if (!tabRaw || !isAdminTab(tabRaw)) return null;

  const state: AdminDashboardState = { tab: tabRaw };
  const subRaw = searchParams.get(DASHBOARD_SUB_PARAM);

  if (tabRaw === 'results' && subRaw && isAdminSelectionSub(subRaw)) {
    state.selectionSubTab = subRaw;
  }
  if (tabRaw === 'learning' && subRaw && isAdminLearningSub(subRaw)) {
    state.learningSubTab = subRaw;
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
    if (!normalized.selectionSubTab || !isAdminSelectionSub(normalized.selectionSubTab)) {
      normalized.selectionSubTab = 'results';
    }
  }

  if (normalized.tab === 'learning') {
    if (!normalized.learningSubTab || !isAdminLearningSub(normalized.learningSubTab)) {
      normalized.learningSubTab = 'lectures';
    }
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
  return params;
}

export function adminDashboardStateToSearchParams(state: AdminDashboardState): URLSearchParams {
  if (state.tab === 'home') return new URLSearchParams();

  const params = new URLSearchParams();
  params.set(DASHBOARD_TAB_PARAM, state.tab);

  const sub =
    state.tab === 'results'
      ? state.selectionSubTab
      : state.tab === 'learning'
        ? state.learningSubTab
        : undefined;

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
