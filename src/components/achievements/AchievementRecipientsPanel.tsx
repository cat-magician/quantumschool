import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Users } from 'lucide-react';
import { loadAchievementRecipients, type AchievementRecipient } from '../../lib/achievementApi';
import type { AchievementDefinition, UserRole } from '../../lib/types';
import { profileAccountLabel, profileDisplayName } from '../../lib/profileUtils';
import UserAvatar from '../UserAvatar';

const PAGE_SIZE = 50;
const ROLE_LABELS: Record<UserRole, string> = { student: 'Ученик', admin: 'Админ', superadmin: 'Суперадмин' };
const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'Europe/Moscow',
});

type Result = {
  key: string;
  items: AchievementRecipient[];
  total: number;
  loading: boolean;
  error: boolean;
};

function earnedDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Дата не указана' : `${dateFormat.format(date)} мск`;
}

export default function AchievementRecipientsPanel({
  definition,
  refreshKey = 0,
}: {
  definition: AchievementDefinition;
  refreshKey?: number;
}) {
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Result>({ key: '', items: [], total: 0, loading: true, error: false });
  const key = `${definition.code}:${refreshKey}:${page}:${retry}`;

  useEffect(() => { setPage(0); }, [definition.code, refreshKey]);

  useEffect(() => {
    let active = true;
    setResult({ key, items: [], total: 0, loading: true, error: false });
    void loadAchievementRecipients(definition.code, { offset: page * PAGE_SIZE, pageSize: PAGE_SIZE })
      .then(({ items, total }) => {
        if (!active) return;
        // При обновлении список мог сократиться; возвращаемся на существующую страницу.
        if (page > 0 && page * PAGE_SIZE >= total) {
          setPage(Math.max(0, Math.ceil(total / PAGE_SIZE) - 1));
          return;
        }
        setResult({ key, items, total, loading: false, error: false });
      })
      .catch(() => {
        if (active) setResult({ key, items: [], total: 0, loading: false, error: true });
      });
    return () => { active = false; };
  }, [definition.code, key, page]);

  const current = result.key === key ? result : { items: [], total: 0, loading: true, error: false };
  const start = page * PAGE_SIZE + 1;
  const end = page * PAGE_SIZE + current.items.length;

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/50 p-5 sm:p-6" aria-labelledby="achievement-recipients-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="achievement-recipients-heading" className="flex items-center gap-2 font-semibold text-white">
            <Users className="h-4 w-4 text-violet-300" aria-hidden />
            Получатели награды
            {!current.loading && !current.error && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs tabular-nums text-violet-200">{current.total}</span>}
          </h3>
          <p className="mt-1 text-xs text-slate-500">{definition.title}</p>
        </div>
        <button type="button" onClick={() => setRetry((value) => value + 1)} disabled={current.loading} className="inline-flex min-h-9 items-center gap-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-50">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />Обновить получателей
        </button>
      </div>

      {current.loading ? (
        <p role="status" className="flex items-center gap-2 py-5 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Загружаем получателей…</p>
      ) : current.error ? (
        <div role="status" className="rounded-xl border border-rose-400/15 bg-rose-400/5 p-4 text-sm text-slate-300">Не удалось загрузить получателей. Нажмите «Обновить получателей», чтобы попробовать снова.</div>
      ) : current.total === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-400">Эта награда пока никому не выдана.</p>
      ) : (
        <>
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {current.items.map(({ id, userId, earnedAt, profile }) => {
              const name = profile ? profileDisplayName(profile) : 'Участник недоступен';
              const account = profile ? profileAccountLabel(profile) : null;
              return (
                <li key={id} className="flex min-w-0 items-start gap-3 rounded-xl bg-slate-950/50 p-3">
                  <UserAvatar userId={userId} displayName={name} avatarUrl={profile?.avatar_url} size="chip" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="break-words text-sm font-medium text-white">{name}</span>
                      {profile && <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{ROLE_LABELS[profile.role]}</span>}
                    </div>
                    {account && <p className="mt-0.5 break-all text-xs text-slate-500">{account}</p>}
                    <time dateTime={earnedAt} className="mt-1 block text-[11px] text-slate-500">Выдано {earnedDate(earnedAt)}</time>
                  </div>
                </li>
              );
            })}
          </ul>
          {current.total > PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs tabular-nums text-slate-500">{start}–{end} из {current.total}</p>
              <div className="flex gap-2">
                <button type="button" aria-label="Предыдущие получатели" disabled={page === 0} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" aria-label="Следующие получатели" disabled={end >= current.total} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/5 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
