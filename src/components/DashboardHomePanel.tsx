import { ArrowLeft, Menu, Sparkles } from 'lucide-react';
import { HOME_GUIDE, resolveHomeGuideRole, type HomeGuideRole } from '../lib/dashboardHelpCopy';

type DashboardHomeRole = 'student' | 'admin' | 'superadmin';

export default function DashboardHomePanel({
  role,
  displayName,
  isEnrolled = false,
}: {
  role: DashboardHomeRole;
  displayName: string;
  isEnrolled?: boolean;
}) {
  const guideRole: HomeGuideRole = resolveHomeGuideRole(role, isEnrolled);
  const guide = HOME_GUIDE[guideRole];
  const greeting = displayName.trim() || 'добро пожаловать';

  return (
    <div className="max-w-xl mx-auto py-8 sm:py-14">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-8 sm:p-10 shadow-xl shadow-black/20">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600/30 to-violet-600/30 border border-blue-500/20 mb-6">
          <Sparkles className="w-7 h-7 text-blue-300" />
        </div>

        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          Здравствуйте, {greeting}
        </h2>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-6 text-center">
          {guide.lead}
        </p>

        <ul className="space-y-2 mb-6 text-left">
          {guide.items.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-slate-400 leading-relaxed">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-600 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <p className="inline-flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 w-full">
          <ArrowLeft className="w-3.5 h-3.5 shrink-0 hidden lg:inline" />
          <Menu className="w-3.5 h-3.5 shrink-0 lg:hidden" />
          <span className="hidden lg:inline">Разделы — в меню слева</span>
          <span className="lg:hidden">Разделы — нижняя панель или «Меню»</span>
        </p>
      </div>
    </div>
  );
}
