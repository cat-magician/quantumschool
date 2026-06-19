/*
  # Admin panel improvements

  - email on user_profiles (for staff student list)
  - staff can only UPDATE student profiles (not other staff)
  - staff can read enrollments
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS email text;

UPDATE public.user_profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, role, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    new.email
  );
  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;

DROP POLICY IF EXISTS "Staff can update student profiles" ON public.user_profiles;

CREATE POLICY "Staff can update student profiles"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (public.is_staff() AND role = 'student')
  WITH CHECK (public.is_staff() AND role = 'student');

DROP POLICY IF EXISTS "Staff can read enrollments" ON public.enrollments;
CREATE POLICY "Staff can read enrollments"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- Admins see only their teacher groups; superadmins see all
DROP POLICY IF EXISTS "Staff can read groups" ON public.groups;
CREATE POLICY "Staff can read groups"
  ON public.groups FOR SELECT
  TO authenticated
  USING (
    public.is_superadmin()
    OR (public.is_staff() AND group_type = 'enrolled')
    OR (public.is_staff() AND group_type = 'teacher' AND teacher_id = auth.uid())
  );

-- Admins can create/update teacher groups assigned to themselves
DROP POLICY IF EXISTS "Superadmin manages groups" ON public.groups;
CREATE POLICY "Staff create teacher groups"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR (public.is_staff() AND group_type = 'teacher' AND teacher_id = auth.uid())
  );

DROP POLICY IF EXISTS "Superadmin updates groups" ON public.groups;
CREATE POLICY "Staff update groups"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (
    public.is_superadmin()
    OR (teacher_id = auth.uid() AND group_type = 'teacher')
  )
  WITH CHECK (
    public.is_superadmin()
    OR (teacher_id = auth.uid() AND group_type = 'teacher')
  );

DROP POLICY IF EXISTS "Superadmin deletes groups" ON public.groups;
CREATE POLICY "Staff delete groups"
  ON public.groups FOR DELETE
  TO authenticated
  USING (
    public.is_superadmin()
    OR (teacher_id = auth.uid() AND group_type = 'teacher')
  );
