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
