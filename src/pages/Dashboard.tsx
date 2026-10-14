import { Suspense, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { hasOAuthCallbackInUrl, hasOAuthReturnInUrl } from '../lib/oauthCallbackUtils';
import TeacherApplicationGate from './TeacherApplicationGate';
import PrivacyConsentGate from '../components/PrivacyConsentGate';
import { profileNeedsPrivacyConsent } from '../lib/profileUtils';
import { shouldShowTeacherApplicationGate } from '../lib/loginCorridor';
import { lazyChunk } from '../lib/lazyChunk';
import { isYandexOAuthEnabled } from '../lib/yandexAuthConfig';
import { isLoginAuthEnabled } from '../lib/loginAuthConfig';
import YandexSignInButton from '../components/YandexSignInButton';
import LoginPasswordForm from '../components/LoginPasswordForm';

// Кабинеты ученика и сотрудника — отдельные чанки: ученику незачем качать код
// админки, а это больше трети прежнего общего чанка.
const loadStudentDashboard = () => import('./StudentDashboard');
const loadAdminDashboard = () => import('./AdminDashboard');
const StudentDashboard = lazyChunk(loadStudentDashboard);
const AdminDashboard = lazyChunk(loadAdminDashboard);

/** Какой кабинет открывали на этом устройстве в прошлый раз. */
const DASHBOARD_KIND_KEY = 'qc:dashboard-kind';

type DashboardKind = 'staff' | 'student';

function rememberedDashboardKind(): DashboardKind {
  try {
    return localStorage.getItem(DASHBOARD_KIND_KEY) === 'staff' ? 'staff' : 'student';
  } catch {
    return 'student';
  }
}

function rememberDashboardKind(kind: DashboardKind) {
  try {
    localStorage.setItem(DASHBOARD_KIND_KEY, kind);
  } catch {
    // Хранилище недоступно — в следующий раз просто угадаем ученика.
  }
}

function DashboardSpinner() {
  return (
    <div className="min-h-screen min-h-svh bg-slate-950 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );
}

export default function Dashboard() {
  const {
    user, profile, loading, oauthError, oauthErrorDetail, clearOAuthError, signOut, signingOut, refreshProfile,
    profileError,
  } = useAuth();
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);

  // Код кабинета качаем сразу, параллельно со входом и загрузкой профиля, —
  // иначе он встал бы в очередь за ними. Какой именно, подсказывает прошлый
  // визит; ошибётся подсказка — нужный чанк догрузится, когда придёт профиль.
  useEffect(() => {
    const load = rememberedDashboardKind() === 'staff' ? loadAdminDashboard : loadStudentDashboard;
    // Сбой тут не страшен: при отрисовке lazy попробует ещё раз и покажет ошибку сам.
    load().catch(() => {});
  }, []);

  const profileRole = profile?.role;
  useEffect(() => {
    if (profileRole) rememberDashboardKind(profileRole === 'student' ? 'student' : 'staff');
  }, [profileRole]);

  useEffect(() => {
    if (loading) return;
    if (user) return;
    if (oauthError) return;
    if (hasOAuthCallbackInUrl()) return;
    navigate('/');
  }, [user, loading, oauthError, navigate]);

  if (loading || (!user && hasOAuthReturnInUrl())) {
    return <DashboardSpinner />;
  }

  if (!user && oauthError) {
    const yandex = isYandexOAuthEnabled();
    const loginPassword = isLoginAuthEnabled();

    // Войти можно прямо отсюда: повторный вход в этом же браузере обычно
    // проходит, а вход по паролю от Яндекса вообще не зависит.
    return (
      <div className="min-h-screen min-h-svh bg-slate-950 flex items-center justify-center px-4 py-8 sm:p-6">
        <div className="max-w-md w-full bg-slate-900/80 border border-rose-500/20 rounded-2xl p-5 sm:p-8">
          <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-rose-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-3 text-center">Не удалось войти</h2>
          <p role="alert" className="text-slate-300 text-sm leading-relaxed mb-6">{oauthError}</p>

          {yandex && (
            <YandexSignInButton
              label="Войти с Яндекс ID ещё раз"
              errorClassName="text-rose-400"
            />
          )}

          {yandex && loginPassword && (
            <div className="flex items-center gap-3 my-6">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-slate-500 uppercase tracking-wide">или</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
          )}

          <LoginPasswordForm tone="dark" onSuccess={clearOAuthError} />

          <Link
            to="/"
            onClick={clearOAuthError}
            className="mt-4 flex items-center justify-center min-h-11 text-sm text-slate-500 hover:text-slate-300"
          >
            На главную
          </Link>

          {/* По этой строке видно, что именно случилось, — если вход так и не
              удастся, её можно переслать организаторам. */}
          {oauthErrorDetail && (
            <p className="mt-3 text-xs text-slate-500 text-center leading-relaxed break-words">
              Для поддержки: {oauthErrorDetail}
            </p>
          )}
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
      <div className="min-h-screen min-h-svh bg-slate-950 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-slate-900/80 border border-white/10 rounded-2xl p-5 sm:p-8 text-center">
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
            <Link to="/" className="flex items-center justify-center min-h-11 text-sm text-slate-500 hover:text-slate-300">На главную</Link>
          </div>
          {profileError && (
            <p className="mt-5 text-xs text-slate-500 leading-relaxed break-words">
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
    return (
      <Suspense fallback={<DashboardSpinner />}>
        <AdminDashboard isSuperAdmin={role === 'superadmin'} />
      </Suspense>
    );
  }

  if (shouldShowTeacherApplicationGate(profile, user.id)) {
    return <TeacherApplicationGate />;
  }

  return (
    <Suspense fallback={<DashboardSpinner />}>
      <StudentDashboard />
    </Suspense>
  );
}
