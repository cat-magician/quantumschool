import { oauthDashboardRedirectPath } from './yandexAuthUtils';

/** Параметры OAuth-возврата: код приходит в ?query=, ошибка — в #hash. */
function readOAuthParams(): URLSearchParams {
  const fromSearch = new URLSearchParams(window.location.search);
  if (fromSearch.has('code') || fromSearch.has('error')) return fromSearch;

  const hash = window.location.hash.replace(/^#/, '');
  return hash ? new URLSearchParams(hash) : fromSearch;
}

/** Идёт обработка возврата от провайдера — уводить со страницы нельзя. */
export function hasOAuthCallbackInUrl(): boolean {
  const params = readOAuthParams();
  return params.has('code') || params.has('access_token') || params.has('error');
}

export function hasOAuthCodeInUrl(): boolean {
  return readOAuthParams().has('code');
}

const OAUTH_SUPPORT_EMAIL = 'quantumschool@rqc.ru';

/**
 * Экран ошибки видят школьники, поэтому текст человеческий, а инструкция
 * по настройке — в консоль: администратору она нужна, участнику только пугает.
 */
export function translateOAuthError(description: string): string {
  const decoded = decodeURIComponent(description.replace(/\+/g, ' '));
  const lower = decoded.toLowerCase();

  if (decoded.includes('missing provider id')) {
    console.error(
      'Yandex OAuth: Supabase не нашёл идентификатор пользователя в ответе провайдера. '
      + 'У custom:yandex в UserInfo URL должна стоять Edge Function yandex-userinfo, '
      + `а не https://login.yandex.ru/info. Ответ: ${decoded}`,
    );
    return 'Вход через Яндекс ID сейчас не работает — сервис настроен неверно. '
      + `Мы уже видим проблему; если она не исчезнет, напишите на ${OAUTH_SUPPORT_EMAIL}`;
  }

  if (decoded.includes('Error getting user email from external provider')) {
    console.error(
      'Yandex OAuth: не пришёл email. Проверьте Scopes (login:info login:email), '
      + 'право login:email в приложении Яндекса и UserInfo URL → yandex-userinfo. '
      + `Ответ: ${decoded}`,
    );
    return 'Яндекс не передал почту, без неё вход невозможен. Разрешите доступ к почте '
      + `при входе или напишите на ${OAUTH_SUPPORT_EMAIL}`;
  }

  if (
    lower.includes('redirect')
    && (lower.includes('not allowed') || lower.includes('mismatch') || lower.includes('invalid'))
  ) {
    console.error(
      'Yandex OAuth: адрес возврата не в allowlist. Добавьте в Supabase → Authentication → '
      + `URL Configuration → Redirect URLs: ${oauthDashboardRedirectPath()}. Ответ: ${decoded}`,
    );
    return 'Вход через Яндекс ID сейчас не работает — сервис настроен неверно. '
      + `Мы уже видим проблему; если она не исчезнет, напишите на ${OAUTH_SUPPORT_EMAIL}`;
  }

  // Отказ на экране Яндекса — единственная ошибка «по вине» пользователя.
  if (lower.includes('access_denied') || lower.includes('user denied') || lower.includes('отмен')) {
    return 'Вход отменён на странице Яндекса. Попробуйте ещё раз и подтвердите доступ.';
  }

  if (decoded) console.error('Yandex OAuth error:', decoded);
  return `Не удалось войти через Яндекс ID. Попробуйте ещё раз через пару минут или напишите на ${OAUTH_SUPPORT_EMAIL}`;
}

/** Прочитать и убрать из URL ошибку OAuth (после неудачного редиректа). */
export function consumeOAuthErrorFromUrl(): string | null {
  const params = readOAuthParams();
  const error = params.get('error');
  if (!error) return null;

  window.history.replaceState({}, document.title, window.location.pathname);
  return translateOAuthError(params.get('error_description') ?? error);
}
