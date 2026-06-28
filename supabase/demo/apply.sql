/*
  ДЕМО-ДАННЫЕ — опционально, после supabase/schema.sql

  Включить:  запустить этот файл целиком
  Выключить: demo/remove.sql
  Сбросить:  demo/reset.sql (remove + apply)

  Домен @test.qc.ru зарезервирован под демо. Реальные пользователи — другие email.

  Сгенерировано: node scripts/build-demo-bundle.mjs
*/


-- ── _helpers.sql ──

-- Временные функции для демо-сидов (удаляются в _helpers_cleanup.sql)

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
  v_instance_id uuid;
BEGIN
  IF p_email NOT LIKE '%@test.qc.ru' THEN
    RAISE EXCEPTION 'create_demo_user: only @test.qc.ru emails allowed';
  END IF;

  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at
    ) VALUES (
      v_user_id, v_instance_id, 'authenticated', 'authenticated', p_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
      '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_name, 'role', p_role), false, false, now(), now()
    );
  ELSE
    UPDATE auth.users
    SET
      instance_id = v_instance_id,
      encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data = jsonb_build_object('full_name', p_name, 'role', p_role),
      updated_at = now()
    WHERE id = v_user_id;
  END IF;

  DELETE FROM auth.identities
  WHERE user_id = v_user_id AND provider = 'email';

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    v_user_id::text,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', p_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email', now(), now(), now()
  );

  INSERT INTO public.user_profiles (id, display_name, role, email)
  VALUES (v_user_id, p_name, p_role, p_email)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    email = EXCLUDED.email;

  RETURN v_user_id;
END;
$$;

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

-- ── 00_staff_users.sql ──

-- Служебные аккаунты для разработки и демо (@test.qc.ru)

SELECT public.create_demo_user('superadmin@test.qc.ru', 'superadmin123', 'Тест Суперадмин', 'superadmin');
UPDATE public.user_profiles SET role = 'superadmin' WHERE email = 'superadmin@test.qc.ru';

SELECT public.create_demo_user('admin@test.qc.ru', 'admin123', 'Тест Преподаватель', 'admin');
UPDATE public.user_profiles SET role = 'admin' WHERE email = 'admin@test.qc.ru';

SELECT public.create_demo_user('student@test.qc.ru', 'student123', 'Тест Ученик', 'student');

/*
  superadmin@test.qc.ru / superadmin123
  admin@test.qc.ru      / admin123
  student@test.qc.ru    / student123
*/

-- ── 01_users_and_core.sql ──

-- Ученики, группа, расписание, legacy homework_assignments

SELECT public.create_demo_user('prep.pending@test.qc.ru', 'demo123', 'Кандидат Преподаватель', 'student');
UPDATE public.user_profiles
SET teacher_application = true
WHERE email = 'prep.pending@test.qc.ru'
  AND teacher_application = false
  AND teacher_application_rejected = false;

SELECT public.create_demo_user('student01@test.qc.ru', 'demo123', 'Анна Иванова');
SELECT public.seed_demo_student_state('student01@test.qc.ru', 'pending', 'pending');

SELECT public.create_demo_user('student02@test.qc.ru', 'demo123', 'Борис Петров');
SELECT public.seed_demo_student_state(
  'student02@test.qc.ru', 'submitted', 'pending', false,
  NULL::integer, NULL::integer, interval '3 days', NULL::interval
);

SELECT public.create_demo_user('student03@test.qc.ru', 'demo123', 'Виктор Сидоров');
SELECT public.seed_demo_student_state(
  'student03@test.qc.ru', 'submitted', 'submitted', false,
  NULL::integer, NULL::integer, interval '5 days', interval '2 days'
);

SELECT public.create_demo_user('student04@test.qc.ru', 'demo123', 'Галина Козлова');
SELECT public.seed_demo_student_state(
  'student04@test.qc.ru', 'submitted', 'pending', false,
  8, NULL::integer, interval '7 days', NULL::interval
);

