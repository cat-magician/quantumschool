import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * Служебная страница /diag: почему у человека не грузится кабинет. Проверяет с
 * этого же сайта и в этом же браузере те запросы, которые делает кабинет, —
 * прямое открытие адреса сервера в браузере проходит не теми путями (без CORS,
 * без проверок «локальной сети»), поэтому само по себе ничего не доказывает.
 * Ни на что не ссылается, ученикам не показывается.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type Result = { ok: boolean; detail: string; ms: number };
type Check = { id: string; title: string; run: () => Promise<string> };

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (error && typeof error === 'object' && 'message' in error) {
    const e = error as { message: string; code?: string; status?: number };
    return [e.code, e.status, e.message].filter(Boolean).join(' · ');
  }
  return String(error);
}

async function permissionState(name: string): Promise<string> {
  try {
    const status = await navigator.permissions.query({ name } as unknown as PermissionDescriptor);
    return `${name}: ${status.state}`;
  } catch {
    return `${name}: не поддерживается`;
  }
}

const CHECKS: Check[] = [
  {
    id: 'no-cors',
    title: 'Сервер данных отвечает сайту (без CORS)',
    run: async () => {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, { mode: 'no-cors', cache: 'no-store' });
      return `ответ получен (${response.type})`;
    },
  },
  {
    id: 'cors-health',
    title: 'Сервер авторизации, запрос как у сайта (CORS + ключ)',
    run: async () => {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: ANON_KEY },
        cache: 'no-store',
      });
      return `HTTP ${response.status}`;
    },
  },
  {
    id: 'cors-rest',
    title: 'База, запрос как у сайта (CORS + ключ + Authorization)',
    run: async () => {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?select=id&limit=1`, {
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
        cache: 'no-store',
      });
      return `HTTP ${response.status}`;
    },
  },
  {
    id: 'session',
    title: 'Сессия входа на этом устройстве',
    run: async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return 'не вошли (это нормально, если вход не выполнялся)';
      const left = Math.round(((session.expires_at ?? 0) * 1000 - Date.now()) / 60000);
      return `есть, ${session.user.email ?? session.user.id}, токен ещё ${left} мин`;
    },
  },
  {
    id: 'profile',
    title: 'Профиль, тем же клиентом, что кабинет',
    run: async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return 'пропущено — нет входа';
      const { error } = await supabase.from('user_profiles').select('id').eq('id', userId).maybeSingle();
      if (error) throw error;
      return 'загружен';
    },
  },
  {
    id: 'control',
    title: 'Чужой сайт с CORS (для сравнения)',
    run: async () => {
      const response = await fetch('https://api.github.com/zen', { cache: 'no-store' });
      return `HTTP ${response.status}`;
    },
  },
  {
    id: 'permissions',
    title: 'Разрешения браузера на локальную сеть',
    run: async () => {
      const states = await Promise.all([
        permissionState('local-network-access'),
        permissionState('local-network'),
        permissionState('loopback-network'),
      ]);
      return states.join('; ');
    },
  },
];

export default function ConnectionDiagnostics() {
  const [results, setResults] = useState<Record<string, Result | 'running'>>({});
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setResults({});
    (async () => {
      for (const check of CHECKS) {
        if (cancelled) return;
        setResults((prev) => ({ ...prev, [check.id]: 'running' }));
        const started = performance.now();
        let result: Result;
        try {
          const detail = await check.run();
          result = { ok: true, detail, ms: Math.round(performance.now() - started) };
        } catch (error) {
          result = { ok: false, detail: describeError(error), ms: Math.round(performance.now() - started) };
        }
        if (cancelled) return;
        setResults((prev) => ({ ...prev, [check.id]: result }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  return (
    <div className="min-h-screen min-h-svh bg-slate-950 text-white px-4 py-6 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold">Проверка связи</h1>
          <button
            type="button"
            onClick={() => setRunId((n) => n + 1)}
            className="inline-flex items-center gap-2 min-h-11 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Ещё раз
          </button>
        </div>

        <ul className="space-y-2">
          {CHECKS.map((check) => {
            const result = results[check.id];
            return (
              <li key={check.id} className="flex items-start gap-3 rounded-xl bg-slate-900/70 border border-white/10 p-3">
                {result === undefined || result === 'running' ? (
                  <Loader2 className={`w-5 h-5 shrink-0 mt-0.5 text-slate-500 ${result ? 'animate-spin' : ''}`} />
                ) : result.ok ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{check.title}</p>
                  {result && result !== 'running' && (
                    <p className="text-xs text-slate-400 mt-0.5 break-words">
                      {result.detail} · {result.ms} мс
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-slate-500 break-words">
          {navigator.userAgent} · {new Date().toISOString()}
        </p>
      </div>
    </div>
  );
}
