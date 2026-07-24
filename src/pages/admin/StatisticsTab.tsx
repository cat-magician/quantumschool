import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, BarChart3, ChevronDown, Filter, Loader2, Search, TrendingUp, Users, X,
} from 'lucide-react';
import { FormSelect } from '../../components/FormControls';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import UserAvatar from '../../components/UserAvatar';
import {
  buildGroupsWithDetails,
  groupsForTeacher,
  loadGroupTeachers,
  type GroupWithDetails,
  type StudentRow,
} from '../../lib/groupUtils';
import {
  aggregateSnapshots,
  breakdownByGrade,
  breakdownByGroup,
  filterSnapshots,
  formatAchievementsProgress,
  formatRankMetricValue,
  groupAverageProgress,
  HOMEWORK_STATUS_COLORS,
  HOMEWORK_STATUS_LABELS,
  RANK_METRIC_OPTIONS,
  rankStudents,
  sortGradeLabels,
  type RankMetric,
  type StudentProgressSnapshot,
  buildStudentProgressSnapshot,
} from '../../lib/progressUtils';
import { formatHomeworkScoreShort, formatHomeworkScoreValue } from '../../lib/homeworkUtils';
import AchievementBadgeStrip from '../../components/achievements/AchievementBadgeStrip';
import type { Achievement, CourseProgress, Group, GroupMember, HomeworkPage, HomeworkPageSubmission, UserProfile } from '../../lib/types';

const STATS_AUTO_REFRESH_MS = 60_000;

