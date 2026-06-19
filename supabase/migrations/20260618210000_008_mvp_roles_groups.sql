/*
  # MVP: Roles, enrollment status, groups

  - user_profiles: role, is_enrolled, selection stage statuses/scores
  - groups + group_members (one group per student)
  - RLS helpers for staff access
*/

-- ── Profile extensions ──────────────────────────────────────

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student'
    CHECK (role IN ('superadmin', 'admin', 'student'));

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_enrolled boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS stage1_status text NOT NULL DEFAULT 'pending'
    CHECK (stage1_status IN ('pending', 'submitted', 'passed', 'failed'));

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS stage2_status text NOT NULL DEFAULT 'pending'
    CHECK (stage2_status IN ('pending', 'submitted', 'passed', 'failed'));

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS stage1_score smallint
    CHECK (stage1_score IS NULL OR (stage1_score >= 0 AND stage1_score <= 10));

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS stage2_score smallint
    CHECK (stage2_score IS NULL OR (stage2_score >= 0 AND stage2_score <= 10));

-- ── Groups ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  group_type text NOT NULL CHECK (group_type IN ('enrolled', 'teacher')),
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- ── RLS helpers ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

-- ── user_profiles policies ────────────────────────────────────

DROP POLICY IF EXISTS "Staff can read all profiles" ON public.user_profiles;
CREATE POLICY "Staff can read all profiles"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "Staff can update student profiles" ON public.user_profiles;
CREATE POLICY "Staff can update student profiles"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ── groups policies ───────────────────────────────────────────

CREATE POLICY "Staff can read groups"
  ON public.groups FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "Superadmin manages groups"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (public.is_superadmin());

CREATE POLICY "Superadmin updates groups"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "Superadmin deletes groups"
  ON public.groups FOR DELETE
  TO authenticated
  USING (public.is_superadmin());

CREATE POLICY "Staff read group members"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "Staff manage group members"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "Staff update group members"
  ON public.group_members FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "Staff remove group members"
  ON public.group_members FOR DELETE
  TO authenticated
  USING (public.is_staff());

-- ── Default enrolled group ────────────────────────────────────

INSERT INTO public.groups (name, group_type)
SELECT 'Зачисленные', 'enrolled'
WHERE NOT EXISTS (
  SELECT 1 FROM public.groups WHERE group_type = 'enrolled'
);

-- ── Auto profile on signup ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'student')
  );
  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;
