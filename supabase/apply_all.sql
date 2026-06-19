/*
  ═══════════════════════════════════════════════════════════════
  ПОЛНАЯ НАСТРОЙКА С НУЛЯ — для НОВОГО пустого проекта Supabase
  SQL Editor → New query → вставить ВСЁ → Run
  ═══════════════════════════════════════════════════════════════
*/

-- ── 1. Базовые таблицы ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title text NOT NULL,
  bio text NOT NULL,
  image_url text NOT NULL,
  specialization text NOT NULL,
  specializations text[] NOT NULL DEFAULT '{}',
  role text NOT NULL DEFAULT 'lecturer' CHECK (role IN ('lecturer', 'seminar')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  duration text NOT NULL,
  level text NOT NULL,
  price decimal(10,2) NOT NULL DEFAULT 0,
  image_url text NOT NULL,
  instructor_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL,
  features jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  avatar_url text NOT NULL,
  rating integer DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  city text,
  grade text,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  privacy_consent boolean NOT NULL DEFAULT false,
  privacy_consent_at timestamptz,
  privacy_policy_version text,
  parental_confirm boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ── 2. Профили и личный кабинет ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_url text DEFAULT '',
  email text,
  enrolled_course_id uuid REFERENCES public.courses(id),
  bio text DEFAULT '',
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('superadmin', 'admin', 'student')),
  is_enrolled boolean NOT NULL DEFAULT false,
  stage1_status text NOT NULL DEFAULT 'pending' CHECK (stage1_status IN ('pending', 'submitted', 'passed', 'failed')),
  stage2_status text NOT NULL DEFAULT 'pending' CHECK (stage2_status IN ('pending', 'submitted', 'passed', 'failed')),
  stage1_score smallint CHECK (stage1_score IS NULL OR (stage1_score >= 0 AND stage1_score <= 10)),
  stage2_score smallint CHECK (stage2_score IS NULL OR (stage2_score >= 0 AND stage2_score <= 10)),
  privacy_consent_at timestamptz,
  privacy_policy_version text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  event_type text NOT NULL DEFAULT 'lesson' CHECK (event_type IN ('lesson', 'webinar', 'homework', 'exam', 'consultation')),
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'missed', 'cancelled')),
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  meeting_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  module_title text NOT NULL,
  module_index int NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  score int DEFAULT NULL CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  completed_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, course_id, module_index)
);

CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  icon text NOT NULL DEFAULT 'award',
  earned_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.essay_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

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

-- ── 3. RLS ────────────────────────────────────────────────────

ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essay_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

-- ── 4. Функции ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT role FROM public.user_profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')); $$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'superadmin'); $$;

CREATE OR REPLACE FUNCTION public.needs_setup()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE role = 'superadmin'); $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_role text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE role = 'superadmin') THEN
    v_role := 'superadmin';
  ELSE
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'student');
  END IF;
  INSERT INTO public.user_profiles (id, display_name, role, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_role,
    new.email
  );
  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.needs_setup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.needs_setup() TO anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── 5. Политики ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Public can view instructors" ON public.instructors;
CREATE POLICY "Public can view instructors" ON public.instructors FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can view active courses" ON public.courses;
CREATE POLICY "Public can view active courses" ON public.courses FOR SELECT TO public USING (is_active = true);

DROP POLICY IF EXISTS "Public can view testimonials" ON public.testimonials;
CREATE POLICY "Public can view testimonials" ON public.testimonials FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can submit enrollments" ON public.enrollments;
CREATE POLICY "Public can submit enrollments" ON public.enrollments FOR INSERT TO public
  WITH CHECK (
    name IS NOT NULL AND length(trim(name)) > 0
    AND email IS NOT NULL AND length(trim(email)) > 0 AND email LIKE '%@%'
    AND privacy_consent = true AND parental_confirm = true
    AND privacy_consent_at IS NOT NULL AND privacy_policy_version IS NOT NULL
  );

DROP POLICY IF EXISTS "Staff can read enrollments" ON public.enrollments;
CREATE POLICY "Staff can read enrollments" ON public.enrollments FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile" ON public.user_profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Staff can read all profiles" ON public.user_profiles;
CREATE POLICY "Staff can read all profiles" ON public.user_profiles FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Staff can update student profiles" ON public.user_profiles;
CREATE POLICY "Staff can update student profiles" ON public.user_profiles FOR UPDATE TO authenticated
  USING (public.is_staff() AND role = 'student') WITH CHECK (public.is_staff() AND role = 'student');