export default function StatisticsTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshots, setSnapshots] = useState<StudentProgressSnapshot[]>([]);
  const [groups, setGroups] = useState<GroupWithDetails[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [rankMetric, setRankMetric] = useState<RankMetric>('avg_score');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [teacherGroupId, setTeacherGroupId] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const load = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!user) return;
    if (silent) setRefreshing(true);
    else setLoading(true);

    const [enrolledRes, pagesRes, subsRes, progressRes, achievementsRes, groupsRes, membersRes, gtRows] =
      await Promise.all([
        supabase.from('user_profiles').select('*').eq('role', 'student').eq('is_enrolled', true).order('display_name'),
        supabase.from('homework_pages').select('id, title, due_at, max_score').eq('is_published', true).order('due_at'),
        supabase.from('homework_page_submissions').select('*'),
        supabase.from('course_progress').select('*'),
        supabase.from('achievements').select('*'),
        supabase.from('groups').select('*').eq('group_type', 'teacher').order('name'),
        supabase.from('group_members').select('*'),
        loadGroupTeachers(supabase),
      ]);

    const enrolled = (enrolledRes.data ?? []) as UserProfile[];
    const publishedPages = (pagesRes.data ?? []) as Pick<HomeworkPage, 'id' | 'title' | 'due_at' | 'max_score'>[];
    const submissions = (subsRes.data ?? []) as HomeworkPageSubmission[];
    const modules = (progressRes.data ?? []) as CourseProgress[];
    const achievements = (achievementsRes.data ?? []) as Achievement[];
    const rawGroups = (groupsRes.data ?? []) as Group[];
    const members = (membersRes.data ?? []) as GroupMember[];

    const profileMap = Object.fromEntries(enrolled.map((s) => [s.id, s as StudentRow]));
    const visibleGroups = isSuperAdmin ? rawGroups : groupsForTeacher(rawGroups, gtRows, user.id);
    const groupDetails = buildGroupsWithDetails(visibleGroups, gtRows, members, profileMap);
    const memberGroup = new Map(members.map((m) => [m.user_id, m.group_id]));
    const groupNameById = Object.fromEntries(rawGroups.map((g) => [g.id, g.name]));

    const studentIds = isSuperAdmin
      ? enrolled.map((s) => s.id)
      : [...new Set(members.filter((m) => visibleGroups.some((g) => g.id === m.group_id)).map((m) => m.user_id))];

    const snaps = studentIds
      .map((id) => {
        const student = profileMap[id];
        if (!student) return null;
        const gid = memberGroup.get(id) ?? null;
        return buildStudentProgressSnapshot(
          student,
          publishedPages,
          submissions,
          modules,
          achievements,
          gid,
          gid ? groupNameById[gid] ?? null : null,
        );
      })
      .filter(Boolean) as StudentProgressSnapshot[];

    setAllGroups(rawGroups);
    setGroups(groupDetails);
    setSnapshots(snaps);
    if (!isSuperAdmin && visibleGroups.length > 0) {
      setTeacherGroupId((prev) =>
        (prev && visibleGroups.some((g) => g.id === prev) ? prev : visibleGroups[0].id),
      );
    }

    if (silent) setRefreshing(false);
    else setLoading(false);
  };

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => { load(); }, [isSuperAdmin, user?.id]);

  useEffect(() => {
    if (!user) return;
    const refresh = () => loadRef.current({ silent: true });
    const intervalId = window.setInterval(refresh, STATS_AUTO_REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user?.id, isSuperAdmin]);

  const gradeOptions = useMemo(() => {
    const labels = new Set(snapshots.map((s) => s.gradeLabel));
    return sortGradeLabels([...labels]);
  }, [snapshots]);

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of snapshots) {
      const key = s.groupId ?? 'none';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [snapshots]);

  const gradeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of snapshots) {
      counts.set(s.gradeLabel, (counts.get(s.gradeLabel) ?? 0) + 1);
    }
    return counts;
  }, [snapshots]);

  useEffect(() => {
    if (groupFilter !== 'all' && groupFilter !== 'none' && !allGroups.some((g) => g.id === groupFilter)) {
      setGroupFilter('all');
    }
    if (gradeFilter !== 'all' && !gradeOptions.includes(gradeFilter)) {
      setGradeFilter('all');
    }
  }, [allGroups, gradeOptions, groupFilter, gradeFilter]);

  const filteredSnapshots = useMemo(
    () => filterSnapshots(snapshots, groupFilter, gradeFilter),
    [snapshots, groupFilter, gradeFilter],
  );

  const ranked = useMemo(() => rankStudents(filteredSnapshots, rankMetric), [filteredSnapshots, rankMetric]);

  const displayedStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q)
        || (s.email?.toLowerCase().includes(q) ?? false),
    );
  }, [ranked, searchQuery]);

  const summary = useMemo(() => aggregateSnapshots(filteredSnapshots), [filteredSnapshots]);
  const gradedInSlice = useMemo(
    () => filteredSnapshots.filter((s) => s.avgScore !== null).length,
    [filteredSnapshots],
  );
  const gradeBreakdown = useMemo(() => breakdownByGrade(snapshots), [snapshots]);
  const groupBreakdown = useMemo(() => breakdownByGroup(snapshots), [snapshots]);

  const teacherGroupsData = useMemo(() => {
    return groups.map((g) => {
      const memberIds = new Set(g.members.map((m) => m.user_id));
      const groupSnaps = snapshots.filter((s) => memberIds.has(s.userId));
      const avgProgress = groupAverageProgress(groupSnaps);
      return { group: g, snapshots: groupSnaps, avgProgress };
    });
  }, [groups, snapshots]);

  const activeTeacherGroup = useMemo(
    () => teacherGroupsData.find((g) => g.group.id === teacherGroupId),
    [teacherGroupsData, teacherGroupId],
  );

  const filterActive = groupFilter !== 'all' || gradeFilter !== 'all';

  const resetFilters = () => {
    setGroupFilter('all');
    setGradeFilter('all');
    setSearchQuery('');
    setExpandedId(null);
  };

  const activeMetricLabel = RANK_METRIC_OPTIONS.find((o) => o.id === rankMetric)?.label ?? '';

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (isSuperAdmin) {
    return (
      <div className={`space-y-5 max-w-6xl relative ${refreshing ? 'opacity-80' : ''}`}>
        {refreshing && <RefreshingBadge />}
        <Header
          title="Статистика"
          description="Срезы по группам и классам. Данные обновляются автоматически каждую минуту."
        />

        <section className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Filter className="w-4 h-4 text-blue-400" />
              Срез данных
            </div>
            {filterActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Сбросить фильтры
              </button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <FilterSelect
              label="Группа"
              value={groupFilter}
              onChange={(v) => { setGroupFilter(v); setExpandedId(null); }}
              options={[
                { value: 'all', label: `Все группы (${snapshots.length})` },
                { value: 'none', label: `Без группы (${groupCounts.get('none') ?? 0})` },
                ...allGroups.map((g) => ({
                  value: g.id,
                  label: `${g.name} (${groupCounts.get(g.id) ?? 0})`,
                })),
              ]}
            />
            <FilterSelect
              label="Класс"
              value={gradeFilter}
              onChange={(v) => { setGradeFilter(v); setExpandedId(null); }}
              options={[
                { value: 'all', label: `Все классы (${snapshots.length})` },
                ...gradeOptions.map((label) => ({
                  value: label,
                  label: `${label} (${gradeCounts.get(label) ?? 0})`,
                })),
              ]}
            />
          </div>
          <p className="text-xs text-slate-500">
            {filterActive
              ? `Показано ${filteredSnapshots.length} из ${snapshots.length} · фильтры суммируются`
              : `${snapshots.length} зачисленных учеников`}
          </p>
        </section>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard icon={Users} label="Учеников в срезе" value={String(summary.students)} compact />
          <SummaryCard icon={TrendingUp} label="Средний прогресс" value={`${summary.avgProgress}%`} compact />
          <SummaryCard
            icon={BarChart3}
            label="Средняя оценка"
            value={summary.avgScore !== null ? `${formatHomeworkScoreValue(summary.avgScore)}/10` : '—'}
            hint={summary.avgScore !== null ? `по ${gradedInSlice} ученикам с оценками` : 'ещё нет проверенных работ'}
            compact
          />
          <SummaryCard
            icon={Award}
            label="Среднее достижений"
            value={`${summary.avgAchievements % 1 === 0 ? summary.avgAchievements : summary.avgAchievements.toFixed(1)} из ${filteredSnapshots[0]?.totalAchievementsPossible ?? 3}`}
            compact
          />
        </div>

        {(gradeBreakdown.length > 1 || groupBreakdown.length > 1) && (
          <div className="grid lg:grid-cols-2 gap-3">
            {gradeBreakdown.length > 1 && (
              <BreakdownTable
                title="По классам"
                hint="Клик — фильтр, повторный — снять"
                activeKey={gradeFilter !== 'all' ? gradeFilter : undefined}
                onRowClick={(key) => {
                  setGradeFilter((prev) => (prev === key ? 'all' : key));
                  setExpandedId(null);
                }}
                rows={gradeBreakdown.map((r) => ({
                  key: r.gradeLabel,
                  name: r.gradeLabel,
                  count: r.count,
                  avgProgress: r.avgProgress,
                  avgScore: r.avgScore,
                }))}
              />
            )}
            {groupBreakdown.length > 1 && (
              <BreakdownTable
                title="По группам"
                hint="Клик — фильтр, повторный — снять"
                activeKey={groupFilter !== 'all' ? groupFilter : undefined}
                onRowClick={(key) => {
                  setGroupFilter((prev) => (prev === key ? 'all' : key));
                  setExpandedId(null);
                }}
                rows={groupBreakdown.map((r) => ({
                  key: r.groupId,
                  name: r.groupName,
                  count: r.count,
                  avgProgress: r.avgProgress,
                  avgScore: r.avgScore,
                }))}
              />
            )}
          </div>
        )}

        <section className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">Рейтинг учеников</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {displayedStudents.length} из {ranked.length}
                {searchQuery.trim() ? ' по поиску' : ''}
                {' · '}
                {activeMetricLabel.toLowerCase()}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial sm:min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по имени…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60"
                />
              </div>
              <FormSelect
                value={rankMetric}
                onChange={(v) => setRankMetric(v as RankMetric)}
                options={RANK_METRIC_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
                className="w-full sm:w-auto sm:min-w-[14rem]"
              />
            </div>
          </div>

          {rankMetric === 'avg_score' && gradedInSlice < filteredSnapshots.length && (
            <p className="text-xs text-slate-500 px-1">
              Ученики без проверенных работ показаны в конце с «—»
            </p>
          )}

          {displayedStudents.length === 0 ? (
            <EmptyState text={searchQuery.trim() ? 'Никого не найдено по запросу' : 'Нет учеников для выбранного среза'} />
          ) : (
            <div className="max-h-[min(60vh,36rem)] overflow-y-auto scrollbar-site -mx-1 px-1 space-y-1.5">
              {displayedStudents.map((s, i) => (
                <RankRow
                  key={s.userId}
                  rank={i + 1}
                  snapshot={s}
                  metric={rankMetric}
                  expanded={expandedId === s.userId}
                  onToggle={() => setExpandedId((prev) => (prev === s.userId ? null : s.userId))}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className={`space-y-6 max-w-6xl relative ${refreshing ? 'opacity-80' : ''}`}>
      {refreshing && <RefreshingBadge />}
      <Header
        title="Статистика"
        description="Прогресс и оценки по вашим группам. Данные обновляются автоматически."
      />

      {groups.length === 0 ? (
        <EmptyState text="Вас ещё не назначили преподавателем ни в одну группу" />
      ) : (
        <>
          {groups.length > 1 ? (
            <FilterSelect
              label="Группа"
              value={teacherGroupId ?? groups[0].id}
              onChange={(v) => {
                setTeacherGroupId(v);
                setExpandedId(null);
              }}
              options={groups.map((g) => {
                const count = snapshots.filter((s) =>
                  g.members.some((m) => m.user_id === s.userId),
                ).length;
                return { value: g.id, label: `${g.name} (${count})` };
              })}
            />
          ) : null}

          {activeTeacherGroup && (
            <section className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">{activeTeacherGroup.group.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeTeacherGroup.snapshots.length} учеников · средний прогресс {activeTeacherGroup.avgProgress}%
                  </p>
                </div>
              </div>

              {activeTeacherGroup.snapshots.length === 0 ? (
                <p className="text-sm text-slate-500">В группе пока нет учеников</p>
              ) : (
                <div className="max-h-[min(60vh,36rem)] overflow-y-auto scrollbar-site -mx-1 px-1 space-y-1.5">
                  {rankStudents(activeTeacherGroup.snapshots, 'progress_percent').map((s) => (
                    <TeacherStudentRow
                      key={s.userId}
                      snapshot={s}
                      expanded={expandedId === s.userId}
                      onToggle={() => setExpandedId((prev) => (prev === s.userId ? null : s.userId))}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Header({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  );
}

function RefreshingBadge() {
  return (
    <div className="absolute top-0 right-0 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-white/10 text-xs text-slate-400">
      <Loader2 className="w-3 h-3 animate-spin" />
      Обновление…
    </div>
  );
}

function SummaryCard({
  icon: Icon, label, value, hint, compact,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <div className={`bg-slate-900/60 border border-white/5 rounded-xl ${compact ? 'p-3.5' : 'p-5'}`}>
      <Icon className={`text-blue-400 mb-2 ${compact ? 'w-4 h-4' : 'w-5 h-5 mb-3'}`} />
      <div className={`font-bold text-white ${compact ? 'text-xl' : 'text-2xl'}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      {hint && <div className="text-[10px] text-slate-600 mt-1">{hint}</div>}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 mb-1.5 block">{label}</span>
      <FormSelect value={value} onChange={onChange} options={options} />
    </label>
  );
}

function BreakdownTable({
  title,
  hint,
  rows,
  activeKey,
  onRowClick,
}: {
  title: string;
  hint?: string;
  rows: { key: string; name: string; count: number; avgProgress: number; avgScore: number | null }[];
  activeKey?: string;
  onRowClick?: (key: string) => void;
}) {
  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 overflow-hidden">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="font-semibold text-white text-sm">{title}</h3>
        {hint && onRowClick && <span className="text-[10px] text-slate-600">{hint}</span>}
      </div>
      <div className="max-h-52 overflow-y-auto overflow-x-auto scrollbar-site -mx-1 px-1">
        <table className="w-full text-sm min-w-[18rem]">
        <thead>
          <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
            <th className="pb-1.5 pr-3 font-medium">Название</th>
            <th className="pb-1.5 pr-3 font-medium">Учеников</th>
            <th className="pb-1.5 pr-3 font-medium">Прогресс</th>
            <th className="pb-1.5 font-medium">Ср. оценка</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((r) => {
            const active = activeKey === r.key;
            if (onRowClick) {
              return (
                <tr
                  key={r.key}
                  onClick={() => onRowClick(r.key)}
                  className={`cursor-pointer transition-colors ${
                    active ? 'bg-blue-500/10' : 'hover:bg-white/5'
                  }`}
                >
                  <td className="py-2 pr-3 text-white">{r.name}</td>
                  <td className="py-2 pr-3 text-slate-400 tabular-nums">{r.count}</td>
                  <td className="py-2 pr-3 text-slate-400 tabular-nums">{r.avgProgress}%</td>
                  <td className="py-2 text-slate-400 tabular-nums">{r.avgScore !== null ? `${formatHomeworkScoreValue(r.avgScore)}/10` : '—'}</td>
                </tr>
              );
            }
            return (
              <tr key={r.key}>
                <td className="py-2 pr-3 text-white">{r.name}</td>
                <td className="py-2 pr-3 text-slate-400 tabular-nums">{r.count}</td>
                <td className="py-2 pr-3 text-slate-400 tabular-nums">{r.avgProgress}%</td>
                <td className="py-2 text-slate-400 tabular-nums">{r.avgScore !== null ? `${formatHomeworkScoreValue(r.avgScore)}/10` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function RankRow({
  rank, snapshot, metric, expanded, onToggle,
}: {
  rank: number;
  snapshot: StudentProgressSnapshot;
  metric: RankMetric;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-slate-950/40 border border-white/5 rounded-xl overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-colors">
        <span className="w-6 text-center text-xs font-bold text-slate-500 flex-shrink-0 tabular-nums">
          {rank}
        </span>
        <UserAvatar displayName={snapshot.displayName} avatarUrl={snapshot.avatarUrl} size="chip" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{snapshot.displayName}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            <span className="text-[11px] text-slate-500 truncate">
              {snapshot.groupName ?? 'Без группы'} · {snapshot.gradeLabel} · {snapshot.gradedCount}/{snapshot.totalPublished} ДЗ
            </span>
            <AchievementBadgeStrip earnedKeys={snapshot.earnedAchievementKeys} size="sm" showLocked={false} wrap />
          </div>
        </div>
        <div className="text-sm font-semibold text-blue-300 flex-shrink-0 tabular-nums">
          {formatRankMetricValue(snapshot, metric)}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && <StudentDetail snapshot={snapshot} variant="admin" />}
    </div>
  );
}

function TeacherStudentRow({
  snapshot, expanded, onToggle,
}: {
  snapshot: StudentProgressSnapshot;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-white/5 bg-slate-950/40 rounded-xl overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-colors">
        <UserAvatar displayName={snapshot.displayName} avatarUrl={snapshot.avatarUrl} size="chip" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{snapshot.displayName}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            <span className="text-[11px] text-slate-500">
              {snapshot.gradedCount}/{snapshot.totalPublished} · {snapshot.progressPercent}%
            </span>
            <AchievementBadgeStrip earnedKeys={snapshot.earnedAchievementKeys} size="sm" showLocked={false} wrap />
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-semibold text-white">
            {snapshot.avgScore !== null ? `${formatHomeworkScoreValue(snapshot.avgScore)}/10` : '—'}
          </div>
          <div className="text-[10px] text-slate-600">средняя</div>
        </div>
      </button>
      {expanded && <StudentDetail snapshot={snapshot} variant="teacher" />}
    </div>
  );
}

function StudentDetail({
  snapshot,
  variant,
}: {
  snapshot: StudentProgressSnapshot;
  variant: 'admin' | 'teacher';
}) {
  return (
    <div className="px-3 pb-3 pt-0 border-t border-white/5 space-y-2">
      <div className="flex flex-wrap items-center gap-2 pt-2 text-sm">
        <InlineStat label="Средняя" value={snapshot.avgScore !== null ? `${formatHomeworkScoreValue(snapshot.avgScore)}/10` : '—'} />
        {variant === 'admin' ? (
          <InlineStat label="Просрочено" value={String(snapshot.overdueMissing)} />
        ) : (
          <InlineStat label="ДЗ" value={`${snapshot.gradedCount}/${snapshot.totalPublished}`} />
        )}
        <div className="flex flex-wrap items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 ml-auto min-w-0">
          <AchievementBadgeStrip
            earnedKeys={snapshot.earnedAchievementKeys}
            size="sm"
            showCounter
            wrap
          />
        </div>
      </div>
      {snapshot.homeworkPages.length > 0 && (
        <div className="space-y-1">
          {snapshot.homeworkPages.map((p) => (
            <div key={p.pageId} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg bg-white/5">
              <span className="text-xs text-white truncate">{p.title}</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {p.score !== null && (
                  <span className="text-[11px] text-slate-400">
                    {formatHomeworkScoreShort(p.score, p.maxScore)}
                  </span>
                )}
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${HOMEWORK_STATUS_COLORS[p.status]}`}>
                  {HOMEWORK_STATUS_LABELS[p.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2.5 py-1.5 rounded-lg bg-white/5 flex items-baseline gap-1.5">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="text-white font-medium text-sm tabular-nums">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-12 text-slate-500 bg-slate-900/40 rounded-2xl border border-white/5">
      {text}
    </div>
  );
}
