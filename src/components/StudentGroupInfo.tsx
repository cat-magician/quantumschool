import { Users } from 'lucide-react';
import UserAvatar from './UserAvatar';
import type { StudentGroupContext } from '../lib/groupUtils';

export default function StudentGroupInfo({ context }: { context: StudentGroupContext }) {
  const teacherLabel = context.teachers.length > 1 ? 'Преподаватели' : 'Преподаватель';

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 px-4 py-3 rounded-2xl bg-slate-900/60 border border-white/5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
          <Users className="w-4 h-4 text-blue-300" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Группа</div>
          <div className="text-sm font-medium text-white truncate">{context.groupName}</div>
        </div>
      </div>

      {context.teachers.length > 0 ? (
        <>
          <div className="hidden sm:block w-px h-9 bg-white/10" />
          <div className="flex items-center gap-3 min-w-0 sm:flex-1">
            <div className="flex -space-x-2 shrink-0">
              {context.teachers.slice(0, 3).map((t) => (
                <UserAvatar
                  key={t.id}
                  displayName={t.display_name}
                  avatarUrl={t.avatar_url}
                  size="xs"
                  className="ring-2 ring-slate-900"
                />
              ))}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{teacherLabel}</div>
              <div className="text-sm text-amber-100 truncate">
                {context.teachers.map((t) => t.display_name).join(', ')}
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-500 sm:ml-1">Преподаватель группы пока не назначен</p>
      )}
    </div>
  );
}
