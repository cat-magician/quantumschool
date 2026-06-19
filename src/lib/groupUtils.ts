import type { SupabaseClient } from '@supabase/supabase-js';
import type { Group, GroupMember, HomeworkSubmission, UserProfile } from './types';

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
