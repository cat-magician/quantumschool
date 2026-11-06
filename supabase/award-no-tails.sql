-- «Без хвостов»: автоматическая награда после уже применённой schema.sql.
-- Выполнить целиком в Supabase SQL Editor. Устанавливает обязательный pg_cron;
-- если расширение или планировщик недоступны, транзакция завершится ошибкой.
-- Финальный семинар выбирает суперадмин в «Наградах»: без выбора выдачи нет.
-- Повторный запуск сохраняет настройку семинара и уже полученные награды.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

INSERT INTO public.achievement_definitions
  (code, title, description, hint, image_url, sort_order, is_active, is_system, staff_ok, updated_at)
VALUES (
  'no_tails',
  'Без хвостов',
  'Все домашние задания сданы на хорошо и отлично!',
  'Получите за все доступные вам опубликованные домашние задания оценки не ниже 5 из 10. Награда выдаётся автоматически через 14 дней после даты финального семинара курса.',
  '/achievements/no-tails.png',
  20,
  true,
  true,
  false,
  now()
)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  hint = EXCLUDED.hint,
  image_url = EXCLUDED.image_url,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  is_system = true,
  staff_ok = false,
  updated_at = now();

-- no_tails-automation:start
-- Изолированная автоматизация: не меняет evaluate_achievements и quantum_leap.
-- Ни создание настройки, ни установка схемы не выбирают семинар за суперадмина.
CREATE TABLE IF NOT EXISTS public.no_tails_achievement_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  final_seminar_id uuid REFERENCES public.lesson_pages(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.no_tails_achievement_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.no_tails_achievement_settings FROM PUBLIC, anon, authenticated;

INSERT INTO public.no_tails_achievement_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

-- Служебное состояние для RPC и проверки из SQL Editor; клиентам вызов закрыт.
CREATE OR REPLACE FUNCTION public.no_tails_automation_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_final_seminar_id uuid;
  v_award_starts_at timestamptz;
  v_is_published boolean;
  v_updated_at timestamptz;
  v_scheduler_ready boolean := false;
BEGIN
  SELECT
    settings.final_seminar_id,
    COALESCE(event.scheduled_at, seminar.lesson_date::timestamp AT TIME ZONE 'Europe/Moscow') + interval '336 hours',
    seminar.is_published,
    settings.updated_at
  INTO v_final_seminar_id, v_award_starts_at, v_is_published, v_updated_at
  FROM public.no_tails_achievement_settings settings
  LEFT JOIN public.lesson_pages seminar
    ON seminar.id = settings.final_seminar_id AND seminar.lesson_type = 'seminar'
  LEFT JOIN public.schedule_events event ON event.lesson_page_id = seminar.id
  WHERE settings.singleton = true;

  -- Не ссылаемся на cron.job статически: API работает и до установки pg_cron.
  IF pg_catalog.to_regclass('cron.job') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT EXISTS (
        SELECT 1 FROM cron.job
        WHERE jobname = ''award-no-tails'' AND active AND schedule = ''*/5 * * * *''
          AND database = pg_catalog.current_database()
          AND command = ''SELECT public.award_due_no_tails();''
      )' INTO v_scheduler_ready;
    EXCEPTION WHEN undefined_table OR invalid_schema_name OR insufficient_privilege THEN
      v_scheduler_ready := false;
    END;
  END IF;

  RETURN jsonb_build_object(
    'final_seminar_id', v_final_seminar_id,
    'award_starts_at', v_award_starts_at,
    'is_published', COALESCE(v_is_published, false),
    'scheduler_ready', v_scheduler_ready,
    'updated_at', v_updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.no_tails_automation_status() FROM PUBLIC, anon, authenticated;

-- Планировщик проверяет единый согласованный снимок данных. Правки оценок,
-- публикации и групп учитываются следующим запуском; уже выданное не отзываем.
CREATE OR REPLACE FUNCTION public.award_due_no_tails()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_awarded integer;
BEGIN
  WITH due AS (
    SELECT 1
    FROM public.no_tails_achievement_settings settings
    JOIN public.lesson_pages seminar
      ON seminar.id = settings.final_seminar_id
        AND seminar.lesson_type = 'seminar' AND seminar.is_published = true
    LEFT JOIN public.schedule_events event ON event.lesson_page_id = seminar.id
    WHERE settings.singleton = true
      AND now() >= COALESCE(event.scheduled_at, seminar.lesson_date::timestamp AT TIME ZONE 'Europe/Moscow') + interval '336 hours'
  )
  INSERT INTO public.achievements (user_id, code, title, description, icon)
  SELECT p.id, definition.code, definition.title, definition.description, definition.code
  FROM public.user_profiles p
  JOIN public.achievement_definitions definition
    ON definition.code = 'no_tails' AND definition.is_active = true
  WHERE p.role = 'student' AND p.is_enrolled = true
    AND EXISTS (SELECT 1 FROM due)
    AND NOT EXISTS (
      SELECT 1 FROM public.achievements earned
      WHERE earned.user_id = p.id AND earned.code = 'no_tails'
    )
    -- Пустой набор ДЗ не считается выполненным курсом.
    AND EXISTS (
      SELECT 1 FROM public.homework_pages homework
      WHERE homework.is_published = true
        AND (
          homework.group_ids = '{}'
          OR EXISTS (
            SELECT 1 FROM public.group_members member
            WHERE member.user_id = p.id AND member.group_id = ANY (homework.group_ids)
          )
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.homework_pages homework
      WHERE homework.is_published = true
        AND (
          homework.group_ids = '{}'
          OR EXISTS (
            SELECT 1 FROM public.group_members member
            WHERE member.user_id = p.id AND member.group_id = ANY (homework.group_ids)
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.homework_page_submissions submission
          WHERE submission.page_id = homework.id AND submission.user_id = p.id
            AND submission.status = 'graded' AND submission.score IS NOT NULL
            AND homework.max_score > 0
            AND submission.score >= 0 AND submission.score <= homework.max_score
            -- Нормализация к шкале 0–10 без округления: минимум 5 из 10.
            AND submission.score * 2 >= homework.max_score
        )
    )
  ON CONFLICT (user_id, code) DO NOTHING;

  GET DIAGNOSTICS v_awarded = ROW_COUNT;
  RETURN v_awarded;
END;
$$;

REVOKE ALL ON FUNCTION public.award_due_no_tails() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.superadmin_get_no_tails_automation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_superadmin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN public.no_tails_automation_status();
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_get_no_tails_automation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_get_no_tails_automation() TO authenticated;

CREATE OR REPLACE FUNCTION public.superadmin_set_no_tails_final_seminar(p_seminar_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.is_superadmin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_seminar_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.lesson_pages seminar
    WHERE seminar.id = p_seminar_id AND seminar.lesson_type = 'seminar'
  ) THEN
    RAISE EXCEPTION 'invalid_final_seminar' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.no_tails_achievement_settings (singleton, final_seminar_id, updated_at, updated_by)
  VALUES (true, p_seminar_id, now(), auth.uid())
  ON CONFLICT (singleton) DO UPDATE SET
    final_seminar_id = EXCLUDED.final_seminar_id,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

  -- Уже прошедший срок проверяем сразу, без ожидания следующего тика cron.
  PERFORM public.award_due_no_tails();
  RETURN public.no_tails_automation_status();
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_set_no_tails_final_seminar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_set_no_tails_final_seminar(uuid) TO authenticated;
-- no_tails-automation:end

SELECT cron.schedule('award-no-tails', '*/5 * * * *', 'SELECT public.award_due_no_tails();');

DO $$
BEGIN
  IF NOT (public.no_tails_automation_status()->>'scheduler_ready')::boolean THEN
    RAISE EXCEPTION 'no_tails_scheduler_not_ready'
      USING HINT = 'Enable pg_cron and create the active award-no-tails job in this database, then rerun this file.';
  END IF;
END;
$$;

COMMIT;

-- Плановая дата и работоспособность планировщика; данных учеников здесь нет.
SELECT public.no_tails_automation_status() AS no_tails_automation;
