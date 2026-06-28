/*
  # Student read access to own group and assigned teachers

  Enrolled students can see their group name and officially assigned teachers
  (group_teachers + legacy groups.teacher_id).
*/

DROP POLICY IF EXISTS "Students read own group membership" ON public.group_members;
CREATE POLICY "Students read own group membership" ON public.group_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Students read own teacher group" ON public.groups;
CREATE POLICY "Students read own teacher group" ON public.groups
  FOR SELECT TO authenticated
  USING (
    group_type = 'teacher'
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.user_id = auth.uid() AND gm.group_id = groups.id
    )
  );

DROP POLICY IF EXISTS "Students read own group teachers" ON public.group_teachers;
CREATE POLICY "Students read own group teachers" ON public.group_teachers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.user_id = auth.uid() AND gm.group_id = group_teachers.group_id
    )
  );

DROP POLICY IF EXISTS "Students read group teacher profiles" ON public.user_profiles;
CREATE POLICY "Students read group teacher profiles" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    role IN ('admin', 'superadmin')
    AND (
      EXISTS (
        SELECT 1 FROM public.group_members gm
        JOIN public.group_teachers gt ON gt.group_id = gm.group_id
        WHERE gm.user_id = auth.uid() AND gt.user_id = user_profiles.id
      )
      OR EXISTS (
        SELECT 1 FROM public.group_members gm
        JOIN public.groups g ON g.id = gm.group_id
        WHERE gm.user_id = auth.uid() AND g.teacher_id = user_profiles.id
      )
    )
  );
