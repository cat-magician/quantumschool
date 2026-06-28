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
