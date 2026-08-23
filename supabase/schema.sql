/*
  СХЕМА САЙТА «Квантовый кружок» — без демо-данных.

  Запускайте ВСЕГДА при деплое / обновлении БД (Supabase SQL Editor, Bolt и т.д.).
  Идемпотентно: повторный запуск безопасен.

  Демо-данные (опционально): supabase/demo/apply.sql
  Удалить демо:              supabase/demo/remove.sql
  Сбросить демо:             supabase/demo/reset.sql

  Сгенерировано: node scripts/build-schema.mjs
  Источник: supabase/migrations/ (все .sql по порядку)
*/


-- ══════════════════════════════════════════════════════════════
-- 20260524171843_001_quantum_school_schema.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Quantum School Database Schema

  1. New Tables
    - `courses` - Stores course information for quantum technology programs
      - `id` (uuid, primary key)
      - `title` (text) - Course name
      - `description` (text) - Course description
      - `duration` (text) - Course duration (e.g., "8 weeks")
      - `level` (text) - Difficulty level (Beginner, Intermediate, Advanced)
      - `price` (decimal) - Course price
      - `image_url` (text) - Course cover image from Pexels
      - `instructor_id` (uuid, foreign key) - Reference to instructor
      - `features` (jsonb) - List of course features
      - `created_at` (timestamp)
      - `is_active` (boolean) - Whether course is available
    
    - `instructors` - Stores instructor information
      - `id` (uuid, primary key)
      - `name` (text) - Instructor name
      - `title` (text) - Professional title
      - `bio` (text) - Short biography
      - `image_url` (text) - Profile photo from Pexels
      - `specialization` (text) - Area of expertise
      - `created_at` (timestamp)
    
    - `testimonials` - Stores student testimonials
      - `id` (uuid, primary key)
      - `name` (text) - Student name
      - `role` (text) - Student role/background
      - `content` (text) - Testimonial text
      - `avatar_url` (text) - Student photo from Pexels
      - `rating` (integer) - Star rating (1-5)
      - `created_at` (timestamp)
    
    - `enrollments` - Stores course enrollment requests
      - `id` (uuid, primary key)
      - `name` (text) - Student name
      - `email` (text) - Contact email
      - `phone` (text) - Contact phone
      - `course_id` (uuid, foreign key) - Reference to course
      - `message` (text) - Optional message
      - `status` (text) - Enrollment status (pending, approved, rejected)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Public read access for courses, instructors, testimonials
    - Public insert access for enrollments (registration form)
    - No update/delete policies for public access

  3. Important Notes
    - All tables use UUID primary keys
    - Timestamps track creation time
    - RLS policies allow public access to display data
    - Enrollment submissions are public, status management requires authentication
*/

-- Create instructors table
CREATE TABLE IF NOT EXISTS instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title text NOT NULL,
  bio text NOT NULL,
  image_url text NOT NULL,
  specialization text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  duration text NOT NULL,
  level text NOT NULL,
  price decimal(10,2) NOT NULL DEFAULT 0,
  image_url text NOT NULL,
  instructor_id uuid REFERENCES instructors(id) ON DELETE SET NULL,
  features jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Create testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  avatar_url text NOT NULL,
  rating integer DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz DEFAULT now()
);

-- Create enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for instructors (public read only)
DROP POLICY IF EXISTS "Public can view instructors" ON instructors;
CREATE POLICY "Public can view instructors" ON instructors FOR SELECT
  TO public
  USING (true);

-- RLS Policies for courses (public read only for active courses)
DROP POLICY IF EXISTS "Public can view active courses" ON courses;
CREATE POLICY "Public can view active courses" ON courses FOR SELECT
  TO public
  USING (is_active = true);

-- RLS Policies for testimonials (public read only)
DROP POLICY IF EXISTS "Public can view testimonials" ON testimonials;
CREATE POLICY "Public can view testimonials" ON testimonials FOR SELECT
  TO public
  USING (true);

-- RLS Policies for enrollments (public insert, no read/update/delete for public)
DROP POLICY IF EXISTS "Public can submit enrollments" ON enrollments;
CREATE POLICY "Public can submit enrollments" ON enrollments FOR INSERT
  TO public
  WITH CHECK (true);

-- Преподавателей и контент главной добавляют через админку (SiteContentTab), не через schema.sql.

-- ══════════════════════════════════════════════════════════════
-- 20260524182508_002_user_dashboard.sql
-- ══════════════════════════════════════════════════════════════

/*
  # User Dashboard Schema

  Creates tables for the participant personal cabinet:

  1. New Tables
    - `user_profiles` — extended profile (display name, avatar, enrolled course)
    - `schedule_items` — lessons/events with date, time, title, type, status
    - `course_progress` — per-module progress for each enrolled user
    - `achievements` — badges/achievements earned by users

  2. Security
    - RLS enabled on all tables
    - Users can only read/write their own data
*/

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_url text DEFAULT '',
  enrolled_course_id uuid REFERENCES courses(id),
  bio text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Schedule items
CREATE TABLE IF NOT EXISTS schedule_items (
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

ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own schedule" ON schedule_items;
CREATE POLICY "Users can read own schedule" ON schedule_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own schedule" ON schedule_items;
CREATE POLICY "Users can insert own schedule" ON schedule_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own schedule" ON schedule_items;
CREATE POLICY "Users can update own schedule" ON schedule_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Course progress (per module)
CREATE TABLE IF NOT EXISTS course_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_title text NOT NULL,
  module_index int NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  score int DEFAULT NULL CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  completed_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, course_id, module_index)
);

ALTER TABLE course_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own progress" ON course_progress;
CREATE POLICY "Users can read own progress" ON course_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own progress" ON course_progress;
CREATE POLICY "Users can insert own progress" ON course_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own progress" ON course_progress;
CREATE POLICY "Users can update own progress" ON course_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  icon text NOT NULL DEFAULT 'award',
  earned_at timestamptz DEFAULT now()
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own achievements" ON achievements;
CREATE POLICY "Users can read own achievements" ON achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT только через триггер (award_achievement_if_new); клиентам запрещено.

-- Seed demo data function (called after user registers)
-- When a new user registers we auto-create their profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ══════════════════════════════════════════════════════════════
-- 20260526205007_003_instructor_role.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Add role field to instructors table

  1. Changes
    - `instructors` table: add `role` column with values 'lecturer' | 'seminar'
    - Default existing instructors to 'lecturer'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'instructors' AND column_name = 'role'
  ) THEN
    ALTER TABLE instructors ADD COLUMN role text NOT NULL DEFAULT 'lecturer'
      CHECK (role IN ('lecturer', 'seminar'));
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 20260526210543_004_instructor_specializations_array.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Add specializations array to instructors

  ## Summary
  Adds support for multiple specializations per instructor.

  ## Changes
  - New column `specializations` (text[]) added to `instructors` table
  - Existing `specialization` values migrated into the new array column
  - Dr. Андрей Стрельцов gets a second specialization "Квантовые вычисления"
  - Old `specialization` column kept for backwards compatibility but array is now primary

  ## Notes
  - No data is lost — existing values are preserved in the new array
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'instructors' AND column_name = 'specializations'
  ) THEN
    ALTER TABLE instructors ADD COLUMN specializations text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- Migrate existing single specialization into array
UPDATE instructors
SET specializations = ARRAY[specialization]
WHERE specializations = '{}' AND specialization IS NOT NULL AND specialization != '';

-- Add second specialization for Dr. Андрей Стрельцов
UPDATE instructors
SET specializations = ARRAY['Нелинейная и квантовая оптика', 'Квантовые вычисления']
WHERE id = 'e8a236f5-5ad5-4040-88bd-95ac5b2efb18';

-- Also update specialization text field for consistency
UPDATE instructors
SET specialization = 'Нелинейная и квантовая оптика'
WHERE id = 'e8a236f5-5ad5-4040-88bd-95ac5b2efb18';

-- ══════════════════════════════════════════════════════════════
-- 20260526211906_005_add_sort_order_to_instructors.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Add sort_order to instructors

  1. Changes
    - Add `sort_order` integer column to `instructors` table with default 0
    - Set sort order: Дарья Сокол = 1, Dr. Дмитрий = 2, Dr. Елена = 3 (last)
*/

ALTER TABLE instructors ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

UPDATE instructors SET sort_order = 1 WHERE id = '4d6f4b0b-9b26-48f7-9a09-376466467bca';
UPDATE instructors SET sort_order = 2 WHERE id = 'e8a236f5-5ad5-4040-88bd-95ac5b2efb18';
UPDATE instructors SET sort_order = 3 WHERE id = 'e0608e84-bea0-4a18-b2e9-9f5e122ee242';

-- ══════════════════════════════════════════════════════════════
-- 20260529200339_006_essay_submissions.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Essay Submissions

  1. New Tables
    - `essay_submissions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `file_path` (text) — path inside the essay-uploads storage bucket
      - `status` (text) — 'submitted' | 'reviewed' | 'accepted' | 'rejected'
      - `submitted_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Storage
    - Creates the `essay-uploads` bucket (private)
    - Creates the `avatars` bucket (public, one file per user in `{user_id}/`)

  3. Security
    - RLS enabled on essay_submissions
    - Users can insert/select their own submission
    - Storage policies: users can upload to their own folder
