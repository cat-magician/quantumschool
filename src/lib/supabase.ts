import { createClient, type AuthError } from '@supabase/supabase-js';
import { takeOAuthSessionFromUrl } from './oauthCallbackUtils';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// До создания клиента: адрес с токенами не должен прожить ни мгновения дольше.
const urlSession = takeOAuthSessionFromUrl();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Возврат от Яндекса разбираем сами (urlSession выше), а не
    // detectSessionInUrl: тот оставлял токены в истории и при ошибке в адресе
    // выходил из уже открытой сессии.
    detectSessionInUrl: false,
    // implicit, а не pkce. При PKCE вход через Яндекс завершается только в том
    // браузере, где нажимали «Войти»: там лежит ключ к коду из адреса. На
    // телефоне Яндекс часто возвращает человека в другое место — приложение
    // Яндекса, браузер по умолчанию вместо встроенного в Telegram, — и вход
    // там обрывался. В implicit сессия приходит прямо в адресе, её
    // подхватывает любой браузер.
    flowType: 'implicit',
    persistSession: true,
  },
});

/**
 * Вход по сессии из адреса после Яндекса; null — её в адресе не было.
 * Успех приходит обычным SIGNED_IN, ошибку (токен не приняли, нет связи)
 * AuthContext показывает на экране входа.
 */
export const oauthUrlSession: Promise<{ error: AuthError | null }> | null = urlSession
  ? supabase.auth.setSession(urlSession).then(
    ({ error }) => ({ error }),
    (error: AuthError) => ({ error }),
  )
  : null;
