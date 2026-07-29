import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import {
  groupsForTeacher,
  loadGroupTeachers,
  pageSubmissionVisibleToStaff,
  studentGroupMap,
} from '../lib/groupUtils';
import { supabase } from '../lib/supabase';
import type { Group } from '../lib/types';

const REFRESH_MS = 60_000;

export function useAdminUngradedCount(isSuperAdmin: boolean): number | null {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) return;

    const [gtRows, gRes, membersRes, subsRes] = await Promise.all([
      loadGroupTeachers(supabase),
      supabase.from('groups').select('*').eq('group_type', 'teacher'),
      supabase.from('group_members').select('*'),
      supabase
        .from('homework_page_submissions')
        .select('user_id, status')
        .in('status', ['submitted', 'graded']),
    ]);

    const groups = (gRes.data ?? []) as Group[];
    const teacherGroups = isSuperAdmin ? groups : groupsForTeacher(groups, gtRows, user.id);
    const teacherGroupIds = new Set(teacherGroups.map((g) => g.id));
    const studentGroups = studentGroupMap(membersRes.data ?? []);

    const ungraded = (subsRes.data ?? []).filter(
      (s) => s.status !== 'graded' && pageSubmissionVisibleToStaff(s, studentGroups, teacherGroupIds, isSuperAdmin),
    ).length;
    setCount(ungraded);
  }, [user?.id, isSuperAdmin]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const run = async () => {
      await refresh();
    };

    void run();
    const interval = window.setInterval(() => {
      if (!cancelled) void refresh();
    }, REFRESH_MS);

    const onFocus = () => {
      if (!cancelled) void refresh();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh, user?.id]);

  return count;
}