*/

CREATE TABLE IF NOT EXISTS essay_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE essay_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own essay" ON essay_submissions;
CREATE POLICY "Users can insert own essay" ON essay_submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can select own essay" ON essay_submissions;
CREATE POLICY "Users can select own essay" ON essay_submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own essay" ON essay_submissions;
CREATE POLICY "Users can update own essay" ON essay_submissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('essay-uploads', 'essay-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Users upload to own folder" ON storage.objects;
CREATE POLICY "Users upload to own folder" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'essay-uploads'
    AND (storage.foldername(name))[1] = 'essays'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users read own files" ON storage.objects;
CREATE POLICY "Users read own files" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'essay-uploads'
    AND (storage.foldername(name))[1] = 'essays'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own files" ON storage.objects;
CREATE POLICY "Users update own files" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'essay-uploads'
    AND (storage.foldername(name))[1] = 'essays'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- User avatars (public bucket, one folder per user)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket public=true: прямой URL (/object/public/avatars/…) работает без SELECT-политики.
-- Намеренно нет политики «read all avatars» — иначе любой может листить bucket через API.

DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;

DROP POLICY IF EXISTS "Users read own avatar" ON storage.objects;
CREATE POLICY "Users read own avatar" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- ══════════════════════════════════════════════════════════════
-- 20260529202102_007_security_fixes.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Security Fixes

  1. Fix mutable search_path on handle_new_user function
     - Recreate the function with SET search_path = '' and fully qualified table names
     - This prevents search_path injection attacks

  2. Revoke EXECUTE on handle_new_user from anon and authenticated roles
     - The function is a trigger, it should only be callable by the system (postgres role)
     - Public roles should not be able to call it directly via RPC

  3. Fix RLS policy on enrollments INSERT
     - Replace the always-true WITH CHECK (true) with a meaningful check
     - Validate that required fields are non-empty to prevent junk submissions
     - The enrollment form is public (no auth required) but we add field validation
*/

-- 1. Recreate handle_new_user with fixed search_path and fully qualified names
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$;

-- 2. Revoke EXECUTE from anon and authenticated (trigger functions should only run as system)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;

-- 3. Drop the overly permissive enrollments INSERT policy
DROP POLICY IF EXISTS "Public can submit enrollments" ON public.enrollments;

-- Recreate with meaningful validation: name and email must be non-empty strings
DROP POLICY IF EXISTS "Public can submit enrollments" ON public.enrollments;
CREATE POLICY "Public can submit enrollments" ON public.enrollments FOR INSERT
  TO public
  WITH CHECK (
    name IS NOT NULL AND length(trim(name)) > 0
    AND email IS NOT NULL AND length(trim(email)) > 0
    AND email LIKE '%@%'
  );

-- ══════════════════════════════════════════════════════════════
-- 20260618210000_008_mvp_roles_groups.sql
-- ══════════════════════════════════════════════════════════════

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

-- ── Private schema: RLS-хелперы (не в Exposed Schemas → нет /rest/v1/rpc/…) ──
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

-- ── RLS helpers ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.is_staff()
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

CREATE OR REPLACE FUNCTION private.is_superadmin()
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

-- ── user_profiles policies ────────────────────────────────────

DROP POLICY IF EXISTS "Staff can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Staff can read all profiles" ON public.user_profiles;
CREATE POLICY "Staff can read all profiles" ON public.user_profiles FOR SELECT
  TO authenticated
  USING (private.is_staff());

DROP POLICY IF EXISTS "Staff can update student profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Staff can update student profiles" ON public.user_profiles;
CREATE POLICY "Staff can update student profiles" ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (private.is_staff())
  WITH CHECK (private.is_staff());

-- ── groups policies ───────────────────────────────────────────

DROP POLICY IF EXISTS "Staff can read groups" ON public.groups;
CREATE POLICY "Staff can read groups" ON public.groups FOR SELECT
  TO authenticated
  USING (private.is_staff());

DROP POLICY IF EXISTS "Superadmin manages groups" ON public.groups;
CREATE POLICY "Superadmin manages groups" ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (private.is_superadmin());

DROP POLICY IF EXISTS "Superadmin updates groups" ON public.groups;
CREATE POLICY "Superadmin updates groups" ON public.groups FOR UPDATE
  TO authenticated
  USING (private.is_superadmin())
  WITH CHECK (private.is_superadmin());

DROP POLICY IF EXISTS "Superadmin deletes groups" ON public.groups;
CREATE POLICY "Superadmin deletes groups" ON public.groups FOR DELETE
  TO authenticated
  USING (private.is_superadmin());

DROP POLICY IF EXISTS "Staff read group members" ON public.group_members;
CREATE POLICY "Staff read group members" ON public.group_members FOR SELECT
  TO authenticated
  USING (private.is_staff());

DROP POLICY IF EXISTS "Staff manage group members" ON public.group_members;
CREATE POLICY "Staff manage group members" ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "Staff update group members" ON public.group_members;
CREATE POLICY "Staff update group members" ON public.group_members FOR UPDATE
  TO authenticated
  USING (private.is_staff())
  WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "Staff remove group members" ON public.group_members;
CREATE POLICY "Staff remove group members" ON public.group_members FOR DELETE
  TO authenticated
  USING (private.is_staff());

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

-- ══════════════════════════════════════════════════════════════
-- 20260618220000_009_privacy_consent.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Privacy consent and enrollment fields

  - city, grade on enrollments
  - privacy consent tracking on enrollments and user_profiles
  - RLS: require consent on public enrollment insert
*/

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS privacy_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_policy_version text,
  ADD COLUMN IF NOT EXISTS parental_confirm boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_policy_version text;

DROP POLICY IF EXISTS "Public can submit enrollments" ON public.enrollments;

DROP POLICY IF EXISTS "Public can submit enrollments" ON public.enrollments;
CREATE POLICY "Public can submit enrollments" ON public.enrollments FOR INSERT
  TO public
  WITH CHECK (
    name IS NOT NULL AND length(trim(name)) > 0
    AND email IS NOT NULL AND length(trim(email)) > 0
    AND email LIKE '%@%'
    AND privacy_consent = true
    AND parental_confirm = true
    AND privacy_consent_at IS NOT NULL
    AND privacy_policy_version IS NOT NULL
  );

-- ══════════════════════════════════════════════════════════════
-- 20260618230000_010_admin_improvements.sql
-- ══════════════════════════════════════════════════════════════

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

DROP POLICY IF EXISTS "Staff can update student profiles" ON public.user_profiles;
CREATE POLICY "Staff can update student profiles" ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (private.is_staff() AND role = 'student')
  WITH CHECK (private.is_staff() AND role = 'student');

DROP POLICY IF EXISTS "Staff can read enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Staff can read enrollments" ON public.enrollments;
CREATE POLICY "Staff can read enrollments" ON public.enrollments FOR SELECT
  TO authenticated
  USING (private.is_staff());

-- Admins see only their teacher groups; superadmins see all
DROP POLICY IF EXISTS "Staff can read groups" ON public.groups;
DROP POLICY IF EXISTS "Staff can read groups" ON public.groups;
CREATE POLICY "Staff can read groups" ON public.groups FOR SELECT
  TO authenticated
  USING (
    private.is_superadmin()
    OR (private.is_staff() AND group_type = 'enrolled')
    OR (private.is_staff() AND group_type = 'teacher' AND teacher_id = auth.uid())
  );

-- Admins can create/update teacher groups assigned to themselves
DROP POLICY IF EXISTS "Superadmin manages groups" ON public.groups;
DROP POLICY IF EXISTS "Staff create teacher groups" ON public.groups;
CREATE POLICY "Staff create teacher groups" ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (
    private.is_superadmin()
    OR (private.is_staff() AND group_type = 'teacher' AND teacher_id = auth.uid())
  );

DROP POLICY IF EXISTS "Superadmin updates groups" ON public.groups;
DROP POLICY IF EXISTS "Staff update groups" ON public.groups;
CREATE POLICY "Staff update groups" ON public.groups FOR UPDATE
  TO authenticated
  USING (
    private.is_superadmin()
    OR (teacher_id = auth.uid() AND group_type = 'teacher')
  )
  WITH CHECK (
    private.is_superadmin()
    OR (teacher_id = auth.uid() AND group_type = 'teacher')
  );

DROP POLICY IF EXISTS "Superadmin deletes groups" ON public.groups;
DROP POLICY IF EXISTS "Staff delete groups" ON public.groups;
CREATE POLICY "Staff delete groups" ON public.groups FOR DELETE
  TO authenticated
  USING (
    private.is_superadmin()
    OR (teacher_id = auth.uid() AND group_type = 'teacher')
  );

-- ══════════════════════════════════════════════════════════════
-- 20260618240000_011_bootstrap_first_admin.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Bootstrap: first registered user becomes superadmin
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
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

CREATE OR REPLACE FUNCTION public.needs_setup()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE role = 'superadmin');
$$;

