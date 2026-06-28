import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
  adminDashboardStateToSearchParams,
  dashboardSearchParamsEqual,
  defaultAdminDashboardState,
  normalizeAdminDashboardState,
  parseAdminDashboardSearchParams,
  profilePathFromDashboardSearch,
} from '../lib/dashboardNavigation';
import DashboardHeaderActions from '../components/DashboardHeaderActions';
import {
  LogOut, Users, ClipboardList, BookOpenCheck, Calendar, FileText, FlaskConical, CheckCircle, GraduationCap, Presentation, BookOpen, BarChart3, Globe,
} from 'lucide-react';
import ResultsTab from './admin/ResultsTab';
import SelectionEssayConfigTab from './admin/SelectionEssayConfigTab';
import SelectionContestConfigTab from './admin/SelectionContestConfigTab';
import StudentsTab from './admin/StudentsTab';
import TeachersTab from './admin/TeachersTab';
import HomeworkTab from './admin/HomeworkTab';
import LessonsTab from './admin/LessonsTab';
import ScheduleTab from './admin/ScheduleTab';
import StatisticsTab from './admin/StatisticsTab';
import SiteContentTab from './admin/SiteContentTab';
import DashboardHomePanel from '../components/DashboardHomePanel';
import DashboardSiteHomeLink from '../components/DashboardSiteHomeLink';
import UserAvatar from '../components/UserAvatar';
import DashboardMobileNav, { MobileMenuCollapsibleSection, MobileSubNavBar, mobileMenuBtn, mobileMenuSubBtn } from '../components/DashboardMobileNav';

type AdminTab = 'home' | 'results' | 'students' | 'teachers' | 'learning' | 'schedule' | 'statistics' | 'site';
type SelectionAdminSubTab = 'essay' | 'contest' | 'results';
type LearningAdminSubTab = 'lectures' | 'seminars' | 'homework';

const SELECTION_ADMIN_SUB_NAV: {
  id: SelectionAdminSubTab;
  label: string;
  icon: typeof FileText;
}[] = [
  { id: 'essay', label: 'Этап 1: Эссе', icon: FileText },
  { id: 'contest', label: 'Этап 2: Задачи', icon: FlaskConical },
  { id: 'results', label: 'Результаты', icon: CheckCircle },
];

const SELECTION_ADMIN_HEADER: Record<SelectionAdminSubTab, string> = {
  essay: 'Этап 1: Эссе',
  contest: 'Этап 2: Задачи',
  results: 'Результаты',
};

const LEARNING_ADMIN_SUB_NAV: {
  id: LearningAdminSubTab;
  label: string;
  icon: typeof Presentation;
}[] = [
  { id: 'lectures', label: 'Лекции', icon: Presentation },
  { id: 'seminars', label: 'Семинары', icon: Presentation },
  { id: 'homework', label: 'Домашние задания', icon: BookOpen },
];

const LEARNING_ADMIN_HEADER: Record<LearningAdminSubTab, string> = {
  lectures: 'Лекции',
  seminars: 'Семинары',
  homework: 'Домашние задания',
};

