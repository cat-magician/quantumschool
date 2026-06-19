/*
  ЗАПУСТИТЕ ЭТОТ ФАЙЛ ЦЕЛИКОМ в Supabase → SQL Editor → Run

  Проект: gxnhrihxbgnrnmzasves
  Содержит: миграции 012 + 013 + 014 + демо-данные

  После выполнения: перезагрузите http://localhost:5173/
*/

-- ── 012: Расписание ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  event_type text NOT NULL DEFAULT 'lecture'
    CHECK (event_type IN ('lecture', 'seminar', 'webinar', 'homework', 'exam', 'consultation')),
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60 CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  meeting_url text NOT NULL DEFAULT '',
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read schedule events" ON public.schedule_events;
CREATE POLICY "Staff read schedule events" ON public.schedule_events
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Staff insert schedule events" ON public.schedule_events;
CREATE POLICY "Staff insert schedule events" ON public.schedule_events
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff update schedule events" ON public.schedule_events;
CREATE POLICY "Staff update schedule events" ON public.schedule_events
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff delete schedule events" ON public.schedule_events;
CREATE POLICY "Staff delete schedule events" ON public.schedule_events
  FOR DELETE TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Enrolled students read schedule events" ON public.schedule_events;
CREATE POLICY "Enrolled students read schedule events" ON public.schedule_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_enrolled = true
    )
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.user_id = auth.uid() AND gm.group_id = schedule_events.group_id
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_schedule_events_scheduled_at ON public.schedule_events (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_schedule_events_group_id ON public.schedule_events (group_id);

-- ── 013: Домашние задания ─────────────────────────────────────

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

DROP POLICY IF EXISTS "Staff read homework submissions" ON public.homework_submissions;
CREATE POLICY "Staff read homework submissions" ON public.homework_submissions
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Staff update homework submissions" ON public.homework_submissions;
CREATE POLICY "Staff update homework submissions" ON public.homework_submissions
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

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

DROP POLICY IF EXISTS "Staff read course progress" ON public.course_progress;
CREATE POLICY "Staff read course progress" ON public.course_progress
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Staff manage course progress" ON public.course_progress;
CREATE POLICY "Staff manage course progress" ON public.course_progress
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

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

-- ── 014: Заявки преподавателей ────────────────────────────────

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

-- ── Демо-данные ───────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.create_demo_user(
  p_email text,
  p_password text,
  p_name text,
  p_role text DEFAULT 'student'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
      '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_name, 'role', p_role), false, false, now(), now()
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_user_id, p_email,
      jsonb_build_object('sub', v_user_id::text, 'email', p_email, 'email_verified', true, 'phone_verified', false),
      'email', now(), now(), now()
    );
  ELSE
    SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  END IF;

  INSERT INTO public.user_profiles (id, display_name, role, email)
  VALUES (v_user_id, p_name, p_role, p_email)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    email = EXCLUDED.email;

  RETURN v_user_id;
END;
$$;

SELECT public.create_demo_user('prep.pending@test.qc.ru', 'demo123', 'Кандидат Преподаватель', 'student');
UPDATE public.user_profiles SET teacher_application = true WHERE email = 'prep.pending@test.qc.ru';

SELECT public.create_demo_user('student01@test.qc.ru', 'demo123', 'Анна Иванова');
UPDATE public.user_profiles SET stage1_status = 'pending', stage2_status = 'pending', is_enrolled = false WHERE email = 'student01@test.qc.ru';

SELECT public.create_demo_user('student02@test.qc.ru', 'demo123', 'Борис Петров');
UPDATE public.user_profiles SET stage1_status = 'submitted', stage2_status = 'pending', stage1_submitted_at = now() - interval '3 days', is_enrolled = false WHERE email = 'student02@test.qc.ru';

SELECT public.create_demo_user('student03@test.qc.ru', 'demo123', 'Виктор Сидоров');
UPDATE public.user_profiles SET stage1_status = 'submitted', stage2_status = 'submitted', stage1_submitted_at = now() - interval '5 days', stage2_submitted_at = now() - interval '2 days', is_enrolled = false WHERE email = 'student03@test.qc.ru';

SELECT public.create_demo_user('student04@test.qc.ru', 'demo123', 'Галина Козлова');
UPDATE public.user_profiles SET stage1_status = 'submitted', stage2_status = 'pending', stage1_submitted_at = now() - interval '7 days', stage1_score = 8, is_enrolled = false WHERE email = 'student04@test.qc.ru';

SELECT public.create_demo_user('student05@test.qc.ru', 'demo123', 'Дмитрий Орлов');
UPDATE public.user_profiles SET stage1_status = 'submitted', stage2_status = 'pending', stage1_submitted_at = now() - interval '6 days', stage1_score = 4, is_enrolled = false WHERE email = 'student05@test.qc.ru';

SELECT public.create_demo_user('student06@test.qc.ru', 'demo123', 'Елена Морозова');
UPDATE public.user_profiles SET stage1_status = 'submitted', stage2_status = 'submitted', stage1_submitted_at = now() - interval '10 days', stage2_submitted_at = now() - interval '1 day', stage1_score = 7, is_enrolled = false WHERE email = 'student06@test.qc.ru';

SELECT public.create_demo_user('student07@test.qc.ru', 'demo123', 'Игорь Волков');
UPDATE public.user_profiles SET stage1_status = 'submitted', stage2_status = 'submitted', stage1_submitted_at = now() - interval '12 days', stage2_submitted_at = now() - interval '4 days', stage1_score = 9, stage2_score = 7, is_enrolled = false WHERE email = 'student07@test.qc.ru';

SELECT public.create_demo_user('student08@test.qc.ru', 'demo123', 'Ксения Лебедева');
UPDATE public.user_profiles SET stage1_status = 'submitted', stage2_status = 'submitted', stage1_submitted_at = now() - interval '14 days', stage2_submitted_at = now() - interval '6 days', stage1_score = null, stage2_score = null, is_enrolled = true WHERE email = 'student08@test.qc.ru';

SELECT public.create_demo_user('student09@test.qc.ru', 'demo123', 'Леонид Соколов');
UPDATE public.user_profiles SET stage1_status = 'submitted', stage2_status = 'submitted', stage1_submitted_at = now() - interval '11 days', stage2_submitted_at = now() - interval '3 days', stage1_score = 8, stage2_score = 3, is_enrolled = false WHERE email = 'student09@test.qc.ru';

SELECT public.create_demo_user('student10@test.qc.ru', 'demo123', 'Мария Федорова');
UPDATE public.user_profiles SET stage1_status = 'submitted', stage2_status = 'submitted', stage1_submitted_at = now() - interval '9 days', stage2_submitted_at = now() - interval '2 days', stage2_score = 5, is_enrolled = false WHERE email = 'student10@test.qc.ru';

INSERT INTO public.groups (name, group_type, teacher_id)
SELECT 'Группа 2026', 'teacher', p.id
FROM public.user_profiles p
WHERE p.email = 'admin@test.qc.ru'
  AND NOT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.name = 'Группа 2026' AND g.group_type = 'teacher'
  );

