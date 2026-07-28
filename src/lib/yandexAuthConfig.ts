/** Identifier custom provider в Supabase Auth (Authentication → Custom Providers). */
export const YANDEX_OAUTH_PROVIDER =
  import.meta.env.VITE_YANDEX_OAUTH_PROVIDER?.trim() || 'custom:yandex';

/** Scopes задаются в Supabase Dashboard у провайдера custom:yandex, не передаём с клиента. */

export function isYandexOAuthEnabled(): boolean {
  const flag = import.meta.env.VITE_YANDEX_OAUTH_ENABLED;
  if (flag === 'false' || flag === '0') return false;
  return true;
}

const OAUTH_RETURN_KEY = 'qc_oauth_return';
const OAUTH_TEACHER_APP_KEY = 'qc_oauth_teacher_pending';

/** Пользователь ушёл на OAuth — после входа отправить в личный кабинет. */
export function markOAuthReturnPending() {
  sessionStorage.setItem(OAUTH_RETURN_KEY, '1');
}

export function consumeOAuthReturnPending(): boolean {
  const pending = sessionStorage.getItem(OAUTH_RETURN_KEY) === '1';
  sessionStorage.removeItem(OAUTH_RETURN_KEY);
  return pending;
}

export function markTeacherApplicationPending() {
  sessionStorage.setItem(OAUTH_TEACHER_APP_KEY, '1');
}

export function consumeTeacherApplicationPending(): boolean {
  const pending = sessionStorage.getItem(OAUTH_TEACHER_APP_KEY) === '1';
  sessionStorage.removeItem(OAUTH_TEACHER_APP_KEY);
  return pending;
}