REVOKE EXECUTE ON FUNCTION public.needs_setup() FROM PUBLIC;

-- ══════════════════════════════════════════════════════════════
-- 20260619000000_012_schedule_events.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Расписание: общие события курса (лекции, семинары)

  Запустите в Supabase SQL Editor, если проект уже создан через apply_all.sql.
*/

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
DROP POLICY IF EXISTS "Staff read schedule events" ON public.schedule_events;
CREATE POLICY "Staff read schedule events" ON public.schedule_events
  FOR SELECT TO authenticated USING (private.is_staff());

DROP POLICY IF EXISTS "Staff insert schedule events" ON public.schedule_events;
DROP POLICY IF EXISTS "Staff insert schedule events" ON public.schedule_events;
CREATE POLICY "Staff insert schedule events" ON public.schedule_events
  FOR INSERT TO authenticated WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "Staff update schedule events" ON public.schedule_events;
DROP POLICY IF EXISTS "Staff update schedule events" ON public.schedule_events;
CREATE POLICY "Staff update schedule events" ON public.schedule_events
  FOR UPDATE TO authenticated USING (private.is_staff()) WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "Staff delete schedule events" ON public.schedule_events;
DROP POLICY IF EXISTS "Staff delete schedule events" ON public.schedule_events;
CREATE POLICY "Staff delete schedule events" ON public.schedule_events
  FOR DELETE TO authenticated USING (private.is_staff());

DROP POLICY IF EXISTS "Enrolled students read schedule events" ON public.schedule_events;
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

-- ══════════════════════════════════════════════════════════════
-- 20260619100000_013_homework_learning.sql
-- ══════════════════════════════════════════════════════════════

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
DROP POLICY IF EXISTS "Staff read homework assignments" ON public.homework_assignments;
CREATE POLICY "Staff read homework assignments" ON public.homework_assignments
  FOR SELECT TO authenticated USING (private.is_staff());

DROP POLICY IF EXISTS "Staff insert homework assignments" ON public.homework_assignments;
DROP POLICY IF EXISTS "Staff insert homework assignments" ON public.homework_assignments;
CREATE POLICY "Staff insert homework assignments" ON public.homework_assignments
  FOR INSERT TO authenticated WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "Staff update homework assignments" ON public.homework_assignments;
DROP POLICY IF EXISTS "Staff update homework assignments" ON public.homework_assignments;
CREATE POLICY "Staff update homework assignments" ON public.homework_assignments
  FOR UPDATE TO authenticated USING (private.is_staff()) WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "Staff delete homework assignments" ON public.homework_assignments;
DROP POLICY IF EXISTS "Staff delete homework assignments" ON public.homework_assignments;
CREATE POLICY "Staff delete homework assignments" ON public.homework_assignments
  FOR DELETE TO authenticated USING (private.is_staff());

DROP POLICY IF EXISTS "Enrolled students read homework assignments" ON public.homework_assignments;
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
DROP POLICY IF EXISTS "Staff read homework submissions" ON public.homework_submissions;
CREATE POLICY "Staff read homework submissions" ON public.homework_submissions
  FOR SELECT TO authenticated USING (private.is_staff());

DROP POLICY IF EXISTS "Staff update homework submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "Staff update homework submissions" ON public.homework_submissions;
CREATE POLICY "Staff update homework submissions" ON public.homework_submissions
  FOR UPDATE TO authenticated USING (private.is_staff()) WITH CHECK (private.is_staff());

-- Submissions: students own
DROP POLICY IF EXISTS "Students read own submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "Students read own submissions" ON public.homework_submissions;
CREATE POLICY "Students read own submissions" ON public.homework_submissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students insert own submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "Students insert own submissions" ON public.homework_submissions;
CREATE POLICY "Students insert own submissions" ON public.homework_submissions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students update own draft submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "Students update own draft submissions" ON public.homework_submissions;
CREATE POLICY "Students update own draft submissions" ON public.homework_submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('draft', 'submitted'))
  WITH CHECK (auth.uid() = user_id);

-- Progress: staff can read/update for enrolled students
DROP POLICY IF EXISTS "Staff read course progress" ON public.course_progress;
DROP POLICY IF EXISTS "Staff read course progress" ON public.course_progress;
CREATE POLICY "Staff read course progress" ON public.course_progress
  FOR SELECT TO authenticated USING (private.is_staff());

DROP POLICY IF EXISTS "Staff manage course progress" ON public.course_progress;
DROP POLICY IF EXISTS "Staff manage course progress" ON public.course_progress;
CREATE POLICY "Staff manage course progress" ON public.course_progress
  FOR ALL TO authenticated USING (private.is_staff()) WITH CHECK (private.is_staff());

-- Achievements: staff can award
DROP POLICY IF EXISTS "Staff read achievements" ON public.achievements;
DROP POLICY IF EXISTS "Staff read achievements" ON public.achievements;
CREATE POLICY "Staff read achievements" ON public.achievements
  FOR SELECT TO authenticated USING (private.is_staff());

CREATE INDEX IF NOT EXISTS idx_homework_assignments_due_at ON public.homework_assignments (due_at);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_assignment ON public.homework_submissions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_user ON public.homework_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_status ON public.homework_submissions (status);

-- ══════════════════════════════════════════════════════════════
-- 20260619120000_014_teacher_applications.sql
-- ══════════════════════════════════════════════════════════════

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
DROP POLICY IF EXISTS "Users update own selection progress" ON public.user_profiles;
CREATE POLICY "Users update own selection progress" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Superadmin update roles" ON public.user_profiles;
DROP POLICY IF EXISTS "Superadmin update roles" ON public.user_profiles;
CREATE POLICY "Superadmin update roles" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (private.is_superadmin())
  WITH CHECK (private.is_superadmin());

-- ══════════════════════════════════════════════════════════════
-- 20260619130000_015_profile_application_fields.sql
-- ══════════════════════════════════════════════════════════════