SELECT public.create_demo_user('student05@test.qc.ru', 'demo123', 'Дмитрий Орлов');
SELECT public.seed_demo_student_state(
  'student05@test.qc.ru', 'submitted', 'pending', false,
  4, NULL::integer, interval '6 days', NULL::interval
);

SELECT public.create_demo_user('student06@test.qc.ru', 'demo123', 'Елена Морозова');
SELECT public.seed_demo_student_state(
  'student06@test.qc.ru', 'submitted', 'submitted', false,
  7, NULL::integer, interval '10 days', interval '1 day'
);

SELECT public.create_demo_user('student07@test.qc.ru', 'demo123', 'Игорь Волков');
SELECT public.seed_demo_student_state(
  'student07@test.qc.ru', 'submitted', 'submitted', false,
  9, 7, interval '12 days', interval '4 days'
);

SELECT public.create_demo_user('student08@test.qc.ru', 'demo123', 'Ксения Лебедева');
SELECT public.seed_demo_student_state(
  'student08@test.qc.ru', 'submitted', 'submitted', true,
  NULL::integer, NULL::integer, interval '14 days', interval '6 days'
);

SELECT public.create_demo_user('student09@test.qc.ru', 'demo123', 'Леонид Соколов');
SELECT public.seed_demo_student_state(
  'student09@test.qc.ru', 'submitted', 'submitted', false,
  8, 3, interval '11 days', interval '3 days'
);

SELECT public.create_demo_user('student10@test.qc.ru', 'demo123', 'Мария Федорова');
SELECT public.seed_demo_student_state(
  'student10@test.qc.ru', 'submitted', 'submitted', false,
  NULL::integer, 5, interval '9 days', interval '2 days'
);

INSERT INTO public.groups (name, group_type, teacher_id, is_demo)
SELECT 'Группа 2026', 'teacher', p.id, true
FROM public.user_profiles p
WHERE p.email = 'admin@test.qc.ru'
  AND NOT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.name = 'Группа 2026' AND g.group_type = 'teacher'
  );

UPDATE public.groups SET is_demo = true
WHERE name = 'Группа 2026' AND group_type = 'teacher';

INSERT INTO public.group_members (group_id, user_id)
SELECT g.id, u.id
FROM public.groups g
JOIN public.user_profiles u ON u.email IN (
  'student07@test.qc.ru',
  'student08@test.qc.ru',
  'student09@test.qc.ru',
  'student10@test.qc.ru'
)
WHERE g.name = 'Группа 2026' AND g.group_type = 'teacher' AND g.is_demo
ON CONFLICT DO NOTHING;

UPDATE public.user_profiles up
SET is_enrolled = true, updated_at = now()
WHERE up.role = 'student'
  AND up.is_enrolled = false
  AND up.email LIKE '%@test.qc.ru'
  AND EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.user_id = up.id AND g.group_type = 'teacher' AND g.is_demo
  );

INSERT INTO public.schedule_events (title, description, event_type, scheduled_at, duration_minutes, meeting_url, created_by, is_demo)
SELECT v.title, v.description, v.event_type, v.scheduled_at, v.duration_minutes, v.meeting_url,
  (SELECT id FROM public.user_profiles WHERE email = 'admin@test.qc.ru'),
  true
FROM (VALUES
  ('Введение в квантовую механику', 'Основные постулаты и эксперименты', 'lecture', now() + interval '2 days', 90, 'https://meet.example.com/qc-1'),
  ('Семинар: кубиты и суперпозиция', 'Разбор задач с прошлой лекции', 'seminar', now() + interval '5 days', 60, 'https://meet.example.com/qc-2'),
  ('Лекция: квантовые вентили', 'NOT, Hadamard, CNOT', 'lecture', now() + interval '9 days', 90, 'https://meet.example.com/qc-3'),
  ('Семинар: алгоритм Дойча', 'Практика на Qiskit', 'seminar', now() + interval '12 days', 75, 'https://meet.example.com/qc-4'),
  ('Лекция: квантовая телепортация', 'Протокол и реализация', 'lecture', now() - interval '3 days', 90, '')
) AS v(title, description, event_type, scheduled_at, duration_minutes, meeting_url)
WHERE NOT EXISTS (SELECT 1 FROM public.schedule_events WHERE title = v.title AND is_demo);

