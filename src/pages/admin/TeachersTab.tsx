import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar, GraduationCap, Loader2, UserCheck, UserX,
} from 'lucide-react';
import SectionHint from '../../components/SectionHint';
import { SECTION_HINT } from '../../lib/dashboardHelpCopy';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import { useAppDialog } from '../../lib/AppDialogContext';
import type { Group, GroupMember, ScheduleEvent, UserProfile } from '../../lib/types';
import UserAvatar from '../../components/UserAvatar';
import { profileEmail } from '../../lib/profileUtils';
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
  const [excludingId, setExcludingId] = useState<string | null>(null);

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
        .filter((e) => isEventUpcoming(e.scheduled_at, e.duration_minutes))
        .slice(0, 4);

      return {
        profile,
        groups: teacherGroups,
        pendingGrading,
        upcomingEvents,
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

  const excludeTeacher = async (id: string) => {
    const teacher = teachers.find((t) => t.profile.id === id);
    if (!teacher || teacher.profile.role !== 'admin') return;

    const ok = await confirm({
      title: 'Исключить преподавателя?',
      message: `${teacher.profile.display_name} потеряет доступ к кабинету преподавателя и будет снят со всех групп. При входе откроется ученический кабинет.`,
      confirmLabel: 'Исключить',
      danger: true,
    });
    if (!ok) return;

    setExcludingId(id);
    await Promise.all([
      supabase.from('group_teachers').delete().eq('user_id', id),
      supabase.from('groups').update({ teacher_id: null }).eq('teacher_id', id),
      supabase.from('user_profiles').update({
        role: 'student',
        teacher_application: false,
        teacher_application_rejected: false,
        updated_at: new Date().toISOString(),
      }).eq('id', id),
    ]);
    setExcludingId(null);
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
        <SectionHint text={SECTION_HINT.admin.teachers} className="mt-1.5" />
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
                  <UserAvatar displayName={a.display_name} avatarUrl={a.avatar_url} size="xs" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{a.display_name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{profileEmail(a) ?? '—'}</div>
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sortedTeachers.map((t) => (
              <TeacherCard
                key={t.profile.id}
                data={t}
                currentUserId={user?.id}
                onExclude={excludeTeacher}
                excluding={excludingId === t.profile.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TeacherCard({
  data,
  currentUserId,
  onExclude,
  excluding = false,
}: {
  data: TeacherCardData;
  currentUserId?: string;
  onExclude: (id: string) => void;
  excluding?: boolean;
}) {
  const { profile } = data;
  const isYou = profile.id === currentUserId;
  const nextEvent = data.upcomingEvents[0];
  const needsHelp = data.pendingGrading > 0;
  const canExclude = profile.role === 'admin' && !isYou;

  return (
    <div
      className={`h-[13.875rem] flex flex-col p-3 gap-2 bg-slate-900/60 border rounded-xl ${
        isYou ? 'border-violet-500/30' : 'border-white/5'
      }`}
    >
      <div className="h-10 shrink-0 flex items-center gap-2 min-w-0">
        <UserAvatar displayName={profile.display_name} avatarUrl={profile.avatar_url} size="xs" />
        <div className="flex-1 min-w-0 h-full flex flex-col justify-center gap-0.5">
          <TeacherCardName
            displayName={profile.display_name}
            isYou={isYou}
            isSuperadmin={profile.role === 'superadmin'}
          />
          <div className="h-3.5 text-[11px] text-slate-500 truncate leading-none">{profileEmail(profile) ?? '—'}</div>
        </div>
        {canExclude && (
          <button
            type="button"
            onClick={() => onExclude(profile.id)}
            disabled={excluding}
            title="Исключить из штата"
            className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors disabled:opacity-50"
          >
            {excluding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      <div
        className={`h-11 shrink-0 rounded-lg border px-3 flex flex-col justify-center ${
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
        <div className="text-[10px] text-slate-500 mt-0.5 leading-none">работ на проверке</div>
      </div>

      <div className="shrink-0">
        <TeacherCardSectionLabel>Группы</TeacherCardSectionLabel>
        <div className="mt-1 h-6">
          {data.groups.length === 0 ? (
            <p className="text-xs text-slate-500 h-full flex items-center leading-none">Не в группах</p>
          ) : (
            <TeacherGroupsBadges groups={data.groups} />
          )}
        </div>
      </div>

      <div className="shrink-0 flex-1 min-h-0 flex flex-col">
        <TeacherCardSectionLabel icon={Calendar}>Ближайшее</TeacherCardSectionLabel>
        {!nextEvent ? (
          <p className="mt-1 text-xs text-slate-500 leading-4">Нет предстоящих</p>
        ) : (
          <div className="mt-1 space-y-0.5">
            <p className="text-xs text-white font-medium truncate leading-4">{nextEvent.title}</p>
            <p className="text-xs text-slate-500 truncate leading-4">
              {formatEventDateTime(nextEvent.scheduled_at)}
              {data.upcomingEvents.length > 1 && (
                <span className="text-slate-600"> · ещё {data.upcomingEvents.length - 1}</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TeacherCardSectionLabel({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon?: typeof Calendar;
}) {
  return (
    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider leading-none flex items-center gap-1">
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      {children}
    </p>
  );
}

function TeacherCardName({
  displayName,
  isYou,
  isSuperadmin,
}: {
  displayName: string;
  isYou: boolean;
  isSuperadmin: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const fit = () => {
      const maxSize = 14;
      const minSize = 10;
      let size = maxSize;
      text.style.fontSize = `${size}px`;

      while (text.scrollWidth > container.clientWidth && size > minSize) {
        size -= 0.5;
        text.style.fontSize = `${size}px`;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [displayName, isYou, isSuperadmin]);

  return (
    <div ref={containerRef} className="h-4 min-w-0 overflow-hidden flex items-center">
      <span ref={textRef} className="font-semibold text-white whitespace-nowrap leading-none text-sm">
        {displayName}
        {isYou && <span className="text-blue-300 font-normal"> (вы)</span>}
        {isSuperadmin && (
          <span className="text-violet-300/90 font-normal text-[10px]"> · суперадмин</span>
        )}
      </span>
    </div>
  );
}

type GroupBadge = { id: string; name: string; studentCount: number };

const groupBadgeClass =
  'inline-flex w-fit max-w-full shrink-0 items-center text-[10px] leading-tight px-1.5 py-0.5 rounded-md truncate';

const groupsRowClass = 'flex flex-nowrap items-center gap-1 overflow-x-hidden';

function TeacherGroupsBadges({ groups }: { groups: GroupBadge[] }) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(groups.length);
  const [showMore, setShowMore] = useState(false);

  useLayoutEffect(() => {
    const measure = measureRef.current;
    if (!measure) return;

    const run = () => {
      const badges = measure.querySelectorAll<HTMLElement>('[data-group-badge]');
      if (badges.length === 0) {
        setVisibleCount(0);
        return;
      }

      const fitCount = (reserveLink: boolean) => {
        measure.classList.toggle('pr-14', reserveLink);
        const maxRight = measure.clientWidth;
        let fit = badges.length;
        for (let i = 0; i < badges.length; i += 1) {
          const badge = badges[i];
          if (badge.offsetLeft + badge.offsetWidth > maxRight + 0.5) {
            fit = i;
            break;
          }
        }
        return fit;
      };

      let fit = fitCount(false);
      if (fit < badges.length) {
        fit = fitCount(true);
        setVisibleCount(Math.max(fit, 1));
        return;
      }

      measure.classList.remove('pr-14');
      setVisibleCount(badges.length);
    };

    run();
    const observer = new ResizeObserver(run);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [groups]);

  useEffect(() => {
    if (!showMore) return;
    const close = (event: MouseEvent) => {
      if (!(event.target as Element).closest('[data-groups-more]')) {
        setShowMore(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showMore]);

  const hiddenCount = Math.max(groups.length - visibleCount, 0);
  const hiddenGroups = groups.slice(visibleCount);

  return (
    <div className="relative h-full" data-groups-more>
      <div
        ref={measureRef}
        aria-hidden
        className={`absolute inset-x-0 top-0 ${groupsRowClass} invisible pointer-events-none`}
      >
        {groups.map((group) => (
          <span
            key={group.id}
            data-group-badge
            className={`${groupBadgeClass} border border-transparent`}
          >
            {group.name} ({group.studentCount})
          </span>
        ))}
      </div>

      <div className={`${groupsRowClass} h-full ${hiddenCount > 0 ? 'pr-14' : ''}`}>
        {groups.slice(0, visibleCount).map((group) => (
          <span
            key={group.id}
            className={`${groupBadgeClass} bg-blue-500/10 border border-blue-500/20 text-blue-300`}
          >
            {group.name} ({group.studentCount})
          </span>
        ))}
      </div>

      {hiddenCount > 0 && (
        <>
          <button
            type="button"
            data-groups-more
            onClick={() => setShowMore((open) => !open)}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-[10px] text-blue-400 hover:text-blue-300 whitespace-nowrap"
          >
            и ещё {hiddenCount}
          </button>
          {showMore && (
            <div
              data-groups-more
              className="absolute right-0 top-full mt-1 z-20 min-w-[10rem] max-w-[min(14rem,calc(100vw-2rem))] bg-slate-800 border border-white/10 rounded-xl p-2.5 shadow-xl"
            >
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Остальные группы
              </p>
              <div className="flex flex-wrap gap-1">
                {hiddenGroups.map((group) => (
                  <span
                    key={group.id}
                    className={`${groupBadgeClass} bg-blue-500/10 border border-blue-500/20 text-blue-300`}
                  >
                    {group.name} ({group.studentCount})
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