/*
  Город, школа, класс в профиле ученика (из формы заявки)
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS school text;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS grade text;

UPDATE public.user_profiles up
SET
  city = COALESCE(up.city, e.city),
  grade = COALESCE(up.grade, e.grade)
FROM public.enrollments e
WHERE up.email = e.email;

-- ══════════════════════════════════════════════════════════════
-- 20260619140000_016_selection_tracking.sql
-- ══════════════════════════════════════════════════════════════

/*
  Просмотр этапов отбора + явный отказ в зачислении
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS stage1_viewed_at timestamptz;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS stage2_viewed_at timestamptz;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS selection_rejected boolean NOT NULL DEFAULT false;

-- ══════════════════════════════════════════════════════════════
-- 20260619150000_017_selection_stage_config.sql
-- ══════════════════════════════════════════════════════════════

-- Публикуемые ссылки на форму эссе и контест этапа 2

CREATE TABLE IF NOT EXISTS public.selection_stage_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  essay_form_id text NOT NULL DEFAULT '',
  essay_published boolean NOT NULL DEFAULT false,
  questionnaire_form_id text NOT NULL DEFAULT '',
  questionnaire_published boolean NOT NULL DEFAULT false,
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
DROP POLICY IF EXISTS "Authenticated read selection config" ON public.selection_stage_config;
CREATE POLICY "Authenticated read selection config" ON public.selection_stage_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Superadmin manage selection config" ON public.selection_stage_config;
DROP POLICY IF EXISTS "Superadmin manage selection config" ON public.selection_stage_config;
CREATE POLICY "Superadmin manage selection config" ON public.selection_stage_config
  FOR ALL TO authenticated
  USING (private.is_superadmin())
  WITH CHECK (private.is_superadmin());

-- ══════════════════════════════════════════════════════════════
-- 20260620120000_019_group_teachers.sql
-- ══════════════════════════════════════════════════════════════

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

CREATE OR REPLACE FUNCTION private.is_group_teacher(p_group_id uuid)
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

CREATE OR REPLACE FUNCTION private.staff_can_access_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_superadmin() OR EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.user_id = p_student_id
      AND private.is_group_teacher(gm.group_id)
  );
$$;

-- groups
DROP POLICY IF EXISTS "Staff can read groups" ON public.groups;
DROP POLICY IF EXISTS "Staff can read groups" ON public.groups;
CREATE POLICY "Staff can read groups" ON public.groups
  FOR SELECT TO authenticated
  USING (
    private.is_superadmin()
    OR (group_type = 'enrolled' AND private.is_staff())
    OR (group_type = 'teacher' AND private.is_group_teacher(id))
  );

DROP POLICY IF EXISTS "Superadmin manages groups" ON public.groups;
DROP POLICY IF EXISTS "Staff create teacher groups" ON public.groups;
DROP POLICY IF EXISTS "Superadmin creates groups" ON public.groups;
DROP POLICY IF EXISTS "Superadmin creates groups" ON public.groups;
CREATE POLICY "Superadmin creates groups" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (private.is_superadmin());

DROP POLICY IF EXISTS "Superadmin updates groups" ON public.groups;
DROP POLICY IF EXISTS "Staff update groups" ON public.groups;
DROP POLICY IF EXISTS "Superadmin updates groups" ON public.groups;
CREATE POLICY "Superadmin updates groups" ON public.groups
  FOR UPDATE TO authenticated
  USING (private.is_superadmin())
  WITH CHECK (private.is_superadmin());

DROP POLICY IF EXISTS "Superadmin deletes groups" ON public.groups;
DROP POLICY IF EXISTS "Staff delete groups" ON public.groups;
DROP POLICY IF EXISTS "Superadmin deletes groups" ON public.groups;
CREATE POLICY "Superadmin deletes groups" ON public.groups
  FOR DELETE TO authenticated
  USING (private.is_superadmin());

-- group_teachers
DROP POLICY IF EXISTS "Staff read group teachers" ON public.group_teachers;
DROP POLICY IF EXISTS "Staff read group teachers" ON public.group_teachers;
CREATE POLICY "Staff read group teachers" ON public.group_teachers
  FOR SELECT TO authenticated
  USING (private.is_superadmin() OR private.is_group_teacher(group_id));

DROP POLICY IF EXISTS "Superadmin manage group teachers" ON public.group_teachers;
DROP POLICY IF EXISTS "Superadmin manage group teachers" ON public.group_teachers;
CREATE POLICY "Superadmin manage group teachers" ON public.group_teachers
  FOR ALL TO authenticated
  USING (private.is_superadmin())
  WITH CHECK (private.is_superadmin());

-- group_members
DROP POLICY IF EXISTS "Staff read group members" ON public.group_members;
DROP POLICY IF EXISTS "Staff read group members" ON public.group_members;
CREATE POLICY "Staff read group members" ON public.group_members
  FOR SELECT TO authenticated
  USING (
    private.is_superadmin()
    OR private.is_group_teacher(group_id)
  );

DROP POLICY IF EXISTS "Staff manage group members" ON public.group_members;
DROP POLICY IF EXISTS "Staff update group members" ON public.group_members;
DROP POLICY IF EXISTS "Staff remove group members" ON public.group_members;
DROP POLICY IF EXISTS "Staff insert group members" ON public.group_members;
DROP POLICY IF EXISTS "Staff insert group members" ON public.group_members;
CREATE POLICY "Staff insert group members" ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_superadmin()
    OR private.is_group_teacher(group_id)
  );

DROP POLICY IF EXISTS "Staff delete group members" ON public.group_members;
DROP POLICY IF EXISTS "Staff update group members" ON public.group_members;
CREATE POLICY "Staff update group members" ON public.group_members
  FOR UPDATE TO authenticated
  USING (private.is_superadmin() OR private.is_group_teacher(group_id))
  WITH CHECK (private.is_superadmin() OR private.is_group_teacher(group_id));

DROP POLICY IF EXISTS "Staff delete group members" ON public.group_members;
CREATE POLICY "Staff delete group members" ON public.group_members
  FOR DELETE TO authenticated
  USING (private.is_superadmin() OR private.is_group_teacher(group_id));

-- homework submissions (staff)
DROP POLICY IF EXISTS "Staff read homework submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "Staff read homework submissions" ON public.homework_submissions;
CREATE POLICY "Staff read homework submissions" ON public.homework_submissions
  FOR SELECT TO authenticated
  USING (private.staff_can_access_student(user_id));

DROP POLICY IF EXISTS "Staff update homework submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "Staff update homework submissions" ON public.homework_submissions;
CREATE POLICY "Staff update homework submissions" ON public.homework_submissions
  FOR UPDATE TO authenticated
  USING (private.staff_can_access_student(user_id))
  WITH CHECK (private.staff_can_access_student(user_id));

CREATE INDEX IF NOT EXISTS idx_group_teachers_group ON public.group_teachers (group_id);
CREATE INDEX IF NOT EXISTS idx_group_teachers_user ON public.group_teachers (user_id);

-- ══════════════════════════════════════════════════════════════
-- 20260621120000_020_teacher_application_rejected.sql
-- ══════════════════════════════════════════════════════════════

/*
  Отклонённые заявки преподавателей
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS teacher_application_rejected boolean NOT NULL DEFAULT false;

-- ══════════════════════════════════════════════════════════════
-- 20260622120000_021_student_group_teacher_read.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Student read access to own group and assigned teachers

  Enrolled students can see their group name and officially assigned teachers
  (group_teachers + legacy groups.teacher_id).
*/

DROP POLICY IF EXISTS "Students read own group membership" ON public.group_members;
DROP POLICY IF EXISTS "Students read own group membership" ON public.group_members;
CREATE POLICY "Students read own group membership" ON public.group_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Students read own teacher group" ON public.groups;
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

-- ══════════════════════════════════════════════════════════════
-- 20260623120000_022_idempotent_demo_seed.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Idempotent demo seed — не затирает решения суперадмина при повторном run_now.sql
*/

CREATE OR REPLACE FUNCTION public.profile_has_selection_edits(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = p_user_id
      AND (
        up.is_enrolled
        OR up.selection_rejected
        OR up.stage1_score IS NOT NULL
        OR up.stage2_score IS NOT NULL
        OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.user_id = up.id)
      )
  );
$$;

DROP FUNCTION IF EXISTS public.seed_demo_student_state(text, text, text, boolean, smallint, smallint, interval, interval);

CREATE OR REPLACE FUNCTION public.seed_demo_student_state(
  p_email text,
  p_stage1_status text,
  p_stage2_status text,
  p_is_enrolled boolean DEFAULT false,
  p_stage1_score integer DEFAULT NULL,
  p_stage2_score integer DEFAULT NULL,
  p_stage1_submitted interval DEFAULT NULL,
  p_stage2_submitted interval DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.user_profiles up
  SET
    stage1_status = p_stage1_status,
    stage2_status = p_stage2_status,
    is_enrolled = p_is_enrolled,
    stage1_score = p_stage1_score,
    stage2_score = p_stage2_score,
    stage1_submitted_at = CASE
      WHEN p_stage1_submitted IS NOT NULL THEN now() - p_stage1_submitted
      ELSE NULL
    END,
    stage2_submitted_at = CASE
      WHEN p_stage2_submitted IS NOT NULL THEN now() - p_stage2_submitted
      ELSE NULL
    END,
    updated_at = now()
  WHERE up.email = p_email
    AND up.role = 'student'
    AND NOT public.profile_has_selection_edits(up.id);
END;
$$;

-- Demo helpers: no EXECUTE for client roles (functions dropped later in this file)

-- ══════════════════════════════════════════════════════════════
-- 20260624120000_023_lesson_pages.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Страницы лекций и семинаров (блоки, черновик/публикация)
*/

CREATE TABLE IF NOT EXISTS public.lesson_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  lesson_type text NOT NULL CHECK (lesson_type IN ('lecture', 'seminar')),
  lesson_date date NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lesson_page_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.lesson_pages(id) ON DELETE CASCADE,
  block_type text NOT NULL CHECK (block_type IN ('recording', 'text', 'materials', 'homework_link')),
  sort_order int NOT NULL DEFAULT 0,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_page_blocks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lesson_pages_type_date ON public.lesson_pages (lesson_type, lesson_date DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_page_blocks_page ON public.lesson_page_blocks (page_id, sort_order);

DROP POLICY IF EXISTS "Staff manage lesson pages" ON public.lesson_pages;
DROP POLICY IF EXISTS "Staff manage lesson pages" ON public.lesson_pages;
CREATE POLICY "Staff manage lesson pages" ON public.lesson_pages
  FOR ALL TO authenticated
  USING (private.is_staff())
  WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "Enrolled read published lesson pages" ON public.lesson_pages;
DROP POLICY IF EXISTS "Enrolled read published lesson pages" ON public.lesson_pages;
CREATE POLICY "Enrolled read published lesson pages" ON public.lesson_pages
  FOR SELECT TO authenticated
  USING (
    is_published
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_enrolled = true
    )
  );

DROP POLICY IF EXISTS "Staff manage lesson blocks" ON public.lesson_page_blocks;
DROP POLICY IF EXISTS "Staff manage lesson blocks" ON public.lesson_page_blocks;
CREATE POLICY "Staff manage lesson blocks" ON public.lesson_page_blocks
  FOR ALL TO authenticated
  USING (private.is_staff())
  WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "Enrolled read published lesson blocks" ON public.lesson_page_blocks;
DROP POLICY IF EXISTS "Enrolled read published lesson blocks" ON public.lesson_page_blocks;
CREATE POLICY "Enrolled read published lesson blocks" ON public.lesson_page_blocks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lesson_pages lp
      JOIN public.user_profiles up ON up.id = auth.uid()
      WHERE lp.id = lesson_page_blocks.page_id
        AND lp.is_published
        AND up.is_enrolled = true
    )
  );

-- ══════════════════════════════════════════════════════════════
-- 20260625120000_025_homework_pages.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Страницы домашних заданий (блоки: текст/markdown, изображение, видео)
*/