UPDATE public.schedule_events SET is_demo = true
WHERE title IN (
  'Введение в квантовую механику',
  'Семинар: кубиты и суперпозиция',
  'Лекция: квантовые вентили',
  'Семинар: алгоритм Дойча',
  'Лекция: квантовая телепортация'
);

INSERT INTO public.homework_assignments (title, lesson_summary, tasks, due_at, is_published, created_by, is_demo)
SELECT v.title, v.lesson_summary, v.tasks, v.due_at, v.is_published,
  (SELECT id FROM public.user_profiles WHERE email = 'admin@test.qc.ru'),
  true
FROM (VALUES
  ('ДЗ 1: Базовые кубиты', 'Повторите материал лекции о кубитах', 'Решите 3 задачи в Контесте', now() + interval '7 days', true),
  ('ДЗ 2: Квантовые вентили', 'Применение вентилей Hadamard и CNOT', 'Постройте схему для состояния |+⟩', now() + interval '14 days', true),
  ('ДЗ 3: Алгоритм Дойча (черновик)', 'Черновик', 'Задачи будут добавлены позже', now() + interval '21 days', false),
  ('ДЗ 4: Квантовая телепортация (черновик)', 'Подготовка к следующей лекции', '', NULL, false)
) AS v(title, lesson_summary, tasks, due_at, is_published)
WHERE NOT EXISTS (SELECT 1 FROM public.homework_assignments WHERE title = v.title AND is_demo);

UPDATE public.homework_assignments SET is_demo = true
WHERE title IN (
  'ДЗ 1: Базовые кубиты',
  'ДЗ 2: Квантовые вентили',
  'ДЗ 3: Алгоритм Дойча (черновик)',
  'ДЗ 4: Квантовая телепортация (черновик)'
);

INSERT INTO public.homework_submissions (assignment_id, user_id, answer_text, status, score, submitted_at)
SELECT ha.id, u.id, 'Решения в Контесте', 'graded', 8, now() - interval '1 day'
FROM public.homework_assignments ha
JOIN public.user_profiles u ON u.email = 'student08@test.qc.ru'
WHERE ha.title = 'ДЗ 1: Базовые кубиты' AND ha.is_demo
ON CONFLICT (assignment_id, user_id) DO NOTHING;

/*
  prep.pending@test.qc.ru / demo123
  student01@test.qc.ru … student10@test.qc.ru / demo123
*/

-- ── 02_lesson_pages.sql ──

INSERT INTO public.lesson_pages (title, lesson_type, lesson_date, is_published, created_by, is_demo)
SELECT
  v.title, v.lesson_type, v.lesson_date, v.is_published,
  (SELECT id FROM public.user_profiles WHERE email = 'admin@test.qc.ru'),
  true
FROM (VALUES
  ('Кубиты и суперпозиция', 'lecture', CURRENT_DATE - 3, true),
  ('Квантовые вентили', 'lecture', CURRENT_DATE, true),
  ('Разбор задач: кубиты', 'seminar', CURRENT_DATE - 1, true)
) AS v(title, lesson_type, lesson_date, is_published)
WHERE EXISTS (SELECT 1 FROM public.user_profiles WHERE email = 'admin@test.qc.ru')
  AND NOT EXISTS (SELECT 1 FROM public.lesson_pages lp WHERE lp.title = v.title AND lp.is_demo);

UPDATE public.lesson_pages SET is_demo = true
WHERE title IN ('Кубиты и суперпозиция', 'Квантовые вентили', 'Разбор задач: кубиты');

