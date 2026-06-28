import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

type DashboardSiteHomeLinkProps = {
  /** Компактная кнопка для шапки (десктоп и мобильный) */
  compact?: boolean;
  className?: string;
};

export default function DashboardSiteHomeLink({ compact, className = '' }: DashboardSiteHomeLinkProps) {
  if (compact) {
    return (
      <Link
        to="/"
        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-sm font-medium transition-colors ${className}`}
        title="Открыть главную страницу сайта без выхода из аккаунта"
      >
        <Home className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">На главную</span>
      </Link>
    );
  }

  return (
    <Link
      to="/"
      className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium ${className}`}
      title="Открыть главную страницу сайта без выхода из аккаунта"
    >
      <Home className="w-4 h-4 shrink-0" />
      На главную
    </Link>
  );
}
