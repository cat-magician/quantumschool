import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LogOut, Users, ClipboardList, BookOpenCheck, Calendar, Settings,
  Bell, Shield, FileText, FlaskConical, CheckCircle, GraduationCap,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import ResultsTab from './admin/ResultsTab';
import SelectionEssayConfigTab from './admin/SelectionEssayConfigTab';
import SelectionContestConfigTab from './admin/SelectionContestConfigTab';
import StudentsTab from './admin/StudentsTab';
import TeachersTab from './admin/TeachersTab';
import HomeworkTab from './admin/HomeworkTab';
import ScheduleTab from './admin/ScheduleTab';

type AdminTab = 'results' | 'students' | 'teachers' | 'homework' | 'schedule';
type SelectionAdminSubTab = 'essay' | 'contest' | 'results';

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

export default function AdminDashboard({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { user, profile, signOut } = useAuth();
  const [tab, setTab] = useState<AdminTab>('results');
  const [selectionSubTab, setSelectionSubTab] = useState<SelectionAdminSubTab>('results');
  const [selectionExpanded, setSelectionExpanded] = useState(true);
  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Админ';

  const navItems: { id: AdminTab; icon: typeof Users; label: string; superAdminOnly?: boolean }[] = [
    { id: 'results', icon: ClipboardList, label: 'Отборочные этапы' },
    { id: 'students', icon: Users, label: 'Ученики' },
    { id: 'teachers', icon: GraduationCap, label: 'Преподаватели', superAdminOnly: true },
    { id: 'homework', icon: BookOpenCheck, label: 'Домашние задания' },
    { id: 'schedule', icon: Calendar, label: 'Расписание' },
  ];

  const visibleNavItems = navItems.filter((item) => !item.superAdminOnly || isSuperAdmin);

  const openSelection = (sub: SelectionAdminSubTab) => {
    setTab('results');
    setSelectionSubTab(sub);
    setSelectionExpanded(true);
  };

  const toggleSelectionSection = () => {
    if (tab === 'results') {
      setSelectionExpanded((v) => !v);
    } else {
      setTab('results');
      setSelectionExpanded(true);
    }
  };

  const headerTitle = tab === 'results' && isSuperAdmin
    ? SELECTION_ADMIN_HEADER[selectionSubTab]
    : visibleNavItems.find((n) => n.id === tab)?.label;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900/80 border-r border-white/5 backdrop-blur-sm fixed h-full z-20">
        <div className="p-6 border-b border-white/5">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo_qc.svg" alt="Квантовый кружок" className="w-9 h-9 brightness-0 invert" />
            <div>
              <span className="font-bold text-white block">Квантовый кружок</span>
              <span className="text-xs text-slate-500">{isSuperAdmin ? 'Суперадмин' : 'Преподаватель'}</span>
            </div>
          </Link>
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
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-sm font-bold">
              {isSuperAdmin ? <Shield className="w-4 h-4" /> : displayName[0].toUpperCase()}
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
        {visibleNavItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs transition-colors ${
              tab === item.id ? 'text-blue-400' : 'text-slate-500'
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.label.split(' ')[0]}
          </button>
        ))}
      </div>

      <main className="flex-1 lg:ml-64 min-h-screen">
        <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">{headerTitle}</h1>
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <Bell className="w-4 h-4 text-slate-400" />
            </button>
            <button className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <Settings className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </header>

        {isSuperAdmin && tab === 'results' && selectionExpanded && (
          <div className="lg:hidden border-b border-white/5 px-4 py-3 space-y-1">
            {SELECTION_ADMIN_SUB_NAV.map((sub) => (
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
          {tab === 'results' && isSuperAdmin && selectionSubTab === 'essay' && <SelectionEssayConfigTab />}
          {tab === 'results' && isSuperAdmin && selectionSubTab === 'contest' && <SelectionContestConfigTab />}
          {tab === 'results' && (isSuperAdmin ? selectionSubTab === 'results' : true) && <ResultsTab />}
          {tab === 'students' && <StudentsTab isSuperAdmin={isSuperAdmin} />}
          {tab === 'teachers' && isSuperAdmin && <TeachersTab />}
          {tab === 'homework' && <HomeworkTab isSuperAdmin={isSuperAdmin} />}
          {tab === 'schedule' && <ScheduleTab />}
        </div>
      </main>
    </div>
  );
}
