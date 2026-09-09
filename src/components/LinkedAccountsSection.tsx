import { useCallback, useEffect, useState } from 'react';
import { Check, KeyRound, Link2, Loader2, Mail, Unlink } from 'lucide-react';
import type { UserIdentity } from '@supabase/supabase-js';
import { useAuth } from '../lib/AuthContext';
import { useAppDialog } from '../lib/AppDialogContext';
import { isYandexOAuthEnabled } from '../lib/yandexAuthConfig';
import { loginFromAuthEmail, validatePassword } from '../lib/loginAuthConfig';
import {
  identityEmail,
  identityYandexLogin,
  loadLinkedIdentities,
  setAccountPassword,
  startYandexLink,
  unlinkIdentity,
  type LinkedIdentities,
} from '../lib/accountLinking';
import { YandexIdLogo } from './YandexSignInButton';

/**
 * Способы входа в один аккаунт.
 *
 * Раньше вход по логину и вход через Яндекс ID создавали два разных кабинета.
 * Здесь их можно связать, а аккаунту Яндекс ID — задать пароль, чтобы входить
 * и без Яндекса. Логин такому аккаунту не придумать: Supabase опознаёт
 * человека по одному адресу, и он уже занят яндексовым.
 */

function MethodRow({
  icon: Icon,
  title,
  value,
  connected,
  children,
}: {
  icon: typeof KeyRound;
  title: string;
  value: string;
  connected: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
        connected
          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
          : 'bg-white/5 border-white/10 text-slate-500'
      }`}
      >
        <Icon className="w-4 h-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-white">{title}</span>
          {connected && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
              <Check className="w-3 h-3" />
              подключён
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-0.5 break-all">{value}</div>
      </div>

      {children}
    </div>
  );
}

const passwordInputClass =
  'w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/60';

export default function LinkedAccountsSection() {
  const { user } = useAuth();
  const { confirm, toast } = useAppDialog();

  const [identities, setIdentities] = useState<LinkedIdentities | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await loadLinkedIdentities();
    setIdentities(data);
    setError(loadError);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleLink = async () => {
    setBusy(true);
    setError(null);
    const { error: linkError } = await startYandexLink();
    // Без ошибки браузер уже уходит на Яндекс — возвращать состояние некуда.
    if (linkError) {
      setError(linkError);
      setBusy(false);
    }
  };

  const handleUnlink = async (identity: UserIdentity) => {
    const ok = await confirm({
      title: 'Отвязать Яндекс ID?',
      message: 'Входить останется только по паролю. Данные кабинета не изменятся, '
        + 'привязать Яндекс ID снова можно в любой момент.',
      confirmLabel: 'Отвязать',
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    setError(null);
    const { error: unlinkError } = await unlinkIdentity(identity);
    if (unlinkError) setError(unlinkError);
    else toast('Яндекс ID отвязан', 'success');
    await refresh();
    setBusy(false);
  };

  const handleSavePassword = async (event: React.FormEvent) => {
    event.preventDefault();

    const invalid = validatePassword(password);
    if (invalid) { setPasswordError(invalid); return; }
    if (password !== repeat) { setPasswordError('Пароли не совпадают'); return; }

    setBusy(true);
    setPasswordError(null);
    const { error: saveError } = await setAccountPassword(password);
    setBusy(false);

    if (saveError) { setPasswordError(saveError); return; }

    setPassword('');
    setRepeat('');
    setPasswordOpen(false);
    setPasswordSaved(true);
    toast('Пароль сохранён', 'success');
    await refresh();
  };

  if (loading) {
    return (
      <section className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Загружаем способы входа…
        </div>
      </section>
    );
  }

  if (!identities) {
    return (
      <section className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 sm:p-8 space-y-2">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Link2 className="w-3.5 h-3.5" />
          Способы входа
        </h2>
        <p className="text-sm text-rose-300">{error ?? 'Не удалось загрузить способы входа.'}</p>
      </section>
    );
  }

  const { password: passwordIdentity, yandex, all } = identities;
  const yandexEmail = identityEmail(yandex);
  const yandexNick = identityYandexLogin(yandex);

  // У входа по логину в Supabase лежит технический адрес, у Яндекс ID — настоящий.
  const authEmail = user?.email ?? '';
  const accountLogin = loginFromAuthEmail(authEmail);
  const signInEmail = accountLogin ? null : authEmail;

  // Последний способ входа отвязывать нельзя — человек потеряет доступ.
  const canUnlinkYandex = all.length > 1;
  const hasPassword = !!passwordIdentity || passwordSaved;

  return (
    <section className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 sm:p-8">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
        <Link2 className="w-3.5 h-3.5" />
        Способы входа
      </h2>
      <p className="text-xs text-slate-500 leading-relaxed mb-3">
        Можно держать оба — кабинет, оценки и группы будут одни и те же.
      </p>

      {accountLogin ? (
        <MethodRow
          icon={KeyRound}
          title="Логин и пароль"
          value={accountLogin}
          connected
        />
      ) : (
        <MethodRow
          icon={Mail}
          title="Почта и пароль"
          value={
            hasPassword
              ? `${signInEmail} — входите этим адресом`
              : `${signInEmail} — пароль не задан`
          }
          connected={hasPassword}
        >
          <button
            type="button"
            onClick={() => {
              setPasswordOpen((v) => !v);
              setPasswordError(null);
            }}
            disabled={busy}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-sm transition-colors disabled:opacity-40"
          >
            {passwordOpen ? 'Отмена' : hasPassword ? 'Изменить пароль' : 'Задать пароль'}
          </button>
        </MethodRow>
      )}

      {passwordOpen && (
        <form onSubmit={handleSavePassword} className="py-3 space-y-2 border-b border-white/5">
          <div className="grid sm:grid-cols-2 gap-2">
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Новый пароль"
              aria-label="Новый пароль"
              className={passwordInputClass}
            />
            <input
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              placeholder="Ещё раз"
              aria-label="Повторите пароль"
              className={passwordInputClass}
            />
          </div>
          {passwordError && <p className="text-xs text-rose-300">{passwordError}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Сохранить пароль
            </button>
            <span className="text-xs text-slate-500">Входить будете по адресу {signInEmail}</span>
          </div>
        </form>
      )}

      <MethodRow
        icon={Link2}
        title="Яндекс ID"
        value={
          yandex
            ? [yandexEmail, yandexNick && `логин: ${yandexNick}`].filter(Boolean).join(' · ')
              || 'аккаунт привязан'
            : 'не привязан'
        }
        connected={!!yandex}
      >
        {yandex ? (
          <button
            type="button"
            onClick={() => { void handleUnlink(yandex); }}
            disabled={busy || !canUnlinkYandex}
            title={canUnlinkYandex ? undefined : 'Это единственный способ войти'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/25 text-slate-400 hover:text-rose-300 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:text-slate-400"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
            Отвязать
          </button>
        ) : isYandexOAuthEnabled() ? (
          <button
            type="button"
            onClick={() => { void handleLink(); }}
            disabled={busy}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <YandexIdLogo className="w-5 h-5" />}
            Привязать Яндекс ID
          </button>
        ) : null}
      </MethodRow>

      {error && (
        <p className="mt-3 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 leading-relaxed">
          {error}
        </p>
      )}

      {/* Пароль задан, но Supabase не завёл отдельную запись входа — «Отвязать»
          останется заблокированной, и молчать об этом нечестно. */}
      {passwordSaved && !passwordIdentity && yandex && !canUnlinkYandex && (
        <p className="mt-3 text-xs text-amber-300/90 leading-relaxed">
          Пароль сохранён — входите по адресу {signInEmail}. Отвязать Яндекс ID пока нельзя:
          сервис авторизации всё ещё считает его единственной подтверждённой записью.
          Попробуйте выйти и войти по паролю — после этого кнопка станет активна.
        </p>
      )}

      {!yandex && isYandexOAuthEnabled() && (
        <p className="mt-3 text-xs text-slate-500 leading-relaxed">
          Привязывать нужно Яндекс ID, под которым вы ещё не заходили на сайт. Если вы уже
          создали им отдельный кабинет, связать два готовых аккаунта автоматически нельзя.
        </p>
      )}
    </section>
  );
}
