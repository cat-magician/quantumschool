import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import DashboardSiteHomeLink from './DashboardSiteHomeLink';
import UserAvatar from './UserAvatar';
import { countUnreadNotifications } from '../lib/notificationReadState';
import {
  loadNotificationsForProfile,
  type AppNotification,
  type NotificationAction,
} from '../lib/notificationsUtils';
import type { UserProfile } from '../lib/types';
import { profileDisplayName } from '../lib/profileUtils';
import NotificationsPanel from './NotificationsPanel';

export default function DashboardHeaderActions({
  profile,
  userId,
  onOpenProfile,
  onNotificationNavigate,
}: {
  profile: UserProfile;
  userId: string;
  onOpenProfile?: () => void;
  onNotificationNavigate?: (action: NotificationAction) => void;
}) {
  const [bellOpen, setBellOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Счётчик грузим при открытии кабинета (и при смене профиля) — один раз.
  useEffect(() => {
    let cancelled = false;
    loadNotificationsForProfile(profile, userId).then((items) => {
      if (!cancelled) setUnreadCount(countUnreadNotifications(userId, items));
    });
    return () => {
      cancelled = true;
    };
  }, [profile, userId]);

  // Открытая панель сама загружает свежий список и помечает его прочитанным:
  // счётчик считаем по нему, а не скачиваем всё заново — ни сразу, ни при
  // закрытии панели, как было раньше.
  const recountUnread = useCallback(
    (items: AppNotification[]) => setUnreadCount(countUnreadNotifications(userId, items)),
    [userId],
  );

  return (
    <div className="relative flex items-center gap-2">
      <DashboardSiteHomeLink compact />
      <div>
        <button
          type="button"
          onClick={() => setBellOpen((v) => !v)}
          className="relative flex items-center gap-1 h-9 rounded-xl bg-white/5 hover:bg-white/10 px-2.5 transition-colors"
          aria-label={unreadCount > 0 ? `Уведомления: ${unreadCount} новых` : 'Уведомления'}
        >
          <Bell className="w-4 h-4 text-slate-400 shrink-0" />
          {unreadCount > 0 && (
            <span className="text-xs font-medium text-blue-400 tabular-nums leading-none">
              ({unreadCount})
            </span>
          )}
        </button>
        {bellOpen && (
          <NotificationsPanel
            profile={profile}
            userId={userId}
            onClose={() => setBellOpen(false)}
            onReadStateChange={recountUnread}
            onNavigate={(action) => {
              onNotificationNavigate?.(action);
              setBellOpen(false);
            }}
          />
        )}
      </div>

      {onOpenProfile && (
        <button
          type="button"
          onClick={onOpenProfile}
          className="lg:hidden w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors overflow-hidden p-0"
          aria-label="Профиль"
        >
          <UserAvatar
            displayName={profileDisplayName(profile)}
            avatarUrl={profile.avatar_url}
            size="xs"
            className="w-9 h-9"
          />
        </button>
      )}
    </div>
  );
}