INSERT INTO public.lesson_page_blocks (page_id, block_type, sort_order, content)
SELECT lp.id, v.block_type, v.sort_order, v.content::jsonb
FROM public.lesson_pages lp
JOIN (VALUES
  ('Кубиты и суперпозиция', 'recording', 0, '{"url":"https://www.youtube.com/watch?v=JhHMojcCy-B"}'),
  ('Кубиты и суперпозиция', 'text', 1, '{"body":"Краткий конспект лекции: кубит — единица квантовой информации. Суперпозиция позволяет хранить несколько состояний одновременно."}'),
  ('Кубиты и суперпозиция', 'materials', 2, '{"pdf_url":"https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf","pdf_title":"Презентация: кубиты и суперпозиция","body":"Дополнительно: конспект в формате PDF выше."}'),
  ('Кубиты и суперпозиция', 'homework_link', 3, '{"url":"https://example.com/hw/1","label":"ДЗ 1: Базовые кубиты"}'),
  ('Квантовые вентили', 'text', 0, '{"body":"NOT, Hadamard, CNOT — базовые одно- и двухкубитные операции."}'),
  ('Разбор задач: кубиты', 'text', 0, '{"body":"Разбор домашнего задания и типичных ошибок."}')
) AS v(page_title, block_type, sort_order, content)
  ON lp.title = v.page_title
WHERE lp.is_demo
  AND NOT EXISTS (
    SELECT 1 FROM public.lesson_page_blocks b WHERE b.page_id = lp.id
  );

UPDATE public.lesson_pages SET cover_url = v.cover_url
FROM (VALUES
  ('Кубиты и суперпозиция', 'https://images.pexels.com/photos/577585/pexels-photo-577585.jpeg?auto=compress&cs=tinysrgb&w=800'),
  ('Квантовые вентили', 'https://images.pexels.com/photos/163100/circuit-circuit-board-resistor-computer-163100.jpeg?auto=compress&cs=tinysrgb&w=800'),
  ('Разбор задач: кубиты', 'https://images.pexels.com/photos/256369/pexels-photo-256369.jpeg?auto=compress&cs=tinysrgb&w=800')
) AS v(title, cover_url)
WHERE lesson_pages.title = v.title AND lesson_pages.is_demo
  AND (lesson_pages.cover_url IS NULL OR lesson_pages.cover_url = '');

-- ── 03_homework_pages.sql ──

INSERT INTO public.homework_pages (title, due_at, is_published, created_by, created_at, updated_at, is_demo)
SELECT
  v.title,
  v.due_at::timestamptz,
  v.is_published,
  u.id,
  v.created_at::timestamptz,
  v.updated_at::timestamptz,
  true
FROM (VALUES
  ('ДЗ 1: Базовые кубиты', (now() + interval '7 days')::text, true, 'admin@test.qc.ru', (now() - interval '14 days')::text, (now() - interval '2 days')::text),
  ('ДЗ 2: Квантовые вентили', (now() + interval '14 days')::text, true, 'admin@test.qc.ru', (now() - interval '10 days')::text, (now() - interval '5 days')::text),
  ('ДЗ 3: Алгоритм Дойча (черновик)', (now() + interval '21 days')::text, false, 'admin@test.qc.ru', (now() - interval '3 days')::text, (now() - interval '6 hours')::text),
  ('ДЗ 4: Срочное повторение кубитов', (now() + interval '3 days')::text, true, 'superadmin@test.qc.ru', (now() - interval '5 days')::text, (now() - interval '1 day')::text),
  ('ДЗ 5: Квантовая телепортация (черновик)', NULL, false, 'superadmin@test.qc.ru', (now() - interval '1 day')::text, (now() - interval '3 hours')::text),
  ('ДЗ 6: Измерения и декогеренция', (now() - interval '2 days')::text, true, 'superadmin@test.qc.ru', (now() - interval '20 days')::text, (now() - interval '4 days')::text)
) AS v(title, due_at, is_published, creator_email, created_at, updated_at)
JOIN public.user_profiles u ON u.email = v.creator_email
WHERE NOT EXISTS (SELECT 1 FROM public.homework_pages hp WHERE hp.title = v.title AND hp.is_demo);

