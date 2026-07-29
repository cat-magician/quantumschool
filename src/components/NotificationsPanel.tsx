import { useEffect, useRef, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import {
  countUnreadNotifications,
  isNotificationRead,
  markNotificationsRead,
} from '../lib/notificationReadState';
import { loadNotificationsForProfile, type AppNotification, type NotificationAction } from '../lib/notificationsUtils';
import type { UserProfile } from '../lib/types';

function NotificationRow({
  item,
  wasNew,
  onAction,
}: {
  item: AppNotification;
  wasNew: boolean;
  onAction?: (action: NotificationAction) => void;
}) {
  const clickable = !!(item.action && onAction);
  const inner = (
    <>
      <div className="flex items-start gap-2">
        {wasNew && (
          <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${wasNew ? 'text-white' : 'text-slate-300'}`}>
            {item.title}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{item.body}</p>
          <p className="text-[10px] text-slate-600 mt-1.5">
            {new Intl.DateTimeFormat('ru-RU', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date(item.createdAt))}
          </p>
        </div>
      </div>
    </>
  );

  if (!clickable) {
    return (
      <li
        className={`px-4 py-3 border-l-2 ${
          wasNew
            ? 'bg-blue-500/8 border-blue-500'
            : 'border-transparent opacity-80'
        }`}
      >
        {inner}
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onAction!(item.action!)}
        className={`w-full text-left px-4 py-3 border-l-2 transition-colors hover:bg-white/5 ${
          wasNew
            ? 'bg-blue-500/8 border-blue-500'
            : 'border-transparent opacity-80'
        }`}
      >
        {inner}
      </button>
    </li>
  );
}

export default function NotificationsPanel({
  profile,
  userId,
  onClose,
  onReadStateChange,
  onNavigate,
}: {
  profile: UserProfile;
  userId: string;
  onClose: () => void;
  onReadStateChange?: () => void;
  onNavigate?: (action: NotificationAction) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const markedOnOpenRef = useRef(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [wasNewIds, setWasNewIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    markedOnOpenRef.current = false;
    setWasNewIds(new Set());
    loadNotificationsForProfile(profile, userId)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile, userId]);

  useEffect(() => {
    if (loading || !items.length || markedOnOpenRef.current) return;
    markedOnOpenRef.current = true;

    const newIds = items.filter((item) => !isNotificationRead(userId, item.id)).map((item) => item.id);
    setWasNewIds(new Set(newIds));

    if (newIds.length) {
      markNotificationsRead(userId, items.map((item) => item.id));
      onReadStateChange?.();
    }
  }, [loading, items, userId, onReadStateChange]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  const unreadCount = countUnreadNotifications(userId, items);
  const newInThisSession = wasNewIds.size;
  const sorted = [...items].sort((a, b) => {
    const aNew = wasNewIds.has(a.id);
    const bNew = wasNewIds.has(b.id);
    if (aNew !== bNew) return aNew ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-slate-900 border border-white/10 shadow-2xl shadow-black/40 overflow-hidden z-50"
    >
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-sm font-semibold text-white">Уведомления</p>
        {!loading && newInThisSession > 0 && (
          <p className="text-[11px] text-blue-400 mt-0.5">
            {newInThisSession} новых — уже прочитаны
          </p>
        )}
        {!loading && items.length > 0 && newInThisSession === 0 && unreadCount === 0 && (
          <p className="text-[11px] text-slate-500 mt-0.5">Все прочитаны</p>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto scrollbar-site">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Уведомлений пока нет</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {sorted.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                wasNew={wasNewIds.has(item.id)}
                onAction={onNavigate}
              />
            ))}
          </ul>
        )}
      </div>

      {!loading && items.length > 0 && (
        <p className="px-4 py-2.5 text-[10px] text-slate-500 border-t border-white/5 leading-relaxed">
          Синяя точка на колокольчике — есть новые. Откройте список — они сразу считаются прочитанными.
        </p>
      )}
    </div>
  );
}