CREATE TABLE IF NOT EXISTS public.homework_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  due_at timestamptz,
  max_score numeric(6,2) NOT NULL DEFAULT 10 CHECK (max_score > 0 AND max_score <= 1000),
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.homework_page_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.homework_pages(id) ON DELETE CASCADE,
  block_type text NOT NULL CHECK (block_type IN ('text', 'image', 'video')),
  sort_order int NOT NULL DEFAULT 0,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.homework_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_page_blocks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_homework_pages_due_at ON public.homework_pages (due_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_homework_page_blocks_page ON public.homework_page_blocks (page_id, sort_order);

ALTER TABLE public.homework_pages
  ADD COLUMN IF NOT EXISTS max_score numeric(6,2) NOT NULL DEFAULT 10;

DROP POLICY IF EXISTS "Staff manage homework pages" ON public.homework_pages;
DROP POLICY IF EXISTS "Staff manage homework pages" ON public.homework_pages;
CREATE POLICY "Staff manage homework pages" ON public.homework_pages
  FOR ALL TO authenticated
  USING (private.is_staff())
  WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "Enrolled read published homework pages" ON public.homework_pages;
DROP POLICY IF EXISTS "Enrolled read published homework pages" ON public.homework_pages;
CREATE POLICY "Enrolled read published homework pages" ON public.homework_pages
  FOR SELECT TO authenticated
  USING (
    is_published
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_enrolled = true
    )
  );

DROP POLICY IF EXISTS "Staff manage homework page blocks" ON public.homework_page_blocks;
DROP POLICY IF EXISTS "Staff manage homework page blocks" ON public.homework_page_blocks;
CREATE POLICY "Staff manage homework page blocks" ON public.homework_page_blocks
  FOR ALL TO authenticated
  USING (private.is_staff())
  WITH CHECK (private.is_staff());

DROP POLICY IF EXISTS "Enrolled read published homework page blocks" ON public.homework_page_blocks;
DROP POLICY IF EXISTS "Enrolled read published homework page blocks" ON public.homework_page_blocks;
CREATE POLICY "Enrolled read published homework page blocks" ON public.homework_page_blocks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.homework_pages hp
      JOIN public.user_profiles up ON up.id = auth.uid()
      WHERE hp.id = homework_page_blocks.page_id
        AND hp.is_published
        AND up.is_enrolled = true
    )
  );

-- ══════════════════════════════════════════════════════════════
-- 20260626120000_026_lesson_page_covers.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Обложка для страниц лекций и семинаров
*/

ALTER TABLE public.lesson_pages
  ADD COLUMN IF NOT EXISTS cover_url text;

-- ══════════════════════════════════════════════════════════════
-- 20260627120000_027_homework_page_submissions.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Ответы учеников на страницы домашних заданий (homework_pages)
*/

CREATE TABLE IF NOT EXISTS public.homework_page_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.homework_pages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer_text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'graded')),
  score numeric(6,2) CHECK (score IS NULL OR (score >= 0 AND score <= 1000)),
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
DROP POLICY IF EXISTS "Staff read homework page submissions" ON public.homework_page_submissions;
CREATE POLICY "Staff read homework page submissions" ON public.homework_page_submissions
  FOR SELECT TO authenticated
  USING (private.staff_can_access_student(user_id));

DROP POLICY IF EXISTS "Staff update homework page submissions" ON public.homework_page_submissions;
DROP POLICY IF EXISTS "Staff update homework page submissions" ON public.homework_page_submissions;
CREATE POLICY "Staff update homework page submissions" ON public.homework_page_submissions
  FOR UPDATE TO authenticated
  USING (private.staff_can_access_student(user_id))
  WITH CHECK (private.staff_can_access_student(user_id));

DROP POLICY IF EXISTS "Students read own homework page submissions" ON public.homework_page_submissions;
DROP POLICY IF EXISTS "Students read own homework page submissions" ON public.homework_page_submissions;
CREATE POLICY "Students read own homework page submissions" ON public.homework_page_submissions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students insert own homework page submissions" ON public.homework_page_submissions;
DROP POLICY IF EXISTS "Students insert own homework page submissions" ON public.homework_page_submissions;
CREATE POLICY "Students insert own homework page submissions" ON public.homework_page_submissions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Students update own homework page submissions" ON public.homework_page_submissions;
DROP POLICY IF EXISTS "Students update own homework page submissions" ON public.homework_page_submissions;
CREATE POLICY "Students update own homework page submissions" ON public.homework_page_submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('draft', 'submitted'))
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_homework_page_submissions_page ON public.homework_page_submissions (page_id);
CREATE INDEX IF NOT EXISTS idx_homework_page_submissions_user ON public.homework_page_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_homework_page_submissions_status ON public.homework_page_submissions (status);

ALTER TABLE public.homework_page_submissions
  DROP CONSTRAINT IF EXISTS homework_page_submissions_score_check;

ALTER TABLE public.homework_page_submissions
  ALTER COLUMN score TYPE numeric(6,2) USING score::numeric(6,2);

ALTER TABLE public.homework_page_submissions
  ADD CONSTRAINT homework_page_submissions_score_check
    CHECK (score IS NULL OR (score >= 0 AND score <= 1000));

-- ══════════════════════════════════════════════════════════════
-- 20260628120000_028_homework_submission_blocks.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Блоки сдачи ДЗ: Яндекс.Форма и Яндекс.Контест
*/

ALTER TABLE public.homework_page_blocks
  DROP CONSTRAINT IF EXISTS homework_page_blocks_block_type_check;

ALTER TABLE public.homework_page_blocks
  ADD CONSTRAINT homework_page_blocks_block_type_check
  CHECK (block_type IN ('text', 'image', 'video', 'yandex_form', 'contest'));

-- ══════════════════════════════════════════════════════════════
-- 20260629120000_029_landing_content.sql
-- ══════════════════════════════════════════════════════════════

-- Редактируемый контент главной страницы (суперадмин)

CREATE TABLE IF NOT EXISTS public.landing_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hero_badge_text text NOT NULL DEFAULT 'ОТКРЫТ НАБОР НА КУРС 2026-2027 ГОДА',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.landing_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.landing_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read landing config" ON public.landing_config;
DROP POLICY IF EXISTS "Public read landing config" ON public.landing_config;
CREATE POLICY "Public read landing config" ON public.landing_config
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Superadmin manage landing config" ON public.landing_config;
DROP POLICY IF EXISTS "Superadmin manage landing config" ON public.landing_config;
CREATE POLICY "Superadmin manage landing config" ON public.landing_config
  FOR ALL TO authenticated
  USING (private.is_superadmin())
  WITH CHECK (private.is_superadmin());

DROP POLICY IF EXISTS "Superadmin manage instructors" ON public.instructors;
DROP POLICY IF EXISTS "Superadmin manage instructors" ON public.instructors;
CREATE POLICY "Superadmin manage instructors" ON public.instructors
  FOR ALL TO authenticated
  USING (private.is_superadmin())
  WITH CHECK (private.is_superadmin());

-- ══════════════════════════════════════════════════════════════
-- 20260630120000_030_demo_markers.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Маркеры демо-контента (не сами данные)

  is_demo = true — строка создана демо-скриптами (supabase/demo/).
  Удаление: demo/remove.sql — реальные данные (is_demo = false) не затрагиваются.
*/

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.schedule_events
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.homework_assignments
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.lesson_pages
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.homework_pages
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_groups_is_demo ON public.groups (is_demo) WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_schedule_events_is_demo ON public.schedule_events (is_demo) WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_homework_assignments_is_demo ON public.homework_assignments (is_demo) WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_lesson_pages_is_demo ON public.lesson_pages (is_demo) WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_homework_pages_is_demo ON public.homework_pages (is_demo) WHERE is_demo;

COMMENT ON COLUMN public.groups.is_demo IS 'Демо-группа; удаляется через demo/remove.sql';
COMMENT ON COLUMN public.schedule_events.is_demo IS 'Демо-событие расписания';
COMMENT ON COLUMN public.homework_assignments.is_demo IS 'Демо-ДЗ (legacy таблица assignments)';
COMMENT ON COLUMN public.lesson_pages.is_demo IS 'Демо-страница лекции/семинара';
COMMENT ON COLUMN public.homework_pages.is_demo IS 'Демо-страница домашнего задания';

-- ══════════════════════════════════════════════════════════════
-- 20260630120100_031_drop_public_demo_seed_functions.sql
-- ══════════════════════════════════════════════════════════════

/*
  # Убрать демо-функции из public-схемы

  Раньше они жили в run_now.sql / миграции 022. Теперь только в supabase/demo/_helpers.sql
  (создаются на время apply и удаляются в конце).
*/

DROP FUNCTION IF EXISTS public.seed_demo_student_state(text, text, text, boolean, integer, integer, interval, interval);
DROP FUNCTION IF EXISTS public.profile_has_selection_edits(uuid);
DROP FUNCTION IF EXISTS public.create_demo_user(text, text, text, text);
DROP FUNCTION IF EXISTS public.create_test_user(text, text, text, text);

-- ══════════════════════════════════════════════════════════════
-- Анкета на этапе 1, allowlist суперадминов по email
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.selection_stage_config
  ADD COLUMN IF NOT EXISTS questionnaire_form_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS questionnaire_published boolean NOT NULL DEFAULT false;

