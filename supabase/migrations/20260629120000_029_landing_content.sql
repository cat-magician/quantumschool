-- Редактируемый контент главной страницы (суперадмин)

CREATE TABLE IF NOT EXISTS public.landing_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hero_badge_text text NOT NULL DEFAULT 'ОТКРЫТ НАБОР НА КУРС 2026-2027 ГОДА',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.landing_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.landing_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read landing config" ON public.landing_config;
CREATE POLICY "Public read landing config" ON public.landing_config
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Superadmin manage landing config" ON public.landing_config;
CREATE POLICY "Superadmin manage landing config" ON public.landing_config
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Superadmin manage instructors" ON public.instructors;
CREATE POLICY "Superadmin manage instructors" ON public.instructors
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());
