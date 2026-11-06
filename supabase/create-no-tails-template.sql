-- «Без хвостов»: только ручной шаблон награды после уже применённой schema.sql.
-- Выполнить целиком в Supabase SQL Editor. Автовыдачу и условия не добавляет,
-- никому награду не выдаёт. Ранее внесённые изменения шаблона сохраняются.

BEGIN;

-- Ручной шаблон no_tails: пока без автоматической выдачи.
-- Создаём один раз; любые изменения суперадмина, включая выключение,
-- сохраняются при повторном запуске схемы.
INSERT INTO public.achievement_definitions
  (code, title, description, hint, image_url, sort_order, is_active, is_system, staff_ok, updated_at)
VALUES (
  'no_tails',
  'Без хвостов',
  'Все домашние задания сданы на хорошо и отлично!',
  'Сдайте все домашние задания курса на оценки от 5 до 10: 5–7 — хорошо, 8–10 — отлично.',
  '/achievements/no-tails.png',
  20,
  true,
  false,
  false,
  now()
)
ON CONFLICT (code) DO NOTHING;

COMMIT;

-- Подтверждение содержимого шаблона без данных получателей.
SELECT code, title, description, hint, image_url, sort_order, is_active, is_system, staff_ok
FROM public.achievement_definitions
WHERE code = 'no_tails';
