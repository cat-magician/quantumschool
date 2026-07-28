/**
 * Прокси userinfo для Supabase Custom Provider (Яндекс).
 *
 * Зачем: Supabase Auth требует в ответе userinfo поле `sub`, а Яндекс отдаёт `id`
 * (см. supabase/auth#2519 — вход падает с «missing provider id»). Заодно Supabase
 * ищет `email`, а Яндекс кладёт адрес в `default_email`.
 *
 * Деплой из Dashboard: Edge Functions → Deploy a new function → вставить этот файл,
 * ОБЯЗАТЕЛЬНО выключить «Verify JWT» (Supabase зовёт функцию с токеном Яндекса,
 * а не со своим JWT). Через CLI это `--no-verify-jwt`.
 *
 * Затем в провайдере custom:yandex заменить UserInfo URL на
 *   https://<PROJECT_REF>.supabase.co/functions/v1/yandex-userinfo
 */

const YANDEX_INFO_URL = "https://login.yandex.ru/info?format=json";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Яндекс исторически ждёт схему OAuth, но принимает и Bearer — пробуем как пришло, потом OAuth. */
async function fetchYandexProfile(authorization: string): Promise<Response> {
  const first = await fetch(YANDEX_INFO_URL, { headers: { Authorization: authorization } });
  if (first.status !== 401 && first.status !== 403) return first;

  const token = authorization.replace(/^(Bearer|OAuth)\s+/i, "");
  return fetch(YANDEX_INFO_URL, { headers: { Authorization: `OAuth ${token}` } });
}

Deno.serve(async (req) => {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "missing_authorization" }, 401);

  const res = await fetchYandexProfile(authorization);
  const rawText = await res.text();

  if (!res.ok) {
    return new Response(rawText, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  let profile: Record<string, unknown>;
  try {
    profile = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_yandex_response" }, 502);
  }

  const id = str(profile.id) ?? str(profile.psuid) ?? str(profile.uid);
  if (!id) {
    return json({ error: "yandex_profile_without_id", profile }, 502);
  }

  const emails = profile.emails;
  const email = str(profile.default_email)
    ?? (Array.isArray(emails) ? str(emails[0]) : null)
    ?? str(profile.email);

  const login = str(profile.login);

  return json({
    ...profile,
    sub: id,
    email,
    email_verified: Boolean(email),
    preferred_username: login,
    name: str(profile.real_name) ?? str(profile.display_name) ?? login,
    given_name: str(profile.first_name),
    family_name: str(profile.last_name),
  });
});
