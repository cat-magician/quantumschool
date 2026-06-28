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
