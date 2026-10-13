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

/** Убрать код из адреса: пока он там, кабинет считает, что вход ещё идёт. */
export function clearOAuthCodeFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('code')) return;
  url.searchParams.delete('code');
  // Состояние истории не трогаем: в нём React Router хранит свой индекс.
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

const OAUTH_SUPPORT_EMAIL = 'quantumschool@rqc.ru';

/**
 * Код из адреса supabase-js меняет на сессию только там, где нажимали
 * «Войти»: в этом браузере лежит PKCE-ключ к коду. На телефоне возврат от
 * Яндекса нередко открывается в другом месте — в приложении Яндекса, во
 * встроенном браузере Telegram, в браузере по умолчанию, — и ключа там нет.
 * Повторный вход отсюда же проходит: ключ ляжет уже в этот браузер.
 */
export const OAUTH_OTHER_BROWSER_ERROR =
  'Яндекс вернул вас не в тот браузер, где вы нажимали «Войти». На телефоне так бывает, '
  + 'когда ссылку перехватывает приложение Яндекса или другой браузер. Войдите ещё раз прямо здесь.';

export const OAUTH_TIMEOUT_ERROR =
  'Вход через Яндекс не завершился: сервис авторизации отвечает слишком долго. '
  + 'Проверьте интернет и попробуйте ещё раз через пару минут.';

/** Связь оборвалась на полпути: fetch в разных браузерах падает с разным текстом. */
export function isNetworkErrorMessage(message: string): boolean {
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(message);
}

/**
 * Почему не удался обмен кода на сессию после возврата от Яндекса.
 * supabase-js не бросает эту ошибку и не шлёт о ней событие — только
 * возвращает из auth.initialize().
 */
export function describeOAuthExchangeError(error: {
  name?: string;
  code?: string;
  message: string;
}): string {
  const lower = error.message.toLowerCase();

  if (error.name === 'AuthRetryableFetchError' || isNetworkErrorMessage(error.message)) {
    return 'Не удалось связаться с сервером входа — похоже, пропал интернет. '
      + 'Проверьте связь и войдите ещё раз.';
  }

  if (error.code === 'bad_code_verifier' || lower.includes('code verifier')) {
    return OAUTH_OTHER_BROWSER_ERROR;
  }

  if (error.code === 'flow_state_not_found' || error.code === 'flow_state_expired'
    || lower.includes('flow state')) {
    return 'Ссылка для входа устарела или уже сработала. Войдите ещё раз.';
  }

  console.error('OAuth code exchange error:', error.name, error.code, error.message);
  return 'Не удалось завершить вход через Яндекс ID. Попробуйте ещё раз или войдите '
    + `по логину и паролю. Если не выходит — напишите на ${OAUTH_SUPPORT_EMAIL}`;
}

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
