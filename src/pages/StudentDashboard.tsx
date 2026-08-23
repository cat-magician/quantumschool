import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Loader2, LogOut, Calendar, BarChart3, Home,
  ClipboardList, FileText, FlaskConical, Lock,
  CheckCircle, BookOpen, Presentation, GraduationCap,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { profileAccountLabel, profileDisplayName } from '../lib/profileUtils';
import {
  dashboardSearchParamsEqual,
  defaultStudentDashboardState,
  normalizeStudentDashboardState,
  parseStudentDashboardSearchParams,
  profilePathFromDashboardSearch,
  studentDashboardStateToSearchParams,
  type StudentDashboardState,
} from '../lib/dashboardNavigation';
import { publicAsset } from '../lib/appPaths';
import type { NotificationAction } from '../lib/notificationsUtils';
import DashboardHeaderActions from '../components/DashboardHeaderActions';
import UserAvatar from '../components/UserAvatar';
import { isContestPublished, isEssayPublished, isQuestionnairePublished } from '../lib/selectionConfig';
import { useSelectionConfig } from '../hooks/useSelectionConfig';
import StageComingSoon from '../components/StageComingSoon';
import { markQuestionnaireSubmitted, markQuestionnaireUnsubmitted, markStageSubmitted, markStageUnsubmitted, markStageViewed } from '../lib/selectionUtils';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../lib/types';
import { canStudentUnsubmit, selectionVerdict, studentStagePhase } from '../lib/selectionDisplayUtils';
import { loadStudentGroupContext, type StudentGroupContext } from '../lib/groupUtils';
import StudentGroupInfo from '../components/StudentGroupInfo';
import SectionHint from '../components/SectionHint';
import { SECTION_HINT, SIDEBAR_HINT } from '../lib/dashboardHelpCopy';
import StudentScheduleTab from './student/ScheduleTab';
import StudentLearningTab, { type LearningSubTab } from './student/LearningTab';
import StudentProgressTab from './student/ProgressTab';
import YandexFormEmbed from '../components/YandexFormEmbed';
import StageEmbedFrame from '../components/StageEmbedFrame';
import StudentDashboardHome, { type StudentNextAction } from '../components/StudentDashboardHome';
import TelegramCommunityCard from '../components/TelegramCommunityCard';
import DashboardSiteHomeLink from '../components/DashboardSiteHomeLink';
import DashboardMobileNav, { MobileMenuCollapsibleSection, MobileSubNavBar, mobileMenuBtn, mobileMenuSubBtn } from '../components/DashboardMobileNav';
import NavCountBadge from '../components/NavCountBadge';
import EnrolledWelcomeModal from '../components/EnrolledWelcomeModal';
import {
  ExternalFormHint,
  ExternalSubmitConfirm,
  SubmitAcceptedBanner,
} from '../components/ExternalSubmitConfirm';
import SelectionStage1Progress, { StepSectionLabel } from '../components/SelectionStage1Progress';
import { countSelectionPendingSteps, buildEnrolledHomeworkProgress } from '../lib/studentHomeActions';
import { markEnrollmentWelcomeShown, shouldShowEnrollmentWelcome } from '../lib/enrollmentWelcome';
import { markHadPendingTeacherApplication } from '../lib/teacherPromotionNotice';
import { TeacherApplicationPendingBanner } from '../components/TeacherRoleBanners';
import {
  consumeJustDemotedFromTeacher,
  loadStudentCabinetSnapshot,
  saveStudentCabinetSnapshot,
} from '../lib/studentCabinetSnapshot';

type Tab = 'home' | 'selection' | 'learning' | 'schedule' | 'progress';
type SelectionSubTab = 'stage1' | 'stage2' | 'results';

const SELECTION_SUB_NAV: { id: SelectionSubTab; label: string; shortLabel: string; icon: typeof FileText }[] = [
  { id: 'stage1', label: 'Этап 1', shortLabel: 'Этап 1', icon: FileText },
  { id: 'stage2', label: 'Этап 2: Задачи', shortLabel: 'Этап 2', icon: FlaskConical },
  { id: 'results', label: 'Результаты', shortLabel: 'Результаты', icon: CheckCircle },
];

const SELECTION_HEADER: Record<SelectionSubTab, string> = {
  stage1: 'Этап 1',
  stage2: 'Этап 2: Задачи',
  results: 'Результаты',
};