INSERT INTO public.group_members (group_id, user_id)
SELECT g.id, u.id
FROM public.groups g
JOIN public.user_profiles u ON u.email = 'student08@test.qc.ru'
WHERE g.name = 'Группа 2026' AND g.group_type = 'teacher'
ON CONFLICT DO NOTHING;

INSERT INTO public.schedule_events (title, description, event_type, scheduled_at, duration_minutes, meeting_url, created_by)
SELECT v.title, v.description, v.event_type, v.scheduled_at, v.duration_minutes, v.meeting_url,
  (SELECT id FROM public.user_profiles WHERE email = 'admin@test.qc.ru')
FROM (VALUES
  ('Введение в квантовую механику', 'Основные постулаты и эксперименты', 'lecture', now() + interval '2 days', 90, 'https://meet.example.com/qc-1'),
  ('Семинар: кубиты и суперпозиция', 'Разбор задач с прошлой лекции', 'seminar', now() + interval '5 days', 60, 'https://meet.example.com/qc-2'),
  ('Лекция: квантовые вентили', 'NOT, Hadamard, CNOT', 'lecture', now() + interval '9 days', 90, 'https://meet.example.com/qc-3'),
  ('Семинар: алгоритм Дойча', 'Практика на Qiskit', 'seminar', now() + interval '12 days', 75, 'https://meet.example.com/qc-4'),
  ('Лекция: квантовая телепортация', 'Протокол и реализация', 'lecture', now() - interval '3 days', 90, '')
) AS v(title, description, event_type, scheduled_at, duration_minutes, meeting_url)
WHERE NOT EXISTS (SELECT 1 FROM public.schedule_events WHERE title = v.title);

