/*
  Просмотр этапов отбора + явный отказ в зачислении
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS stage1_viewed_at timestamptz;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS stage2_viewed_at timestamptz;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS selection_rejected boolean NOT NULL DEFAULT false;
