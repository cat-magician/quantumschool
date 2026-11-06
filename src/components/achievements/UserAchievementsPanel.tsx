import { ArrowRight, Loader2, Medal, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserAchievements, type UserAchievement } from '../../hooks/useUserAchievements';
import AchievementImage from './AchievementImage';

const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

function achievementDate(iso: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date);
}

/** На главной — последние награды, в профиле — полная личная коллекция. */
export default function UserAchievementsPanel({
  userId,
  compact = false,
}: {
  userId: string | undefined;
  compact?: boolean;
}) {
  const { items, loading, error, refresh } = useUserAchievements(userId);
  return <UserAchievementsContent items={items} loading={loading} error={error} refresh={refresh} compact={compact} />;
}

/** Общий вид коллекции: также используется в стенде без входа и базы. */
export function UserAchievementsContent({
  items,
  loading = false,
  error = false,
  refresh,
  compact = false,
}: {
  items: UserAchievement[];
  loading?: boolean;
  error?: boolean;
  refresh?: () => void;
  compact?: boolean;
}) {
  const visible = compact ? items.slice(0, 3) : items;

  return (
    <section id={compact ? undefined : 'achievements'} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Medal className="h-4 w-4 text-violet-300" aria-hidden />
          Мои достижения
          {items.length > 0 && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs tabular-nums text-violet-200">{items.length}</span>}
        </h2>
        {compact && (
          <Link to="/profile" className="inline-flex min-h-9 items-center gap-1 text-xs text-blue-300 transition-colors hover:text-blue-200">
            Все в профиле
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>

      {loading && items.length === 0 ? (
        <p role="status" className="flex items-center gap-2 py-3 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Загружаем достижения…
        </p>
      ) : items.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center">
          <p className="text-sm text-slate-300">Пока нет достижений</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">Здесь появятся ваши персональные награды.</p>
        </div>
      ) : visible.length > 0 ? (
        <ul className={compact ? 'space-y-2' : 'grid grid-cols-1 gap-3 sm:grid-cols-2'}>
          {visible.map((item) => {
            const date = achievementDate(item.earnedAt);
            return (
              <li key={item.id} className={`min-w-0 rounded-xl border border-white/5 bg-slate-950/40 ${compact ? 'flex items-start gap-3 p-3' : 'p-4'}`}>
                <div className={`flex shrink-0 items-center justify-center rounded-xl bg-violet-500/5 ${compact ? 'h-14 w-14 p-1' : 'mb-3 h-20 w-20 p-1.5'}`}>
                  <AchievementImage code={item.code} imageSrc={item.imageSrc} className="h-full w-full" />
                </div>
                <div className="min-w-0">
                  <h3 className="break-words text-sm font-semibold leading-snug text-white">{item.title}</h3>
                  {item.description && <p className={`mt-1 break-words text-xs leading-relaxed text-slate-400 ${compact ? 'line-clamp-2' : ''}`}>{item.description}</p>}
                  {date && <time dateTime={item.earnedAt} className="mt-2 block text-[11px] text-slate-500">Получено {date}</time>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {error && (
        <div role="status" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <p>{items.length > 0 ? 'Не удалось обновить достижения.' : 'Не удалось загрузить достижения.'}</p>
          {refresh && (
            <button type="button" onClick={refresh} className="inline-flex min-h-9 items-center gap-1.5 text-blue-300 transition-colors hover:text-blue-200">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Повторить
            </button>
          )}
        </div>
      )}
    </section>
  );
}
