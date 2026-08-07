/** Vite base path without trailing slash, e.g. "/quantumschool" or "". */
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

/** Public asset from /public (icons, logos, images). */
export function publicAsset(path: string): string {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const encoded = normalized.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  return appHref(`/${encoded}`);
}

export const DASHBOARD_ROUTE = '/dashboard';

export function dashboardPathname(): string {
  return appHref(DASHBOARD_ROUTE);
}

export function oauthDashboardRedirectPath(): string {
  return `${window.location.origin}${dashboardPathname()}`;
}
