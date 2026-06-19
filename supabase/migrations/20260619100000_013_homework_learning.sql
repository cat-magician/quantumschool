/*
  # Домашние задания, прогресс, достижения (фаза 5)

  Запустите в Supabase SQL Editor после миграции schedule_events.
*/

CREATE TABLE IF NOT EXISTS public.homework_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  lesson_summary text NOT NULL DEFAULT '',
  materials text NOT NULL DEFAULT '',
  tasks text NOT NULL DEFAULT '',
  external_url text NOT NULL DEFAULT '',
  due_at timestamptz,
  schedule_event_id uuid REFERENCES public.schedule_events(id) ON DELETE SET NULL,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer_text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'graded')),
  score smallint CHECK (score IS NULL OR (score >= 0 AND score <= 10)),
  feedback text NOT NULL DEFAULT '',
  graded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, user_id)
);

ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

-- Assignments: staff full access
DROP POLICY IF EXISTS "Staff read homework assignments" ON public.homework_assignments;
CREATE POLICY "Staff read homework assignments" ON public.homework_assignments
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Staff insert homework assignments" ON public.homework_assignments;
CREATE POLICY "Staff insert homework assignments" ON public.homework_assignments
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff update homework assignments" ON public.homework_assignments;
CREATE POLICY "Staff update homework assignments" ON public.homework_assignments
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff delete homework assignments" ON public.homework_assignments;
CREATE POLICY "Staff delete homework assignments" ON public.homework_assignments
  FOR DELETE TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Enrolled students read homework assignments" ON public.homework_assignments;
CREATE POLICY "Enrolled students read homework assignments" ON public.homework_assignments
  FOR SELECT TO authenticated
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_enrolled = true
    )
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.user_id = auth.uid() AND gm.group_id = homework_assignments.group_id
      )
    )
  );

-- Submissions: staff read/update all
DROP POLICY IF EXISTS "Staff read homework submissions" ON public.homework_submissions;
CREATE POLICY "Staff read homework submissions" ON public.homework_submissions
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Staff update homework submissions" ON public.homework_submissions;
CREATE POLICY "Staff update homework submissions" ON public.homework_submissions
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Submissions: students own
DROP POLICY IF EXISTS "Students read own submissions" ON public.homework_submissions;
CREATE POLICY "Students read own submissions" ON public.homework_submissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students insert own submissions" ON public.homework_submissions;
CREATE POLICY "Students insert own submissions" ON public.homework_submissions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students update own draft submissions" ON public.homework_submissions;
CREATE POLICY "Students update own draft submissions" ON public.homework_submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('draft', 'submitted'))
  WITH CHECK (auth.uid() = user_id);

-- Progress: staff can read/update for enrolled students
DROP POLICY IF EXISTS "Staff read course progress" ON public.course_progress;
CREATE POLICY "Staff read course progress" ON public.course_progress
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Staff manage course progress" ON public.course_progress;
CREATE POLICY "Staff manage course progress" ON public.course_progress
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Achievements: staff can award
DROP POLICY IF EXISTS "Staff read achievements" ON public.achievements;
CREATE POLICY "Staff read achievements" ON public.achievements
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Staff insert achievements" ON public.achievements;
CREATE POLICY "Staff insert achievements" ON public.achievements
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

CREATE INDEX IF NOT EXISTS idx_homework_assignments_due_at ON public.homework_assignments (due_at);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_assignment ON public.homework_submissions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_user ON public.homework_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_status ON public.homework_submissions (status);
