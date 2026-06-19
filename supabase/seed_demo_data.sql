/*
  Демо-данные для «Квантовый кружок».

  Запустите в Supabase SQL Editor ПОСЛЕ apply_all.sql и миграции 014.

  Создаёт:
  - 1 преподавателя-кандидата (заявка, ждёт назначения суперадмином)
  - 10 учеников в разных статусах отбора (статусы соответствуют реальным действиям)
  - домашние задания (опубликованные + черновики)
  - расписание (лекции и семинары)

  Пароль для всех новых аккаунтов: demo123
*/

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

-- Преподаватель-кандидат (суперадмин назначит admin в разделе «Ученики»)
SELECT public.create_demo_user('prep.pending@test.qc.ru', 'demo123', 'Кандидат Преподаватель', 'student');
UPDATE public.user_profiles SET teacher_application = true WHERE email = 'prep.pending@test.qc.ru';

-- 10 учеников с автоматическими статусами отбора
-- 1. Ничего не сделал
SELECT public.create_demo_user('student01@test.qc.ru', 'demo123', 'Анна Иванова');
UPDATE public.user_profiles SET
  stage1_status = 'pending', stage2_status = 'pending',
  stage1_score = NULL, stage2_score = NULL, is_enrolled = false
WHERE email = 'student01@test.qc.ru';

-- 2. Отправила эссе
SELECT public.create_demo_user('student02@test.qc.ru', 'demo123', 'Борис Петров');
UPDATE public.user_profiles SET
  stage1_status = 'submitted', stage2_status = 'pending',
  stage1_submitted_at = now() - interval '3 days',
  stage1_score = NULL, stage2_score = NULL, is_enrolled = false
WHERE email = 'student02@test.qc.ru';

-- 3. Отправил эссе и прошёл контест, ждёт оценок
SELECT public.create_demo_user('student03@test.qc.ru', 'demo123', 'Виктор Сидоров');
UPDATE public.user_profiles SET
  stage1_status = 'submitted', stage2_status = 'submitted',
  stage1_submitted_at = now() - interval '5 days',
  stage2_submitted_at = now() - interval '2 days',
  stage1_score = NULL, stage2_score = NULL, is_enrolled = false
WHERE email = 'student03@test.qc.ru';

-- 4. Эссе оценено (8 баллов), контест не начат
SELECT public.create_demo_user('student04@test.qc.ru', 'demo123', 'Галина Козлова');
UPDATE public.user_profiles SET
  stage1_status = 'submitted', stage2_status = 'pending',
  stage1_submitted_at = now() - interval '7 days',
  stage1_score = 8, stage2_score = NULL, is_enrolled = false
WHERE email = 'student04@test.qc.ru';

-- 5. Эссе оценено (4 балла), контест не начат
SELECT public.create_demo_user('student05@test.qc.ru', 'demo123', 'Дмитрий Орлов');
UPDATE public.user_profiles SET
  stage1_status = 'submitted', stage2_status = 'pending',
  stage1_submitted_at = now() - interval '6 days',
  stage1_score = 4, stage2_score = NULL, is_enrolled = false
WHERE email = 'student05@test.qc.ru';

-- 6. Эссе оценено, контест отправлен
SELECT public.create_demo_user('student06@test.qc.ru', 'demo123', 'Елена Морозова');
UPDATE public.user_profiles SET
  stage1_status = 'submitted', stage2_status = 'submitted',
  stage1_submitted_at = now() - interval '10 days',
  stage2_submitted_at = now() - interval '1 day',
  stage1_score = 7, stage2_score = NULL, is_enrolled = false
WHERE email = 'student06@test.qc.ru';

-- 7. Оба этапа оценены, не зачислен
SELECT public.create_demo_user('student07@test.qc.ru', 'demo123', 'Игорь Волков');
UPDATE public.user_profiles SET
  stage1_status = 'submitted', stage2_status = 'submitted',
  stage1_submitted_at = now() - interval '12 days',
  stage2_submitted_at = now() - interval '4 days',
  stage1_score = 9, stage2_score = 7, is_enrolled = false
WHERE email = 'student07@test.qc.ru';

-- 8. Зачислен на обучение (этапы отправлены, оценки ещё не выставлены — для теста отмены)
SELECT public.create_demo_user('student08@test.qc.ru', 'demo123', 'Ксения Лебедева');
UPDATE public.user_profiles SET
  stage1_status = 'submitted', stage2_status = 'submitted',
  stage1_submitted_at = now() - interval '14 days',
  stage2_submitted_at = now() - interval '6 days',
  stage1_score = null, stage2_score = null, is_enrolled = true
