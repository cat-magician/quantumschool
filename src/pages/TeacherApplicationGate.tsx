import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Loader2, LogOut, RefreshCw, UserX } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

type Mode = 'pending' | 'rejected';

export default function TeacherApplicationGate({ mode }: { mode: Mode }) {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [reapplying, setReapplying] = useState(false);

  useEffect(() => {
    if (mode !== 'pending') return;
    const id = window.setInterval(() => { refreshProfile(); }, 60_000);
    return () => window.clearInterval(id);
  }, [mode, refreshProfile]);

  const checkStatus = async () => {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
  };

  const reapply = async () => {
    if (!user) return;
    setReapplying(true);
    await supabase.from('user_profiles').update({
      teacher_application: true,
      teacher_application_rejected: false,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    await refreshProfile();
    setReapplying(false);
  };

  const submittedAt = profile?.created_at
    ? new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(profile.created_at))
    : null;

  if (mode === 'rejected') {
    return (
      <GateShell
        icon={<UserX className="w-12 h-12 text-rose-400" />}
        title="Заявка не одобрена"
        description="К сожалению, заявка на роль преподавателя отклонена. Личный кабинет преподавателя недоступен. Вы можете подать заявку повторно или выйти из аккаунта."
      >
        <button
          type="button"
          onClick={reapply}
          disabled={reapplying}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
        >
          {reapplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Подать заявку повторно
        </button>
        <button
          type="button"
          onClick={signOut}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-300">На главную</Link>
      </GateShell>
    );
  }

  return (
    <GateShell
      icon={<GraduationCap className="w-12 h-12 text-violet-400" />}
      title="Заявка на рассмотрении"
      description="Пока заявка не одобрена, личный кабинет недоступен — это нормально. Суперадмин рассмотрит заявку; после одобрения нажмите «Проверить статус» или войдите снова — откроется кабинет преподавателя."
    >
      {submittedAt && (
        <p className="text-xs text-slate-500 -mt-2 mb-1">Аккаунт создан: {submittedAt}</p>
      )}
      <p className="text-xs text-slate-600 mb-1">
        Email: <span className="text-slate-400">{user?.email}</span>
      </p>
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
        onClick={signOut}
        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Выйти
      </button>
      <p className="text-[11px] text-slate-600 leading-relaxed">
        Статус обновляется автоматически раз в минуту, пока эта страница открыта.
      </p>
    </GateShell>
  );
}

function GateShell({
  icon, title, description, children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900/80 border border-white/10 rounded-2xl p-8 text-center">
        <div className="mb-4 flex justify-center">{icon}</div>
        <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">{description}</p>
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}
