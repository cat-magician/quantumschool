import type { UserProfile } from './types';
import { loginFromAuthEmail } from './loginAuthConfig';

export function roleLabel(profile: UserProfile): string {
  if (profile.role === 'superadmin') return 'Суперадмин';
  if (profile.role === 'admin') return 'Преподаватель';
  if (profile.teacher_application) return 'Заявка на преподавателя';
  return profile.is_enrolled ? 'Участник курса' : 'Участник отбора';
}

export function roleBadgeClass(profile: UserProfile): string {
  if (profile.role === 'superadmin') return 'text-violet-300 bg-violet-500/10 border-violet-500/25';
  if (profile.role === 'admin') return 'text-blue-300 bg-blue-500/10 border-blue-500/25';
  if (profile.is_enrolled) return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25';
  return 'text-amber-300 bg-amber-500/10 border-amber-500/25';
}

export function formatProfileDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

export type ProfileEditableFields = {
  display_name: string;
  city: string;
  school: string;
  grade: string;
};

export function profileDisplayName(
  profile: Pick<UserProfile, 'display_name'>,
): string {
  return profile.display_name?.trim() || 'Участник';
}

/**
 * Настоящая почта аккаунта. У входа по логину её нет: адрес в auth.users
 * технический, письма туда не уходят, показывать его нельзя.
 */
export function profileEmail(
  profile: Pick<UserProfile, 'email'> | null | undefined,
  authEmail?: string | null,
): string | null {
  const value = authEmail?.trim() || profile?.email?.trim() || null;
  if (!value || loginFromAuthEmail(value)) return null;
  return value;
}

/** Логин аккаунта; у входа через Яндекс ID — null. */
export function profileLogin(
  profile: Pick<UserProfile, 'email' | 'login'> | null | undefined,
  authEmail?: string | null,
): string | null {
  const stored = profile?.login?.trim();
  if (stored) return stored;
  return loginFromAuthEmail(authEmail ?? profile?.email ?? null);
}

/** Чем подписан аккаунт в списках: почтой Яндекс ID или логином. */
export function profileAccountLabel(
  profile: Pick<UserProfile, 'email' | 'login'> | null | undefined,
  authEmail?: string | null,
): string | null {
  const email = profileEmail(profile, authEmail);
  if (email) return email;

  const login = profileLogin(profile, authEmail);
  return login ? `логин: ${login}` : null;
}

export function profileToEditable(profile: UserProfile): ProfileEditableFields {
  return {
    display_name: profile.display_name ?? '',
    city: profile.city ?? '',
    school: profile.school ?? '',
    grade: profile.grade ?? '',
  };
}

export function canEditApplicationFields(profile: UserProfile): boolean {
  return profile.role === 'student';
}

/** Согласие на обработку ПДн ещё не зафиксировано в профиле (первый вход). */
export function profileNeedsPrivacyConsent(profile: UserProfile | null | undefined): boolean {
  return Boolean(profile && !profile.privacy_consent_at);
}
