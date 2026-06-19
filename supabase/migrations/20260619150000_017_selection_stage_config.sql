-- Публикуемые ссылки на форму эссе и контест этапа 2

CREATE TABLE IF NOT EXISTS public.selection_stage_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  essay_form_id text NOT NULL DEFAULT '',
  essay_published boolean NOT NULL DEFAULT false,
  contest_url text NOT NULL DEFAULT '',
  contest_published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.selection_stage_config (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.selection_stage_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read selection config" ON public.selection_stage_config;
CREATE POLICY "Authenticated read selection config" ON public.selection_stage_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Superadmin manage selection config" ON public.selection_stage_config;
CREATE POLICY "Superadmin manage selection config" ON public.selection_stage_config
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());
