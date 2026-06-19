/*
  Город, школа, класс в профиле ученика (из формы заявки)
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS school text;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS grade text;

UPDATE public.user_profiles up
SET
  city = COALESCE(up.city, e.city),
  grade = COALESCE(up.grade, e.grade)
FROM public.enrollments e
WHERE up.email = e.email;
