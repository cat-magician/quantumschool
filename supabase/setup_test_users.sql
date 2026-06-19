/*
  # Создание тестовых пользователей

  Запустите в Supabase Dashboard → SQL Editor (один раз).
  Если вход не работает — используйте fix_test_users.sql (пересоздаёт аккаунты).

  Создаёт (если ещё нет):
    superadmin@test.qc.ru / superadmin123
    admin@test.qc.ru      / admin123
    student@test.qc.ru    / student123
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.create_test_user(
  p_email text,
  p_password text,
  p_name text,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      is_sso_user,
      is_anonymous,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      p_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(),
      '',
      '',
      '',
      '',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_name, 'role', p_role),
      false,
      false,
      now(),
      now()
    );

    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      p_email,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', p_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      now(),
      now(),
      now()
    );
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;

  INSERT INTO public.user_profiles (id, display_name, role, email)
  VALUES (v_user_id, p_name, p_role, p_email)
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    email = EXCLUDED.email;
END;
$$;

SELECT public.create_test_user('superadmin@test.qc.ru', 'superadmin123', 'Тест Суперадмин', 'superadmin');
SELECT public.create_test_user('admin@test.qc.ru', 'admin123', 'Тест Преподаватель', 'admin');
SELECT public.create_test_user('student@test.qc.ru', 'student123', 'Тест Ученик', 'student');

DROP FUNCTION public.create_test_user(text, text, text, text);
