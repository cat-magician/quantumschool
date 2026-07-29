import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { LessonPage, LessonPageBlock, LessonPageType } from '../lib/types';
import { lessonPageLoadError } from '../lib/lessonPageLoadError';
import { formatLessonDate } from '../lib/lessonPageUtils';
import LessonPageBlocks from './LessonPageBlocks';
import LessonPageCard from './LessonPageCard';
import LessonCoverImage from './LessonCoverImage';

export function StudentLessonList({
  lessonType,
  onOpen,
}: {
  lessonType: LessonPageType;
  onOpen: (pageId: string) => void;
}) {
  const [pages, setPages] = useState<LessonPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    supabase
      .from('lesson_pages')
      .select('*')
      .eq('lesson_type', lessonType)
      .eq('is_published', true)
      .order('lesson_date', { ascending: false })
      .then(({ data, error }) => {
        if (error) setLoadError(lessonPageLoadError(error.message));
        else setPages((data ?? []) as LessonPage[]);
        setLoading(false);
      });
  }, [lessonType]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
        {loadError}
      </p>
    );
  }

  if (pages.length === 0) {
    return (
      <p className="text-center py-12 text-slate-500 bg-slate-900/40 rounded-2xl border border-white/5">
        {lessonType === 'lecture' ? 'Лекций' : 'Семинаров'} пока нет
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {pages.map((page) => (
        <LessonPageCard key={page.id} page={page} onClick={() => onOpen(page.id)} />
      ))}
    </div>
  );
}

export function StudentLessonPageView({
  pageId,
  onBack,
  onOpenHomework,
}: {
  pageId: string;
  onBack: () => void;
  onOpenHomework?: (pageId: string) => void;
}) {
  const [page, setPage] = useState<LessonPage | null>(null);
  const [blocks, setBlocks] = useState<LessonPageBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      supabase.from('lesson_pages').select('*').eq('id', pageId).single(),
      supabase.from('lesson_page_blocks').select('*').eq('page_id', pageId),
    ]).then(([pageRes, blocksRes]) => {
      if (pageRes.error) {
        setLoadError(lessonPageLoadError(pageRes.error.message));
        setPage(null);
        setBlocks([]);
      } else {
        setPage((pageRes.data ?? null) as LessonPage | null);
        setBlocks((blocksRes.data ?? []) as LessonPageBlock[]);
      }
      setLoading(false);
    });
  }, [pageId]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (loadError || !page) {
    return (
      <div className="max-w-3xl space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </button>
        <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
          {loadError ?? 'Страница не найдена или недоступна'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад
      </button>

      <div>
        {page.cover_url?.trim() && (
          <div className="mb-4 rounded-2xl overflow-hidden border border-white/5 aspect-[21/9] max-h-48 bg-slate-900">
            <LessonCoverImage
              url={page.cover_url.trim()}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <p className="text-sm text-slate-500">{formatLessonDate(page.lesson_date)}</p>
        <h2 className="text-2xl font-bold text-white mt-1">{page.title}</h2>
      </div>

      <LessonPageBlocks blocks={blocks} onOpenHomework={onOpenHomework} />
    </div>
  );
}
