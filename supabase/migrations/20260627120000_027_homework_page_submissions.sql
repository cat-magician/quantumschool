/*
  # Ответы учеников на страницы домашних заданий (homework_pages)
*/

CREATE TABLE IF NOT EXISTS public.homework_page_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.homework_pages(id) ON DELETE CASCADE,
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
  UNIQUE (page_id, user_id)
);

ALTER TABLE public.homework_page_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read homework page submissions" ON public.homework_page_submissions;
CREATE POLICY "Staff read homework page submissions" ON public.homework_page_submissions
  FOR SELECT TO authenticated
  USING (public.staff_can_access_student(user_id));

DROP POLICY IF EXISTS "Staff update homework page submissions" ON public.homework_page_submissions;
CREATE POLICY "Staff update homework page submissions" ON public.homework_page_submissions
  FOR UPDATE TO authenticated
  USING (public.staff_can_access_student(user_id))
  WITH CHECK (public.staff_can_access_student(user_id));

DROP POLICY IF EXISTS "Students read own homework page submissions" ON public.homework_page_submissions;
CREATE POLICY "Students read own homework page submissions" ON public.homework_page_submissions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students insert own homework page submissions" ON public.homework_page_submissions;
CREATE POLICY "Students insert own homework page submissions" ON public.homework_page_submissions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students update own homework page submissions" ON public.homework_page_submissions;
CREATE POLICY "Students update own homework page submissions" ON public.homework_page_submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('draft', 'submitted'))
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_homework_page_submissions_page ON public.homework_page_submissions (page_id);
CREATE INDEX IF NOT EXISTS idx_homework_page_submissions_user ON public.homework_page_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_homework_page_submissions_status ON public.homework_page_submissions (status);
