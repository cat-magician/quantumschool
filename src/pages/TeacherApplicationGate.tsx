import { useEffect, useState } from 'react';
import { GraduationCap, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import DashboardSiteHomeLink from '../components/DashboardSiteHomeLink';
import { profileEmail } from '../lib/profileUtils';
import { markStudentCorridorUnlocked, markStudentLoginCorridor } from '../lib/loginCorridor';

/** Заглушка для кандидата, который зашёл через коридор преподавателя. */
export default function TeacherApplicationGate() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => { void refreshProfile(); }, 60_000);
    return () => window.clearInterval(id);
  }, [refreshProfile]);

  const checkStatus = async () => {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
  };

  const openStudentCabinet = () => {
    if (user?.id) markStudentCorridorUnlocked(user.id);
    markStudentLoginCorridor();
    navigate('/dashboard', { replace: true });
  };

  const submittedAt = profile?.created_at
    ? new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(profile.created_at))
    : null;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900/80 border border-white/10 rounded-2xl p-8 text-center">
        <div className="mb-4 flex justify-center">
          <GraduationCap className="w-12 h-12 text-violet-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Заявка на рассмотрении</h2>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          Заявка на роль преподавателя отправлена. Суперадмин рассмотрит её — после одобрения откроется кабинет преподавателя.
          Нажмите «Проверить статус» или войдите снова через страницу заявки.
        </p>
        {submittedAt && (
          <p className="text-xs text-slate-500 -mt-2 mb-1">Аккаунт создан: {submittedAt}</p>
        )}
        <p className="text-xs text-slate-600 mb-4">
          Почта: <span className="text-slate-400">{profileEmail(profile, user?.email) ?? '—'}</span>
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={checkStatus}
            disabled={checking}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Проверить статус
          </button>
          <button
            type="button"
            onClick={openStudentCabinet}
            className="flex items-center justify-center px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-sm font-medium transition-colors"
          >
            Участвовать в отборе как школьник
          </button>
          <button
            type="button"
            onClick={signOut}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </button>
          <DashboardSiteHomeLink className="justify-center" />
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Статус обновляется автоматически раз в минуту. Для отбора войдите с главной страницы или нажмите кнопку выше.
          </p>
        </div>
      </div>
    </div>
  );
}
