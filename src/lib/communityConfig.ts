import { supabase } from './supabase';
import type { CommunityConfig } from './types';

export const DEFAULT_COMMUNITY_CONFIG: CommunityConfig = {
  id: 1,
  telegram_invite_url: '',
  telegram_invite_message:
    'Присоединяйтесь к Telegram-каналу кружка — там объявления, напоминания и общение с участниками.',
  updated_at: null,
  updated_by: null,
};

/** Нормализует ссылку-приглашение t.me / telegram.me. */
export function normalizeTelegramInviteUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    let candidate = trimmed;
    if (!/^https?:\/\//i.test(candidate)) {
      if (/^(t\.me|telegram\.me)\//i.test(candidate)) {
        candidate = `https://${candidate}`;
      } else {
        return null;
      }
    }

    const url = new URL(candidate);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host !== 't.me' && host !== 'telegram.me') return null;

    return url.toString();
  } catch {
    return null;
  }
}

export async function fetchCommunityConfig(): Promise<CommunityConfig> {
  const { data, error } = await supabase
    .from('community_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) return DEFAULT_COMMUNITY_CONFIG;
  return data as CommunityConfig;
}

export async function saveCommunityConfig(
  patch: Pick<CommunityConfig, 'telegram_invite_url' | 'telegram_invite_message'>,
  userId: string,
) {
  const url = patch.telegram_invite_url.trim();
  const normalizedUrl = url ? normalizeTelegramInviteUrl(url) : '';
  if (url && !normalizedUrl) {
    return { data: null, error: { message: 'Укажите ссылку вида https://t.me/… или t.me/…' } };
  }

  return supabase.from('community_config').upsert({
    id: 1,
    telegram_invite_url: normalizedUrl ?? '',
    telegram_invite_message: patch.telegram_invite_message.trim(),
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });
}

export function isCommunityTelegramVisible(config: CommunityConfig): boolean {
  return !!config.telegram_invite_url.trim();
}
