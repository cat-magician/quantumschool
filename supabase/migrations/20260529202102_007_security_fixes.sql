/*
  # Security Fixes

  1. Fix mutable search_path on handle_new_user function
     - Recreate the function with SET search_path = '' and fully qualified table names
     - This prevents search_path injection attacks

  2. Revoke EXECUTE on handle_new_user from anon and authenticated roles
     - The function is a trigger, it should only be callable by the system (postgres role)
     - Public roles should not be able to call it directly via RPC

  3. Fix RLS policy on enrollments INSERT
     - Replace the always-true WITH CHECK (true) with a meaningful check
     - Validate that required fields are non-empty to prevent junk submissions
     - The enrollment form is public (no auth required) but we add field validation
*/

-- 1. Recreate handle_new_user with fixed search_path and fully qualified names
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$;

-- 2. Revoke EXECUTE from anon and authenticated (trigger functions should only run as system)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;

-- 3. Drop the overly permissive enrollments INSERT policy
DROP POLICY IF EXISTS "Public can submit enrollments" ON public.enrollments;

-- Recreate with meaningful validation: name and email must be non-empty strings
CREATE POLICY "Public can submit enrollments"
  ON public.enrollments FOR INSERT
  TO public
  WITH CHECK (
    name IS NOT NULL AND length(trim(name)) > 0
    AND email IS NOT NULL AND length(trim(email)) > 0
    AND email LIKE '%@%'
  );
