import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  LogOut, Calendar, BarChart3, Award, Home, Bell, Settings,
  ClipboardList, FileText, FlaskConical, Lock,
  CheckCircle, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { YANDEX_FORM_EMBED } from '../lib/constants';
import { isContestPublished, isEssayPublished } from '../lib/selectionConfig';
import { useSelectionConfig } from '../hooks/useSelectionConfig';
import StageComingSoon from '../components/StageComingSoon';
import { markStageSubmitted, markStageUnsubmitted, markStageViewed } from '../lib/selectionUtils';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../lib/types';
import { canStudentUnsubmit, selectionVerdict, studentStagePhase } from '../lib/selectionDisplayUtils';
import StudentScheduleTab from './student/ScheduleTab';
import StudentLearningTab from './student/LearningTab';
import StudentProgressTab from './student/ProgressTab';
import StudentAchievementsTab from './student/AchievementsTab';
import YandexFormEmbed from '../components/YandexFormEmbed';
import StageEmbedFrame from '../components/StageEmbedFrame';

type Tab = 'selection' | 'learning' | 'schedule' | 'progress' | 'achievements';
type SelectionSubTab = 'stage1' | 'stage2' | 'results';

const SELECTION_SUB_NAV: { id: SelectionSubTab; label: string; shortLabel: string; icon: typeof FileText }[] = [
  { id: 'stage1', label: 'Этап 1: Эссе', shortLabel: 'Этап 1', icon: FileText },
  { id: 'stage2', label: 'Этап 2: Задачи', shortLabel: 'Этап 2', icon: FlaskConical },
  { id: 'results', label: 'Результаты', shortLabel: 'Результаты', icon: CheckCircle },
];

const SELECTION_HEADER: Record<SelectionSubTab, string> = {
  stage1: 'Этап 1: Эссе',
  stage2: 'Этап 2: Задачи',
  results: 'Результаты',
};

