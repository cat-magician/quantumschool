-- «Квантовый скачок»: точечное обновление после уже применённой schema.sql.
-- Выполнить целиком в Supabase SQL Editor. Полная schema.sql остаётся
-- источником структуры; этот файл не удаляет и не выключает другие награды.
-- Повторный запуск безопасен: уже выданные награды и seen_at сохраняются.

BEGIN;

INSERT INTO public.achievement_definitions
  (code, title, description, hint, image_url, sort_order, is_active, is_system, staff_ok, updated_at)
VALUES (
  'quantum_leap',
  'Квантовый скачок',
  'Вы прошли отбор и оказались по эту сторону портала. Добро пожаловать в Квантовый кружок! Этот кот предупреждал, что будет интересно. Про домашки он почему-то промолчал',
  'Пройдите отбор и дождитесь зачисления в Квантовый кружок.',
  '/achievements/quantum-leap.png',
  10,
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

CREATE OR REPLACE FUNCTION public.evaluate_achievements(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Условие проверяем в базе; вход ученика на сайт для выдачи не нужен.
  -- Сотрудникам награда не выдаётся только за преподавание или роль.
  IF EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = p_user_id AND p.role = 'student' AND p.is_enrolled = true
  ) THEN
    PERFORM public.award_achievement(p_user_id, 'quantum_leap');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_achievements(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_user_profile_enrollment_achievement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.evaluate_achievements(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_user_profile_enrollment_achievement() FROM PUBLIC, anon, authenticated;

-- AFTER видит итоговые role/is_enrolled после BEFORE-проверок профиля.
-- Повторное зачисление и перевод в student безопасны: award_achievement
-- не создаёт вторую выдачу (уникальная пара user_id/code).
DROP TRIGGER IF EXISTS user_profile_enrollment_achievement ON public.user_profiles;
CREATE TRIGGER user_profile_enrollment_achievement
  AFTER INSERT OR UPDATE OF is_enrolled, role ON public.user_profiles
  FOR EACH ROW
  WHEN (NEW.role = 'student' AND NEW.is_enrolled = true)
  EXECUTE FUNCTION public.trg_user_profile_enrollment_achievement();

-- Выдать всем уже зачисленным ученикам; без ожидания их входа на сайт.
DO $$
BEGIN
  PERFORM public.evaluate_achievements(p.id)
  FROM public.user_profiles p
  WHERE p.role = 'student' AND p.is_enrolled = true;
END;
$$;

COMMIT;

-- В результате у всех зачисленных учеников должна быть награда: осталось_выдать = 0.
SELECT
  count(*) AS enrolled_students,
  count(a.id) AS awarded_students,
  count(*) FILTER (WHERE a.id IS NULL) AS remaining_students
FROM public.user_profiles p
LEFT JOIN public.achievements a
  ON a.user_id = p.id AND a.code = 'quantum_leap'
WHERE p.role = 'student' AND p.is_enrolled = true;
