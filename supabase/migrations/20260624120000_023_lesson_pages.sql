/*
  # Страницы лекций и семинаров (блоки, черновик/публикация)
*/

CREATE TABLE IF NOT EXISTS public.lesson_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  lesson_type text NOT NULL CHECK (lesson_type IN ('lecture', 'seminar')),
  lesson_date date NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lesson_page_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.lesson_pages(id) ON DELETE CASCADE,
  block_type text NOT NULL CHECK (block_type IN ('recording', 'text', 'materials', 'homework_link')),
  sort_order int NOT NULL DEFAULT 0,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_page_blocks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lesson_pages_type_date ON public.lesson_pages (lesson_type, lesson_date DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_page_blocks_page ON public.lesson_page_blocks (page_id, sort_order);

DROP POLICY IF EXISTS "Staff manage lesson pages" ON public.lesson_pages;
CREATE POLICY "Staff manage lesson pages" ON public.lesson_pages
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Enrolled read published lesson pages" ON public.lesson_pages;
CREATE POLICY "Enrolled read published lesson pages" ON public.lesson_pages
  FOR SELECT TO authenticated
  USING (
    is_published
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_enrolled = true
    )
  );

DROP POLICY IF EXISTS "Staff manage lesson blocks" ON public.lesson_page_blocks;
CREATE POLICY "Staff manage lesson blocks" ON public.lesson_page_blocks
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Enrolled read published lesson blocks" ON public.lesson_page_blocks;
CREATE POLICY "Enrolled read published lesson blocks" ON public.lesson_page_blocks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lesson_pages lp
      JOIN public.user_profiles up ON up.id = auth.uid()
      WHERE lp.id = lesson_page_blocks.page_id
        AND lp.is_published
        AND up.is_enrolled = true
    )
  );