DROP POLICY IF EXISTS "Users can read own schedule" ON public.schedule_items;
CREATE POLICY "Users can read own schedule" ON public.schedule_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own schedule" ON public.schedule_items;
CREATE POLICY "Users can insert own schedule" ON public.schedule_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own schedule" ON public.schedule_items;
CREATE POLICY "Users can update own schedule" ON public.schedule_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own progress" ON public.course_progress;
CREATE POLICY "Users can read own progress" ON public.course_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own progress" ON public.course_progress;
CREATE POLICY "Users can insert own progress" ON public.course_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own progress" ON public.course_progress;
CREATE POLICY "Users can update own progress" ON public.course_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own achievements" ON public.achievements;
CREATE POLICY "Users can read own achievements" ON public.achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own achievements" ON public.achievements;
CREATE POLICY "Users can insert own achievements" ON public.achievements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own essay" ON public.essay_submissions;
CREATE POLICY "Users can insert own essay" ON public.essay_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can select own essay" ON public.essay_submissions;
CREATE POLICY "Users can select own essay" ON public.essay_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own essay" ON public.essay_submissions;
CREATE POLICY "Users can update own essay" ON public.essay_submissions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can read groups" ON public.groups;
CREATE POLICY "Staff can read groups" ON public.groups FOR SELECT TO authenticated
  USING (public.is_superadmin() OR (public.is_staff() AND group_type = 'enrolled') OR (public.is_staff() AND group_type = 'teacher' AND teacher_id = auth.uid()));

DROP POLICY IF EXISTS "Staff create teacher groups" ON public.groups;
CREATE POLICY "Staff create teacher groups" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (public.is_superadmin() OR (public.is_staff() AND group_type = 'teacher' AND teacher_id = auth.uid()));

DROP POLICY IF EXISTS "Staff update groups" ON public.groups;
CREATE POLICY "Staff update groups" ON public.groups FOR UPDATE TO authenticated
  USING (public.is_superadmin() OR (teacher_id = auth.uid() AND group_type = 'teacher'))
  WITH CHECK (public.is_superadmin() OR (teacher_id = auth.uid() AND group_type = 'teacher'));

DROP POLICY IF EXISTS "Staff delete groups" ON public.groups;
CREATE POLICY "Staff delete groups" ON public.groups FOR DELETE TO authenticated
  USING (public.is_superadmin() OR (teacher_id = auth.uid() AND group_type = 'teacher'));

DROP POLICY IF EXISTS "Staff read group members" ON public.group_members;
CREATE POLICY "Staff read group members" ON public.group_members FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "Staff manage group members" ON public.group_members;
CREATE POLICY "Staff manage group members" ON public.group_members FOR INSERT TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "Staff update group members" ON public.group_members;
CREATE POLICY "Staff update group members" ON public.group_members FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "Staff remove group members" ON public.group_members;
CREATE POLICY "Staff remove group members" ON public.group_members FOR DELETE TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Staff read schedule events" ON public.schedule_events;
CREATE POLICY "Staff read schedule events" ON public.schedule_events FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "Staff insert schedule events" ON public.schedule_events;
CREATE POLICY "Staff insert schedule events" ON public.schedule_events FOR INSERT TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "Staff update schedule events" ON public.schedule_events;
CREATE POLICY "Staff update schedule events" ON public.schedule_events FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "Staff delete schedule events" ON public.schedule_events;
CREATE POLICY "Staff delete schedule events" ON public.schedule_events FOR DELETE TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "Enrolled students read schedule events" ON public.schedule_events;
CREATE POLICY "Enrolled students read schedule events" ON public.schedule_events FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_enrolled = true)
    AND (
      group_id IS NULL
      OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.user_id = auth.uid() AND gm.group_id = schedule_events.group_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_schedule_events_scheduled_at ON public.schedule_events (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_schedule_events_group_id ON public.schedule_events (group_id);

DROP POLICY IF EXISTS "Staff read homework assignments" ON public.homework_assignments;
CREATE POLICY "Staff read homework assignments" ON public.homework_assignments FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "Staff insert homework assignments" ON public.homework_assignments;
CREATE POLICY "Staff insert homework assignments" ON public.homework_assignments FOR INSERT TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "Staff update homework assignments" ON public.homework_assignments;
CREATE POLICY "Staff update homework assignments" ON public.homework_assignments FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "Staff delete homework assignments" ON public.homework_assignments;
CREATE POLICY "Staff delete homework assignments" ON public.homework_assignments FOR DELETE TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "Enrolled students read homework assignments" ON public.homework_assignments;
CREATE POLICY "Enrolled students read homework assignments" ON public.homework_assignments FOR SELECT TO authenticated
  USING (
    is_published = true
    AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_enrolled = true)
    AND (group_id IS NULL OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.user_id = auth.uid() AND gm.group_id = homework_assignments.group_id))
  );