const LEARNING_SUB_NAV: { id: LearningSubTab; label: string; icon: typeof Presentation }[] = [
  { id: 'lectures', label: 'Лекции', icon: Presentation },
  { id: 'seminars', label: 'Семинары', icon: Presentation },
  { id: 'homework', label: 'Домашние задания', icon: BookOpen },
];

const LEARNING_HEADER: Record<LearningSubTab, string> = {
  lectures: 'Лекции',
  seminars: 'Семинары',
  homework: 'Домашние задания',
};

export default function StudentDashboard() {
  const { user, profile, signOut, signingOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isEnrolled = profile?.is_enrolled ?? false;
  const [tab, setTab] = useState<Tab>('home');
  const [selectionSubTab, setSelectionSubTab] = useState<SelectionSubTab>('stage1');
  const [learningSubTab, setLearningSubTab] = useState<LearningSubTab>('lectures');
  const [learningExpanded, setLearningExpanded] = useState(false);
  const [viewReady, setViewReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showEnrollmentWelcome, setShowEnrollmentWelcome] = useState(false);
  const [homeworkPendingCount, setHomeworkPendingCount] = useState(0);
  const [contentPageId, setContentPageId] = useState<string | null>(null);
  const displayName = profile ? profileDisplayName(profile) : 'Участник';
  const accountSubtitle = profileAccountLabel(profile, user?.email);
  const [groupContext, setGroupContext] = useState<StudentGroupContext | null>(null);

  const closeMobileNav = () => setMobileNavOpen(false);

  const openHome = () => {
    setTab('home');
    setContentPageId(null);
    setLearningExpanded(false);
    closeMobileNav();
  };

  const selectionSubNav = useMemo(
    () => (isEnrolled ? SELECTION_SUB_NAV.filter((s) => s.id === 'results') : SELECTION_SUB_NAV),
    [isEnrolled],
  );

  const selectionPendingCount = useMemo(
    () => (profile ? countSelectionPendingSteps(profile) : 0),
    [profile],
  );

  useEffect(() => {
    if (!user?.id || !isEnrolled) return;
    if (shouldShowEnrollmentWelcome(user.id, isEnrolled)) {
      setShowEnrollmentWelcome(true);
    }
  }, [user?.id, isEnrolled]);

  useEffect(() => {
    if (!user?.id || !profile?.teacher_application) return;
    markHadPendingTeacherApplication(user.id);
    const id = window.setInterval(() => { void refreshProfile(); }, 60_000);
    return () => window.clearInterval(id);
  }, [user?.id, profile?.teacher_application, refreshProfile]);

  useEffect(() => {
    if (!user?.id || !isEnrolled) {
      setHomeworkPendingCount(0);
      return;
    }
    Promise.all([
      supabase.from('homework_pages').select('id, title, due_at, max_score').eq('is_published', true),
      supabase.from('homework_page_submissions').select('*').eq('user_id', user.id),
    ]).then(([pagesRes, subsRes]) => {
      const progress = buildEnrolledHomeworkProgress(user.id, pagesRes.data ?? [], subsRes.data ?? []);
      setHomeworkPendingCount(progress.filter((p) => p.status === 'none' || p.status === 'draft').length);
    });
  }, [user?.id, isEnrolled, tab]);

  const openLockedEnrollmentInfo = () => {
    openSelection('results');
  };

  const dismissEnrollmentWelcome = () => {
    if (user?.id) markEnrollmentWelcomeShown(user.id);
    setShowEnrollmentWelcome(false);
  };

  const goToLearningFromWelcome = () => {
    dismissEnrollmentWelcome();
    openLearning('lectures');
  };

  useEffect(() => {
    if (!user?.id || !isEnrolled) {
      setGroupContext(null);
      return;
    }
    loadStudentGroupContext(supabase, user.id).then(setGroupContext);
  }, [user?.id, isEnrolled]);

  useEffect(() => {
    let parsed = parseStudentDashboardSearchParams(searchParams);
    const tabRaw = searchParams.get('tab');
    const justDemoted = user?.id ? consumeJustDemotedFromTeacher(user.id) : false;
    // После исключения из штата URL может ещё быть админским (?tab=lectures) —
    // восстанавливаем последний ученический кабинет из снимка.
    if (user?.id && (justDemoted || (!parsed && tabRaw))) {
      const snap = loadStudentCabinetSnapshot(user.id);
      if (snap && (justDemoted || !parsed)) parsed = snap;
    }

    const next = normalizeStudentDashboardState(
      parsed ?? defaultStudentDashboardState(),
      isEnrolled,
    );
    setTab(next.tab);
    setSelectionSubTab(next.selectionSubTab ?? (isEnrolled ? 'results' : 'stage1'));
    setLearningSubTab(next.learningSubTab ?? 'lectures');
    setContentPageId(next.contentPageId ?? null);
    setLearningExpanded(next.tab === 'learning');
    setViewReady(true);
  }, [searchParams, isEnrolled, user?.id]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (!viewReady) return;

    const normalized = normalizeStudentDashboardState(
      {
        tab,
        selectionSubTab,
        learningSubTab,
        contentPageId: contentPageId ?? undefined,
      },
      isEnrolled,
    );

    if (user?.id) {
      saveStudentCabinetSnapshot(user.id, normalized);
    }

    const params = studentDashboardStateToSearchParams(normalized);

    if (!dashboardSearchParamsEqual(params, searchParams)) {
      setSearchParams(params, { replace: true });
    }
  }, [tab, selectionSubTab, learningSubTab, contentPageId, isEnrolled, viewReady, searchParams, setSearchParams, user?.id]);


  const openProfile = () => {
    navigate(profilePathFromDashboardSearch(searchParams));
  };

  const navItems: { id: Tab; icon: typeof Home; label: string; locked: boolean }[] = [
    { id: 'selection', icon: ClipboardList, label: 'Отборочный этап', locked: false },
    { id: 'schedule', icon: Calendar, label: 'Расписание', locked: !isEnrolled },
    { id: 'learning', icon: GraduationCap, label: 'Обучение', locked: !isEnrolled },
    { id: 'progress', icon: BarChart3, label: 'Прогресс', locked: !isEnrolled },
  ];

  const handleTabClick = (id: Tab, locked: boolean) => {
    if (locked) {
      openLockedEnrollmentInfo();
      return;
    }
    setTab(id);
    setContentPageId(null);
    if (id !== 'learning') setLearningExpanded(false);
    closeMobileNav();
  };

  const applyStudentNavState = (state: StudentDashboardState) => {
    const next = normalizeStudentDashboardState(state, isEnrolled);
    setTab(next.tab);
    setSelectionSubTab(next.selectionSubTab ?? (isEnrolled ? 'results' : 'stage1'));
    setLearningSubTab(next.learningSubTab ?? 'lectures');
    setContentPageId(next.contentPageId ?? null);
    setLearningExpanded(next.tab === 'learning');
    closeMobileNav();
  };

  const handleNotificationNavigate = (action: NotificationAction) => {
    if (action.audience !== 'student') return;
    applyStudentNavState(action.state);
  };

  const openSelection = (sub: SelectionSubTab) => {
    setTab('selection');
    setSelectionSubTab(sub);
    setContentPageId(null);
    setLearningExpanded(false);
    closeMobileNav();
  };

  const openLearning = (sub: LearningSubTab, pageId?: string | null) => {
    if (!isEnrolled) return;
    // Повторный клик по активной подвкладке — назад к списку карточек
    if (
      pageId == null
      && tab === 'learning'
      && learningSubTab === sub
      && contentPageId
    ) {
      setContentPageId(null);
      closeMobileNav();
      return;
    }
    setTab('learning');
    setLearningSubTab(sub);
    setContentPageId(pageId ?? null);
    setLearningExpanded(true);
    closeMobileNav();
  };

  const openHomeworkPage = (pageId: string) => {
    openLearning('homework', pageId);
  };

  const handleHomeAction = (action: StudentNextAction) => {
    if (action.tab === 'selection' && action.selectionSub) {
      openSelection(action.selectionSub);
      return;
    }
    if (action.tab === 'learning') {
      openLearning(action.learningSub ?? 'lectures', action.homeworkPageId);
      return;
    }
    if (action.tab === 'schedule') {
      setTab('schedule');
      setContentPageId(null);
      setLearningExpanded(false);
      closeMobileNav();
      return;
    }
    if (action.tab === 'progress') {
      setTab('progress');
      setContentPageId(null);
      setLearningExpanded(false);
      closeMobileNav();
    }
  };

  const toggleLearningSection = () => {
    if (!isEnrolled) return;
    if (tab === 'learning') {
      setLearningExpanded((v) => !v);
    } else {
      setTab('learning');
      setLearningExpanded(true);
    }
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
            <span className="font-bold text-white">Квантовый кружок</span>
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-site p-4 space-y-1">
          <button
            type="button"
            onClick={openHome}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${
              tab === 'home'
                ? 'bg-gradient-to-r from-blue-600/30 to-violet-600/30 text-white border border-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="flex-1 text-left">Главная</span>
            {!isEnrolled && selectionPendingCount > 0 && (
              <NavCountBadge count={selectionPendingCount} />
            )}
            {isEnrolled && homeworkPendingCount > 0 && (
              <NavCountBadge count={homeworkPendingCount} />
            )}
          </button>

          {navItems.map((item) => {
            if (item.id === 'selection') {
              return (
                <div key={item.id} className="space-y-1 pt-1">
                  <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    Отборочный этап
                  </p>
                  {selectionSubNav.map((sub) => {
                    const isSubActive = tab === 'selection' && selectionSubTab === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => openSelection(sub.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          isSubActive
                            ? 'bg-gradient-to-r from-blue-600/30 to-violet-600/30 text-white border border-blue-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <sub.icon className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1 text-left">{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            }

            if (item.id === 'learning') {
              if (item.locked) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={openLockedEnrollmentInfo}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                    title="Откроется после зачисления — нажмите для статуса"
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <Lock className="w-3.5 h-3.5 ml-auto text-slate-600" />
                  </button>
                );
              }

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
                        {LEARNING_SUB_NAV.map((sub) => {
                          const isSubActive = isLearningActive && learningSubTab === sub.id;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => openLearning(sub.id)}
                              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                isSubActive
                                  ? 'bg-blue-600/25 text-blue-200 border border-blue-500/25 shadow-sm shadow-blue-500/10'
                                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                              }`}
                            >
                              <sub.icon className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{sub.label}</span>
                            </button>
                          );
                        })}
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
                onClick={() => handleTabClick(item.id, item.locked)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  item.locked
                    ? 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    : tab === item.id
                      ? 'bg-gradient-to-r from-blue-600/30 to-violet-600/30 text-white border border-blue-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                title={item.locked ? 'Откроется после зачисления — нажмите для статуса' : undefined}
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.locked && <Lock className="w-3.5 h-3.5 ml-auto text-slate-600" />}
              </button>
            );
          })}
        </nav>

        {!isEnrolled && (
          <div className="shrink-0 px-4 pb-2">
            <p className="text-xs text-slate-500 leading-relaxed px-2">
              {SIDEBAR_HINT.student_not_enrolled}
              {' '}
              <button type="button" onClick={openLockedEnrollmentInfo} className="text-blue-400 hover:text-blue-300">
                Статус →
              </button>
            </p>
          </div>
        )}

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
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {signingOut ? 'Выходим…' : 'Выйти'}
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
            badge:
              !isEnrolled && selectionPendingCount > 0
                ? selectionPendingCount
                : isEnrolled && homeworkPendingCount > 0
                  ? homeworkPendingCount
                  : undefined,
            onClick: openHome,
          },
          ...navItems.map((item) => ({
            id: item.id,
            label: item.label,
            shortLabel:
              item.id === 'selection' ? 'Отбор' : item.id === 'progress' ? 'Прогресс' : item.label.split(' ')[0],
            icon: item.icon,
            active: tab === item.id,
            badge:
              item.id === 'selection' && selectionPendingCount > 0
                ? selectionPendingCount
                : item.id === 'learning' && homeworkPendingCount > 0
                  ? homeworkPendingCount
                  : undefined,
            onClick: () => {
              if (item.locked) {
                openLockedEnrollmentInfo();
                return;
              }
              if (item.id === 'selection') {
                openSelection(selectionSubTab);
              } else if (item.id === 'learning') {
                openLearning(learningSubTab);
              } else {
                handleTabClick(item.id, false);
              }
            },
          })),
        ]}
        menuOpen={mobileNavOpen}
        onMenuOpenChange={setMobileNavOpen}
        menuTitle="Разделы кабинета"
      >
        {navItems.map((item) => {
          if (item.id === 'selection') {
            return (
              <div key={item.id} className="space-y-1 pt-1">
                <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Отборочный этап
                </p>
                {selectionSubNav.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => openSelection(sub.id)}
                    className={mobileMenuSubBtn(tab === 'selection' && selectionSubTab === sub.id)}
                  >
                    <sub.icon className="w-3.5 h-3.5 shrink-0" />
                    {sub.label}
                  </button>
                ))}
              </div>
            );
          }
          if (item.id === 'learning') {
            const isLearningActive = tab === 'learning';
            if (item.locked) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={openLockedEnrollmentInfo}
                  className={`${mobileMenuBtn(false)} text-slate-500`}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <Lock className="w-4 h-4 shrink-0 text-slate-600" />
                </button>
              );
            }
            return (
              <MobileMenuCollapsibleSection
                key={item.id}
                active={isLearningActive}
                expanded={learningExpanded && isLearningActive}
                onToggle={toggleLearningSection}
                icon={item.icon}
                label={item.label}
              >
                {LEARNING_SUB_NAV.map((sub) => (
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
              onClick={() => handleTabClick(item.id, item.locked)}
              className={`${mobileMenuBtn(tab === item.id)} ${item.locked ? 'text-slate-500' : ''}`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.locked && <Lock className="w-4 h-4 ml-auto shrink-0" />}
            </button>
          );
        })}
        {!isEnrolled && (
          <p className="text-xs text-slate-500 leading-relaxed px-4 py-2">
            {SIDEBAR_HINT.student_not_enrolled}
            {' '}
            <button type="button" onClick={openLockedEnrollmentInfo} className="text-blue-400 hover:text-blue-300">
              Статус зачисления →
            </button>
          </p>
        )}
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
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className={`${mobileMenuBtn(false)} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {signingOut
              ? <Loader2 className="w-5 h-5 shrink-0 animate-spin" />
              : <LogOut className="w-5 h-5 shrink-0" />}
            {signingOut ? 'Выходим…' : 'Выйти'}
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
            {tab === 'home' && 'Личный кабинет'}
            {tab === 'selection' && SELECTION_HEADER[selectionSubTab]}
            {tab === 'learning' && LEARNING_HEADER[learningSubTab]}
            {tab === 'schedule' && 'Расписание'}
            {tab === 'progress' && 'Прогресс'}
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

        {profile?.teacher_application && <TeacherApplicationPendingBanner />}

        {tab === 'selection' && (
          <MobileSubNavBar
            items={selectionSubNav}
            activeId={selectionSubTab}
            onSelect={(id) => openSelection(id as SelectionSubTab)}
          />
        )}

        {tab === 'learning' && isEnrolled && (
          <MobileSubNavBar
            items={LEARNING_SUB_NAV}
            activeId={learningSubTab}
            onSelect={(id) => openLearning(id as LearningSubTab)}
          />
        )}

        <div className="p-4 sm:p-6 lg:p-8 pb-36 lg:pb-8">
          {isEnrolled && groupContext && tab !== 'home' && <StudentGroupInfo context={groupContext} />}
          {tab === 'home' && profile && user && (
            <div className="space-y-6">
              <StudentDashboardHome
                profile={profile}
                userId={user.id}
                displayName={displayName}
                isEnrolled={isEnrolled}
                onAction={handleHomeAction}
                onOpenHomework={openHomeworkPage}
              />
              {isEnrolled && <TelegramCommunityCard />}
            </div>
          )}
          {tab === 'selection' && profile && (
            <SelectionTab
              profile={profile}
              subTab={selectionSubTab}
              onRefresh={refreshProfile}
              onGoHome={openHome}
              onGoResults={() => openSelection('results')}
            />
          )}
          {tab === 'learning' && isEnrolled && (
            <StudentLearningTab
              subTab={learningSubTab}
              contentPageId={contentPageId}
              onContentPageChange={setContentPageId}
              onOpenHomeworkPage={openHomeworkPage}
            />
          )}
          {tab === 'schedule' && isEnrolled && <StudentScheduleTab />}
          {tab === 'progress' && isEnrolled && (
            <StudentProgressTab onOpenHomework={openHomeworkPage} />
          )}
        </div>
      </main>

      {showEnrollmentWelcome && (
        <EnrolledWelcomeModal
          onGoToLearning={goToLearningFromWelcome}
          onDismiss={dismissEnrollmentWelcome}
        />
      )}
    </div>
  );
}

function SelectionTab({
  profile, subTab, onRefresh, onGoHome, onGoResults,
}: {
  profile: UserProfile;
  subTab: SelectionSubTab;
  onRefresh: () => Promise<void>;
  onGoHome?: () => void;
  onGoResults?: () => void;
}) {
  const [marking, setMarking] = useState<1 | 2 | null>(null);
  const [questionnaireMarking, setQuestionnaireMarking] = useState(false);
  const [markError, setMarkError] = useState('');
  const { config } = useSelectionConfig();
  const essayPublished = isEssayPublished(config);
  const questionnairePublished = isQuestionnairePublished(config);
  const contestPublished = isContestPublished(config);

  const handleMarkSubmitted = async (stage: 1 | 2) => {
    if (!profile) return;
    setMarking(stage);
    setMarkError('');
    const { error } = await markStageSubmitted(supabase, profile.id, stage);
    if (error) {
      const msg = typeof error === 'string' ? error : (error as { message?: string }).message;
      setMarkError(msg || 'Не удалось сохранить');
    } else {
      await onRefresh();
    }
    setMarking(null);
  };

  const handleMarkUnsubmitted = async (stage: 1 | 2) => {
    if (!profile) return;
    setMarking(stage);
    setMarkError('');
    const { error } = await markStageUnsubmitted(supabase, profile.id, stage);
    if (error) setMarkError(typeof error === 'string' ? error : 'Не удалось отменить');
    else await onRefresh();
    setMarking(null);
  };

  const handleQuestionnaireSubmitted = async () => {
    if (!profile) return;
    setQuestionnaireMarking(true);
    setMarkError('');
    const { error } = await markQuestionnaireSubmitted(supabase, profile.id);
    if (error) {
      const msg = typeof error === 'string' ? error : (error as { message?: string }).message;
      setMarkError(msg || 'Не удалось сохранить');
    } else {
      await onRefresh();
    }
    setQuestionnaireMarking(false);
  };

  const handleQuestionnaireUnsubmitted = async () => {
    if (!profile) return;
    setQuestionnaireMarking(true);
    setMarkError('');
    const { error } = await markQuestionnaireUnsubmitted(supabase, profile.id);
    if (error) setMarkError('Не удалось отменить');
    else await onRefresh();
    setQuestionnaireMarking(false);
  };

  useEffect(() => {
    if (!profile) return;
    if (subTab === 'stage1' && !profile.stage1_viewed_at) {
      markStageViewed(supabase, profile.id, 1).then(() => onRefresh());
    }
    if (subTab === 'stage2' && !profile.stage2_viewed_at) {
      markStageViewed(supabase, profile.id, 2).then(() => onRefresh());
    }
  }, [subTab, profile, onRefresh]);

  const stage1Phase = studentStagePhase(profile.stage1_status, profile.stage1_score, profile.stage1_submitted_at);
  const stage2Phase = studentStagePhase(profile.stage2_status, profile.stage2_score, profile.stage2_submitted_at);
  const stage1Done = stage1Phase !== 'pending';
  const stage2Done = stage2Phase !== 'pending';
  const canCancelStage1 = canStudentUnsubmit(profile.stage1_status, profile.stage1_score, profile.stage1_submitted_at);
  const canCancelStage2 = canStudentUnsubmit(profile.stage2_status, profile.stage2_score, profile.stage2_submitted_at);

  return (
    <div className="max-w-3xl space-y-6">
      {markError && (
        <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
          {markError}
        </p>
      )}
      {subTab === 'stage1' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Этап 1</h2>
            <p className="text-slate-400 leading-relaxed">
              Заполните анкету и отправьте мотивационное эссе.
            </p>
            <SectionHint text={SECTION_HINT.student.selectionStage1} className="mt-2" />
          </div>

          <SelectionStage1Progress
            questionnaireDone={!!profile.questionnaire_submitted_at}
            essayDone={stage1Done}
          />

          <div>
            <StepSectionLabel step={1} total={2} label="Анкета участника" />
            <p className="text-slate-400 leading-relaxed mb-5">
              Заполните анкету в форме ниже.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 sm:p-8 overflow-visible">
            {!profile.questionnaire_submitted_at && questionnairePublished && (
              <ExternalFormHint />
            )}
            {questionnairePublished ? (
              <YandexFormEmbed formId={config.questionnaire_form_id} />
            ) : (
              <StageComingSoon stage="questionnaire" onGoHome={onGoHome} onGoResults={onGoResults} />
            )}
            <div className="mt-4 pt-4 border-t border-white/5">
              {!profile.questionnaire_submitted_at ? (
                <ExternalSubmitConfirm
                  checkboxLabel="Я отправил анкету в форме выше"
                  loading={questionnaireMarking}
                  onConfirm={handleQuestionnaireSubmitted}
                />
              ) : (
                <div className="space-y-3">
                  <SubmitAcceptedBanner
                    title="Анкета принята"
                    detail="Преподаватель увидит отметку. Ответы хранятся в Яндекс.Форме."
                  />
                  <button
                    type="button"
                    onClick={handleQuestionnaireUnsubmitted}
                    disabled={questionnaireMarking}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10 text-sm transition-colors disabled:opacity-50"
                  >
                    {questionnaireMarking ? 'Сохранение...' : 'Отменить отметку'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-white/10" />
            </div>
          </div>

          <div>
            <StepSectionLabel step={2} total={2} label="Мотивационное эссе" />
            <p className="text-slate-400 leading-relaxed">
              Заполните и отправьте эссе в форме ниже. Правила указаны в самой форме.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 sm:p-8 overflow-visible">
            {!stage1Done && essayPublished && (
              <ExternalFormHint />
            )}
            {essayPublished ? (
              <YandexFormEmbed formId={config.essay_form_id} />
            ) : (
              <StageComingSoon stage="essay" onGoHome={onGoHome} onGoResults={onGoResults} />
            )}
            <div className="mt-4 pt-4 border-t border-white/5">
              {!stage1Done ? (
                <ExternalSubmitConfirm
                  checkboxLabel="Я отправил эссе в форме выше"
                  loading={marking === 1}
                  variant="primary"
                  onConfirm={() => handleMarkSubmitted(1)}
                />
              ) : (
                <div className="space-y-3">
                  {stage1Phase === 'graded' ? (
                    <>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-white tabular-nums">{profile.stage1_score}</span>
                        <span className="text-slate-500 text-sm pb-1">из 10</span>
                      </div>
                      <p className="text-sm text-blue-300/90">Эссе проверено преподавателем.</p>
                    </>
                  ) : (
                    <SubmitAcceptedBanner
                      title="Эссе принято"
                      detail="Ожидайте проверки. Текст эссе — в Яндекс.Форме."
                    />
                  )}
                  {canCancelStage1 && (
                    <button
                      type="button"
                      onClick={() => handleMarkUnsubmitted(1)}
                      disabled={marking === 1}
                      className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {marking === 1 ? 'Сохранение...' : 'Отменить отправку'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'stage2' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Решение задач</h2>
            <p className="text-slate-400 leading-relaxed">
              Отборочный этап 2 — решение задач в Яндекс.Контесте. После публикации контест откроется в блоке ниже.
            </p>
            <SectionHint text={SECTION_HINT.student.selectionStage2} className="mt-2" />
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 sm:p-8 overflow-visible">
            <h3 className="font-semibold text-white mb-5">Контест</h3>
            {!stage2Done && contestPublished && (
              <ExternalFormHint />
            )}
            {contestPublished ? (
              <StageEmbedFrame flush minHeight={420}>
                <iframe
                  src={config.contest_url}
                  title="Яндекс.Контест — этап 2"
                  frameBorder={0}
                  className="block w-full border-0 bg-white"
                  allow="clipboard-write"
                />
              </StageEmbedFrame>
            ) : (
              <StageComingSoon stage="contest" onGoHome={onGoHome} onGoResults={onGoResults} />
            )}
            <div className="mt-4">
              {stage2Done ? (
                <div className="space-y-3">
                  {stage2Phase === 'graded' ? (
                    <>
                      <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-white tabular-nums">{profile.stage2_score}</span>
                        <span className="text-slate-500 text-sm pb-1">из 10</span>
                      </div>
                      <p className="text-sm text-blue-300/90">Контест проверен преподавателем.</p>
                    </>
                  ) : (
                    <SubmitAcceptedBanner
                      title="Контест принят"
                      detail="Ожидайте проверки. Решения — в Яндекс.Контесте."
                    />
                  )}
                  {canCancelStage2 && (
                    <button
                      type="button"
                      onClick={() => handleMarkUnsubmitted(2)}
                      disabled={marking === 2}
                      className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {marking === 2 ? 'Сохранение...' : 'Отменить отправку'}
                    </button>
                  )}
                </div>
              ) : (
                <ExternalSubmitConfirm
                  checkboxLabel="Я завершил контест в блоке выше"
                  loading={marking === 2}
                  variant="violet"
                  onConfirm={() => handleMarkSubmitted(2)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'results' && (
        <SelectionResults profile={profile} />
      )}
    </div>
  );
}

function SelectionResults({ profile }: { profile: UserProfile }) {
  const verdict = selectionVerdict(profile.is_enrolled, profile.selection_rejected ?? false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Результаты</h2>
        <p className="text-slate-400 text-sm">Оценки и решение по зачислению на обучение</p>
        <SectionHint text={SECTION_HINT.student.selectionResults} className="mt-2" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <StudentResultCard
          title="Этап 1: Эссе"
          score={profile.stage1_score}
          submitted={profile.stage1_status === 'submitted' || !!profile.stage1_submitted_at}
        />
        <StudentResultCard
          title="Этап 2: Задачи"
          score={profile.stage2_score}
          submitted={profile.stage2_status === 'submitted' || !!profile.stage2_submitted_at}
        />
      </div>

      {verdict === 'accepted' && (
        <div className="space-y-4">
          <div className="rounded-2xl overflow-hidden border border-emerald-500/30">
            <div className="bg-gradient-to-br from-emerald-600/20 to-teal-600/10 px-6 py-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Вы зачислены!</h3>
              <p className="text-sm text-emerald-200/90 max-w-md mx-auto leading-relaxed">
                Поздравляем! Вы прошли отбор и зачислены на обучение в «Квантовый кружок».
                Разделы «Обучение», «Расписание» и «Прогресс» теперь доступны.
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-3 leading-relaxed">
                Оценки за отбор — в карточках выше. Материалы этапов больше не редактируются.
              </p>
            </div>
          </div>
          <TelegramCommunityCard compact />
        </div>
      )}

      {verdict === 'rejected' && (
        <div className="rounded-2xl overflow-hidden border border-slate-500/30">
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 px-6 py-8 text-center space-y-3">
            <h3 className="text-xl font-bold text-white">Спасибо за участие</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              К сожалению, в этом наборе мы не можем зачислить вас на обучение.
              Благодарим за интерес к программе и желаем успехов в дальнейшем развитии!
            </p>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed pt-1">
              По вопросам:{' '}
              <a
                href="mailto:quantumschool@rqc.ru"
                className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
              >
                quantumschool@rqc.ru
              </a>
            </p>
          </div>
        </div>
      )}

      {verdict === 'waiting' && (profile.stage1_score !== null || profile.stage2_score !== null) && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-6 py-6 text-center">
          <p className="text-sm text-amber-200/90 leading-relaxed">
            Оценки выставлены. Решение о зачислении появится здесь, когда преподаватель его примет.
          </p>
        </div>
      )}

      {verdict === 'waiting' && profile.stage1_score === null && profile.stage2_score === null && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-6 py-6 text-center">
          <p className="text-sm text-amber-200/90 leading-relaxed">
            Результаты проверяются. Оценки и решение о зачислении появятся здесь после проверки ваших работ.
          </p>
        </div>
      )}
    </div>
  );
}

function StudentResultCard({
  title, score, submitted,
}: {
  title: string;
  score: number | null;
  submitted: boolean;
}) {
  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6">
      <h3 className="font-semibold text-white mb-4">{title}</h3>
      {score !== null ? (
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold text-white tabular-nums">{score}</span>
          <span className="text-slate-500 text-sm pb-1.5">из 10</span>
        </div>
      ) : submitted ? (
        <p className="text-sm text-amber-300/90">Работа отправлена — ожидайте оценку</p>
      ) : (
        <p className="text-sm text-slate-500">Ещё не отправлено</p>
      )}
    </div>
  );
}
