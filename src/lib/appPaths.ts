/** Vite base path without trailing slash, e.g. "/quantumschool1" or "". */
export function appBasePath(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, '');
}

/** BrowserRouter basename (empty string = site root). */
export function routerBasename(): string {
  return appBasePath();
}

/** Absolute in-app path for plain <a href> (React Router Link/to uses routes without base). */
export function appHref(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const base = appBasePath();
  return base ? `${base}${normalized}` : normalized;
}

export const DASHBOARD_ROUTE = '/dashboard';

export function dashboardPathname(): string {
  return appHref(DASHBOARD_ROUTE);
}

export function oauthDashboardRedirectPath(): string {
  return `${window.location.origin}${dashboardPathname()}`;
}
