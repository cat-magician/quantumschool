import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { DASHBOARD_ROUTE } from '../lib/appPaths';
import {
  LOGIN_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  SUPPORT_EMAIL,
  isLoginAuthEnabled,
  normalizeLogin,
  validateLogin,
  validatePassword,
  validateRecoveryEmail,
} from '../lib/loginAuthConfig';

type Mode = 'signin' | 'signup';
type Tone = 'dark' | 'light';

const TONES = {
  dark: {
    label: 'text-slate-300',
    hint: 'text-slate-500',
    input: 'bg-slate-950/80 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500/60',
    inputError: 'border-rose-500/60',
    fieldError: 'text-rose-400',
    formError: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    switchTrack: 'bg-white/5 border-white/10',
    switchOn: 'bg-white/10 text-white',
    switchOff: 'text-slate-400 hover:text-slate-200',
    submit: 'bg-gradient-to-r from-blue-600 to-violet-700 text-white hover:shadow-lg hover:shadow-violet-900/30',
    iconButton: 'text-slate-500 hover:text-slate-300',
  },
  light: {
    label: 'text-slate-700',
    hint: 'text-slate-500',
    input: 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-500',
    inputError: 'border-rose-400',
    fieldError: 'text-rose-600',
    formError: 'text-rose-700 bg-rose-50 border-rose-200',
    switchTrack: 'bg-slate-100 border-slate-200',
    switchOn: 'bg-white text-slate-900 shadow-sm',
    switchOff: 'text-slate-500 hover:text-slate-700',
    submit: 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:shadow-lg',
    iconButton: 'text-slate-400 hover:text-slate-600',
  },
} as const satisfies Record<Tone, Record<string, string>>;

type FieldErrors = Partial<Record<'name' | 'login' | 'password' | 'recoveryEmail', string>>;

/**
 * Вход и регистрация по придуманному логину — запасной путь к кабинету, когда
 * Яндекс ID недоступен. Технический адрес для Supabase собирается в
 * AuthContext, здесь пользователь видит только логин.
 */
