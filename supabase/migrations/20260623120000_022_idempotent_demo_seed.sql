/*
  # Idempotent demo seed — не затирает решения суперадмина при повторном run_now.sql
*/

CREATE OR REPLACE FUNCTION public.profile_has_selection_edits(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = p_user_id
      AND (
        up.is_enrolled
        OR up.selection_rejected
        OR up.stage1_score IS NOT NULL
        OR up.stage2_score IS NOT NULL
        OR EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.user_id = up.id)
      )
  );
$$;

DROP FUNCTION IF EXISTS public.seed_demo_student_state(text, text, text, boolean, smallint, smallint, interval, interval);

CREATE OR REPLACE FUNCTION public.seed_demo_student_state(
  p_email text,
  p_stage1_status text,
  p_stage2_status text,
  p_is_enrolled boolean DEFAULT false,
  p_stage1_score integer DEFAULT NULL,
  p_stage2_score integer DEFAULT NULL,
  p_stage1_submitted interval DEFAULT NULL,
  p_stage2_submitted interval DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.user_profiles up
  SET
    stage1_status = p_stage1_status,
    stage2_status = p_stage2_status,
    is_enrolled = p_is_enrolled,
    stage1_score = p_stage1_score,
    stage2_score = p_stage2_score,
    stage1_submitted_at = CASE
      WHEN p_stage1_submitted IS NOT NULL THEN now() - p_stage1_submitted
      ELSE NULL
    END,
    stage2_submitted_at = CASE
      WHEN p_stage2_submitted IS NOT NULL THEN now() - p_stage2_submitted
      ELSE NULL
    END,
    updated_at = now()
  WHERE up.email = p_email
    AND up.role = 'student'
    AND NOT public.profile_has_selection_edits(up.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.profile_has_selection_edits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_student_state(text, text, text, boolean, integer, integer, interval, interval) TO authenticated;
