import { Link } from 'react-router-dom';
import { ArrowLeft, Atom, GraduationCap } from 'lucide-react';
import YandexSignInButton from '../components/YandexSignInButton';
import LoginPasswordForm from '../components/LoginPasswordForm';
import { isYandexOAuthEnabled } from '../lib/yandexAuthConfig';
import { isLoginAuthEnabled } from '../lib/loginAuthConfig';
import { markTeacherLoginCorridor } from '../lib/loginCorridor';

export default function TeacherJoin() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </Link>
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-8">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-violet-700 rounded-2xl flex items-center justify-center">
              <Atom className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="flex justify-center mb-4">
            <GraduationCap className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-xl font-bold text-white text-center mb-1">Заявка преподавателя</h1>
          <p className="text-slate-400 text-sm text-center mb-8 leading-relaxed">
            Войдите любым способом — заявка отправится автоматически. Для школьников —{' '}
            <Link to="/#contact" className="text-blue-400 hover:text-blue-300">регистрация на главной</Link>.
          </p>

          {isYandexOAuthEnabled() && (
            <YandexSignInButton
              size="lg"
              label="Продолжить с Яндекс ID"
              teacherApplication
              errorClassName="text-rose-400"
            />
          )}

          {isYandexOAuthEnabled() && isLoginAuthEnabled() && (
            <div className="flex items-center gap-3 my-6">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-slate-500 uppercase tracking-wide">или</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
          )}

          <LoginPasswordForm tone="dark" teacherApplication />

          {!isYandexOAuthEnabled() && !isLoginAuthEnabled() && (
            <p className="text-sm text-amber-400 text-center">
              Вход временно недоступен.
            </p>
          )}

          <p className="text-center mt-6 text-sm text-slate-500">
            Уже подавали заявку?{' '}
            <Link
              to="/dashboard"
              onClick={markTeacherLoginCorridor}
              className="text-blue-400 hover:text-blue-300"
            >
              Войти в кабинет
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
