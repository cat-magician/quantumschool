import type { SupabaseClient } from '@supabase/supabase-js';
import type { Group, GroupMember, HomeworkPageSubmission, HomeworkSubmission, UserProfile } from './types';

export type GroupTeacherRow = {
  id: string;
  group_id: string;
  user_id: string;
  created_at: string;
};

export type StudentRow = UserProfile & { email: string | null };

export type GroupWithDetails = Group & {
  teachers: StudentRow[];
  members: (GroupMember & { profile?: StudentRow })[];
};

export async function loadGroupTeachers(supabase: SupabaseClient) {
  const { data } = await supabase.from('group_teachers').select('*');
  return (data ?? []) as GroupTeacherRow[];
}

/** Преподаватели, которых можно назначить на учебную группу (включая суперадмина). */
export async function loadGroupStaffProfiles(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .in('role', ['admin', 'superadmin'])
    .order('display_name');
  return (data ?? []) as StudentRow[];
}

export function teacherIdsForGroup(
  groupId: string,
  groupTeachers: GroupTeacherRow[],
  legacyTeacherId?: string | null,
): string[] {
  const fromJoin = groupTeachers.filter((gt) => gt.group_id === groupId).map((gt) => gt.user_id);
  if (legacyTeacherId && !fromJoin.includes(legacyTeacherId)) {
    return [...fromJoin, legacyTeacherId];
  }
  return fromJoin;
}

export function groupsForTeacher(
  groups: Group[],
  groupTeachers: GroupTeacherRow[],
  teacherId: string,
): Group[] {
  const assigned = new Set(
    groupTeachers.filter((gt) => gt.user_id === teacherId).map((gt) => gt.group_id),
  );
  return groups.filter(
    (g) => g.group_type === 'teacher' && (assigned.has(g.id) || g.teacher_id === teacherId),
  );
}

export function buildGroupsWithDetails(
  groups: Group[],
  groupTeachers: GroupTeacherRow[],
  members: GroupMember[],
  profileMap: Record<string, StudentRow>,
): GroupWithDetails[] {
  return groups
    .filter((g) => g.group_type === 'teacher')
    .map((g) => {
      const teacherIds = teacherIdsForGroup(g.id, groupTeachers, g.teacher_id);
      return {
        ...g,
        teachers: teacherIds.map((id) => profileMap[id]).filter(Boolean),
        members: members
          .filter((m) => m.group_id === g.id)
          .map((m) => ({ ...m, profile: profileMap[m.user_id] })),
      };
    });
}

export function studentGroupMap(members: GroupMember[]): Record<string, string> {
  return Object.fromEntries(members.map((m) => [m.user_id, m.group_id]));
}

export function submissionVisibleToStaff(
  submission: HomeworkSubmission,
  studentGroups: Record<string, string>,
  teacherGroupIds: Set<string>,
  isSuperAdmin: boolean,
): boolean {
  if (isSuperAdmin) return true;
  const studentGroupId = studentGroups[submission.user_id];
  if (!studentGroupId || !teacherGroupIds.has(studentGroupId)) return false;
  const assignGroup = submission.assignment?.group_id;
  if (assignGroup && assignGroup !== studentGroupId) return false;
  return true;
}

export function pageSubmissionVisibleToStaff(
  submission: Pick<HomeworkPageSubmission, 'user_id'>,
  studentGroups: Record<string, string>,
  teacherGroupIds: Set<string>,
  isSuperAdmin: boolean,
): boolean {
  if (isSuperAdmin) return true;
  const studentGroupId = studentGroups[submission.user_id];
  return !!studentGroupId && teacherGroupIds.has(studentGroupId);
}

export function assignmentVisibleToStaff(
  assignment: { group_id: string | null },
  teacherGroupIds: Set<string>,
  isSuperAdmin: boolean,
): boolean {
  if (isSuperAdmin) return true;
  if (!assignment.group_id) return true;
  return teacherGroupIds.has(assignment.group_id);
}

export const ENROLLED_GROUP_LABEL = 'Все зачисленные';

export type StudentGroupContext = {
  groupId: string;
  groupName: string;
  teachers: { id: string; display_name: string; avatar_url: string | null }[];
};

/** Группа и официально назначенные преподаватели для зачисленного ученика. */
export async function loadStudentGroupContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<StudentGroupContext | null> {
  const { data: membership, error: memberError } = await supabase
    .from('group_members')
    .select('group_id, group:groups(id, name, teacher_id)')
    .eq('user_id', userId)
    .maybeSingle();

  if (memberError || !membership?.group) return null;

  const group = membership.group as { id: string; name: string; teacher_id: string | null };
  const { data: gtRows } = await supabase
    .from('group_teachers')
    .select('group_id, user_id')
    .eq('group_id', group.id);

  const teacherIds = teacherIdsForGroup(
    group.id,
    (gtRows ?? []) as GroupTeacherRow[],
    group.teacher_id,
  );

  if (teacherIds.length === 0) {
    return { groupId: group.id, groupName: group.name, teachers: [] };
  }

  const { data: teachers } = await supabase
    .from('user_profiles')
    .select('id, display_name, avatar_url')
    .in('id', teacherIds);

  return {
    groupId: group.id,
    groupName: group.name,
    teachers: (teachers ?? [])
      .map((t) => ({
        id: t.id,
        display_name: t.display_name,
        avatar_url: t.avatar_url?.trim() || null,
      }))
      .sort((a, b) => a.display_name.localeCompare(b.display_name, 'ru')),
  };
}
