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
