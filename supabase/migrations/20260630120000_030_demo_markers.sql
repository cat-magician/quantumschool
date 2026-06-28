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
