/*
  # Блоки сдачи ДЗ: Яндекс.Форма и Яндекс.Контест
*/

ALTER TABLE public.homework_page_blocks
  DROP CONSTRAINT IF EXISTS homework_page_blocks_block_type_check;

ALTER TABLE public.homework_page_blocks
  ADD CONSTRAINT homework_page_blocks_block_type_check
  CHECK (block_type IN ('text', 'image', 'video', 'yandex_form', 'contest'));
