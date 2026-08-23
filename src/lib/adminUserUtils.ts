import { supabase } from './supabase';

function translateDeleteAccountError(message: string): string {
  if (message.includes('user_not_found')) return 'Пользователь не найден';
  if (message.includes('not_allowed')) return 'Недостаточно прав';
  if (message.includes('cannot_delete_self')) return 'Нельзя удалить свой аккаунт';
  if (message.includes('cannot_delete_staff')) return 'Можно удалять только учеников';
  if (message.includes('cannot_delete_enrolled')) return 'Сначала снимите зачисление';
  return message;
}

export async function superadminDeleteUserAccount(
  targetUserId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('superadmin_delete_user_account', {
    target_user_id: targetUserId,
  });
  if (error) return { error: translateDeleteAccountError(error.message) };
  return { error: null };
}

function translateResetPasswordError(message: string): string {
  if (message.includes('forbidden')) return 'Только суперадмин может выдавать пароли';
  if (message.includes('not_a_login_account')) return 'У аккаунта нет логина — вход только через Яндекс ID';
  if (message.includes('password_too_short')) return 'Пароль короче 8 символов';
  return message;
}

/** Символы без пар-двойников (0/O, 1/l/I): пароль диктуют голосом. */
const PASSWORD_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

export function generatePassword(length = 12): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('');
}

/**
 * Выдать новый пароль аккаунту с логином. Писем в системе нет, поэтому пароль
 * возвращается суперадмину — передать участнику он должен сам.
 */
export async function superadminSetLoginPassword(
  targetUserId: string,
  newPassword: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('superadmin_set_login_password', {
    target_user_id: targetUserId,
    new_password: newPassword,
  });
  if (error) return { error: translateResetPasswordError(error.message) };
  return { error: null };
}