export default function LoginPasswordForm({
  tone = 'dark',
  initialMode = 'signin',
  teacherApplication = false,
  onSuccess,
}: {
  tone?: Tone;
  initialMode?: Mode;
  teacherApplication?: boolean;
  onSuccess?: () => void;
}) {
  const { signInWithLogin, signUpWithLogin } = useAuth();
  const navigate = useNavigate();
  const fieldId = useId();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isLoginAuthEnabled()) return null;

  const s = TONES[tone];
  const isSignUp = mode === 'signup';

  const switchMode = (next: Mode) => {
    setMode(next);
    setFieldErrors({});
    setFormError('');
    setPassword('');
    setShowPassword(false);
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (isSignUp && !name.trim()) errors.name = 'Как к вам обращаться?';

    if (isSignUp) {
      const loginError = validateLogin(login);
      if (loginError) errors.login = loginError;

      const passwordError = validatePassword(password);
      if (passwordError) errors.password = passwordError;

      const emailError = validateRecoveryEmail(recoveryEmail);
      if (emailError) errors.recoveryEmail = emailError;
    } else {
      if (!login.trim()) errors.login = 'Введите логин';
      if (!password) errors.password = 'Введите пароль';
    }

    return errors;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setLoading(true);
    const result = isSignUp
      ? await signUpWithLogin({
        login, password, name, recoveryEmail, teacherApplication,
      })
      : await signInWithLogin({ login, password, teacherApplication });
    setLoading(false);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    onSuccess?.();
    navigate(DASHBOARD_ROUTE);
  };

  const inputClass = (field: keyof FieldErrors) => [
    'w-full h-12 rounded-xl border px-4 transition-colors',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
    s.input,
    fieldErrors[field] ? s.inputError : '',
  ].join(' ');

  const renderError = (field: keyof FieldErrors) => (
    fieldErrors[field]
      ? <p id={`${fieldId}-${field}-error`} className={`mt-1.5 text-sm ${s.fieldError}`}>{fieldErrors[field]}</p>
      : null
  );

  const errorProps = (field: keyof FieldErrors) => ({
    'aria-invalid': Boolean(fieldErrors[field]),
    'aria-describedby': fieldErrors[field] ? `${fieldId}-${field}-error` : undefined,
  });

  return (
    <div>
      <div className={`grid grid-cols-2 gap-1 p-1 mb-5 rounded-xl border ${s.switchTrack}`}>
        {([['signin', 'Вход'], ['signup', 'Регистрация']] as const).map(([value, title]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => switchMode(value)}
            className={`h-9 rounded-lg text-sm font-medium transition-colors ${mode === value ? s.switchOn : s.switchOff}`}
          >
            {title}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {isSignUp && (
          <div>
            <label htmlFor={`${fieldId}-name`} className={`block text-sm font-medium mb-1.5 ${s.label}`}>
              Имя и фамилия
            </label>
            <input
              id={`${fieldId}-name`}
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Иван Иванов"
              className={inputClass('name')}
              {...errorProps('name')}
            />
            {renderError('name')}
          </div>
        )}

        <div>
          <label htmlFor={`${fieldId}-login`} className={`block text-sm font-medium mb-1.5 ${s.label}`}>
            Логин
          </label>
          <input
            id={`${fieldId}-login`}
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={LOGIN_MAX_LENGTH}
            value={login}
            onChange={(e) => setLogin(normalizeLogin(e.target.value))}
            placeholder="ivan2010"
            className={inputClass('login')}
            {...errorProps('login')}
          />
          {renderError('login')}
          {isSignUp && !fieldErrors.login && (
            <p className={`mt-1.5 text-xs ${s.hint}`}>
              Латинские буквы и цифры. Это не почта — придумайте что угодно.
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${fieldId}-password`} className={`block text-sm font-medium mb-1.5 ${s.label}`}>
            Пароль
          </label>
          <div className="relative">
            <input
              id={`${fieldId}-password`}
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? `Минимум ${PASSWORD_MIN_LENGTH} символов` : ''}
              className={`${inputClass('password')} pr-12`}
              {...errorProps('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              className={`absolute inset-y-0 right-0 w-12 flex items-center justify-center rounded-r-xl transition-colors ${s.iconButton}`}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {renderError('password')}
        </div>

        {isSignUp && (
          <div>
            <label htmlFor={`${fieldId}-recovery`} className={`block text-sm font-medium mb-1.5 ${s.label}`}>
              Почта для восстановления <span className={`font-normal ${s.hint}`}>— можно пропустить</span>
            </label>
            <input
              id={`${fieldId}-recovery`}
              type="email"
              autoComplete="email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              placeholder="ivan@example.com"
              className={inputClass('recoveryEmail')}
              {...errorProps('recoveryEmail')}
            />
            {renderError('recoveryEmail')}
            {!fieldErrors.recoveryEmail && (
              <p className={`mt-1.5 text-xs ${s.hint}`}>
                Понадобится, только если забудете пароль — по ней организаторы вас узнают.
              </p>
            )}
          </div>
        )}

        {formError && (
          <p role="alert" className={`text-sm border rounded-xl px-4 py-3 ${s.formError}`}>
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full h-12 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${s.submit}`}
        >
          {loading && <Loader2 className="w-5 h-5 animate-spin" />}
          {isSignUp ? 'Создать аккаунт' : 'Войти'}
        </button>

        {!isSignUp && (
          <p className={`text-center text-xs leading-relaxed ${s.hint}`}>
            Забыли пароль? Напишите на{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2 hover:no-underline">
              {SUPPORT_EMAIL}
            </a>
            {' '}— организаторы выдадут новый.
          </p>
        )}
      </form>
    </div>
  );
}
