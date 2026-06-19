/*
  # Privacy consent and enrollment fields

  - city, grade on enrollments
  - privacy consent tracking on enrollments and user_profiles
  - RLS: require consent on public enrollment insert
*/

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS privacy_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_policy_version text,
  ADD COLUMN IF NOT EXISTS parental_confirm boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_policy_version text;

DROP POLICY IF EXISTS "Public can submit enrollments" ON public.enrollments;

CREATE POLICY "Public can submit enrollments"
  ON public.enrollments FOR INSERT
  TO public
  WITH CHECK (
    name IS NOT NULL AND length(trim(name)) > 0
    AND email IS NOT NULL AND length(trim(email)) > 0
    AND email LIKE '%@%'
    AND privacy_consent = true
    AND parental_confirm = true
    AND privacy_consent_at IS NOT NULL
    AND privacy_policy_version IS NOT NULL
  );
