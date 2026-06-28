/*
  # Убрать демо-функции из public-схемы

  Раньше они жили в run_now.sql / миграции 022. Теперь только в supabase/demo/_helpers.sql
  (создаются на время apply и удаляются в конце).
*/

DROP FUNCTION IF EXISTS public.seed_demo_student_state(text, text, text, boolean, integer, integer, interval, interval);
DROP FUNCTION IF EXISTS public.profile_has_selection_edits(uuid);
DROP FUNCTION IF EXISTS public.create_demo_user(text, text, text, text);
DROP FUNCTION IF EXISTS public.create_test_user(text, text, text, text);
