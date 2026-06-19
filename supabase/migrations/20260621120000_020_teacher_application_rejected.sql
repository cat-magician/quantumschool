/*
  Отклонённые заявки преподавателей
*/

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS teacher_application_rejected boolean NOT NULL DEFAULT false;
