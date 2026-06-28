/*
  УДАЛЕНИЕ ДЕМО-ДАННЫХ — реальные пользователи и контент не затрагиваются.

  Критерии:
  - контент с is_demo = true (группы, расписание, ДЗ, страницы)
  - все аккаунты @test.qc.ru (демо и тестовые staff)
  - заявки enrollments с demo-email (если есть)

  Реальные пользователи: любой email КРОМЕ @test.qc.ru, is_demo = false.
*/

-- Пометить legacy-строки, созданные до колонки is_demo
UPDATE public.groups SET is_demo = true
WHERE name = 'Группа 2026' AND group_type = 'teacher' AND NOT is_demo;

UPDATE public.schedule_events SET is_demo = true
WHERE title IN (
  'Введение в квантовую механику',
  'Семинар: кубиты и суперпозиция',
  'Лекция: квантовые вентили',
  'Семинар: алгоритм Дойча',
  'Лекция: квантовая телепортация'
) AND NOT is_demo;

UPDATE public.homework_assignments SET is_demo = true
WHERE title LIKE 'ДЗ %' AND title IN (
  'ДЗ 1: Базовые кубиты', 'ДЗ 2: Квантовые вентили',
  'ДЗ 3: Алгоритм Дойча (черновик)', 'ДЗ 4: Квантовая телепортация (черновик)'
) AND NOT is_demo;

UPDATE public.lesson_pages SET is_demo = true
WHERE title IN ('Кубиты и суперпозиция', 'Квантовые вентили', 'Разбор задач: кубиты')
  AND NOT is_demo;

UPDATE public.homework_pages SET is_demo = true
WHERE title LIKE 'ДЗ %' AND title IN (
  'ДЗ 1: Базовые кубиты', 'ДЗ 2: Квантовые вентили',
  'ДЗ 3: Алгоритм Дойча (черновик)', 'ДЗ 4: Срочное повторение кубитов',
  'ДЗ 5: Квантовая телепортация (черновик)', 'ДЗ 6: Измерения и декогеренция'
) AND NOT is_demo;

-- Сначала контент (каскады на blocks/submissions)
DELETE FROM public.homework_page_submissions
WHERE page_id IN (SELECT id FROM public.homework_pages WHERE is_demo)
   OR user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.qc.ru');

DELETE FROM public.homework_pages WHERE is_demo;

DELETE FROM public.lesson_page_blocks
WHERE page_id IN (SELECT id FROM public.lesson_pages WHERE is_demo);

DELETE FROM public.lesson_pages WHERE is_demo;

DELETE FROM public.homework_submissions
WHERE assignment_id IN (SELECT id FROM public.homework_assignments WHERE is_demo)
   OR user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.qc.ru');

DELETE FROM public.homework_assignments WHERE is_demo;

DELETE FROM public.schedule_events WHERE is_demo;

DELETE FROM public.group_members
WHERE group_id IN (SELECT id FROM public.groups WHERE is_demo)
   OR user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.qc.ru');

DELETE FROM public.groups WHERE is_demo;

DELETE FROM public.enrollments WHERE email LIKE '%@test.qc.ru';

-- Демо-пользователи (каскад на user_profiles)
DELETE FROM auth.identities
WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@test.qc.ru');

DELETE FROM auth.users WHERE email LIKE '%@test.qc.ru';

-- На всякий случай — временные demo-функции
DROP FUNCTION IF EXISTS public.seed_demo_student_state(text, text, text, boolean, integer, integer, interval, interval);
DROP FUNCTION IF EXISTS public.profile_has_selection_edits(uuid);
DROP FUNCTION IF EXISTS public.create_demo_user(text, text, text, text);