DROP POLICY IF EXISTS "Staff read homework submissions" ON public.homework_submissions;
CREATE POLICY "Staff read homework submissions" ON public.homework_submissions FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "Staff update homework submissions" ON public.homework_submissions;
CREATE POLICY "Staff update homework submissions" ON public.homework_submissions FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "Students read own submissions" ON public.homework_submissions;
CREATE POLICY "Students read own submissions" ON public.homework_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Students insert own submissions" ON public.homework_submissions;
CREATE POLICY "Students insert own submissions" ON public.homework_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Students update own draft submissions" ON public.homework_submissions;
CREATE POLICY "Students update own draft submissions" ON public.homework_submissions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('draft', 'submitted')) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff read course progress" ON public.course_progress;
CREATE POLICY "Staff read course progress" ON public.course_progress FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "Staff manage course progress" ON public.course_progress;
CREATE POLICY "Staff manage course progress" ON public.course_progress FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff read achievements" ON public.achievements;
CREATE POLICY "Staff read achievements" ON public.achievements FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "Staff insert achievements" ON public.achievements;
CREATE POLICY "Staff insert achievements" ON public.achievements FOR INSERT TO authenticated WITH CHECK (public.is_staff());

CREATE INDEX IF NOT EXISTS idx_homework_assignments_due_at ON public.homework_assignments (due_at);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_assignment ON public.homework_submissions (assignment_id);

-- Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('essay-uploads', 'essay-uploads', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users upload to own folder" ON storage.objects;
CREATE POLICY "Users upload to own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'essay-uploads' AND (storage.foldername(name))[1] = 'essays' AND (storage.foldername(name))[2] = auth.uid()::text);
DROP POLICY IF EXISTS "Users read own files" ON storage.objects;
CREATE POLICY "Users read own files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'essay-uploads' AND (storage.foldername(name))[1] = 'essays' AND (storage.foldername(name))[2] = auth.uid()::text);
DROP POLICY IF EXISTS "Users update own files" ON storage.objects;
CREATE POLICY "Users update own files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'essay-uploads' AND (storage.foldername(name))[1] = 'essays' AND (storage.foldername(name))[2] = auth.uid()::text);

-- ── 6. Начальные данные ───────────────────────────────────────

INSERT INTO public.groups (name, group_type)
SELECT 'Зачисленные', 'enrolled'
WHERE NOT EXISTS (SELECT 1 FROM public.groups WHERE group_type = 'enrolled');

INSERT INTO public.instructors (name, title, bio, image_url, specialization, specializations, sort_order) VALUES
  ('Dr. Елена Волкова', 'Профессор квантовой физики',
   'Ведущий исследователь в области квантовых вычислений с 15-летним опытом.',
   'https://images.pexels.com/photos/3769045/pexels-photo-3769045.jpeg?auto=compress&cs=tinysrgb&w=400',
   'Квантовые алгоритмы', ARRAY['Квантовые алгоритмы'], 1),
  ('Dr. Андрей Стрельцов', 'Старший научный сотрудник',
   'Специалист по квантовой криптографии и квантовой коммуникации.',
   'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400',
   'Квантовая криптография', ARRAY['Квантовая криптография', 'Квантовые вычисления'], 2),
  ('Dr. Мария Петрова', 'PhD по квантовой информатике',
   'Эксперт по квантовой оптике и квантовым сетям.',
   'https://images.pexels.com/photos/3756679/pexels-photo-3756679.jpeg?auto=compress&cs=tinysrgb&w=400',
   'Квантовые сети', ARRAY['Квантовые сети'], 3);

-- ── 7. Заявки преподавателей (миграция 014) ───────────────────

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS teacher_application boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS stage1_submitted_at timestamptz;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS stage2_submitted_at timestamptz;

DROP POLICY IF EXISTS "Users update own selection progress" ON public.user_profiles;
CREATE POLICY "Users update own selection progress" ON public.user_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Superadmin update roles" ON public.user_profiles;
CREATE POLICY "Superadmin update roles" ON public.user_profiles
  FOR UPDATE TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- ── 8. Тестовые пользователи ──────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.create_test_user(
  p_email text, p_password text, p_name text, p_role text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_user_id uuid;
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
  END IF;
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  INSERT INTO public.user_profiles (id, display_name, role, email)
  VALUES (v_user_id, p_name, p_role, p_email)
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, role = EXCLUDED.role, email = EXCLUDED.email;
END;
$$;

SELECT public.create_test_user('superadmin@test.qc.ru', 'superadmin123', 'Тест Суперадмин', 'superadmin');
SELECT public.create_test_user('admin@test.qc.ru', 'admin123', 'Тест Преподаватель', 'admin');
SELECT public.create_test_user('student@test.qc.ru', 'student123', 'Тест Ученик', 'student');

DROP FUNCTION public.create_test_user(text, text, text, text);

-- Для расширенного набора (10 учеников, расписание, ДЗ) запустите seed_demo_data.sql
