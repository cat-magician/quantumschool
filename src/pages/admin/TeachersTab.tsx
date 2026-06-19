import { useEffect, useMemo, useState } from 'react';
import {
  Calendar, GraduationCap, Loader2, UserCheck, UserX,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useAppDialog } from '../../lib/AppDialogContext';
import type { Group, GroupMember, ScheduleEvent, UserProfile } from '../../lib/types';
import { studentInitials } from '../../lib/adminUtils';
import { loadGroupTeachers, loadGroupStaffProfiles } from '../../lib/groupUtils';
import {
  formatEventDateTime,
  isEventUpcoming,
} from '../../lib/scheduleUtils';

type TeacherRow = UserProfile & { email: string | null };

type TeacherCardData = {
  profile: TeacherRow;
  groups: { id: string; name: string; studentCount: number }[];
  pendingGrading: number;
  upcomingEvents: ScheduleEvent[];
  totalEvents: number;
};

export default function TeachersTab() {
  const { user } = useAuth();
  const { confirm } = useAppDialog();
  const [applicants, setApplicants] = useState<TeacherRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherCardData[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const load = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (silent) setRefreshing(true);
    else setInitialLoading(true);

    const [
      applicantsRes,
      teachersRes,
      groupsRes,
      gtRows,
      membersRes,
      submissionsRes,
      eventsRes,
    ] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('*')
        .eq('teacher_application', true)
        .eq('role', 'student')
        .order('created_at', { ascending: false }),
      loadGroupStaffProfiles(supabase),
      supabase.from('groups').select('*').eq('group_type', 'teacher').order('name'),
      loadGroupTeachers(supabase),
      supabase.from('group_members').select('*'),
      supabase.from('homework_submissions').select('user_id, status').eq('status', 'submitted'),
      supabase
        .from('schedule_events')
        .select('*')
        .order('scheduled_at', { ascending: true }),
    ]);

    setApplicants((applicantsRes.data ?? []) as TeacherRow[]);

    const teacherProfiles = teachersRes as TeacherRow[];
    const groups = (groupsRes.data ?? []) as Group[];
    const members = (membersRes.data ?? []) as GroupMember[];
    const submissions = submissionsRes.data ?? [];
    const events = (eventsRes.data ?? []) as ScheduleEvent[];

    const studentsByGroup = members.reduce<Record<string, string[]>>((acc, m) => {
      (acc[m.group_id] ??= []).push(m.user_id);
      return acc;
    }, {});

    const cards: TeacherCardData[] = teacherProfiles.map((profile) => {
      const teacherGroupIds = gtRows
        .filter((gt) => gt.user_id === profile.id)
        .map((gt) => gt.group_id);
      const legacyGroupIds = groups.filter((g) => g.teacher_id === profile.id).map((g) => g.id);
      const allGroupIds = [...new Set([...teacherGroupIds, ...legacyGroupIds])];

      const teacherGroups = allGroupIds
        .map((id) => {
          const group = groups.find((g) => g.id === id);
          if (!group) return null;
          return {
            id: group.id,
            name: group.name,
            studentCount: (studentsByGroup[id] ?? []).length,
          };
        })
        .filter(Boolean) as TeacherCardData['groups'];

      const studentIds = new Set(
        allGroupIds.flatMap((gid) => studentsByGroup[gid] ?? []),
      );

      const pendingGrading = submissions.filter(
        (s) => studentIds.has(s.user_id),
      ).length;

      const teacherEvents = events.filter((e) => e.created_by === profile.id);
      const upcomingEvents = teacherEvents
        .filter((e) => isEventUpcoming(e.scheduled_at))
        .slice(0, 4);

      return {
        profile,
        groups: teacherGroups,
        pendingGrading,
        upcomingEvents,
        totalEvents: teacherEvents.length,
      };
    });

    setTeachers(cards);
    if (silent) setRefreshing(false);
    else setInitialLoading(false);
  };

  useEffect(() => { load(); }, []);

  const pendingApplications = applicants.length;

  const promoteTeacher = async (id: string) => {
    setPromotingId(id);
    await supabase.from('user_profiles').update({
      role: 'admin',
      teacher_application: false,
      teacher_application_rejected: false,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    setPromotingId(null);
    load({ silent: true });
  };

  const rejectTeacher = async (id: string) => {
    const applicant = applicants.find((a) => a.id === id);
    const ok = await confirm({
      title: 'Отклонить заявку?',
      message: applicant
        ? `${applicant.display_name} не получит доступ к кабинету преподавателя. Кандидат увидит отказ при следующем входе.`
        : 'Кандидат увидит отказ при следующем входе.',
      confirmLabel: 'Отклонить',
      danger: true,
    });
    if (!ok) return;

    setRejectingId(id);
    await supabase.from('user_profiles').update({
      teacher_application: false,
      teacher_application_rejected: true,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    setRejectingId(null);
    load({ silent: true });
  };

  const sortedTeachers = useMemo(
    () => [...teachers].sort((a, b) => b.pendingGrading - a.pendingGrading),
    [teachers],
  );

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 max-w-6xl relative transition-opacity duration-200 ${refreshing ? 'opacity-80' : ''}`}>
      {refreshing && (
        <div className="absolute top-0 right-0 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-white/10 text-xs text-slate-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Обновление…
        </div>
      )}
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Преподаватели</h2>
        <p className="text-slate-400 text-sm">
          Мониторинг штата преподавания — в первую очередь работы на проверке.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-amber-400" />
          Заявки преподавателей ({pendingApplications})
        </h3>
        <p className="text-xs text-slate-500 -mt-1">
          Регистрация через{' '}
          <a href="/join/teacher" className="text-blue-400 hover:text-blue-300">/join/teacher</a>
          . После одобрения кандидат появится в штате — назначьте его в группу во вкладке «Ученики».
        </p>

        {pendingApplications === 0 ? (
          <div className="text-center py-8 text-slate-500 bg-slate-900/40 rounded-xl border border-white/5 text-sm">
            Новых заявок нет
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {applicants.map((a) => (
              <div
                key={a.id}
                className="flex flex-col bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5 gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {studentInitials(a.display_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{a.display_name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{a.email}</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500">
                  Подана{' '}
                  {new Intl.DateTimeFormat('ru-RU', {
                    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                  }).format(new Date(a.created_at))}
                </div>
                <div className="flex gap-2 mt-auto">
                  <button
                    type="button"
                    onClick={() => promoteTeacher(a.id)}
                    disabled={promotingId === a.id || rejectingId === a.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {promotingId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                    Одобрить
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectTeacher(a.id)}
                    disabled={promotingId === a.id || rejectingId === a.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-300 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {rejectingId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                    Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Штат преподавания ({sortedTeachers.length})
        </h3>

        {sortedTeachers.length === 0 ? (
          <div className="text-center py-12 text-slate-500 bg-slate-900/40 rounded-2xl border border-white/5">
            Нет преподавателей и суперадминов в системе
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 items-stretch">
            {sortedTeachers.map((t) => (
              <TeacherCard key={t.profile.id} data={t} currentUserId={user?.id} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TeacherCard({ data, currentUserId }: { data: TeacherCardData; currentUserId?: string }) {
  const { profile } = data;
  const isYou = profile.id === currentUserId;
  const nextEvent = data.upcomingEvents[0];
  const needsHelp = data.pendingGrading > 0;

  return (
    <div
      className={`h-full flex flex-col bg-slate-900/60 border rounded-xl p-3.5 gap-2.5 ${
        isYou ? 'border-violet-500/30' : 'border-white/5'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {studentInitials(profile.display_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate leading-tight">
            {profile.display_name}
            {isYou && <span className="text-blue-300 font-normal"> (вы)</span>}
            {profile.role === 'superadmin' && (
              <span className="text-violet-300/90 font-normal text-[10px]"> · суперадмин</span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 truncate">{profile.email}</div>
        </div>
      </div>

      <div className={`rounded-lg border px-3 py-2 ${
        needsHelp
          ? 'bg-amber-500/10 border-amber-500/25'
          : 'bg-white/5 border-white/5'
      }`}
      >
        <div className={`text-lg font-bold tabular-nums leading-none ${
          needsHelp ? 'text-amber-300' : 'text-white'
        }`}
        >
          {data.pendingGrading}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">работ на проверке</div>
      </div>

      <div className="flex-1 flex flex-col gap-2 min-h-[4.5rem]">
        <div className="min-h-[2.25rem]">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Группы</p>
          {data.groups.length === 0 ? (
            <p className="text-xs text-slate-500">Не в группах</p>
          ) : (
            <div className="flex flex-wrap gap-1 max-h-10 overflow-hidden">
              {data.groups.map((g) => (
                <span
                  key={g.id}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-300 truncate max-w-full"
                >
                  {g.name} ({g.studentCount})
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-[2.5rem] mt-auto">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Ближайшее · {data.totalEvents} всего
          </p>
          {!nextEvent ? (
            <p className="text-xs text-slate-500">Нет предстоящих</p>
          ) : (
            <div className="text-xs leading-snug">
              <span className="text-white font-medium truncate block">{nextEvent.title}</span>
              <span className="text-slate-500">{formatEventDateTime(nextEvent.scheduled_at)}</span>
              {data.upcomingEvents.length > 1 && (
                <span className="text-slate-600"> · ещё {data.upcomingEvents.length - 1}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
