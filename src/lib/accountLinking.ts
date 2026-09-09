import type { Provider, UserIdentity } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { YANDEX_OAUTH_PROVIDER } from './yandexAuthConfig';
import { appHref } from './appPaths';
import { LOGIN_EMAIL_DOMAIN, SUPPORT_EMAIL } from './loginAuthConfig';

/**
 * Привязка второго способа входа к одному аккаунту.
 *
 * Кто зашёл по логину, а потом завёл Яндекс ID, иначе получал два разных
 * кабинета. linkIdentity добавляет вторую identity тому же пользователю:
 * профиль, оценки и группы остаются одни.
 */

/** Куда Яндекс вернёт после привязки — обратно в профиль, а не в кабинет. */
export function accountLinkRedirectPath(): string {
  return `${window.location.origin}${appHref('/profile')}`;
}

export type LinkedIdentities = {
  /** Вход по логину и паролю. */
  password: UserIdentity | null;
  /** Вход через Яндекс ID. */
  yandex: UserIdentity | null;
  all: UserIdentity[];
};

function isYandexIdentity(identity: UserIdentity): boolean {
  const provider = identity.provider ?? '';
  return provider === YANDEX_OAUTH_PROVIDER || provider.includes('yandex');
}

export function groupIdentities(identities: UserIdentity[]): LinkedIdentities {
  return {
    password: identities.find((i) => i.provider === 'email') ?? null,
    yandex: identities.find(isYandexIdentity) ?? null,
    all: identities,
  };
}

export async function loadLinkedIdentities(): Promise<{
  data: LinkedIdentities | null;
  error: string | null;
}> {
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) return { data: null, error: describeLinkError(error.message) };
  return { data: groupIdentities(data?.identities ?? []), error: null };
}

/** Адрес из identity Яндекса; технический адрес логина сюда не попадает. */
export function identityEmail(identity: UserIdentity | null): string | null {
  const raw = identity?.identity_data?.email;
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!value || value.endsWith(`@${LOGIN_EMAIL_DOMAIN}`)) return null;
  return value;
}

/** Логин Яндекса из identity — им же участник подписан в Контесте. */
export function identityYandexLogin(identity: UserIdentity | null): string | null {
  const data = identity?.identity_data ?? {};
  for (const key of ['preferred_username', 'login', 'user_name']) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Уводит на Яндекс. Успех — это не возврат значения, а редирект: результат
 * увидим после того, как Яндекс вернёт пользователя на страницу профиля.
 */
export async function startYandexLink(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.linkIdentity({
    provider: YANDEX_OAUTH_PROVIDER as Provider,
    options: {
      redirectTo: accountLinkRedirectPath(),
      // Иначе Яндекс молча возьмёт аккаунт, под которым человек уже сидит,
      // а привязать он мог хотеть другой.
      queryParams: { force_confirm: 'yes' },
    },
  });

  return { error: error ? describeLinkError(error.message) : null };
}

/**
 * Задать пароль аккаунту, который завели через Яндекс ID.
 *
 * Логин такому аккаунту не придумать: Supabase опознаёт человека по одному
 * адресу, и он уже занят яндексовым. Поэтому второй способ входа у них —
 * та же почта плюс пароль.
 */
export async function setAccountPassword(
  password: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error ? describeLinkError(error.message) : null };
}

export async function unlinkIdentity(
  identity: UserIdentity,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.unlinkIdentity(identity);
  return { error: error ? describeLinkError(error.message) : null };
}

/**
 * Ошибки Supabase на русском. Две из них означают не поломку, а состояние,
 * которое пользователь должен понять: провайдер уже занят другим аккаунтом
 * и выключенная в проекте ручная привязка.
 */
export function describeLinkError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('already') && (lower.includes('linked') || lower.includes('registered')
    || lower.includes('exists') || lower.includes('taken'))) {
    return 'Этот Яндекс ID уже используется как отдельный аккаунт на сайте. '
      + `Два готовых аккаунта сливать нельзя — напишите на ${SUPPORT_EMAIL}, вам помогут вручную.`;
  }

  if (lower.includes('manual linking') || lower.includes('manual_linking')
    || lower.includes('linking is disabled') || lower.includes('not enabled')) {
    return 'Привязка аккаунтов пока не включена в настройках проекта. '
      + `Напишите на ${SUPPORT_EMAIL}.`;
  }

  if (lower.includes('single identity') || lower.includes('last identity')
    || lower.includes('only identity')) {
    return 'Это единственный способ войти — его нельзя отвязать, иначе вы потеряете доступ.';
  }

  if (lower.includes('weak password') || lower.includes('pwned')) {
    return 'Пароль слишком простой — добавьте символов.';
  }

  if (lower.includes('should be at least')) {
    return 'Пароль слишком короткий.';
  }

  if (lower.includes('should be different') || lower.includes('same as the old')) {
    return 'Это ваш текущий пароль — придумайте новый.';
  }

  if (lower.includes('reauthentication') || lower.includes('recent login')) {
    return 'Для смены пароля нужно заново войти в аккаунт.';
  }

  if (lower.includes('session') || lower.includes('jwt') || lower.includes('not authenticated')) {
    return 'Сессия истекла. Войдите заново и повторите привязку.';
  }

  console.error('Account linking error:', message);
  return `Не удалось изменить способы входа. Попробуйте позже или напишите на ${SUPPORT_EMAIL}`;
}