-- Адреса с правами суперадмина. Должны совпадать с email, который отдаёт Яндекс ID
-- при входе. Хранятся в нижнем регистре; сравнение без учёта регистра.
-- Чтобы добавить суперадмина: допишите адрес в оба списка ниже и прогоните schema.sql.
CREATE TABLE IF NOT EXISTS public.superadmin_allowlist (
  email text PRIMARY KEY,
  CONSTRAINT superadmin_allowlist_email_normalized CHECK (email = lower(trim(email)))
);

-- Возврат к email после периода, когда allowlist хранил логины
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'superadmin_allowlist' AND column_name = 'login'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'superadmin_allowlist' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.superadmin_allowlist RENAME COLUMN login TO email;
    ALTER TABLE public.superadmin_allowlist DROP CONSTRAINT IF EXISTS superadmin_allowlist_login_normalized;
    ALTER TABLE public.superadmin_allowlist
      ADD CONSTRAINT superadmin_allowlist_email_normalized CHECK (email = lower(trim(email)));
  END IF;
END $$;

ALTER TABLE public.superadmin_allowlist ENABLE ROW LEVEL SECURITY;

-- Только SECURITY DEFINER-функции читают allowlist; клиентам доступ закрыт.
REVOKE ALL ON TABLE public.superadmin_allowlist FROM PUBLIC, anon, authenticated;

DELETE FROM public.superadmin_allowlist
WHERE email NOT IN (
  'marcellau@yandex.ru',
  'n.tatarinova@rqc.ru',
  'sokol.dm@phystech.edu'
);

INSERT INTO public.superadmin_allowlist (email) VALUES
  ('marcellau@yandex.ru'),
  ('n.tatarinova@rqc.ru'),
  ('sokol.dm@phystech.edu')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION private.is_allowlisted_superadmin_email(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.superadmin_allowlist
    WHERE email = lower(trim(p_email))
  );
$$;

DROP FUNCTION IF EXISTS public.is_allowlisted_superadmin_login(text);
DROP FUNCTION IF EXISTS public.is_superadmin_email(text);

-- Синхронизация ролей при повторном прогоне schema.sql
UPDATE public.user_profiles p
SET role = 'superadmin', updated_at = now()
WHERE private.is_allowlisted_superadmin_email(p.email)
  AND p.role IS DISTINCT FROM 'superadmin';

UPDATE public.user_profiles p
SET role = 'student', updated_at = now()
WHERE p.role = 'superadmin'
  AND NOT private.is_allowlisted_superadmin_email(p.email);

CREATE OR REPLACE FUNCTION public.needs_setup()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE role = 'superadmin');
$$;

REVOKE EXECUTE ON FUNCTION public.needs_setup() FROM PUBLIC;

-- Паролей больше нет: вход только через Яндекс ID
DROP FUNCTION IF EXISTS public.superadmin_reset_user_password(uuid, text);

-- ══════════════════════════════════════════════════════════════
-- Security: profile column guards + homework submission RLS
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_user_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Signup trigger / service context (no JWT yet)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF private.is_superadmin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = NEW.id THEN
    IF private.is_allowlisted_superadmin_email(COALESCE(NEW.email, '')) THEN
      NEW.role := 'superadmin';
    ELSE
      NEW.role := 'student';
    END IF;
    NEW.is_enrolled := false;
    NEW.stage1_score := NULL;
    NEW.stage2_score := NULL;
    NEW.selection_rejected := false;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'profile_insert_forbidden' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_user_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SQL Editor, demo seeds, auth triggers (no JWT)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF private.is_superadmin() THEN
    RETURN NEW;
  END IF;

  IF private.is_staff() AND auth.uid() IS DISTINCT FROM OLD.id THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.id THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'profile_update_forbidden' USING ERRCODE = '42501', MESSAGE = 'role';
    END IF;
    IF NEW.is_enrolled IS DISTINCT FROM OLD.is_enrolled THEN
      RAISE EXCEPTION 'profile_update_forbidden' USING ERRCODE = '42501', MESSAGE = 'is_enrolled';
    END IF;
    -- Почту разрешено только подтянуть из Яндекс ID (sync_oauth_user_profile), не подменить
    IF NEW.email IS DISTINCT FROM OLD.email
      AND NEW.email IS DISTINCT FROM (SELECT u.email FROM auth.users u WHERE u.id = OLD.id) THEN
      RAISE EXCEPTION 'profile_update_forbidden' USING ERRCODE = '42501', MESSAGE = 'email';
    END IF;
    IF NEW.enrolled_course_id IS DISTINCT FROM OLD.enrolled_course_id THEN
      RAISE EXCEPTION 'profile_update_forbidden' USING ERRCODE = '42501', MESSAGE = 'enrolled_course_id';
    END IF;
    IF NEW.stage1_score IS DISTINCT FROM OLD.stage1_score THEN
      RAISE EXCEPTION 'profile_update_forbidden' USING ERRCODE = '42501', MESSAGE = 'stage1_score';
    END IF;
    IF NEW.stage2_score IS DISTINCT FROM OLD.stage2_score THEN
      RAISE EXCEPTION 'profile_update_forbidden' USING ERRCODE = '42501', MESSAGE = 'stage2_score';
    END IF;
    IF NEW.selection_rejected IS DISTINCT FROM OLD.selection_rejected THEN
      RAISE EXCEPTION 'profile_update_forbidden' USING ERRCODE = '42501', MESSAGE = 'selection_rejected';
    END IF;

    IF NEW.stage1_status IS DISTINCT FROM OLD.stage1_status THEN
      IF NEW.stage1_status IN ('passed', 'failed')
        OR NOT (
          (OLD.stage1_status = 'pending' AND NEW.stage1_status = 'submitted')
          OR (OLD.stage1_status = 'submitted' AND NEW.stage1_status = 'pending' AND OLD.stage1_score IS NULL)
        ) THEN
        RAISE EXCEPTION 'profile_update_forbidden' USING ERRCODE = '42501', MESSAGE = 'stage1_status';
      END IF;
    END IF;

    IF NEW.stage2_status IS DISTINCT FROM OLD.stage2_status THEN
      IF NEW.stage2_status IN ('passed', 'failed')
        OR NOT (
          (OLD.stage2_status = 'pending' AND NEW.stage2_status = 'submitted')
          OR (OLD.stage2_status = 'submitted' AND NEW.stage2_status = 'pending' AND OLD.stage2_score IS NULL)
        ) THEN
        RAISE EXCEPTION 'profile_update_forbidden' USING ERRCODE = '42501', MESSAGE = 'stage2_status';
      END IF;
    END IF;

    IF OLD.stage1_viewed_at IS NOT NULL
      AND NEW.stage1_viewed_at IS DISTINCT FROM OLD.stage1_viewed_at THEN
      RAISE EXCEPTION 'profile_update_forbidden' USING ERRCODE = '42501', MESSAGE = 'stage1_viewed_at';
    END IF;

    IF OLD.stage2_viewed_at IS NOT NULL
      AND NEW.stage2_viewed_at IS DISTINCT FROM OLD.stage2_viewed_at THEN
      RAISE EXCEPTION 'profile_update_forbidden' USING ERRCODE = '42501', MESSAGE = 'stage2_viewed_at';
    END IF;

    IF NEW.teacher_application IS DISTINCT FROM OLD.teacher_application THEN
      IF NOT (OLD.teacher_application = false AND NEW.teacher_application = true) THEN
        RAISE EXCEPTION 'profile_update_forbidden' USING ERRCODE = '42501', MESSAGE = 'teacher_application';
      END IF;
    END IF;

    IF NEW.teacher_application_rejected IS DISTINCT FROM OLD.teacher_application_rejected THEN
      IF NOT (OLD.teacher_application_rejected = true AND NEW.teacher_application_rejected = false) THEN
        RAISE EXCEPTION 'profile_update_forbidden' USING ERRCODE = '42501', MESSAGE = 'teacher_application_rejected';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'profile_update_forbidden' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS guard_user_profile_insert ON public.user_profiles;
CREATE TRIGGER guard_user_profile_insert
  BEFORE INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.guard_user_profile_insert();

DROP TRIGGER IF EXISTS guard_user_profile_update ON public.user_profiles;
CREATE TRIGGER guard_user_profile_update
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.guard_user_profile_update();

CREATE OR REPLACE FUNCTION public.sync_group_members_on_enrollment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    (OLD.is_enrolled = true AND NEW.is_enrolled = false)
    OR (COALESCE(OLD.selection_rejected, false) = false AND NEW.selection_rejected = true)
  ) THEN
    DELETE FROM public.group_members WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_group_members_on_enrollment_change ON public.user_profiles;
CREATE TRIGGER sync_group_members_on_enrollment_change
  AFTER UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_group_members_on_enrollment_change();

