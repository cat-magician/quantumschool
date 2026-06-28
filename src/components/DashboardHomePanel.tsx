import { ArrowLeft, Menu, Sparkles } from 'lucide-react';

type DashboardHomeRole = 'student' | 'admin' | 'superadmin';

const ROLE_COPY: Record<DashboardHomeRole, { lead: string; hints: string[] }> = {
  student: {
    lead: 'Выберите раздел в меню — отборочные этапы, расписание, обучение или прогресс.',
    hints: [
      '«Отборочный этап» — эссе, задачи и результаты',
      'После зачисления откроются расписание, обучение и прогресс',
    ],
  },
  admin: {
    lead: 'Выберите раздел в меню, чтобы начать работу с учениками и материалами.',
    hints: [
      '«Ученики» — группы и профили',
      '«Обучение» — лекции, семинары и домашние задания',
      '«Расписание» — занятия и события',
    ],
  },
  superadmin: {
    lead: 'Выберите раздел в меню — от настройки отбора до контента главной страницы.',
    hints: [
      '«Отборочные этапы» — эссе, задачи и итоги',
      '«Сайт» — плашка и карточки преподавателей на главной',
      '«Статистика» — сводка по ученикам',
    ],
  },
};

export default function DashboardHomePanel({
  role,
  displayName,
}: {
  role: DashboardHomeRole;
  displayName: string;
}) {
  const copy = ROLE_COPY[role];
  const greeting = displayName.trim() || 'добро пожаловать';

  return (
    <div className="max-w-xl mx-auto py-8 sm:py-14">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-8 sm:p-10 text-center shadow-xl shadow-black/20">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600/30 to-violet-600/30 border border-blue-500/20 mb-6">
          <Sparkles className="w-7 h-7 text-blue-300" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">
          Здравствуйте, {greeting}
        </h2>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-8">
          {copy.lead}
        </p>

        <ul className="text-left space-y-3 mb-8">
          {copy.hints.map((hint) => (
            <li key={hint} className="flex items-start gap-3 text-sm text-slate-300">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
              <span>{hint}</span>
            </li>
          ))}
        </ul>

        <p className="inline-flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
          <ArrowLeft className="w-3.5 h-3.5 shrink-0 hidden lg:inline" />
          <Menu className="w-3.5 h-3.5 shrink-0 lg:hidden" />
          <span className="hidden lg:inline">Начните с любого пункта бокового меню</span>
          <span className="lg:hidden">Нижняя панель или «Меню» — все разделы кабинета</span>
        </p>
      </div>
    </div>
  );
}