INSERT INTO public.homework_assignments (title, lesson_summary, tasks, due_at, is_published, created_by)
SELECT v.title, v.lesson_summary, v.tasks, v.due_at, v.is_published,
  (SELECT id FROM public.user_profiles WHERE email = 'admin@test.qc.ru')
FROM (VALUES
  ('ДЗ 1: Базовые кубиты', 'Повторите материал лекции о кубитах', 'Решите 3 задачи в Контесте', now() + interval '7 days', true),
  ('ДЗ 2: Квантовые вентили', 'Применение вентилей Hadamard и CNOT', 'Постройте схему для состояния |+⟩', now() + interval '14 days', true),
  ('ДЗ 3: Алгоритм Дойча (черновик)', 'Черновик', 'Задачи будут добавлены позже', now() + interval '21 days', false),
  ('ДЗ 4: Квантовая телепортация (черновик)', 'Подготовка к следующей лекции', '', NULL, false)
) AS v(title, lesson_summary, tasks, due_at, is_published)
WHERE NOT EXISTS (SELECT 1 FROM public.homework_assignments WHERE title = v.title);

INSERT INTO public.homework_submissions (assignment_id, user_id, answer_text, status, score, submitted_at)
SELECT ha.id, u.id, 'Решения в Контесте', 'graded', 8, now() - interval '1 day'
FROM public.homework_assignments ha
JOIN public.user_profiles u ON u.email = 'student08@test.qc.ru'
WHERE ha.title = 'ДЗ 1: Базовые кубиты'
ON CONFLICT (assignment_id, user_id) DO NOTHING;

DROP FUNCTION public.create_demo_user(text, text, text, text);

-- ── 015: Город, школа, класс в профиле ────────────────────────

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS school text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS grade text;

UPDATE public.user_profiles up
SET
  city = COALESCE(up.city, e.city),
  grade = COALESCE(up.grade, e.grade)
FROM public.enrollments e
WHERE up.email = e.email;

-- ── 016: Просмотр этапов + отказ в зачислении ───────────────

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS stage1_viewed_at timestamptz;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS stage2_viewed_at timestamptz;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS selection_rejected boolean NOT NULL DEFAULT false;

-- ── 017: Публикуемые ссылки этапов отбора ───────────────────

CREATE TABLE IF NOT EXISTS public.selection_stage_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  essay_form_id text NOT NULL DEFAULT '',
  essay_published boolean NOT NULL DEFAULT false,
  contest_url text NOT NULL DEFAULT '',
  contest_published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.selection_stage_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.selection_stage_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read selection config" ON public.selection_stage_config;
CREATE POLICY "Authenticated read selection config" ON public.selection_stage_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Superadmin manage selection config" ON public.selection_stage_config;
CREATE POLICY "Superadmin manage selection config" ON public.selection_stage_config
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- ── 018: Устаревшие passed/failed → pending/submitted ───────