REVOKE ALL ON FUNCTION public.guard_user_profile_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_user_profile_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_group_members_on_enrollment_change() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Students update own draft submissions" ON public.homework_submissions;
CREATE POLICY "Students update own draft submissions" ON public.homework_submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('draft', 'submitted'))
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('draft', 'submitted')
    AND score IS NULL
    AND graded_by IS NULL
    AND graded_at IS NULL
    AND feedback = ''
  );

DROP POLICY IF EXISTS "Students insert own submissions" ON public.homework_submissions;
CREATE POLICY "Students insert own submissions" ON public.homework_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('draft', 'submitted')
    AND score IS NULL
    AND graded_by IS NULL
    AND graded_at IS NULL
    AND feedback = ''
  );

DROP POLICY IF EXISTS "Students update own homework page submissions" ON public.homework_page_submissions;
CREATE POLICY "Students update own homework page submissions" ON public.homework_page_submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('draft', 'submitted'))
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('draft', 'submitted')
    AND score IS NULL
    AND graded_by IS NULL
    AND graded_at IS NULL
    AND feedback = ''
  );

DROP POLICY IF EXISTS "Students insert own homework page submissions" ON public.homework_page_submissions;
CREATE POLICY "Students insert own homework page submissions" ON public.homework_page_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('draft', 'submitted')
    AND score IS NULL
    AND graded_by IS NULL
    AND graded_at IS NULL
    AND feedback = ''
  );

