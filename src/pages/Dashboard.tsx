import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { hasOAuthCallbackInUrl, hasOAuthCodeInUrl } from '../lib/oauthCallbackUtils';
import StudentDashboard from './StudentDashboard';
import AdminDashboard from './AdminDashboard';
import TeacherApplicationGate from './TeacherApplicationGate';
import PrivacyConsentGate from '../components/PrivacyConsentGate';
import { profileNeedsPrivacyConsent } from '../lib/profileUtils';
import { shouldShowTeacherApplicationGate } from '../lib/loginCorridor';

export default function Dashboard() {
  const {
    user, profile, loading, oauthError, clearOAuthError, signOut, signingOut, refreshProfile,
    profileError,
  } = useAuth();
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user) return;
    if (oauthError) return;
    if (hasOAuthCallbackInUrl()) return;
    navigate('/');
  }, [user, loading, oauthError, navigate]);

  if (loading || (!user && hasOAuthCodeInUrl())) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && oauthError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-slate-900/80 border border-rose-500/20 rounded-2xl p-8">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-3 text-center">Не удалось войти</h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">{oauthError}</p>
          <div className="flex flex-col gap-3">
            <Link
              to="/"
              onClick={clearOAuthError}
              className="flex items-center justify-center px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
            >
              На главную
            </Link>
            <Link
              to="/#contact"
              onClick={clearOAuthError}
              className="text-center text-sm text-slate-500 hover:text-slate-300"
            >
              Попробовать снова
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (!profile) {
    const retry = async () => {
      setRetrying(true);
      await refreshProfile();
      setRetrying(false);
    };

    // Сессию не приняли — повторять бессмысленно, нужна новая.
    const staleSession = profileError?.kind === 'unauthorized';

    const title = staleSession
      ? 'Сессия больше не действует'
      : profileError
        ? 'Не удалось загрузить профиль'
        : 'Профиль не загружен';

    const message = staleSession
      ? `Вход был выполнен (${user.email ?? '—'}), но сервер эту сессию больше не принимает.
         Такое бывает после перезапуска или сбоя сервиса авторизации. Войдите заново.`
      : profileError
        ? `Вход выполнен (${user.email ?? '—'}), но сервис не ответил на запрос профиля.
           Обычно это временно — попробуйте ещё раз через минуту.`
        : `Вход выполнен (${user.email ?? '—'}), но профиля в базе нет.
           Возможно, не применена схема Supabase.`;

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900/80 border border-white/10 rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">{message}</p>
          <div className="flex flex-col gap-3">
            {!staleSession && (
              <button
                type="button"
                onClick={() => { void retry(); }}
                disabled={retrying || signingOut}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {retrying
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <RefreshCw className="w-4 h-4" />}
                {retrying ? 'Проверяем…' : 'Повторить'}
              </button>
            )}
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                staleSession
                  ? 'bg-blue-600 hover:bg-blue-500 text-white font-medium'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300'
              }`}
            >
              {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              {signingOut ? 'Выходим…' : staleSession ? 'Войти заново' : 'Выйти'}
            </button>
            <Link to="/" className="text-sm text-slate-500 hover:text-slate-300">На главную</Link>
          </div>
          {profileError && (
            <p className="mt-5 text-[11px] text-slate-600 leading-relaxed break-words">
              Техническая причина: {profileError.detail}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (profileNeedsPrivacyConsent(profile)) {
    return <PrivacyConsentGate />;
  }

  const role = profile.role ?? 'student';

  if (role === 'superadmin' || role === 'admin') {
    return <AdminDashboard isSuperAdmin={role === 'superadmin'} />;
  }

  if (shouldShowTeacherApplicationGate(profile, user.id)) {
    return <TeacherApplicationGate />;
  }

  return <StudentDashboard />;
}
