/*
  # Расписание: общие события курса (лекции, семинары)

  Запустите в Supabase SQL Editor, если проект уже создан через apply_all.sql.
*/

CREATE TABLE IF NOT EXISTS public.schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  event_type text NOT NULL DEFAULT 'lecture'
    CHECK (event_type IN ('lecture', 'seminar', 'webinar', 'homework', 'exam', 'consultation')),
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60 CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  meeting_url text NOT NULL DEFAULT '',
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read schedule events" ON public.schedule_events;
CREATE POLICY "Staff read schedule events" ON public.schedule_events
  FOR SELECT TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Staff insert schedule events" ON public.schedule_events;
CREATE POLICY "Staff insert schedule events" ON public.schedule_events
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff update schedule events" ON public.schedule_events;
CREATE POLICY "Staff update schedule events" ON public.schedule_events
  FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff delete schedule events" ON public.schedule_events;
CREATE POLICY "Staff delete schedule events" ON public.schedule_events
  FOR DELETE TO authenticated USING (public.is_staff());

DROP POLICY IF EXISTS "Enrolled students read schedule events" ON public.schedule_events;
CREATE POLICY "Enrolled students read schedule events" ON public.schedule_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_enrolled = true
    )
    AND (
      group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.user_id = auth.uid() AND gm.group_id = schedule_events.group_id
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_schedule_events_scheduled_at ON public.schedule_events (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_schedule_events_group_id ON public.schedule_events (group_id);
