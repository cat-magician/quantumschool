import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, GraduationCap, Loader2, MapPin, Plus, School,
  Trash2, UserPlus, Users, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import type { Group, GroupMember } from '../../lib/types';
import UserAvatar from '../../components/UserAvatar';
import { profileDisplayName, profileEmail } from '../../lib/profileUtils';
import QuestionnaireStatusHint from '../../components/QuestionnaireStatusHint';
import { useAppDialog } from '../../lib/AppDialogContext';
import {
  buildGroupsWithDetails,
  ENROLLED_GROUP_LABEL,
  groupsForTeacher,
  loadGroupTeachers,
  loadGroupStaffProfiles,
  type GroupWithDetails,
  type StudentRow,
} from '../../lib/groupUtils';
import { SearchableActionList, SearchableCheckboxList, type PickerRow } from '../../components/SearchablePicker';
type ActiveView = 'enrolled' | string;

export default function StudentsTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { user } = useAuth();
  const { confirm, toast } = useAppDialog();
  const [groups, setGroups] = useState<GroupWithDetails[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<StudentRow[]>([]);
  const [groupStaff, setGroupStaff] = useState<StudentRow[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>('enrolled');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupTeachers, setNewGroupTeachers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [infoStudentId, setInfoStudentId] = useState<string | null>(null);
  const [assignStudent, setAssignStudent] = useState<StudentRow | null>(null);

  const load = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!user) return;
    if (silent) setRefreshing(true);
    else setInitialLoading(true);

    const [groupsRes, studentsRes, enrolledRes, staffRes, membersRes, gtRows] = await Promise.all([
      supabase.from('groups').select('*').eq('group_type', 'teacher').order('name'),
      supabase.from('user_profiles').select('*').eq('role', 'student'),
      supabase.from('user_profiles').select('*').eq('role', 'student').eq('is_enrolled', true).order('display_name'),
      loadGroupStaffProfiles(supabase),
      supabase.from('group_members').select('*'),
      loadGroupTeachers(supabase),
    ]);

    const allStudents = (studentsRes.data ?? []) as StudentRow[];
    const staff = staffRes;
    const profileMap = Object.fromEntries(
      [...allStudents, ...staff].map((p) => [p.id, p]),
    );

    setEnrolledStudents((enrolledRes.data ?? []) as StudentRow[]);
    setGroupStaff(staff);

    const rawGroups = (groupsRes.data ?? []) as Group[];
    const visibleGroups = isSuperAdmin
      ? rawGroups
      : groupsForTeacher(rawGroups, gtRows, user.id);

    setGroups(
      buildGroupsWithDetails(
        visibleGroups,
        gtRows,
        (membersRes.data ?? []) as GroupMember[],
        profileMap,
      ),
    );

    if (silent) setRefreshing(false);
    else setInitialLoading(false);
  };

  useEffect(() => { load(); }, [isSuperAdmin, user?.id]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-student-info]')) {
        setInfoStudentId(null);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const activeGroup = groups.find((g) => g.id === activeView);

  const groupNameByStudentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) {
      for (const m of g.members) {
        map.set(m.user_id, g.name);
      }
    }
    return map;
  }, [groups]);

  const availableForGroup = useMemo(() => {
    if (!activeGroup) return [];
    const inCurrentGroup = new Set(activeGroup.members.map((m) => m.user_id));
    return enrolledStudents.filter((s) => !inCurrentGroup.has(s.id));
  }, [activeGroup, enrolledStudents]);

  const staffNotInGroup = useMemo(() => {
    if (!activeGroup) return groupStaff;
    const inGroup = new Set(activeGroup.teachers.map((t) => t.id));
    return groupStaff.filter((a) => !inGroup.has(a.id));
  }, [activeGroup, groupStaff]);

  const teacherPickerItems = useMemo((): PickerRow[] => groupStaff.map((a) => ({
    id: a.id,
    title: `${a.display_name}${a.id === user?.id ? ' (вы)' : ''}`,
    subtitle: `${profileEmail(a) ?? ''}${a.role === 'superadmin' ? ' · суперадмин' : ''}`.trim() || undefined,
    searchText: `${a.display_name} ${a.email ?? ''} ${a.role}`,
  })), [groupStaff, user?.id]);

  const availableStudentPickerItems = useMemo((): PickerRow[] => availableForGroup.map((s) => ({
    id: s.id,
    title: profileDisplayName(s),
    subtitle: profileEmail(s) ?? undefined,
    searchText: `${s.display_name} ${s.email ?? ''}`,
    leading: (
      <UserAvatar displayName={profileDisplayName(s)} avatarUrl={s.avatar_url} size="chip" />
    ),
    trailing: groupNameByStudentId.has(s.id) ? (
      <span className="text-xs text-amber-400 shrink-0">переместить</span>
    ) : undefined,
  })), [availableForGroup, groupNameByStudentId]);

  const groupPickerItems = useMemo((): PickerRow[] => {
    if (!assignStudent) return [];
    const currentGroup = groupNameByStudentId.get(assignStudent.id);
    return groups.map((g) => {
      const isCurrent = g.members.some((m) => m.user_id === assignStudent.id);
      return {
        id: g.id,
        title: g.name,
        subtitle: `${g.members.length} учеников`,
        searchText: g.name,
        disabled: isCurrent,
        leading: (
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-300 shrink-0">
            {g.members.length}
          </div>
        ),
        trailing: isCurrent ? (
          <span className="text-xs text-slate-500 shrink-0">уже в группе</span>
        ) : currentGroup ? (
          <span className="text-xs text-amber-400 shrink-0">переместить</span>
        ) : (
          <span className="text-xs text-emerald-400 shrink-0">добавить</span>
        ),
      };
    });
  }, [assignStudent, groups, groupNameByStudentId]);

  const staffPickerItems = useMemo((): PickerRow[] => staffNotInGroup.map((a) => ({
    id: a.id,
    title: `${a.display_name}${a.id === user?.id ? ' (вы)' : ''}`,
    subtitle: `${profileEmail(a) ?? ''}${a.role === 'superadmin' ? ' · суперадмин' : ''}`.trim() || undefined,
    searchText: `${a.display_name} ${a.email ?? ''} ${a.role}`,
    leading: (
      <UserAvatar displayName={a.display_name} avatarUrl={a.avatar_url} size="chip" />
    ),
  })), [staffNotInGroup, user?.id]);

  const createGroup = async () => {
    if (!newGroupName.trim() || newGroupTeachers.length === 0) {
      toast('Укажите название и хотя бы одного преподавателя', 'warning');
      return;
    }
    setCreating(true);
    const { data: group, error } = await supabase.from('groups').insert({
      name: newGroupName.trim(),
      group_type: 'teacher',
      teacher_id: newGroupTeachers[0],
    }).select('id').single();

    if (!error && group) {
      await supabase.from('group_teachers').insert(
        newGroupTeachers.map((userId) => ({ group_id: group.id, user_id: userId })),
      );
    }

    setNewGroupName('');
    setNewGroupTeachers([]);
    setShowCreate(false);
    setCreating(false);
    load({ silent: true });
  };

  const deleteGroup = async (id: string) => {
    const ok = await confirm({
      title: 'Удалить группу?',
      message: 'Ученики будут откреплены от неё. Это действие нельзя отменить.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    await supabase.from('groups').delete().eq('id', id);
    if (activeView === id) setActiveView(isSuperAdmin ? 'enrolled' : groups[0]?.id ?? 'enrolled');
    load({ silent: true });
  };

  const addStudentToGroup = async (studentId: string, groupId: string) => {
    const student = enrolledStudents.find((s) => s.id === studentId);
    if (!student) return;

    const existing = groups.flatMap((g) => g.members).find((m) => m.user_id === studentId);
    if (existing) {
      const { error: moveError } = await supabase.from('group_members').delete().eq('id', existing.id);
      if (moveError) {
        toast(`Не удалось переместить ученика: ${moveError.message}`, 'error');
        return;
      }
    }

    const { data: inserted, error } = await supabase
      .from('group_members')
      .insert({ group_id: groupId, user_id: studentId })
      .select('*')
      .single();

    if (error || !inserted) {
      toast(`Не удалось добавить ученика: ${error?.message ?? 'ошибка'}`, 'error');
      load({ silent: true });
      return;
    }

    setGroups((prev) => prev.map((g) => ({
      ...g,
      members: g.id === groupId
        ? [...g.members.filter((m) => m.user_id !== studentId), { ...inserted, profile: student }]
        : g.members.filter((m) => m.user_id !== studentId),
    })));

    setShowAddStudent(false);
    setAssignStudent(null);
  };

  const removeStudent = async (memberId: string) => {
    const snapshot = groups;
    setGroups((prev) => prev.map((g) => ({
      ...g,
      members: g.members.filter((m) => m.id !== memberId),
    })));

    const { error } = await supabase.from('group_members').delete().eq('id', memberId);
    if (error) {
      setGroups(snapshot);
      toast(`Не удалось убрать ученика: ${error.message}`, 'error');
    }
  };

  const addTeacherToGroup = async (teacherId: string, groupId: string) => {
    const teacher = groupStaff.find((a) => a.id === teacherId);
    const { data: inserted, error } = await supabase
      .from('group_teachers')
      .insert({ group_id: groupId, user_id: teacherId })
      .select('*')
      .single();

    if (error || !inserted || !teacher) {
      toast(`Не удалось назначить преподавателя: ${error?.message ?? 'ошибка'}`, 'error');
      return;
    }

    setGroups((prev) => prev.map((g) => {
      if (g.id !== groupId) return g;
      if (g.teachers.some((t) => t.id === teacherId)) return g;
      return {
        ...g,
        teachers: [...g.teachers, teacher],
        teacher_id: g.teacher_id ?? teacherId,
      };
    }));
    setShowAddTeacher(false);
  };

  const removeTeacherFromGroup = async (groupId: string, teacherId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    const snapshot = groups;
    const remainingTeachers = group.teachers.filter((t) => t.id !== teacherId);
    const nextLegacyTeacherId = group.teacher_id === teacherId
      ? (remainingTeachers[0]?.id ?? null)
      : group.teacher_id;

    setGroups((prev) => prev.map((g) => (
      g.id === groupId
        ? { ...g, teachers: remainingTeachers, teacher_id: nextLegacyTeacherId }
        : g
    )));

    const { error: unlinkError } = await supabase
      .from('group_teachers')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', teacherId);

    if (unlinkError) {
      setGroups(snapshot);
      toast(`Не удалось снять преподавателя: ${unlinkError.message}`, 'error');
      return;
    }

    if (group.teacher_id === teacherId) {
      const { error: legacyError } = await supabase
        .from('groups')
        .update({ teacher_id: nextLegacyTeacherId })
        .eq('id', groupId);

      if (legacyError) {
        setGroups(snapshot);
        toast(`Не удалось обновить группу: ${legacyError.message}`, 'error');
      }
    }
  };

  const toggleNewGroupTeacher = (id: string) => {
    setNewGroupTeachers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const selectGroup = (view: ActiveView) => {
    setActiveView(view);
    setInfoStudentId(null);
  };

  const navItems: { id: ActiveView; label: string; count: number; variant: 'enrolled' | 'group' }[] = [
    { id: 'enrolled', label: ENROLLED_GROUP_LABEL, count: enrolledStudents.length, variant: 'enrolled' },
    ...groups.map((g) => ({
      id: g.id,
      label: g.name,
      count: g.members.length,
      variant: 'group' as const,
    })),
  ];

  return (
    <div className="space-y-5 w-full max-w-6xl">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Ученики и группы</h2>
        <p className="text-slate-400 text-sm">
          {isSuperAdmin
            ? 'Зачисленные ученики и учебные группы'
            : 'Все зачисленные ученики и ваши учебные группы'}
        </p>
      </div>

      {!isSuperAdmin && groups.length === 0 && (
        <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200/90">
          Вас ещё не назначили преподавателем ни в одну группу — ниже доступен общий список зачисленных. Обратитесь к суперадмину для назначения в группу.
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(220px,260px)_1fr] gap-6 items-start">
          <GroupNavigation
            items={navItems}
            activeView={activeView}
            onSelect={selectGroup}
            isSuperAdmin={isSuperAdmin}
            onCreateGroup={() => setShowCreate(true)}
          />

          <div className="min-w-0 space-y-5 relative">
            {refreshing && (
              <div className="absolute top-0 right-0 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-white/10 text-xs text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Обновление…
              </div>
            )}
      {activeView === 'enrolled' && (
        <StudentList
          title={ENROLLED_GROUP_LABEL}
          description={
            isSuperAdmin
              ? 'Все зачисленные ученики. Кнопка справа на карточке — добавить или переместить в группу.'
              : groups.length > 0
                ? 'Все зачисленные ученики. Кнопка справа — добавить или переместить в вашу группу.'
                : 'Все зачисленные ученики курса.'
          }
          students={enrolledStudents}
          emptyText="Нет зачисленных учеников. Зачислите учеников во вкладке «Отборочные этапы»."
          infoStudentId={infoStudentId}
          onToggleInfo={(id) => setInfoStudentId((prev) => (prev === id ? null : id))}
          groupLabelFor={(id) => groupNameByStudentId.get(id) ?? null}
          onAssignToGroup={groups.length > 0 ? setAssignStudent : undefined}
        />
      )}

      {activeGroup && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">{activeGroup.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeGroup.members.length} учеников · {activeGroup.teachers.length} преподавателей
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowAddStudent(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Добавить ученика
              </button>
              {isSuperAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowAddTeacher(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 text-sm transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Преподаватель
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteGroup(activeGroup.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-sm transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Преподаватели группы</p>
            {activeGroup.teachers.length === 0 ? (
              <p className="text-sm text-slate-500">Преподаватели не назначены</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeGroup.teachers.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200"
                  >
                    {t.display_name}
                    {t.id === user?.id && <span className="text-blue-300/80 text-xs">(вы)</span>}
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => removeTeacherFromGroup(activeGroup.id, t.id)}
                        className="text-amber-400/70 hover:text-rose-400"
                        title="Снять с группы"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {activeGroup.members.length === 0 ? (
            <StudentCardGrid>
              <div className="col-span-full flex items-center justify-center py-12 text-slate-500 bg-slate-900/40 rounded-2xl border border-white/5">
                Группа пуста. Добавьте учеников из списка зачисленных.
              </div>
            </StudentCardGrid>
          ) : (
            <StudentCardGrid>
              {activeGroup.members.map((m) => (
                <StudentCard
                  key={m.id}
                  student={m.profile}
                  showGroupLine={false}
                  showInfo={infoStudentId === m.user_id}
                  onToggleInfo={() => setInfoStudentId((prev) => (prev === m.user_id ? null : m.user_id))}
                  trailing={(
                    <button
                      type="button"
                      onClick={() => removeStudent(m.id)}
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex-shrink-0"
                      title="Убрать из группы"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                />
              ))}
            </StudentCardGrid>
          )}
        </div>
      )}
          </div>
        </div>

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="Создать учебную группу" wide>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Название группы</label>
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Например: Группа А — весна 2026"
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Преподаватели группы</label>
              <SearchableCheckboxList
                items={teacherPickerItems}
                selectedIds={newGroupTeachers}
                onToggle={toggleNewGroupTeacher}
                searchPlaceholder="Поиск по имени или почте..."
                emptyText="Нет доступных преподавателей"
              />
            </div>
            <button
              type="button"
              onClick={createGroup}
              disabled={creating || !newGroupName.trim() || newGroupTeachers.length === 0}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {creating ? 'Создание...' : 'Создать группу'}
            </button>
          </div>
        </Modal>
      )}

      {showAddStudent && activeGroup && (
        <Modal
          onClose={() => setShowAddStudent(false)}
          title={`Добавить в «${activeGroup.name}»`}
          wide
        >
          <SearchableActionList
            items={availableStudentPickerItems}
            onPick={(id) => addStudentToGroup(id, activeGroup.id)}
            searchPlaceholder="Поиск по имени или почте..."
            emptyText={
              enrolledStudents.length === 0
                ? 'Нет зачисленных учеников'
                : 'Все зачисленные ученики уже в этой группе'
            }
          />
        </Modal>
      )}

      {assignStudent && (
        <Modal
          onClose={() => setAssignStudent(null)}
          title={`В группу: ${assignStudent.display_name}`}
          wide
        >
          <SearchableActionList
            items={groupPickerItems}
            onPick={(groupId) => addStudentToGroup(assignStudent.id, groupId)}
            searchPlaceholder="Поиск по названию группы..."
            emptyText="Сначала создайте учебную группу"
          />
        </Modal>
      )}

      {showAddTeacher && activeGroup && isSuperAdmin && (
        <Modal
          onClose={() => setShowAddTeacher(false)}
          title={`Преподаватель в «${activeGroup.name}»`}
          wide
        >
          <SearchableActionList
            items={staffPickerItems}
            onPick={(id) => addTeacherToGroup(id, activeGroup.id)}
            searchPlaceholder="Поиск по имени или почте..."
            emptyText="Все преподаватели уже в группе"
          />
        </Modal>
      )}
    </div>
  );
}

function GroupNavigation({
  items, activeView, onSelect, isSuperAdmin, onCreateGroup,
}: {
  items: { id: ActiveView; label: string; count: number; variant: 'enrolled' | 'group' }[];
  activeView: ActiveView;
  onSelect: (id: ActiveView) => void;
  isSuperAdmin: boolean;
  onCreateGroup: () => void;
}) {
  return (
    <>
      <div className="lg:hidden space-y-3">
        {isSuperAdmin && (
          <button
            type="button"
            onClick={onCreateGroup}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Новая группа
          </button>
        )}
        <div className="relative">
          <select
            value={activeView}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full appearance-none pl-4 pr-10 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50"
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.count})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
      </div>

      <aside className="hidden lg:flex flex-col gap-3 sticky top-4">
        {isSuperAdmin && (
          <button
            type="button"
            onClick={onCreateGroup}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Новая группа
          </button>
        )}
        <nav className="bg-slate-900/60 border border-white/5 rounded-2xl p-2 max-h-[min(70vh,520px)] overflow-y-auto space-y-1">
          {items.map((item) => (
            <GroupNavItem
              key={item.id}
              active={activeView === item.id}
              onClick={() => onSelect(item.id)}
              label={item.label}
              count={item.count}
              variant={item.variant}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}

function GroupNavItem({
  active, onClick, label, count, variant,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  variant: 'enrolled' | 'group';
}) {
  const activeCls = variant === 'enrolled'
    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30'
    : 'bg-blue-600/20 text-blue-300 border-blue-500/30';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-colors border ${
        active ? activeCls : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
      }`}
    >
      <span className="truncate font-medium">{label}</span>
      <span className={`text-xs tabular-nums flex-shrink-0 min-w-[1.75rem] text-center px-2 py-0.5 rounded-md ${
        active ? 'bg-black/20' : 'bg-white/5 text-slate-500'
      }`}
      >
        {count}
      </span>
    </button>
  );
}

function StudentCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 items-stretch grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))]">
      {children}
    </div>
  );
}

function StudentList({
  title, description, students, emptyText, infoStudentId, onToggleInfo, groupLabelFor, onAssignToGroup,
}: {
  title: string;
  description: string;
  students: StudentRow[];
  emptyText: string;
  infoStudentId: string | null;
  onToggleInfo: (id: string) => void;
  groupLabelFor?: (id: string) => string | null;
  onAssignToGroup?: (student: StudentRow) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      {students.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-slate-900/40 rounded-2xl border border-white/5">
          {emptyText}
        </div>
      ) : (
        <StudentCardGrid>
          {students.map((s) => (
            <StudentCard
              key={s.id}
              student={s}
              showInfo={infoStudentId === s.id}
              onToggleInfo={() => onToggleInfo(s.id)}
              groupLabel={groupLabelFor?.(s.id) ?? null}
              trailing={onAssignToGroup && (
                <button
                  type="button"
                  onClick={() => onAssignToGroup(s)}
                  className="p-2 rounded-lg text-slate-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors flex-shrink-0"
                  title="Добавить в группу"
                >
                  <Users className="w-4 h-4" />
                </button>
              )}
            />
          ))}
        </StudentCardGrid>
      )}
    </div>
  );
}

function StudentCard({
  student, showInfo, onToggleInfo, trailing, groupLabel, showGroupLine = true,
}: {
  student?: StudentRow;
  showInfo: boolean;
  onToggleInfo: () => void;
  trailing?: React.ReactNode;
  groupLabel?: string | null;
  showGroupLine?: boolean;
}) {
  if (!student) return null;

  return (
    <div className={`relative flex h-full bg-slate-900/60 border border-white/5 rounded-2xl p-3 hover:border-white/10 transition-colors ${showGroupLine ? 'min-h-[5.5rem]' : 'min-h-[4.5rem]'}`}>
      <div className="flex items-center gap-2 w-full min-h-0">
        <button
          type="button"
          data-student-info
          onClick={onToggleInfo}
          className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-xl hover:bg-white/5 px-1.5 py-1 -mx-1.5 transition-colors"
        >
          <UserAvatar displayName={profileDisplayName(student)} avatarUrl={student.avatar_url} size="md" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-white truncate text-sm leading-snug">{profileDisplayName(student)}</div>
            <div className="text-xs text-slate-500 truncate mt-0.5">{profileEmail(student) ?? '—'}</div>
            {!student.is_enrolled && (
              <div className="mt-1">
                <QuestionnaireStatusHint submittedAt={student.questionnaire_submitted_at} compact />
              </div>
            )}
            {showGroupLine && (
              <div className="text-xs mt-1 truncate h-4 leading-4">
                {groupLabel ? (
                  <span className="text-blue-400/80">Группа: {groupLabel}</span>
                ) : (
                  <span className="text-slate-600">Без группы</span>
                )}
              </div>
            )}
          </div>
        </button>
        {trailing}
      </div>

      {showInfo && (
        <div
          data-student-info
          className="absolute left-4 right-4 sm:right-auto sm:w-64 top-full mt-2 z-20 bg-slate-800 border border-white/10 rounded-xl p-4 shadow-xl"
        >
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">О участнике</p>
          <div className="space-y-2.5 text-sm">
            <InfoRow icon={MapPin} label="Город" value={student.city} />
            <InfoRow icon={School} label="Школа" value={student.school} />
            <InfoRow icon={GraduationCap} label="Класс" value={student.grade} />
            {!student.is_enrolled && (
              <div className="pt-1 border-t border-white/5">
                <QuestionnaireStatusHint submittedAt={student.questionnaire_submitted_at} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-white break-words">{value?.trim() || '—'}</div>
      </div>
    </div>
  );
}

function Modal({
  title, children, onClose, wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'} max-h-[min(90dvh,calc(100vh-2rem))] overflow-y-auto scrollbar-site bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