UPDATE public.homework_pages SET is_demo = true
WHERE title IN (
  'ДЗ 1: Базовые кубиты',
  'ДЗ 2: Квантовые вентили',
  'ДЗ 3: Алгоритм Дойча (черновик)',
  'ДЗ 4: Срочное повторение кубитов',
  'ДЗ 5: Квантовая телепортация (черновик)',
  'ДЗ 6: Измерения и декогеренция'
);

INSERT INTO public.homework_page_blocks (page_id, block_type, sort_order, content)
SELECT hp.id, v.block_type, v.sort_order, v.content::jsonb
FROM public.homework_pages hp
JOIN (VALUES
  ('ДЗ 1: Базовые кубиты', 'text', 0, '{"body":"## Задача 1\\n\\nОпишите состояние $|+\\\\rangle$.\\n\\n## Задача 2\\n\\nВычислите $H|0\\\\rangle$."}'),
  ('ДЗ 2: Квантовые вентили', 'text', 0, '{"body":"Постройте схему для $|+\\\\rangle$ с помощью $H$. Опишите действие CNOT."}'),
  ('ДЗ 3: Алгоритм Дойча (черновик)', 'text', 0, '{"body":"Черновик — задачи будут добавлены перед публикацией."}'),
  ('ДЗ 4: Срочное повторение кубитов', 'text', 0, '{"body":"## Срочно\\n\\nПовторите определение кубита и запишите матрицу Паули $\\\\sigma_x$."}'),
  ('ДЗ 5: Квантовая телепортация (черновик)', 'text', 0, '{"body":"Заготовка под следующую лекцию."}'),
  ('ДЗ 6: Измерения и декогеренция', 'text', 0, '{"body":"## Задача\\n\\nОбъясните, почему суперпозиция разрушается при измерении."}')
) AS v(page_title, block_type, sort_order, content)
  ON hp.title = v.page_title
WHERE hp.is_demo
  AND NOT EXISTS (SELECT 1 FROM public.homework_page_blocks b WHERE b.page_id = hp.id);

INSERT INTO public.homework_page_blocks (page_id, block_type, sort_order, content)
SELECT hp.id, v.block_type, v.sort_order, v.content::jsonb
FROM public.homework_pages hp
JOIN (VALUES
  ('ДЗ 1: Базовые кубиты', 'yandex_form', 1, '{"form_id":"https://forms.yandex.ru/u/demo/homework1"}'),
  ('ДЗ 2: Квантовые вентили', 'contest', 1, '{"url":""}'),
  ('ДЗ 4: Срочное повторение кубитов', 'yandex_form', 1, '{"form_id":"https://forms.yandex.ru/u/demo/homework4"}')
) AS v(page_title, block_type, sort_order, content)
  ON hp.title = v.page_title
WHERE hp.is_demo
  AND NOT EXISTS (
    SELECT 1 FROM public.homework_page_blocks b
    WHERE b.page_id = hp.id AND b.block_type = v.block_type
  );

INSERT INTO public.homework_page_submissions (page_id, user_id, answer_text, status, score, feedback, submitted_at, graded_at)
SELECT hp.id, u.id, '', v.status, v.score, v.feedback,
  v.submitted_at::timestamptz,
  v.graded_at::timestamptz
