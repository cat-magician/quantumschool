/*
  # Обложка для страниц лекций и семинаров
*/

ALTER TABLE public.lesson_pages
  ADD COLUMN IF NOT EXISTS cover_url text;
