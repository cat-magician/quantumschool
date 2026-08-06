import type { User } from '@supabase/supabase-js';

/** Имя из профиля Яндекс ID. Порядок полей совпадает с extract_oauth_display_name в schema.sql. */
export function yandexDisplayName(user: User): string | null {
  const meta = user.user_metadata ?? {};
  const candidates = [meta.full_name, meta.name, meta.real_name, meta.display_name];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  const parts = [meta.first_name, meta.last_name]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .map((value) => value.trim());

  return parts.length ? parts.join(' ') : null;
}

export { DASHBOARD_ROUTE as DASHBOARD_PATH, dashboardPathname, oauthDashboardRedirectPath } from './appPaths';