FROM (VALUES
  ('student08@test.qc.ru', 'ДЗ 1: Базовые кубиты', 'graded', 9, 'Отлично, формулировка верная.', (now() - interval '2 days')::text, (now() - interval '1 day')::text),
  ('student08@test.qc.ru', 'ДЗ 2: Квантовые вентили', 'submitted', NULL::integer, '', (now() - interval '3 hours')::text, NULL),
  ('student07@test.qc.ru', 'ДЗ 1: Базовые кубиты', 'submitted', NULL::integer, '', (now() - interval '5 hours')::text, NULL),
  ('student07@test.qc.ru', 'ДЗ 2: Квантовые вентили', 'submitted', NULL::integer, '', (now() - interval '8 hours')::text, NULL),
  ('student09@test.qc.ru', 'ДЗ 1: Базовые кубиты', 'graded', 7, 'В целом верно, уточните нотацию.', (now() - interval '3 days')::text, (now() - interval '2 days')::text),
  ('student09@test.qc.ru', 'ДЗ 2: Квантовые вентили', 'submitted', NULL::integer, '', (now() - interval '1 day')::text, NULL),
  ('student10@test.qc.ru', 'ДЗ 1: Базовые кубиты', 'submitted', NULL::integer, '', (now() - interval '12 hours')::text, NULL),
  ('student10@test.qc.ru', 'ДЗ 2: Квантовые вентили', 'graded', 8, 'Хорошая работа.', (now() - interval '4 days')::text, (now() - interval '3 days')::text),
  ('student07@test.qc.ru', 'ДЗ 4: Срочное повторение кубитов', 'submitted', NULL::integer, '', (now() - interval '2 hours')::text, NULL),
  ('student08@test.qc.ru', 'ДЗ 4: Срочное повторение кубитов', 'submitted', NULL::integer, '', (now() - interval '30 minutes')::text, NULL),
  ('student10@test.qc.ru', 'ДЗ 4: Срочное повторение кубитов', 'graded', 6, 'Есть ошибки в выводе.', (now() - interval '6 days')::text, (now() - interval '5 days')::text),
  ('student09@test.qc.ru', 'ДЗ 6: Измерения и декогеренция', 'submitted', NULL::integer, '', (now() - interval '18 hours')::text, NULL),
  ('student07@test.qc.ru', 'ДЗ 6: Измерения и декогеренция', 'graded', 5, 'Нужно доработать вывод.', (now() - interval '5 days')::text, (now() - interval '4 days')::text)
) AS v(email, page_title, status, score, feedback, submitted_at, graded_at)
JOIN public.user_profiles u ON u.email = v.email
JOIN public.homework_pages hp ON hp.title = v.page_title AND hp.is_demo
ON CONFLICT (page_id, user_id) DO NOTHING;

UPDATE public.homework_page_submissions SET answer_text = '' WHERE answer_text <> '';

UPDATE public.homework_page_blocks b
SET content = v.content::jsonb
FROM (VALUES
  ('ДЗ 1: Базовые кубиты', 0, '{"body":"## Задача 1\n\nОпишите состояние $|+\\rangle$.\n\n## Задача 2\n\nВычислите $H|0\\rangle$."}'::jsonb),
  ('ДЗ 2: Квантовые вентили', 0, '{"body":"Постройте схему для $|+\\rangle$ с помощью $H$. Опишите действие CNOT."}'::jsonb),
  ('ДЗ 4: Срочное повторение кубитов', 0, '{"body":"## Срочно\n\nПовторите определение кубита и запишите матрицу Паули $\\sigma_z$."}'::jsonb),
  ('ДЗ 6: Измерения и декогеренция', 0, '{"body":"## Задача\n\nОбъясните, почему суперпозиция разрушается при измерении."}'::jsonb)
) AS v(page_title, sort_order, content)
JOIN public.homework_pages hp ON hp.title = v.page_title AND hp.is_demo
WHERE b.page_id = hp.id AND b.block_type = 'text' AND b.sort_order = v.sort_order;

UPDATE public.homework_page_blocks
SET content = '{"url":""}'::jsonb
WHERE block_type = 'contest'
  AND page_id IN (SELECT id FROM public.homework_pages WHERE is_demo)
  AND trim(both from content->>'url') ~* '^https?://contest\.yandex\.(ru|com|by|kz|uz)/?$';

-- ── _helpers_cleanup.sql ──

DROP FUNCTION IF EXISTS public.seed_demo_student_state(text, text, text, boolean, integer, integer, interval, interval);
DROP FUNCTION IF EXISTS public.profile_has_selection_edits(uuid);
DROP FUNCTION IF EXISTS public.create_demo_user(text, text, text, text);