-- ══════════════════════════════════════════════════════════════
-- Security (medium): profile read scope, achievements, auth hardening
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Staff can read all profiles" ON public.user_profiles;
CREATE POLICY "Staff can read all profiles" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    private.is_superadmin()
    OR (
      private.is_staff()
      AND (
        role IN ('admin', 'superadmin')
        OR private.staff_can_access_student(id)
        OR (role = 'student' AND is_enrolled = true)
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own achievements" ON public.achievements;
DROP POLICY IF EXISTS "Staff insert achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can insert own achievements" ON achievements;
DROP POLICY IF EXISTS "Staff insert achievements" ON achievements;

-- Достижения начисляются только триггером по факту сдачи/проверки ДЗ (не через RPC).
CREATE OR REPLACE FUNCTION public.award_achievement_if_new(
  p_user_id uuid,
  p_title text,
  p_description text,
  p_icon text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(trim(p_title), '') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.achievements
    WHERE user_id = p_user_id AND title = trim(p_title)
  ) THEN
    INSERT INTO public.achievements (user_id, title, description, icon)
    VALUES (
      p_user_id,
      trim(p_title),
      COALESCE(p_description, ''),
      COALESCE(NULLIF(trim(p_icon), ''), 'award')
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.award_achievement_if_new(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_homework_page_submission_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page_title text;
  v_max_score numeric;
  v_score_label text;
BEGIN
  IF NEW.status = 'submitted'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted') THEN
    PERFORM public.award_achievement_if_new(
      NEW.user_id,
      'Первое ДЗ',
      'Вы отправили работу на проверку',
      'send'
    );
  END IF;

  IF NEW.status = 'graded'
    AND NEW.score IS NOT NULL
    AND (
      TG_OP = 'INSERT'
      OR OLD.status IS DISTINCT FROM 'graded'
      OR OLD.score IS DISTINCT FROM NEW.score
    ) THEN
    SELECT hp.title, hp.max_score
    INTO v_page_title, v_max_score
    FROM public.homework_pages hp
    WHERE hp.id = NEW.page_id;

    v_score_label :=
      trim(to_char(NEW.score, 'FM999990.99'))
      || '/'
      || trim(to_char(COALESCE(v_max_score, 10), 'FM999990.99'));

    PERFORM public.award_achievement_if_new(
      NEW.user_id,
      'ДЗ проверено',
      'Получена оценка ' || v_score_label || ' за «' || COALESCE(v_page_title, 'Домашнее задание') || '»',
      'check'
    );

    IF COALESCE(v_max_score, 10) > 0
      AND NEW.score / COALESCE(v_max_score, 10) >= 0.8 THEN
      PERFORM public.award_achievement_if_new(
        NEW.user_id,
        'Отличная работа',
        'Оценка ' || v_score_label || ' за «' || COALESCE(v_page_title, 'Домашнее задание') || '»',
        'star'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_homework_page_submission_achievements() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS homework_page_submission_achievements ON public.homework_page_submissions;
CREATE TRIGGER homework_page_submission_achievements
  AFTER INSERT OR UPDATE ON public.homework_page_submissions
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_homework_page_submission_achievements();

DROP FUNCTION IF EXISTS public.grant_achievement(uuid, text, text, text);

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS questionnaire_submitted_at timestamptz;

-- Яндекс ID: имя пользователя из профиля Яндекс-почты
CREATE OR REPLACE FUNCTION public.extract_oauth_display_name(p_metadata jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(trim(p_metadata->>'full_name'), ''),
    NULLIF(trim(p_metadata->>'name'), ''),
    NULLIF(trim(p_metadata->>'real_name'), ''),
    NULLIF(trim(p_metadata->>'display_name'), ''),
    NULLIF(trim(
      COALESCE(NULLIF(trim(p_metadata->>'first_name'), ''), '')
      || ' '
      || COALESCE(NULLIF(trim(p_metadata->>'last_name'), ''), '')
    ), ''),
    ''
  );
$$;

REVOKE ALL ON FUNCTION public.extract_oauth_display_name(jsonb) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.extract_oauth_login(jsonb, text);

CREATE OR REPLACE FUNCTION public.sync_oauth_user_profile(
  p_privacy_consent boolean DEFAULT false,
  p_privacy_version text DEFAULT NULL
)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_user auth.users%ROWTYPE;
  v_profile public.user_profiles;
  v_display_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_user FROM auth.users WHERE id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  v_display_name := public.extract_oauth_display_name(v_user.raw_user_meta_data);

  SELECT * INTO v_profile FROM public.user_profiles WHERE id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (id, display_name, role, email)
    VALUES (
      auth.uid(),
      v_display_name,
      CASE
        WHEN private.is_allowlisted_superadmin_email(COALESCE(v_user.email, '')) THEN 'superadmin'
        ELSE 'student'
      END,
      v_user.email
    )
    RETURNING * INTO v_profile;
  ELSE
    UPDATE public.user_profiles
    SET
      email = COALESCE(v_user.email, v_profile.email),
      display_name = CASE
        WHEN NULLIF(trim(v_profile.display_name), '') IS NOT NULL THEN v_profile.display_name
        ELSE v_display_name
      END,
      privacy_consent_at = CASE
        WHEN p_privacy_consent AND privacy_consent_at IS NULL THEN now()
        ELSE privacy_consent_at
      END,
      privacy_policy_version = CASE
        WHEN p_privacy_consent AND privacy_policy_version IS NULL THEN p_privacy_version
        ELSE privacy_policy_version
      END,
      updated_at = now()
    WHERE id = auth.uid()
    RETURNING * INTO v_profile;
  END IF;

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_oauth_user_profile(boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_oauth_user_profile(boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_role text;
BEGIN
  IF private.is_allowlisted_superadmin_email(COALESCE(new.email, '')) THEN
    v_role := 'superadmin';
  ELSE
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'student');
    IF v_role = 'superadmin' THEN
      v_role := 'student';
    END IF;
  END IF;

  INSERT INTO public.user_profiles (id, display_name, role, email)
  VALUES (
    new.id,
    public.extract_oauth_display_name(new.raw_user_meta_data),
    v_role,
    new.email
  );
  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.superadmin_delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_role text;
  v_enrolled boolean;
BEGIN
  IF NOT private.is_superadmin() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF auth.uid() = target_user_id THEN
    RAISE EXCEPTION 'cannot_delete_self';
  END IF;

  SELECT role, is_enrolled
  INTO v_role, v_enrolled
  FROM public.user_profiles
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'cannot_delete_staff';
  END IF;

  IF v_enrolled THEN
    RAISE EXCEPTION 'cannot_delete_enrolled';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_delete_user_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.superadmin_delete_user_account(uuid) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- Способы входа: Яндекс ID и логин с паролем
-- ══════════════════════════════════════════════════════════════

-- Колонку login старой (почтовой) схемы здесь раньше дропали. Теперь она
-- заводится заново — см. секцию «Вход по логину и паролю» в конце файла;
-- дропать её тут нельзя, иначе каждый прогон schema.sql сносил бы логины.

-- ══════════════════════════════════════════════════════════════
-- Security hardening: права на функции (переприменяется при каждом деплое)
-- ══════════════════════════════════════════════════════════════
--
-- Принцип: через PostgREST /rpc доступны только две функции, которые зовёт фронт.
-- Всё остальное — триггеры и RLS-хелперы; anon не должен иметь EXECUTE ни на что.

-- Demo-хелперы не должны торчать в API
DROP FUNCTION IF EXISTS public.seed_demo_student_state(text, text, text, boolean, integer, integer, interval, interval);
DROP FUNCTION IF EXISTS public.profile_has_selection_edits(uuid);

-- Allowlist: явный запрет для клиентов (audit «RLS enabled no policy»)
DROP POLICY IF EXISTS "No client access to superadmin allowlist" ON public.superadmin_allowlist;
CREATE POLICY "No client access to superadmin allowlist" ON public.superadmin_allowlist
  FOR ALL
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE public.superadmin_allowlist FROM PUBLIC, anon, authenticated;

-- Устаревшие политики (ссылались на public.is_staff() — мешают DROP FUNCTION)
DROP POLICY IF EXISTS "Staff insert achievements" ON public.achievements;
DROP POLICY IF EXISTS "Staff insert achievements" ON achievements;
DROP POLICY IF EXISTS "Users can insert own achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users can insert own achievements" ON achievements;

-- Триггеры auth / user_profiles — не RPC
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_user_profile_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_user_profile_update() FROM PUBLIC, anon, authenticated;

-- Внутренние SECURITY DEFINER: утечка allowlist / bootstrap
REVOKE ALL ON FUNCTION private.is_allowlisted_superadmin_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.needs_setup() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.extract_oauth_display_name(jsonb) FROM PUBLIC, anon, authenticated;

-- Удалить устаревшие public-хелперы (перенесены в private, не exposed через API)
DROP FUNCTION IF EXISTS public.get_my_role();
DROP FUNCTION IF EXISTS public.is_staff();
DROP FUNCTION IF EXISTS public.is_superadmin();
DROP FUNCTION IF EXISTS public.is_group_teacher(uuid);
DROP FUNCTION IF EXISTS public.staff_can_access_student(uuid);
DROP FUNCTION IF EXISTS public.is_allowlisted_superadmin_email(text);

-- private RLS-хелперы: EXECUTE только authenticated (схема private не в Exposed Schemas)
REVOKE ALL ON FUNCTION private.is_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_superadmin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_group_teacher(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.staff_can_access_student(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_group_teacher(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.staff_can_access_student(uuid) TO authenticated;

-- Новые public-функции не получают EXECUTE автоматически
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Единственный намеренный RPC-surface для authenticated (см. src/lib/*.ts)
REVOKE ALL ON FUNCTION public.sync_oauth_user_profile(boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.superadmin_delete_user_account(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.sync_oauth_user_profile(boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_delete_user_account(uuid) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- Изображения контента (обложки, блоки ДЗ, карточки на главной)
-- ══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('site-images', 'site-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff upload site images" ON storage.objects;
CREATE POLICY "Staff upload site images" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'site-images'
    AND private.is_staff()
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Staff update site images" ON storage.objects;
CREATE POLICY "Staff update site images" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'site-images'
    AND private.is_staff()
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'site-images'
    AND private.is_staff()
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Staff delete site images" ON storage.objects;
CREATE POLICY "Staff delete site images" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'site-images'
    AND private.is_staff()
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- ══════════════════════════════════════════════════════════════
-- Документы занятий (PDF, картинки конспектов)
-- ══════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-documents', 'lesson-documents', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Staff upload lesson documents" ON storage.objects;
CREATE POLICY "Staff upload lesson documents" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lesson-documents'
    AND private.is_staff()
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Staff update lesson documents" ON storage.objects;
CREATE POLICY "Staff update lesson documents" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lesson-documents'
    AND private.is_staff()
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'lesson-documents'
    AND private.is_staff()
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Staff delete lesson documents" ON storage.objects;
CREATE POLICY "Staff delete lesson documents" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lesson-documents'
    AND private.is_staff()
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- ══════════════════════════════════════════════════════════════
-- Telegram-канал для зачисленных учеников (не публичный)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.community_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  telegram_invite_url text NOT NULL DEFAULT '',
  telegram_invite_message text NOT NULL DEFAULT 'Присоединяйтесь к Telegram-каналу кружка — там объявления, напоминания и общение с участниками.',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.community_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.community_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin manage community config" ON public.community_config;
CREATE POLICY "Superadmin manage community config" ON public.community_config
  FOR ALL TO authenticated
  USING (private.is_superadmin())
  WITH CHECK (private.is_superadmin());

DROP POLICY IF EXISTS "Enrolled students read community config" ON public.community_config;
CREATE POLICY "Enrolled students read community config" ON public.community_config
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.role = 'student'
        AND up.is_enrolled = true
    )
  );

-- Достижения: только триггер, не RPC
DROP FUNCTION IF EXISTS public.grant_achievement(uuid, text, text, text);
REVOKE ALL ON FUNCTION public.award_achievement_if_new(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_homework_page_submission_achievements() FROM PUBLIC, anon, authenticated;

-- ══════════════════════════════════════════════════════════════
-- Вход по логину и паролю (второй способ рядом с Яндекс ID)
-- ══════════════════════════════════════════════════════════════
--
-- Supabase Auth опознаёт пользователя только по email или телефону, поэтому
-- логину сопоставляется технический адрес <login>@id.quantumschool.ru.
-- Пользователь его не видит и не вводит, письма туда не уходят — домен
-- намеренно не почтовый.
--
-- Настоящая почта, если её оставили при регистрации, живёт отдельно в
-- user_profiles.recovery_email и в аутентификации не участвует. Класть
-- непроверенный адрес в auth.users.email нельзя: чужой почтой можно было бы
-- занять аккаунт, к которому её настоящий владелец потом привяжет Яндекс ID.
--
-- Домен обязан совпадать с LOGIN_EMAIL_DOMAIN в src/lib/loginAuthConfig.ts.

CREATE OR REPLACE FUNCTION private.login_email_domain()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT 'id.quantumschool.ru'::text $$;

-- Логин из технического адреса; у аккаунтов Яндекс ID — NULL.
CREATE OR REPLACE FUNCTION private.login_from_email(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN lower(COALESCE(p_email, '')) LIKE ('%@' || private.login_email_domain())
      THEN NULLIF(split_part(lower(p_email), '@', 1), '')
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION private.login_email_domain() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.login_from_email(text) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS login text,
  ADD COLUMN IF NOT EXISTS recovery_email text;

-- Дубли невозможны и так (auth.users.email уникален), индекс — страховка.
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_login_key
  ON public.user_profiles (lower(login))
  WHERE login IS NOT NULL;

-- Роль больше не читается из raw_user_meta_data: при регистрации по логину её
-- задаёт клиент, а значит любой мог бы попросить себе 'admin'. Демо-сиды
-- (demo/apply.sql, scripts/seed-test-users.mjs) и так проставляют роль
-- отдельным UPDATE профиля, на триггер они не опираются.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_role text;
  v_login text;
  v_display_name text;
BEGIN
  IF private.is_allowlisted_superadmin_email(COALESCE(new.email, '')) THEN
    v_role := 'superadmin';
  ELSE
    v_role := 'student';
  END IF;

  v_login := private.login_from_email(new.email);
  v_display_name := COALESCE(
    NULLIF(public.extract_oauth_display_name(new.raw_user_meta_data), ''),
    v_login,
    ''
  );

  INSERT INTO public.user_profiles (id, display_name, role, email, login, recovery_email)
  VALUES (
    new.id,
    v_display_name,
    v_role,
    new.email,
    v_login,
    CASE
      WHEN v_login IS NULL THEN NULL
      ELSE lower(NULLIF(trim(new.raw_user_meta_data->>'recovery_email'), ''))
    END
  );
  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- Логин привязан к auth.users.email, править его из приложения нельзя никому:
-- разъехавшись с почтой, он оставит человека без входа.
CREATE OR REPLACE FUNCTION public.guard_user_profile_login()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.login IS NOT DISTINCT FROM OLD.login THEN
    RETURN NEW;
  END IF;

  -- SQL Editor, демо-сиды, триггеры auth (без JWT)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- MESSAGE в USING нельзя сочетать с форматной строкой, поэтому поле в тексте.
  RAISE EXCEPTION 'profile_update_forbidden: login' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS guard_user_profile_login ON public.user_profiles;
CREATE TRIGGER guard_user_profile_login
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_profile_login();

REVOKE ALL ON FUNCTION public.guard_user_profile_login() FROM PUBLIC, anon, authenticated;

-- Восстановление пароля: писем в системе нет, поэтому пароль заново выдаёт
-- суперадмин. recovery_email нужен, чтобы понять, с кем он разговаривает.
CREATE OR REPLACE FUNCTION public.superadmin_set_login_password(
  target_user_id uuid,
  new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, extensions
AS $$
DECLARE
  v_login text;
BEGIN
  IF NOT private.is_superadmin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF length(COALESCE(new_password, '')) < 8 THEN
    RAISE EXCEPTION 'password_too_short';
  END IF;

  SELECT COALESCE(p.login, private.login_from_email(u.email))
  INTO v_login
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.id = u.id
  WHERE u.id = target_user_id;

  IF v_login IS NULL THEN
    RAISE EXCEPTION 'not_a_login_account';
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
    updated_at = now()
  WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_set_login_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.superadmin_set_login_password(uuid, text) TO authenticated;

-- Заполнить login у аккаунтов, заведённых до появления колонки.
UPDATE public.user_profiles p
SET login = private.login_from_email(u.email)
FROM auth.users u
WHERE u.id = p.id
  AND p.login IS NULL
  AND private.login_from_email(u.email) IS NOT NULL;
