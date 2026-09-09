import { useCallback, useEffect, useState } from 'react';
import { Check, KeyRound, Link2, Loader2, Unlink } from 'lucide-react';
import type { UserIdentity } from '@supabase/supabase-js';
import { useAppDialog } from '../lib/AppDialogContext';
import { isYandexOAuthEnabled } from '../lib/yandexAuthConfig';
import {
  identityEmail,
  identityYandexLogin,
  loadLinkedIdentities,
  startYandexLink,
  unlinkIdentity,
  type LinkedIdentities,
} from '../lib/accountLinking';
import { YandexIdLogo } from './YandexSignInButton';

/**
 * Способы входа в один аккаунт.
 *
 * Раньше вход по логину и вход через Яндекс ID создавали два разных кабинета.
 * Здесь их можно связать: профиль, оценки и группы остаются одни, а войти
 * получится любым из способов.
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
        <div className="flex items-center gap-2">
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

export default function LinkedAccountsSection() {
  const { confirm, toast } = useAppDialog();
  const [identities, setIdentities] = useState<LinkedIdentities | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      message: 'Входить останется только по логину и паролю. Данные кабинета не изменятся, '
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

  const { password, yandex, all } = identities;
  const yandexEmail = identityEmail(yandex);
  const yandexNick = identityYandexLogin(yandex);
  // Последний способ входа отвязывать нельзя — человек потеряет доступ.
  const canUnlinkYandex = all.length > 1;

  return (
    <section className="rounded-2xl bg-slate-900/60 border border-white/5 p-6 sm:p-8">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
        <Link2 className="w-3.5 h-3.5" />
        Способы входа
      </h2>
      <p className="text-xs text-slate-500 leading-relaxed mb-3">
        Можно входить и по логину, и через Яндекс ID — кабинет, оценки и группы будут одни и те же.
      </p>

      <MethodRow
        icon={KeyRound}
        title="Логин и пароль"
        value={password ? 'подключён при регистрации' : 'не настроен'}
        connected={!!password}
      />

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

      {!yandex && isYandexOAuthEnabled() && (
        <p className="mt-3 text-xs text-slate-500 leading-relaxed">
          Привязывать нужно Яндекс ID, под которым вы ещё не заходили на сайт. Если вы уже
          создали им отдельный кабинет, связать два готовых аккаунта автоматически нельзя.
        </p>
      )}
    </section>
  );
}
