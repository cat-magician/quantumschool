/*
  # Несколько преподавателей на учебную группу

  - group_teachers: many-to-many groups ↔ admins
  - RLS: суперадмин — все группы; админ — только назначенные
*/

CREATE TABLE IF NOT EXISTS public.group_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE public.group_teachers ENABLE ROW LEVEL SECURITY;

INSERT INTO public.group_teachers (group_id, user_id)
SELECT g.id, g.teacher_id
FROM public.groups g
WHERE g.group_type = 'teacher' AND g.teacher_id IS NOT NULL
ON CONFLICT (group_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_group_teacher(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_teachers
    WHERE group_id = p_group_id AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = p_group_id AND teacher_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_can_access_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_superadmin() OR EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.user_id = p_student_id
      AND public.is_group_teacher(gm.group_id)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_group_teacher(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_can_access_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_teacher(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_can_access_student(uuid) TO authenticated;

-- groups
DROP POLICY IF EXISTS "Staff can read groups" ON public.groups;
CREATE POLICY "Staff can read groups" ON public.groups
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR (group_type = 'enrolled' AND public.is_staff())
    OR (group_type = 'teacher' AND public.is_group_teacher(id))
  );

DROP POLICY IF EXISTS "Superadmin manages groups" ON public.groups;
DROP POLICY IF EXISTS "Staff create teacher groups" ON public.groups;
DROP POLICY IF EXISTS "Superadmin creates groups" ON public.groups;
CREATE POLICY "Superadmin creates groups" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Superadmin updates groups" ON public.groups;
DROP POLICY IF EXISTS "Staff update groups" ON public.groups;
CREATE POLICY "Superadmin updates groups" ON public.groups
  FOR UPDATE TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Superadmin deletes groups" ON public.groups;
DROP POLICY IF EXISTS "Staff delete groups" ON public.groups;
CREATE POLICY "Superadmin deletes groups" ON public.groups
  FOR DELETE TO authenticated
  USING (public.is_superadmin());

-- group_teachers
DROP POLICY IF EXISTS "Staff read group teachers" ON public.group_teachers;
CREATE POLICY "Staff read group teachers" ON public.group_teachers
  FOR SELECT TO authenticated
  USING (public.is_superadmin() OR public.is_group_teacher(group_id));

DROP POLICY IF EXISTS "Superadmin manage group teachers" ON public.group_teachers;
CREATE POLICY "Superadmin manage group teachers" ON public.group_teachers
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- group_members
DROP POLICY IF EXISTS "Staff read group members" ON public.group_members;
CREATE POLICY "Staff read group members" ON public.group_members
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR public.is_group_teacher(group_id)
  );

DROP POLICY IF EXISTS "Staff manage group members" ON public.group_members;
DROP POLICY IF EXISTS "Staff update group members" ON public.group_members;
DROP POLICY IF EXISTS "Staff remove group members" ON public.group_members;
DROP POLICY IF EXISTS "Staff insert group members" ON public.group_members;
CREATE POLICY "Staff insert group members" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR public.is_group_teacher(group_id)
  );

DROP POLICY IF EXISTS "Staff delete group members" ON public.group_members;
CREATE POLICY "Staff update group members" ON public.group_members
  FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR public.is_group_teacher(group_id))
  WITH CHECK (public.is_superadmin() OR public.is_group_teacher(group_id));

CREATE POLICY "Staff delete group members" ON public.group_members
  FOR DELETE TO authenticated
  USING (public.is_superadmin() OR public.is_group_teacher(group_id));

-- homework submissions (staff)
DROP POLICY IF EXISTS "Staff read homework submissions" ON public.homework_submissions;
CREATE POLICY "Staff read homework submissions" ON public.homework_submissions
  FOR SELECT TO authenticated
  USING (public.staff_can_access_student(user_id));

DROP POLICY IF EXISTS "Staff update homework submissions" ON public.homework_submissions;
CREATE POLICY "Staff update homework submissions" ON public.homework_submissions
  FOR UPDATE TO authenticated
  USING (public.staff_can_access_student(user_id))
  WITH CHECK (public.staff_can_access_student(user_id));

CREATE INDEX IF NOT EXISTS idx_group_teachers_group ON public.group_teachers (group_id);
CREATE INDEX IF NOT EXISTS idx_group_teachers_user ON public.group_teachers (user_id);
