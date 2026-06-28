-- Служебные аккаунты для разработки и демо (@test.qc.ru)

SELECT public.create_demo_user('superadmin@test.qc.ru', 'superadmin123', 'Тест Суперадмин', 'superadmin');
UPDATE public.user_profiles SET role = 'superadmin' WHERE email = 'superadmin@test.qc.ru';

SELECT public.create_demo_user('admin@test.qc.ru', 'admin123', 'Тест Преподаватель', 'admin');
UPDATE public.user_profiles SET role = 'admin' WHERE email = 'admin@test.qc.ru';

SELECT public.create_demo_user('student@test.qc.ru', 'student123', 'Тест Ученик', 'student');

/*
  superadmin@test.qc.ru / superadmin123
  admin@test.qc.ru      / admin123
  student@test.qc.ru    / student123
*/