export default function StudentDashboard() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>('selection');
  const [selectionSubTab, setSelectionSubTab] = useState<SelectionSubTab>('stage1');
  const [selectionExpanded, setSelectionExpanded] = useState(true);
  const isEnrolled = profile?.is_enrolled ?? false;
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Участник';
  const enrolledBootstrapped = useRef(false);

  const selectionSubNav = useMemo(
    () => (isEnrolled ? SELECTION_SUB_NAV.filter((s) => s.id === 'results') : SELECTION_SUB_NAV),
    [isEnrolled],
  );

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    if (profile && isEnrolled && !enrolledBootstrapped.current) {
      enrolledBootstrapped.current = true;
      setTab('learning');
      setSelectionSubTab('results');
      setSelectionExpanded(false);
    }
  }, [profile, isEnrolled]);

  const navItems: { id: Tab; icon: typeof Home; label: string; locked: boolean }[] = [
    { id: 'selection', icon: ClipboardList, label: 'Отборочный этап', locked: false },
    { id: 'learning', icon: Home, label: 'Обучение', locked: !isEnrolled },
    { id: 'schedule', icon: Calendar, label: 'Расписание', locked: !isEnrolled },
    { id: 'progress', icon: BarChart3, label: 'Прогресс', locked: !isEnrolled },
    { id: 'achievements', icon: Award, label: 'Достижения', locked: !isEnrolled },
  ];

  const handleTabClick = (id: Tab, locked: boolean) => {
    if (locked) return;
    setTab(id);
    if (id !== 'selection') setSelectionExpanded(false);
  };

  const openSelection = (sub: SelectionSubTab) => {
    setTab('selection');
    setSelectionSubTab(sub);
    setSelectionExpanded(true);
  };

  const toggleSelectionSection = () => {
    if (tab === 'selection') {
      setSelectionExpanded((v) => !v);
    } else {
      setTab('selection');
      setSelectionExpanded(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900/80 border-r border-white/5 backdrop-blur-sm fixed h-full z-20">
        <div className="p-6 border-b border-white/5">
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/logo_qc.svg" alt="Квантовый кружок" className="w-9 h-9 brightness-0 invert" />
            <span className="font-bold text-white">Квантовый кружок</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            if (item.id === 'selection') {
              const isSelectionActive = tab === 'selection';
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
                        {selectionSubNav.map((sub) => {
                          const isSubActive = isSelectionActive && selectionSubTab === sub.id;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => openSelection(sub.id)}
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
                disabled={item.locked}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${
                  item.locked
                    ? 'text-slate-600 cursor-not-allowed'
                    : tab === item.id
                      ? 'bg-gradient-to-r from-blue-600/30 to-violet-600/30 text-white border border-blue-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.locked && <Lock className="w-3.5 h-3.5 ml-auto text-slate-600" />}
              </button>
            );
          })}
        </nav>

        {!isEnrolled && (
          <div className="px-4 pb-2">
            <p className="text-xs text-slate-500 leading-relaxed px-2">
              Разделы обучения откроются после зачисления на курс
            </p>
          </div>
        )}

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center text-sm font-bold">
              {displayName[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{displayName}</div>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
            </div>
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

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-slate-900/95 backdrop-blur-md border-t border-white/5 flex">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.locked) return;
              if (item.id === 'selection') {
                if (tab === 'selection') setSelectionExpanded((v) => !v);
                else openSelection(selectionSubTab);
              } else {
                handleTabClick(item.id, item.locked);
              }
            }}
            disabled={item.locked}
            className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs transition-colors ${
              item.locked ? 'text-slate-700' : tab === item.id ? 'text-blue-400' : 'text-slate-500'
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.label.split(' ')[0]}
          </button>
        ))}
      </div>

      <main className="flex-1 lg:ml-64 min-h-screen">
        <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">
            {tab === 'selection' && SELECTION_HEADER[selectionSubTab]}
            {tab === 'learning' && 'Обучение'}
            {tab === 'schedule' && 'Расписание'}
            {tab === 'progress' && 'Прогресс'}
            {tab === 'achievements' && 'Достижения'}
          </h1>
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <Bell className="w-4 h-4 text-slate-400" />
            </button>
            <button className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <Settings className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </header>

        {tab === 'selection' && selectionExpanded && (
          <div className="lg:hidden border-b border-white/5 px-4 py-3 space-y-1">
            {selectionSubNav.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => openSelection(sub.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  selectionSubTab === sub.id
                    ? 'bg-blue-600/25 text-blue-200 border border-blue-500/25'
                    : 'text-slate-400 border border-transparent'
                }`}
              >
                <sub.icon className="w-3.5 h-3.5" />
                {sub.label}
              </button>
            ))}
          </div>
        )}

        <div className="p-6 lg:p-8 pb-24 lg:pb-8">
          {tab === 'selection' && profile && (
            <SelectionTab
              profile={profile}
              subTab={selectionSubTab}
              onRefresh={refreshProfile}
            />
          )}
          {tab === 'learning' && isEnrolled && <StudentLearningTab />}
          {tab === 'schedule' && isEnrolled && <StudentScheduleTab />}
          {tab === 'progress' && isEnrolled && <StudentProgressTab />}
          {tab === 'achievements' && isEnrolled && <StudentAchievementsTab />}
        </div>
      </main>
    </div>
  );
}

function SelectionTab({
  profile, subTab, onRefresh,
}: {
  profile: UserProfile;
  subTab: SelectionSubTab;
  onRefresh: () => Promise<void>;
}) {
  const [marking, setMarking] = useState<1 | 2 | null>(null);
  const [markError, setMarkError] = useState('');
  const { config } = useSelectionConfig();
  const essayPublished = isEssayPublished(config);
  const contestPublished = isContestPublished(config);

  const handleMarkSubmitted = async (stage: 1 | 2) => {
    if (!profile) return;
    setMarking(stage);
    setMarkError('');
    const { error } = await markStageSubmitted(supabase, profile.id, stage, {
      essayPublished,
      contestPublished,
    });
    if (error) setMarkError(typeof error === 'string' ? error : 'Не удалось сохранить');
    else await onRefresh();
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

  useEffect(() => {
    if (!profile) return;
    if (subTab === 'stage1' && !profile.stage1_viewed_at) {
      markStageViewed(supabase, profile.id, 1).then(() => onRefresh());
    }
    if (subTab === 'stage2' && !profile.stage2_viewed_at) {
      markStageViewed(supabase, profile.id, 2).then(() => onRefresh());
    }
  }, [subTab, profile, onRefresh]);

  const essayPoints = [
    'почему вам интересны физика, математика или современные технологии;',
    'почему вы хотите принять участие в «Квантовом кружке»;',
    'что вам наиболее интересно в области квантовых технологий;',
    'какие знания и навыки вы хотели бы получить в рамках программы;',
    'как вы представляете своё дальнейшее образование и профессиональное развитие.',
  ];

  const stage1Phase = studentStagePhase(profile.stage1_status, profile.stage1_score, profile.stage1_submitted_at);
  const stage2Phase = studentStagePhase(profile.stage2_status, profile.stage2_score, profile.stage2_submitted_at);
  const stage1Done = stage1Phase !== 'pending';
  const stage2Done = stage2Phase !== 'pending';
  const canCancelStage1 = canStudentUnsubmit(profile.stage1_status, profile.stage1_score, profile.stage1_submitted_at);
  const canCancelStage2 = canStudentUnsubmit(profile.stage2_status, profile.stage2_score, profile.stage2_submitted_at);

  return (
    <div className="max-w-3xl space-y-6">
      {subTab === 'stage1' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Мотивационное эссе</h2>
            <p className="text-slate-400 leading-relaxed">
              Напишите эссе объёмом <span className="text-white font-medium">300–700 слов</span> и загрузите PDF (до 3 МБ).
            </p>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">В эссе расскажите:</h3>
            <ul className="space-y-2">
              {essayPoints.map((pt, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-400">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0 text-xs text-blue-400 font-semibold">{i + 1}</span>
                  {pt}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-start gap-3 px-5 py-4 rounded-xl bg-amber-500/8 border border-amber-500/20">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-300/80 leading-relaxed">
              Эссе пишется <strong className="text-amber-300">от руки</strong>, затем сканируется и загружается в форме ниже в формате <strong className="text-amber-300">PDF</strong>.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 sm:p-8 overflow-visible">
            <h3 className="font-semibold text-white mb-5">Загрузить эссе</h3>
            {essayPublished ? (
              <YandexFormEmbed formId={config.essay_form_id} />
            ) : (
              <StageComingSoon stage="essay" />
            )}
            <div className="mt-4">
              {!stage1Done ? (
                <>
                  <p className="text-sm text-slate-400 mb-4">
                    {essayPublished
                      ? 'После отправки эссе в форме нажмите кнопку — статус обновится автоматически.'
                      : 'Кнопка подтверждения станет доступна после публикации формы.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleMarkSubmitted(1)}
                    disabled={marking === 1 || !essayPublished}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {marking === 1 ? 'Сохранение...' : 'Я отправил эссе'}
                  </button>
                </>
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
                    <p className="text-sm text-emerald-400/90">
                      Эссе отмечено как отправленное — ожидайте проверки преподавателем.
                    </p>
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
              {markError && <p className="text-sm text-rose-400 mt-2">{markError}</p>}
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
          </div>

          <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 sm:p-8 overflow-visible">
            <h3 className="font-semibold text-white mb-5">Контест</h3>
            {contestPublished ? (
              <StageEmbedFrame minHeight={420}>
                <iframe
                  src={config.contest_url}
                  title="Яндекс.Контест — этап 2"
                  width={YANDEX_FORM_EMBED.width}
                  frameBorder={0}
                  className="block border-0 bg-white"
                  style={{ width: YANDEX_FORM_EMBED.width }}
                  allow="clipboard-write"
                />
              </StageEmbedFrame>
            ) : (
              <StageComingSoon stage="contest" />
            )}
            <div className="mt-4">
              {!stage1Done ? (
                <p className="text-sm text-slate-500">
                  Сначала отправьте эссе на этапе 1 — затем откроется доступ к контесту.
                </p>
              ) : stage2Done ? (
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
                    <p className="text-sm text-emerald-400/90">
                      Контест отмечен как отправленный — ожидайте проверки преподавателем.
                    </p>
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
                <>
                  <p className="text-sm text-slate-400 mb-4">
                    {contestPublished
                      ? 'После прохождения контеста нажмите кнопку — статус обновится автоматически.'
                      : 'Кнопка подтверждения станет доступна после публикации контеста.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleMarkSubmitted(2)}
                    disabled={marking === 2 || !contestPublished}
                    className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {marking === 2 ? 'Сохранение...' : 'Я завершил контест'}
                  </button>
                </>
              )}
              {markError && <p className="text-sm text-rose-400 mt-2">{markError}</p>}
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
        <div className="rounded-2xl overflow-hidden border border-emerald-500/30">
          <div className="bg-gradient-to-br from-emerald-600/20 to-teal-600/10 px-6 py-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Вы зачислены!</h3>
            <p className="text-sm text-emerald-200/90 max-w-md mx-auto leading-relaxed">
              Поздравляем! Вы прошли отбор и зачислены на обучение в «Квантовый кружок».
              Разделы «Обучение», «Расписание», «Прогресс» и «Достижения» теперь доступны.
            </p>
          </div>
        </div>
      )}

      {verdict === 'rejected' && (
        <div className="rounded-2xl overflow-hidden border border-slate-500/30">
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 px-6 py-8 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Спасибо за участие</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              К сожалению, в этом наборе мы не можем зачислить вас на обучение.
              Благодарим за интерес к программе и желаем успехов в дальнейшем развитии!
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
