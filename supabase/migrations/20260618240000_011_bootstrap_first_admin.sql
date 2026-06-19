/*
  # Bootstrap: first registered user becomes superadmin
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE role = 'superadmin') THEN
    v_role := 'superadmin';
  ELSE
    v_role := COALESCE(new.raw_user_meta_data->>'role', 'student');
  END IF;

  INSERT INTO public.user_profiles (id, display_name, role, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_role,
    new.email
  );
  RETURN new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.needs_setup()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE role = 'superadmin');
$$;

REVOKE EXECUTE ON FUNCTION public.needs_setup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.needs_setup() TO anon, authenticated;