WHERE email = 'student08@test.qc.ru';

-- 9. Эссе оценено, контест оценён (низкий балл)
SELECT public.create_demo_user('student09@test.qc.ru', 'demo123', 'Леонид Соколов');
UPDATE public.user_profiles SET
  stage1_status = 'submitted', stage2_status = 'submitted',
  stage1_submitted_at = now() - interval '11 days',
  stage2_submitted_at = now() - interval '3 days',
  stage1_score = 8, stage2_score = 3, is_enrolled = false
WHERE email = 'student09@test.qc.ru';

-- 10. Эссе отправлено, контест оценён
SELECT public.create_demo_user('student10@test.qc.ru', 'demo123', 'Мария Федорова');
UPDATE public.user_profiles SET
  stage1_status = 'submitted', stage2_status = 'submitted',
  stage1_submitted_at = now() - interval '9 days',
  stage2_submitted_at = now() - interval '2 days',
  stage1_score = NULL, stage2_score = 5, is_enrolled = false
WHERE email = 'student10@test.qc.ru';

-- Группа преподавателя и зачисленный ученик
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

-- Расписание: лекции и семинары
INSERT INTO public.schedule_events (title, description, event_type, scheduled_at, duration_minutes, meeting_url, created_by)
SELECT
  v.title, v.description, v.event_type,
  v.scheduled_at, v.duration_minutes, v.meeting_url,
  (SELECT id FROM public.user_profiles WHERE email = 'admin@test.qc.ru')
FROM (VALUES
  ('Введение в квантовую механику', 'Основные постулаты и эксперименты', 'lecture', now() + interval '2 days', 90, 'https://meet.example.com/qc-1'),
  ('Семинар: кубиты и суперпозиция', 'Разбор задач с прошлой лекции', 'seminar', now() + interval '5 days', 60, 'https://meet.example.com/qc-2'),
  ('Лекция: квантовые вентили', 'NOT, Hadamard, CNOT', 'lecture', now() + interval '9 days', 90, 'https://meet.example.com/qc-3'),
  ('Семинар: алгоритм Дойча', 'Практика на Qiskit', 'seminar', now() + interval '12 days', 75, 'https://meet.example.com/qc-4'),
  ('Лекция: квантовая телепортация', 'Протокол и реализация', 'lecture', now() - interval '3 days', 90, '')
) AS v(title, description, event_type, scheduled_at, duration_minutes, meeting_url)
WHERE NOT EXISTS (SELECT 1 FROM public.schedule_events WHERE title = v.title);

-- Домашние задания
INSERT INTO public.homework_assignments (title, lesson_summary, tasks, due_at, is_published, created_by)
SELECT
  v.title, v.lesson_summary, v.tasks, v.due_at, v.is_published,
  (SELECT id FROM public.user_profiles WHERE email = 'admin@test.qc.ru')
FROM (VALUES
  ('ДЗ 1: Базовые кубиты', 'Повторите материал лекции о кубитах', 'Решите 3 задачи в Контесте', now() + interval '7 days', true),
  ('ДЗ 2: Квантовые вентили', 'Применение вентилей Hadamard и CNOT', 'Постройте схему для состояния |+⟩', now() + interval '14 days', true),
  ('ДЗ 3: Алгоритм Дойча (черновик)', 'Черновик — не видно ученикам', 'Задачи будут добавлены позже', now() + interval '21 days', false),
  ('ДЗ 4: Квантовая телепортация (черновик)', 'Подготовка к следующей лекции', '', NULL, false)
) AS v(title, lesson_summary, tasks, due_at, is_published)
WHERE NOT EXISTS (SELECT 1 FROM public.homework_assignments WHERE title = v.title);

-- Сдача ДЗ зачисленным учеником
INSERT INTO public.homework_submissions (assignment_id, user_id, answer_text, status, score, submitted_at)
SELECT ha.id, u.id, 'Решения в Контесте', 'graded', 8, now() - interval '1 day'
FROM public.homework_assignments ha
JOIN public.user_profiles u ON u.email = 'student08@test.qc.ru'
WHERE ha.title = 'ДЗ 1: Базовые кубиты'
ON CONFLICT (assignment_id, user_id) DO NOTHING;

DROP FUNCTION public.create_demo_user(text, text, text, text);

/*
  Аккаунты для проверки:

  Суперадмин:  superadmin@test.qc.ru / superadmin123
  Преподаватель (уже admin): admin@test.qc.ru / admin123
  Кандидат преподавателя: prep.pending@test.qc.ru / demo123  → назначить в «Ученики»
  Ученики: student01@test.qc.ru … student10@test.qc.ru / demo123
*/