UPDATE public.user_profiles SET
  stage1_status = CASE
    WHEN stage1_status IN ('passed', 'failed') AND stage1_submitted_at IS NOT NULL THEN 'submitted'
    WHEN stage1_status IN ('passed', 'failed') THEN 'pending'
    ELSE stage1_status
  END,
  stage2_status = CASE
    WHEN stage2_status IN ('passed', 'failed') AND stage2_submitted_at IS NOT NULL THEN 'submitted'
    WHEN stage2_status IN ('passed', 'failed') THEN 'pending'
    ELSE stage2_status
  END,
  updated_at = now()
WHERE stage1_status IN ('passed', 'failed')
   OR stage2_status IN ('passed', 'failed');

-- ── 019: Несколько преподавателей на группу ─────────────────

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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.is_superadmin() OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.user_id = p_student_id AND public.is_group_teacher(gm.group_id)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_group_teacher(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_can_access_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_teacher(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_can_access_student(uuid) TO authenticated;

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
  FOR INSERT TO authenticated WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Superadmin updates groups" ON public.groups;
DROP POLICY IF EXISTS "Staff update groups" ON public.groups;
CREATE POLICY "Superadmin updates groups" ON public.groups
  FOR UPDATE TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Superadmin deletes groups" ON public.groups;
DROP POLICY IF EXISTS "Staff delete groups" ON public.groups;
CREATE POLICY "Superadmin deletes groups" ON public.groups
  FOR DELETE TO authenticated USING (public.is_superadmin());

DROP POLICY IF EXISTS "Staff read group teachers" ON public.group_teachers;
CREATE POLICY "Staff read group teachers" ON public.group_teachers
  FOR SELECT TO authenticated
  USING (public.is_superadmin() OR public.is_group_teacher(group_id));

DROP POLICY IF EXISTS "Superadmin manage group teachers" ON public.group_teachers;
CREATE POLICY "Superadmin manage group teachers" ON public.group_teachers
  FOR ALL TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Staff read group members" ON public.group_members;
CREATE POLICY "Staff read group members" ON public.group_members
  FOR SELECT TO authenticated
  USING (public.is_superadmin() OR public.is_group_teacher(group_id));

DROP POLICY IF EXISTS "Staff manage group members" ON public.group_members;
DROP POLICY IF EXISTS "Staff update group members" ON public.group_members;
DROP POLICY IF EXISTS "Staff remove group members" ON public.group_members;
DROP POLICY IF EXISTS "Staff insert group members" ON public.group_members;
CREATE POLICY "Staff insert group members" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin() OR public.is_group_teacher(group_id));

DROP POLICY IF EXISTS "Staff delete group members" ON public.group_members;
CREATE POLICY "Staff update group members" ON public.group_members
  FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR public.is_group_teacher(group_id))
  WITH CHECK (public.is_superadmin() OR public.is_group_teacher(group_id));

CREATE POLICY "Staff delete group members" ON public.group_members
  FOR DELETE TO authenticated
  USING (public.is_superadmin() OR public.is_group_teacher(group_id));

DROP POLICY IF EXISTS "Staff read homework submissions" ON public.homework_submissions;
CREATE POLICY "Staff read homework submissions" ON public.homework_submissions
  FOR SELECT TO authenticated USING (public.staff_can_access_student(user_id));

DROP POLICY IF EXISTS "Staff update homework submissions" ON public.homework_submissions;
CREATE POLICY "Staff update homework submissions" ON public.homework_submissions
  FOR UPDATE TO authenticated
  USING (public.staff_can_access_student(user_id))
  WITH CHECK (public.staff_can_access_student(user_id));

CREATE INDEX IF NOT EXISTS idx_group_teachers_group ON public.group_teachers (group_id);
CREATE INDEX IF NOT EXISTS idx_group_teachers_user ON public.group_teachers (user_id);

-- ── 020: Отклонение заявок преподавателей ─────────────────────

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS teacher_application_rejected boolean NOT NULL DEFAULT false;