export default function AdminDashboard({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<AdminTab>('home');
  const [selectionSubTab, setSelectionSubTab] = useState<SelectionAdminSubTab>('results');
  const [selectionExpanded, setSelectionExpanded] = useState(false);
  const [learningSubTab, setLearningSubTab] = useState<LearningAdminSubTab>('lectures');
  const [learningExpanded, setLearningExpanded] = useState(true);
  const [viewReady, setViewReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Админ';

  const closeMobileNav = () => setMobileNavOpen(false);

  const openHome = () => {
    setTab('home');
    setSelectionExpanded(false);
    setLearningExpanded(false);
    closeMobileNav();
  };

  useEffect(() => {
    const parsed = parseAdminDashboardSearchParams(searchParams);
    const next = normalizeAdminDashboardState(
      parsed ?? defaultAdminDashboardState(isSuperAdmin),
      isSuperAdmin,
    );
    setTab(next.tab);
    setSelectionSubTab(next.selectionSubTab ?? 'results');
    setLearningSubTab(next.learningSubTab ?? 'lectures');
    setSelectionExpanded(next.tab === 'results');
    setLearningExpanded(next.tab === 'learning');
    setViewReady(true);
  }, [searchParams, isSuperAdmin]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (!viewReady) return;

    const params = adminDashboardStateToSearchParams(
      normalizeAdminDashboardState(
        { tab, selectionSubTab, learningSubTab },
        isSuperAdmin,
      ),
    );

    if (!dashboardSearchParamsEqual(params, searchParams)) {
      setSearchParams(params, { replace: true });
    }
  }, [tab, selectionSubTab, learningSubTab, isSuperAdmin, viewReady, searchParams, setSearchParams]);

  const openProfile = () => {
    navigate(profilePathFromDashboardSearch(searchParams));
  };

  const navItems: { id: AdminTab; icon: typeof Users; label: string; superAdminOnly?: boolean }[] = [
    { id: 'results', icon: ClipboardList, label: 'Отборочные этапы' },
    { id: 'students', icon: Users, label: 'Ученики' },
    { id: 'teachers', icon: GraduationCap, label: 'Преподаватели', superAdminOnly: true },
    { id: 'learning', icon: BookOpenCheck, label: 'Обучение' },
    { id: 'schedule', icon: Calendar, label: 'Расписание' },
    { id: 'statistics', icon: BarChart3, label: 'Статистика' },
    { id: 'site', icon: Globe, label: 'Сайт', superAdminOnly: true },
  ];

  const visibleNavItems = navItems.filter((item) => !item.superAdminOnly || isSuperAdmin);

  const openSelection = (sub: SelectionAdminSubTab) => {
    setTab('results');
    setSelectionSubTab(sub);
    setSelectionExpanded(true);
    setLearningExpanded(false);
    closeMobileNav();
  };

  const toggleSelectionSection = () => {
    if (tab === 'results') {
      setSelectionExpanded((v) => !v);
    } else {
      setTab('results');
      setSelectionExpanded(true);
      setLearningExpanded(false);
    }
  };

  const openLearning = (sub: LearningAdminSubTab) => {
    setTab('learning');
    setLearningSubTab(sub);
    setLearningExpanded(true);
    setSelectionExpanded(false);
    closeMobileNav();
  };

  const toggleLearningSection = () => {
    if (tab === 'learning') {
      setLearningExpanded((v) => !v);
    } else {
      setTab('learning');
      setLearningExpanded(true);
      setSelectionExpanded(false);
    }
  };

  const headerTitle = tab === 'home'
    ? 'Личный кабинет'
    : tab === 'results' && isSuperAdmin
      ? SELECTION_ADMIN_HEADER[selectionSubTab]
      : tab === 'learning'
        ? LEARNING_ADMIN_HEADER[learningSubTab]
        : visibleNavItems.find((n) => n.id === tab)?.label;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900/80 border-r border-white/5 backdrop-blur-sm fixed h-full z-20">
        <div className="p-6 border-b border-white/5">
          <button
            type="button"
            onClick={openHome}
            className="flex items-center gap-3 w-full text-left rounded-xl hover:bg-white/5 transition-colors -m-2 p-2"
            title="Личный кабинет"
          >
            <img src="/logo_qc.svg" alt="Квантовый кружок" className="w-9 h-9 brightness-0 invert shrink-0" />
            <div className="min-w-0">
              <span className="font-bold text-white block">Квантовый кружок</span>
              <span className="text-xs text-slate-500">{isSuperAdmin ? 'Суперадмин' : 'Преподаватель'}</span>
            </div>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
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

            if (item.id === 'learning') {
              const isLearningActive = tab === 'learning';
              const showLearningSubs = learningExpanded && isLearningActive;
              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={toggleLearningSection}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${
                      isLearningActive
                        ? 'bg-gradient-to-r from-blue-600/30 to-violet-600/30 text-white border border-blue-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                  <div
                    className={`grid transition-all duration-200 ${
                      showLearningSubs ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-1">
                        {LEARNING_ADMIN_SUB_NAV.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => openLearning(sub.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                              isLearningActive && learningSubTab === sub.id
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
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  tab === item.id
                    ? 'bg-gradient-to-r from-blue-600/30 to-violet-600/30 text-white border border-blue-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
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
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
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
        items={visibleNavItems.map((item) => ({
          id: item.id,
          label: item.label,
          shortLabel: item.id === 'results' ? 'Отбор' : item.id === 'statistics' ? 'Статист.' : item.label.split(' ')[0],
          icon: item.icon,
          active: tab === item.id,
          onClick: () => {
            if (item.id === 'results' && isSuperAdmin) {
              openSelection(selectionSubTab);
            } else if (item.id === 'learning') {
              openLearning(learningSubTab);
            } else {
              setTab(item.id);
              setSelectionExpanded(false);
              setLearningExpanded(false);
              closeMobileNav();
            }
          },
        }))}
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
          if (item.id === 'learning') {
            const isLearningActive = tab === 'learning';
            return (
              <MobileMenuCollapsibleSection
                key={item.id}
                active={isLearningActive}
                expanded={learningExpanded && isLearningActive}
                onToggle={toggleLearningSection}
                icon={item.icon}
                label={item.label}
              >
                {LEARNING_ADMIN_SUB_NAV.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => openLearning(sub.id)}
                    className={mobileMenuSubBtn(isLearningActive && learningSubTab === sub.id)}
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
              onClick={() => {
                setTab(item.id);
                setSelectionExpanded(false);
                setLearningExpanded(false);
                closeMobileNav();
              }}
              className={mobileMenuBtn(tab === item.id)}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {item.label}
            </button>
          );
        })}
        <div className="pt-3 mt-3 border-t border-white/5 space-y-2">
          <button
            type="button"
            onClick={() => { openProfile(); closeMobileNav(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-left"
          >
            <UserAvatar displayName={displayName} avatarUrl={profile?.avatar_url} size="xs" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white truncate">{displayName}</div>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
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
              />
            )}
          </div>
        </header>

        {isSuperAdmin && tab === 'results' && (
          <MobileSubNavBar
            items={SELECTION_ADMIN_SUB_NAV}
            activeId={selectionSubTab}
            onSelect={(id) => openSelection(id as SelectionAdminSubTab)}
          />
        )}

        {tab === 'learning' && (
          <MobileSubNavBar
            items={LEARNING_ADMIN_SUB_NAV}
            activeId={learningSubTab}
            onSelect={(id) => openLearning(id as LearningAdminSubTab)}
          />
        )}

        <div className="p-4 sm:p-6 lg:p-8 pb-28 lg:pb-8">
          {tab === 'home' && (
            <DashboardHomePanel
              role={isSuperAdmin ? 'superadmin' : 'admin'}
              displayName={displayName}
            />
          )}
          {tab === 'results' && isSuperAdmin && selectionSubTab === 'essay' && <SelectionEssayConfigTab />}
          {tab === 'results' && isSuperAdmin && selectionSubTab === 'contest' && <SelectionContestConfigTab />}
          {tab === 'results' && (isSuperAdmin ? selectionSubTab === 'results' : true) && <ResultsTab />}
          {tab === 'students' && <StudentsTab isSuperAdmin={isSuperAdmin} />}
          {tab === 'teachers' && isSuperAdmin && <TeachersTab />}
          {tab === 'learning' && learningSubTab === 'lectures' && <LessonsTab lessonType="lecture" />}
          {tab === 'learning' && learningSubTab === 'seminars' && <LessonsTab lessonType="seminar" />}
          {tab === 'learning' && learningSubTab === 'homework' && <HomeworkTab isSuperAdmin={isSuperAdmin} />}
          {tab === 'schedule' && <ScheduleTab />}
          {tab === 'statistics' && <StatisticsTab isSuperAdmin={isSuperAdmin} />}
          {tab === 'site' && isSuperAdmin && <SiteContentTab />}
        </div>
      </main>
    </div>
  );
}
