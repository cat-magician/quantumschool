import { ArrowRight, BookOpenCheck, Calendar, ClipboardList, GraduationCap, Loader2, Users } from 'lucide-react';
import { useAdminUngradedCount } from '../hooks/useAdminUngradedCount';

type AdminTab =
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

export type AdminHomeAction = {
  label: string;
  description: string;
  tab: AdminTab;
  selectionSub?: 'results' | 'stage1' | 'contest';
  badge?: number;
};

type AdminDashboardHomeProps = {
  isSuperAdmin: boolean;
  displayName: string;
  onNavigate: (action: AdminHomeAction) => void;
};

function ActionIcon({ tab }: { tab: AdminTab }) {
  const cls = 'w-4 h-4';
  if (tab === 'results') return <ClipboardList className={`${cls} text-blue-400`} />;
  if (tab === 'teachers') return <GraduationCap className={`${cls} text-amber-400`} />;
  if (tab === 'grading' || tab === 'homework') return <BookOpenCheck className={`${cls} text-violet-400`} />;
  if (tab === 'students') return <Users className={`${cls} text-emerald-400`} />;
  if (tab === 'schedule') return <Calendar className={`${cls} text-cyan-400`} />;
  return <ClipboardList className={`${cls} text-slate-400`} />;
}

export default function AdminDashboardHome({
  isSuperAdmin,
  displayName,
  onNavigate,
}: AdminDashboardHomeProps) {
  const ungradedCount = useAdminUngradedCount(isSuperAdmin);
  const greeting = displayName.trim() || 'добро пожаловать';

  const actions: AdminHomeAction[] = [
    {
      label: ungradedCount ? `Проверить домашки · ${ungradedCount}` : 'Проверить домашки',
      description: 'Сданные работы без оценки',
      tab: 'grading',
      badge: ungradedCount ?? undefined,
    },
    {
      label: 'Расписание',
      description: 'Созвоны и живые занятия для учеников',
      tab: 'schedule',
    },
    {
      label: 'Ученики',
      description: 'Группы и зачисленные участники',
      tab: 'students',
    },
  ];

  if (isSuperAdmin) {
    actions.unshift(
      {
        label: 'Результаты отбора',
        description: 'Оценки, зачисление и отклонение',
        tab: 'results',
        selectionSub: 'results',
      },
      {
        label: 'Настройка этапов',
        description: 'Формы и контест для отбора',
        tab: 'results',
        selectionSub: 'stage1',
      },
    );
    actions.push({
      label: 'Преподаватели',
      description: 'Заявки и назначение в группы',
      tab: 'teachers',
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 py-4 sm:py-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Здравствуйте, {greeting}</h2>
        <p className="text-slate-400 text-sm">
          {isSuperAdmin
            ? 'Быстрый доступ к отбору, ученикам и проверке работ'
            : 'Материалы, расписание и проверка домашних заданий'}
        </p>
      </div>

      <div className="space-y-2">
        {actions.map((action) => (
          <button
            key={`${action.tab}-${action.selectionSub ?? ''}-${action.label}`}
            type="button"
            onClick={() => onNavigate(action)}
            className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3.5 text-left hover:bg-slate-900/80 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              <ActionIcon tab={action.tab} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{action.label}</p>
              <p className="text-xs text-slate-500 truncate">{action.description}</p>
            </div>
            {action.tab === 'grading' && ungradedCount === null ? (
              <Loader2 className="w-4 h-4 text-slate-500 animate-spin shrink-0" />
            ) : (
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white shrink-0 transition-colors" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
