-- Временные функции для демо-сидов (удаляются в _helpers_cleanup.sql)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.create_demo_user(
  p_email text,
  p_password text,
  p_name text,
  p_role text DEFAULT 'student'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
  v_instance_id uuid;
BEGIN
  IF p_email NOT LIKE '%@test.qc.ru' THEN
    RAISE EXCEPTION 'create_demo_user: only @test.qc.ru emails allowed';
  END IF;

  SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at
    ) VALUES (
      v_user_id, v_instance_id, 'authenticated', 'authenticated', p_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
      '', '', '', '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_name, 'role', p_role), false, false, now(), now()
    );
  ELSE
    UPDATE auth.users
    SET
      instance_id = v_instance_id,
      encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_user_meta_data = jsonb_build_object('full_name', p_name, 'role', p_role),
      updated_at = now()
    WHERE id = v_user_id;
  END IF;

  DELETE FROM auth.identities
  WHERE user_id = v_user_id AND provider = 'email';

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    v_user_id::text,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', p_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email', now(), now(), now()
  );

  INSERT INTO public.user_profiles (id, display_name, role, email)
  VALUES (v_user_id, p_name, p_role, p_email)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    email = EXCLUDED.email;

  RETURN v_user_id;
END;
$$;

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
