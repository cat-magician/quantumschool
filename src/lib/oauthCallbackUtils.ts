import { oauthDashboardRedirectPath } from './yandexAuthUtils';

/**
 * Параметры OAuth-возврата. Сессия при входе (implicit) и ошибка приходят
 * в #hash, код (старый PKCE-вход, начатый до перехода на implicit) — в ?query=.
 */
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

/** Яндекс вернул человека с готовой сессией в адресе (implicit). */
export function hasOAuthTokenInUrl(): boolean {
  return readOAuthParams().has('access_token');
}

/**
 * Забрать сессию, с которой Яндекс вернул человека (#access_token=…), и сразу
 * убрать её из адреса через replaceState. Сам supabase-js делал это через
 * location.hash = '': в истории оставалась запись с токенами, и первая
 * «Назад» после входа вела на ту же страницу.
 */
export function takeOAuthSessionFromUrl(): { access_token: string; refresh_token: string } | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const access_token = hash.get('access_token');
  const refresh_token = hash.get('refresh_token');
  if (!access_token || !refresh_token) return null;
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
  return { access_token, refresh_token };
}

/** В адресе возврат от Яндекса, который ещё нужно превратить во вход. */
export function hasOAuthReturnInUrl(): boolean {
  return hasOAuthCodeInUrl() || hasOAuthTokenInUrl();
}

/**
 * Убрать из адреса код и токены возврата: пока они там, кабинет считает, что
 * вход ещё идёт. replaceState, а не location.hash = '': токены не должны
 * остаться в истории за кнопкой «Назад».
 */
export function clearOAuthReturnFromUrl() {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const hashHasReturn = hashParams.has('access_token') || hashParams.has('refresh_token');
  if (!url.searchParams.has('code') && !hashHasReturn) return;
  url.searchParams.delete('code');
  if (hashHasReturn) url.hash = '';
  // Состояние истории не трогаем: в нём React Router хранит свой индекс.
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

const OAUTH_SUPPORT_EMAIL = 'quantumschool@rqc.ru';

/**
 * Код в адресе — от PKCE-входа, начатого до перехода на implicit (или в
 * другом браузере). Обменять его здесь нечем; повторный вход проходит:
 * теперь сессия приходит прямо в адресе и подхватывается любым браузером.
 */
export const OAUTH_STALE_CODE_ERROR = 'Ссылка для входа устарела. Войдите ещё раз.';

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
    return OAUTH_STALE_CODE_ERROR;
  }

  if (error.code === 'flow_state_not_found' || error.code === 'flow_state_expired'
    || lower.includes('flow state')) {
    return 'Ссылка для входа устарела или уже сработала. Войдите ещё раз.';
  }

  console.error('OAuth code exchange error:', error.name, error.code, error.message);
  return 'Не удалось завершить вход через Яндекс ID. Попробуйте ещё раз или войдите '
    + `по логину и паролю. Если не выходит — напишите на ${OAUTH_SUPPORT_EMAIL}`;
}

/** Коротко и без перевода — строка «для поддержки» на экране ошибки входа. */
export function oauthErrorDetail(error: {
  name?: string;
  code?: string;
  status?: number;
  message: string;
}): string {
  const head = [error.name, error.code, error.status].filter(Boolean).join(' · ');
  return `${head}${head ? ': ' : ''}${error.message}`.slice(0, 200);
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
