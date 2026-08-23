/**
 * Вход по придуманному логину поверх Supabase Auth.
 *
 * Supabase опознаёт пользователя только по email или телефону, поэтому логину
 * сопоставляется технический адрес <login>@id.quantumschool.ru. Пользователь
 * его не видит и не вводит, письма туда не уходят — домен намеренно не
 * почтовый. Домен обязан совпадать с private.login_email_domain()
 * в supabase/schema.sql.
 */
export const LOGIN_EMAIL_DOMAIN = 'id.quantumschool.ru';

export const LOGIN_MIN_LENGTH = 3;
export const LOGIN_MAX_LENGTH = 20;
export const PASSWORD_MIN_LENGTH = 8;

export const SUPPORT_EMAIL = 'quantumschool@rqc.ru';

/** Латиница, цифры и . _ - внутри; на краях только буква или цифра. */
const LOGIN_PATTERN = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

/** Служебные имена: чтобы «admin» в списке участников никого не путал. */
const RESERVED_LOGINS = new Set([
  'admin', 'administrator', 'root', 'superadmin', 'moderator',
  'support', 'help', 'info', 'noreply', 'quantumschool', 'rqc',
]);

export function isLoginAuthEnabled(): boolean {
  const flag = import.meta.env.VITE_LOGIN_AUTH_ENABLED;
  if (flag === 'false' || flag === '0') return false;
  return true;
}

export function normalizeLogin(value: string): string {
  return value.trim().toLowerCase();
}

/** Логин → технический адрес для Supabase Auth. */
export function loginToAuthEmail(login: string): string {
  return `${normalizeLogin(login)}@${LOGIN_EMAIL_DOMAIN}`;
}

/** Логин из технического адреса; у аккаунтов Яндекс ID — null. */
export function loginFromAuthEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase();
  if (!value?.endsWith(`@${LOGIN_EMAIL_DOMAIN}`)) return null;
  return value.slice(0, -(LOGIN_EMAIL_DOMAIN.length + 1)) || null;
}

/** Текст ошибки или null, если логин подходит. */
export function validateLogin(value: string): string | null {
  const login = normalizeLogin(value);

  if (!login) return 'Придумайте логин';
  if (login.length < LOGIN_MIN_LENGTH) {
    return `Логин короче ${LOGIN_MIN_LENGTH} символов`;
  }
  if (login.length > LOGIN_MAX_LENGTH) {
    return `Логин длиннее ${LOGIN_MAX_LENGTH} символов`;
  }
  if (!LOGIN_PATTERN.test(login)) {
    return 'Только латинские буквы, цифры и знаки . _ - ; начинаться и заканчиваться буквой или цифрой';
  }
  if (RESERVED_LOGINS.has(login)) return 'Такой логин занят системой — придумайте другой';

  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return 'Придумайте пароль';
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Пароль короче ${PASSWORD_MIN_LENGTH} символов`;
  }
  return null;
}

/** Почта для восстановления необязательна: пустое поле — не ошибка. */
export function validateRecoveryEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Проверьте адрес почты';
  if (email.toLowerCase().endsWith(`@${LOGIN_EMAIL_DOMAIN}`)) {
    return 'Этот домен служебный — укажите настоящую почту или оставьте поле пустым';
  }
  return null;
}

/**
 * Ошибки Supabase Auth на русском. Технические (провайдер выключен,
 * подтверждение почты включено) пишем в консоль — пользователю от них толку
 * нет, а показывать настройки проекта на публичной странице не нужно.
 */
export function translateLoginAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return 'Неверный логин или пароль';
  }
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'Такой логин уже занят — придумайте другой';
  }
  if (lower.includes('password should be at least')) {
    return `Пароль короче ${PASSWORD_MIN_LENGTH} символов`;
  }
  if (lower.includes('weak password') || lower.includes('pwned')) {
    return 'Пароль слишком простой — добавьте символов';
  }
  if (lower.includes('for security purposes') || lower.includes('rate limit') || lower.includes('too many')) {
    return 'Слишком много попыток подряд. Подождите минуту и попробуйте снова';
  }

  if (
    lower.includes('email not confirmed')
    || lower.includes('signups not allowed')
    || lower.includes('email signups are disabled')
    || lower.includes('email logins are disabled')
    || lower.includes('email address') // «invalid email address» = домен не принят проектом
  ) {
    console.error(
      'Регистрация по логину не настроена в Supabase: '
      + 'Authentication → Sign In / Providers → Email должен быть включён, '
      + `а «Confirm email» выключен (адреса @${LOGIN_EMAIL_DOMAIN} технические, письма туда не уходят). `
      + `Ответ Supabase: ${message}`,
    );
    return `Регистрация по логину сейчас недоступна. Войдите через Яндекс ID или напишите на ${SUPPORT_EMAIL}`;
  }

  console.error('Login auth error:', message);
  return `Не удалось выполнить вход. Попробуйте ещё раз или напишите на ${SUPPORT_EMAIL}`;
}
