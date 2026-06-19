/*
  Заявки преподавателей + отметки прохождения отбора
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS teacher_application boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS stage1_submitted_at timestamptz;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS stage2_submitted_at timestamptz;

DROP POLICY IF EXISTS "Users update own selection progress" ON public.user_profiles;
CREATE POLICY "Users update own selection progress" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Superadmin update roles" ON public.user_profiles;
CREATE POLICY "Superadmin update roles" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());
