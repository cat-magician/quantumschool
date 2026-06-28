import { useState, useEffect } from 'react';
import { X, Atom, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';

function translateAuthError(msg: string) {
  if (msg.includes('Invalid login credentials')) {
    return 'Неверный email или пароль. Проверьте: 1) в .env тот же Supabase-проект, где запускали demo/apply.sql; 2) после смены .env перезапустите npm run dev; 3) при необходимости снова demo/remove.sql → demo/apply.sql.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'Подтвердите email — проверьте почту или отключите подтверждение в настройках Supabase Auth.';
  }
  return msg;
}

interface AuthModalProps {
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export default function AuthModal({ onClose, initialMode = 'login' }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMode(initialMode);
    setName('');
    setEmail('');
    setPassword('');
    setShowPass(false);
    setError('');
    setLoading(false);
  }, [initialMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, name);
    setLoading(false);
    if (result.error) {
      setError(translateAuthError(result.error));
    } else {
      onClose();
      navigate('/dashboard');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="relative w-full max-w-md max-h-[min(90dvh,calc(100vh-2rem))] overflow-y-auto scrollbar-site bg-slate-900 border border-white/10 rounded-3xl p-4 sm:p-8 shadow-2xl shadow-violet-900/20 my-auto"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
          <X className="w-4 h-4 text-slate-400" />
        </button>

        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-violet-700 rounded-2xl flex items-center justify-center">
            <Atom className="w-7 h-7 text-white" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white text-center mb-1">
          {mode === 'login' ? 'Вход в личный кабинет' : 'Регистрация'}
        </h2>
        <p className="text-slate-400 text-sm text-center mb-8">
          {mode === 'login' ? 'Введите данные для входа' : 'Создайте аккаунт участника'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Имя</label>
              <input
                type="text"
                required
                autoComplete="off"
                name="auth-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ваше имя"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <input
              type="email"
              required
              autoComplete="off"
              name="auth-email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@mail.ru"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Пароль</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                required
                autoComplete="new-password"
                name="auth-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm break-words">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-violet-700 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          {mode === 'login' ? (
            <>Нет аккаунта?{' '}
              <button
                onClick={() => {
                  onClose();
                  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-blue-400 hover:text-blue-300 font-medium"
              >
                Зарегистрироваться
              </button>
            </>
          ) : (
            <>Уже есть аккаунт?{' '}
              <button onClick={() => { setMode('login'); setName(''); setEmail(''); setPassword(''); setError(''); setShowPass(false); }} className="text-blue-400 hover:text-blue-300 font-medium">
                Войти
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
