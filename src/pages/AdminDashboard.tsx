import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { profileDisplayName, profileEmail } from '../lib/profileUtils';
import {
  adminDashboardStateToSearchParams,
  dashboardSearchParamsEqual,
  defaultAdminDashboardState,
  normalizeAdminDashboardState,
  parseAdminDashboardSearchParams,
  profilePathFromDashboardSearch,
  type AdminDashboardState,
} from '../lib/dashboardNavigation';
import { publicAsset } from '../lib/appPaths';
import type { NotificationAction } from '../lib/notificationsUtils';
import DashboardHeaderActions from '../components/DashboardHeaderActions';
import {
  LogOut, Users, ClipboardList, Calendar, FileText, FlaskConical, CheckCircle, GraduationCap, Presentation, BookOpen, BarChart3, Globe, Home, ClipboardCheck,
} from 'lucide-react';
import ResultsTab from './admin/ResultsTab';
import SelectionStage1ConfigTab from './admin/SelectionStage1ConfigTab';
import SelectionContestConfigTab from './admin/SelectionContestConfigTab';
import StudentsTab from './admin/StudentsTab';
import TeachersTab from './admin/TeachersTab';
import HomeworkTab from './admin/HomeworkTab';
import HomeworkPagesTab from './admin/HomeworkPagesTab';
import LessonsTab from './admin/LessonsTab';
import ScheduleTab from './admin/ScheduleTab';
import StatisticsTab from './admin/StatisticsTab';
import SiteContentTab from './admin/SiteContentTab';
import AdminDashboardHome, { type AdminHomeAction } from '../components/AdminDashboardHome';
import { SIDEBAR_HINT } from '../lib/dashboardHelpCopy';
import DashboardSiteHomeLink from '../components/DashboardSiteHomeLink';
import UserAvatar from '../components/UserAvatar';
import DashboardMobileNav, { MobileMenuCollapsibleSection, MobileSubNavBar, mobileMenuBtn, mobileMenuSubBtn } from '../components/DashboardMobileNav';
import NavCountBadge from '../components/NavCountBadge';
import { useAdminUngradedCount } from '../hooks/useAdminUngradedCount';
import { TeacherPromotedBanner } from '../components/TeacherRoleBanners';

type AdminTab =
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
type SelectionAdminSubTab = 'stage1' | 'contest' | 'results';

const SELECTION_ADMIN_SUB_NAV: {
  id: SelectionAdminSubTab;
  label: string;
  icon: typeof FileText;
}[] = [
  { id: 'stage1', label: 'Этап 1', icon: ClipboardList },
  { id: 'contest', label: 'Этап 2: Задачи', icon: FlaskConical },
  { id: 'results', label: 'Результаты', icon: CheckCircle },
];

const SELECTION_ADMIN_HEADER: Record<SelectionAdminSubTab, string> = {
  stage1: 'Этап 1',
  contest: 'Этап 2: Задачи',
  results: 'Результаты',
};

