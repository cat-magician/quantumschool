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

export function translateOAuthError(description: string): string {
  const decoded = decodeURIComponent(description.replace(/\+/g, ' '));

  if (decoded.includes('missing provider id')) {
    return 'Supabase не нашёл идентификатор пользователя в ответе Яндекса. '
      + 'У провайдера custom:yandex в UserInfo URL должна стоять функция yandex-userinfo, '
      + 'а не https://login.yandex.ru/info.';
  }

  if (decoded.includes('Error getting user email from external provider')) {
    return 'Supabase не получил email от Яндекса. Проверьте Scopes: login:info login:email, '
      + 'право login:email в приложении Яндекса и что UserInfo URL указывает на yandex-userinfo.';
  }

  const lower = decoded.toLowerCase();
  if (
    lower.includes('redirect')
    && (lower.includes('not allowed') || lower.includes('mismatch') || lower.includes('invalid'))
  ) {
    return `Адрес возврата не разрешён в Supabase. Добавьте в Authentication → URL Configuration → Redirect URLs: ${oauthDashboardRedirectPath()}`;
  }

  return decoded || 'Не удалось войти через Яндекс ID';
}

/** Прочитать и убрать из URL ошибку OAuth (после неудачного редиректа). */
export function consumeOAuthErrorFromUrl(): string | null {
  const params = readOAuthParams();
  const error = params.get('error');
  if (!error) return null;

  window.history.replaceState({}, document.title, window.location.pathname);
  return translateOAuthError(params.get('error_description') ?? error);
}
