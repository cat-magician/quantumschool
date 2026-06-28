/*
  # Страницы домашних заданий (блоки: текст/markdown, изображение, видео)
*/

CREATE TABLE IF NOT EXISTS public.homework_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  due_at timestamptz,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.homework_page_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.homework_pages(id) ON DELETE CASCADE,
  block_type text NOT NULL CHECK (block_type IN ('text', 'image', 'video')),
  sort_order int NOT NULL DEFAULT 0,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.homework_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_page_blocks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_homework_pages_due_at ON public.homework_pages (due_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_homework_page_blocks_page ON public.homework_page_blocks (page_id, sort_order);

DROP POLICY IF EXISTS "Staff manage homework pages" ON public.homework_pages;
CREATE POLICY "Staff manage homework pages" ON public.homework_pages
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Enrolled read published homework pages" ON public.homework_pages;
CREATE POLICY "Enrolled read published homework pages" ON public.homework_pages
  FOR SELECT TO authenticated
  USING (
    is_published
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_enrolled = true
    )
  );

DROP POLICY IF EXISTS "Staff manage homework page blocks" ON public.homework_page_blocks;
CREATE POLICY "Staff manage homework page blocks" ON public.homework_page_blocks
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Enrolled read published homework page blocks" ON public.homework_page_blocks;
CREATE POLICY "Enrolled read published homework page blocks" ON public.homework_page_blocks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.homework_pages hp
      JOIN public.user_profiles up ON up.id = auth.uid()
      WHERE hp.id = homework_page_blocks.page_id
        AND hp.is_published
        AND up.is_enrolled = true
    )
  );