export default function AdminDashboard({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<AdminTab>('home');
  const [selectionSubTab, setSelectionSubTab] = useState<SelectionAdminSubTab>('results');
  const [selectionExpanded, setSelectionExpanded] = useState(false);
  const ungradedCount = useAdminUngradedCount(isSuperAdmin);
  const [viewReady, setViewReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [contentListResetKey, setContentListResetKey] = useState(0);
  const displayName = profile ? profileDisplayName(profile) : 'Админ';
  const accountSubtitle = profileEmail(profile, user?.email);

  const gradingLabel = useMemo(
    () =>
      ungradedCount != null && ungradedCount > 0
        ? `Проверка · ${ungradedCount}`
        : 'Проверка',
    [ungradedCount],
  );

  const navItems: {
    id: AdminTab;
    icon: typeof Users;
    label: string;
    superAdminOnly?: boolean;
    badge?: number;
  }[] = useMemo(
    () => [
      { id: 'results', icon: ClipboardList, label: 'Отборочные этапы' },
      { id: 'students', icon: Users, label: 'Ученики' },
      { id: 'teachers', icon: GraduationCap, label: 'Преподаватели', superAdminOnly: true },
      { id: 'schedule', icon: Calendar, label: 'Расписание' },
      { id: 'lectures', icon: Presentation, label: 'Лекции' },
      { id: 'seminars', icon: Presentation, label: 'Семинары' },
      { id: 'homework', icon: BookOpen, label: 'Домашние задания' },
      {
        id: 'grading',
        icon: ClipboardCheck,
        label: gradingLabel,
        badge: ungradedCount != null && ungradedCount > 0 ? ungradedCount : undefined,
      },
      { id: 'statistics', icon: BarChart3, label: 'Статистика' },
      { id: 'site', icon: Globe, label: 'Контент', superAdminOnly: true },
    ],
    [gradingLabel, ungradedCount],
  );

  const closeMobileNav = () => setMobileNavOpen(false);

  const openHome = () => {
    setTab('home');
    setSelectionExpanded(false);
    closeMobileNav();
  };

  useEffect(() => {
    const parsed = parseAdminDashboardSearchParams(searchParams);
    const next = normalizeAdminDashboardState(
      parsed ?? defaultAdminDashboardState(),
      isSuperAdmin,
    );
    setTab(next.tab);
    setSelectionSubTab(next.selectionSubTab ?? 'results');
    setSelectionExpanded(next.tab === 'results');
    setViewReady(true);
  }, [searchParams, isSuperAdmin]);

  useEffect(() => {
    void refreshProfile();
    const id = window.setInterval(() => { void refreshProfile(); }, 45_000);
    return () => window.clearInterval(id);
  }, [refreshProfile]);

  useEffect(() => {
    if (!viewReady) return;

    const params = adminDashboardStateToSearchParams(
      normalizeAdminDashboardState({ tab, selectionSubTab }, isSuperAdmin),
    );

    if (!dashboardSearchParamsEqual(params, searchParams)) {
      setSearchParams(params, { replace: true });
    }
  }, [tab, selectionSubTab, isSuperAdmin, viewReady, searchParams, setSearchParams]);

  const openProfile = () => {
    navigate(profilePathFromDashboardSearch(searchParams));
  };

  const visibleNavItems = navItems.filter((item) => !item.superAdminOnly || isSuperAdmin);

  const selectTab = (nextTab: AdminTab) => {
    if (
      nextTab === tab
      && (nextTab === 'lectures' || nextTab === 'seminars' || nextTab === 'homework')
    ) {
      setContentListResetKey((k) => k + 1);
      closeMobileNav();
      return;
    }
    setTab(nextTab);
    if (nextTab !== 'results') setSelectionExpanded(false);
    closeMobileNav();
  };

  const openSelection = (sub: SelectionAdminSubTab) => {
    setTab('results');
    setSelectionSubTab(sub);
    setSelectionExpanded(true);
    closeMobileNav();
  };

  const toggleSelectionSection = () => {
    if (tab === 'results') {
      setSelectionExpanded((v) => !v);
    } else {
      setTab('results');
      setSelectionExpanded(true);
    }
  };

  const applyAdminNavState = (state: AdminDashboardState) => {
    const next = normalizeAdminDashboardState(state, isSuperAdmin);
    setTab(next.tab);
    setSelectionSubTab(next.selectionSubTab ?? 'results');
    setSelectionExpanded(next.tab === 'results');
    closeMobileNav();
  };

  const handleNotificationNavigate = (action: NotificationAction) => {
    if (action.audience !== 'admin') return;
    applyAdminNavState(action.state);
  };

  const handleAdminHomeNavigate = (action: AdminHomeAction) => {
    if (action.selectionSub) {
      openSelection(action.selectionSub);
      return;
    }
    selectTab(action.tab);
  };

  const headerTitle = tab === 'home'
    ? 'Личный кабинет'
    : tab === 'results' && isSuperAdmin
      ? SELECTION_ADMIN_HEADER[selectionSubTab]
      : visibleNavItems.find((n) => n.id === tab)?.label;

  const mobileShortLabel = (id: AdminTab, label: string) => {
    if (id === 'results') return 'Отбор';
    if (id === 'statistics') return 'Статист.';
    if (id === 'homework') return 'ДЗ';
    if (id === 'grading') return 'Проверка';
    return label.split(' ')[0];
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900/80 border-r border-white/5 backdrop-blur-sm fixed h-full min-h-0 overflow-hidden z-20">
        <div className="shrink-0 p-6 border-b border-white/5">
          <button
            type="button"
            onClick={openHome}
            className="flex items-center gap-3 w-full text-left rounded-xl hover:bg-white/5 transition-colors -m-2 p-2"
            title="Личный кабинет"
          >
            <img src={publicAsset('/logo_qc.svg')} alt="Квантовый кружок" className="w-9 h-9 brightness-0 invert shrink-0" />
            <div className="min-w-0">
              <span className="font-bold text-white block">Квантовый кружок</span>
              <span className="text-xs text-slate-500">{isSuperAdmin ? 'Суперадмин' : 'Преподаватель'}</span>
            </div>
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-site p-4 space-y-1">
          {visibleNavItems.map((item) => {
            if (item.id === 'results' && isSuperAdmin) {
              const isSelectionActive = tab === 'results';
              const showSubs = selectionExpanded && isSelectionActive;
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={toggleSelectionSection}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${
                      isSelectionActive
                        ? 'bg-gradient-to-r from-blue-600/30 to-violet-600/30 text-white border border-blue-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                  <div
                    className={`grid transition-all duration-200 ${
                      showSubs ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-1">
                        {SELECTION_ADMIN_SUB_NAV.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => openSelection(sub.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                              isSelectionActive && selectionSubTab === sub.id
                                ? 'bg-blue-600/25 text-blue-200 border border-blue-500/25 shadow-sm shadow-blue-500/10'
                                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                            }`}
                          >
                            <sub.icon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{sub.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  tab === item.id
                    ? 'bg-gradient-to-r from-blue-600/30 to-violet-600/30 text-white border border-blue-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1 text-left truncate">{item.label}</span>
                {item.badge != null && item.badge > 0 && <NavCountBadge count={item.badge} />}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0 px-4 pb-2">
          <p className="text-xs text-slate-500 leading-relaxed px-2">
            {isSuperAdmin ? SIDEBAR_HINT.superadmin : SIDEBAR_HINT.admin}
          </p>
        </div>

        <div className="shrink-0 p-4 border-t border-white/5">
          <button
            type="button"
            onClick={openProfile}
            className="w-full flex items-center gap-3 mb-4 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors text-left group"
            title="Открыть профиль"
          >
            <UserAvatar
              displayName={displayName}
              avatarUrl={profile?.avatar_url}
              size="xs"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{displayName}</div>
              {accountSubtitle && (
                <div className="text-xs text-slate-500 truncate">{accountSubtitle}</div>
              )}
            </div>
          </button>
          <div className="mb-2">
            <DashboardSiteHomeLink />
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </button>
        </div>
      </aside>

      <DashboardMobileNav
        items={[
          {
            id: 'home',
            label: 'Главная',
            shortLabel: 'Главная',
            icon: Home,
            active: tab === 'home',
            badge: ungradedCount != null && ungradedCount > 0 ? ungradedCount : undefined,
            onClick: openHome,
          },
          ...visibleNavItems.map((item) => ({
            id: item.id,
            label: item.label,
            shortLabel: mobileShortLabel(item.id, item.label),
            icon: item.icon,
            active: tab === item.id,
            badge: item.badge,
            onClick: () => {
              if (item.id === 'results' && isSuperAdmin) {
                openSelection(selectionSubTab);
              } else {
                selectTab(item.id);
              }
            },
          })),
        ]}
        menuOpen={mobileNavOpen}
        onMenuOpenChange={setMobileNavOpen}
        menuTitle="Разделы кабинета"
      >
        {visibleNavItems.map((item) => {
          if (item.id === 'results' && isSuperAdmin) {
            const isSelectionActive = tab === 'results';
            return (
              <MobileMenuCollapsibleSection
                key={item.id}
                active={isSelectionActive}
                expanded={selectionExpanded && isSelectionActive}
                onToggle={toggleSelectionSection}
                icon={item.icon}
                label={item.label}
              >
                {SELECTION_ADMIN_SUB_NAV.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => openSelection(sub.id)}
                    className={mobileMenuSubBtn(isSelectionActive && selectionSubTab === sub.id)}
                  >
                    <sub.icon className="w-3.5 h-3.5 shrink-0" />
                    {sub.label}
                  </button>
                ))}
              </MobileMenuCollapsibleSection>
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectTab(item.id)}
              className={mobileMenuBtn(tab === item.id)}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge != null && item.badge > 0 && <NavCountBadge count={item.badge} />}
            </button>
          );
        })}
        <p className="text-xs text-slate-500 leading-relaxed px-4 py-2">
          {isSuperAdmin ? SIDEBAR_HINT.superadmin : SIDEBAR_HINT.admin}
        </p>
        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <button
            type="button"
            onClick={() => { openProfile(); closeMobileNav(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-left"
          >
            <UserAvatar displayName={displayName} avatarUrl={profile?.avatar_url} size="xs" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white truncate">{displayName}</div>
              {accountSubtitle && (
                <div className="text-xs text-slate-500 truncate">{accountSubtitle}</div>
              )}
            </div>
          </button>
          <DashboardSiteHomeLink />
          <button type="button" onClick={signOut} className={mobileMenuBtn(false)}>
            <LogOut className="w-5 h-5 shrink-0" />
            Выйти
          </button>
        </div>
      </DashboardMobileNav>

      <main className="flex-1 lg:ml-64 min-h-screen min-w-0">
        <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 min-w-0">
          <button
            type="button"
            onClick={openHome}
            className="flex-1 min-w-0 text-lg font-semibold text-white truncate text-left hover:text-blue-200 transition-colors"
          >
            {headerTitle}
          </button>
          <div className="flex items-center gap-3 shrink-0">
            {profile && user && (
              <DashboardHeaderActions
                profile={profile}
                userId={user.id}
                onOpenProfile={openProfile}
                onNotificationNavigate={handleNotificationNavigate}
              />
            )}
          </div>
        </header>

        {user && !isSuperAdmin && <TeacherPromotedBanner userId={user.id} />}

        {isSuperAdmin && tab === 'results' && (
          <MobileSubNavBar
            items={SELECTION_ADMIN_SUB_NAV}
            activeId={selectionSubTab}
            onSelect={(id) => openSelection(id as SelectionAdminSubTab)}
          />
        )}

        <div className="p-4 sm:p-6 lg:p-8 pb-36 lg:pb-8">
          {tab === 'home' && (
            <AdminDashboardHome
              isSuperAdmin={isSuperAdmin}
              displayName={displayName}
              onNavigate={handleAdminHomeNavigate}
            />
          )}
          {tab === 'results' && isSuperAdmin && selectionSubTab === 'stage1' && <SelectionStage1ConfigTab />}
          {tab === 'results' && isSuperAdmin && selectionSubTab === 'contest' && <SelectionContestConfigTab />}
          {tab === 'results' && (isSuperAdmin ? selectionSubTab === 'results' : true) && (
            <ResultsTab isSuperAdmin={isSuperAdmin} />
          )}
          {tab === 'students' && <StudentsTab isSuperAdmin={isSuperAdmin} />}
          {tab === 'teachers' && isSuperAdmin && <TeachersTab />}
          {tab === 'lectures' && (
            <LessonsTab key={`lecture-${contentListResetKey}`} lessonType="lecture" />
          )}
          {tab === 'seminars' && (
            <LessonsTab key={`seminar-${contentListResetKey}`} lessonType="seminar" />
          )}
          {tab === 'homework' && (
            <HomeworkPagesTab key={`homework-${contentListResetKey}`} />
          )}
          {tab === 'grading' && <HomeworkTab isSuperAdmin={isSuperAdmin} mode="grading" />}
          {tab === 'schedule' && <ScheduleTab />}
          {tab === 'statistics' && <StatisticsTab isSuperAdmin={isSuperAdmin} />}
          {tab === 'site' && isSuperAdmin && <SiteContentTab />}
        </div>
      </main>
    </div>
  );
}
