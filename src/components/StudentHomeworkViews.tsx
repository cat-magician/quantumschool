import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import type { HomeworkPage, HomeworkPageBlock, HomeworkPageSubmission } from '../lib/types';
import { homeworkPageLoadError } from '../lib/homeworkPageLoadError';
import { formatHomeworkDueAt, isHomeworkPendingSubmission, sortHomeworkPagesForStudent, type HomeworkListFilter, type HomeworkListSort } from '../lib/homeworkPageUtils';
import { DEFAULT_HOMEWORK_MAX_SCORE } from '../lib/homeworkUtils';
import HomeworkPageBlocks from './HomeworkPageBlocks';
import HomeworkPageCard from './HomeworkPageCard';
import HomeworkDueBadge from './HomeworkDueBadge';
import HomeworkSubmissionSection, { HomeworkSubmissionStatusBadge } from './HomeworkSubmissionSection';

export function StudentHomeworkList({ onOpen }: { onOpen: (pageId: string) => void }) {
  const { user } = useAuth();
  const [pages, setPages] = useState<HomeworkPage[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, HomeworkPageSubmission>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sort, setSort] = useState<HomeworkListSort>('deadline');
  const [filter, setFilter] = useState<HomeworkListFilter>('all');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      supabase
        .from('homework_pages')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: true }),
      supabase.from('homework_page_submissions').select('*').eq('user_id', user.id),
    ]).then(([pagesRes, subsRes]) => {
      if (pagesRes.error) setLoadError(homeworkPageLoadError(pagesRes.error.message));
      else setPages((pagesRes.data ?? []) as HomeworkPage[]);
      if (subsRes.data) {
        setSubmissions(Object.fromEntries(subsRes.data.map((s) => [s.page_id, s])));
      }
      setLoading(false);
    });
  }, [user]);

  const sortedPages = useMemo(
    () => sortHomeworkPagesForStudent(pages, sort),
    [pages, sort],
  );

  const visiblePages = useMemo(() => {
    if (filter === 'all') return sortedPages;
    return sortedPages.filter((page) => isHomeworkPendingSubmission(submissions[page.id]));
  }, [sortedPages, filter, submissions]);

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
        Наставник ещё не опубликовал задания
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {([
          ['all', 'Все'],
          ['todo', 'К сдаче'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === id
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                : 'text-slate-400 bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="w-px h-8 bg-white/10 self-center hidden sm:block" aria-hidden />
        {([
          ['deadline', 'По сроку'],
          ['date', 'По дате'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSort(id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              sort === id
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 bg-white/5 hover:text-white border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {visiblePages.length === 0 ? (
        <p className="text-center py-12 text-slate-500 bg-slate-900/40 rounded-2xl border border-white/5">
          {filter === 'todo' ? 'Все задания сданы — отлично!' : 'Наставник ещё не опубликовал задания'}
        </p>
      ) : (
      <div className="space-y-2">
      {visiblePages.map((page) => (
        <HomeworkPageCard
          key={page.id}
          page={page}
          submission={submissions[page.id]}
          showPublishStatus={false}
          onClick={() => onOpen(page.id)}
        />
      ))}
      </div>
      )}
    </div>
  );
}

export function StudentHomeworkPageView({
  pageId,
  onBack,
}: {
  pageId: string;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [page, setPage] = useState<HomeworkPage | null>(null);
  const [blocks, setBlocks] = useState<HomeworkPageBlock[]>([]);
  const [submission, setSubmission] = useState<HomeworkPageSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const loadPage = async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    const [pageRes, blocksRes, subRes] = await Promise.all([
      supabase.from('homework_pages').select('*').eq('id', pageId).eq('is_published', true).single(),
      supabase.from('homework_page_blocks').select('*').eq('page_id', pageId),
      supabase.from('homework_page_submissions').select('*').eq('page_id', pageId).eq('user_id', user.id).maybeSingle(),
    ]);
    if (pageRes.error) {
      setLoadError(homeworkPageLoadError(pageRes.error.message));
      setPage(null);
      setBlocks([]);
      setSubmission(null);
    } else {
      setPage((pageRes.data ?? null) as HomeworkPage | null);
      setBlocks((blocksRes.data ?? []) as HomeworkPageBlock[]);
      setSubmission((subRes.data ?? null) as HomeworkPageSubmission | null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPage();
  }, [pageId, user?.id]);

  const upsertSubmission = async (status: 'draft' | 'submitted') => {
    if (!user) return;
    setSaving(true);
    setSubmitError('');
    const now = new Date().toISOString();
    const payload = {
      page_id: pageId,
      user_id: user.id,
      answer_text: '',
      status,
      submitted_at: status === 'submitted' ? now : submission?.submitted_at ?? null,
      updated_at: now,
    };

    const result = submission
      ? await supabase.from('homework_page_submissions').update(payload).eq('id', submission.id)
      : await supabase.from('homework_page_submissions').insert(payload);

    setSaving(false);
    if (result.error) {
      setSubmitError(homeworkPageLoadError(result.error.message) ?? 'Не удалось сохранить статус');
      return;
    }
    await loadPage();
  };

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
          {loadError ?? 'Задание не найдено или недоступно'}
        </p>
      </div>
    );
  }

  const dueText = page.due_at ? formatHomeworkDueAt(page.due_at) : null;

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
        <div className="flex flex-wrap items-center gap-2">
          {dueText ? (
            <p className="text-sm text-slate-500">Срок: {dueText}</p>
          ) : (
            <p className="text-sm text-slate-500">Без срока</p>
          )}
          <HomeworkDueBadge dueAt={page.due_at} submission={submission} />
          {submission && (
            <HomeworkSubmissionStatusBadge
              submission={submission}
              maxScore={page.max_score ?? DEFAULT_HOMEWORK_MAX_SCORE}
            />
          )}
        </div>
        <h2 className="text-2xl font-bold text-white mt-1">{page.title}</h2>
      </div>

      <HomeworkPageBlocks blocks={blocks} />

      <HomeworkSubmissionSection
        submission={submission}
        maxScore={page.max_score ?? DEFAULT_HOMEWORK_MAX_SCORE}
        saving={saving}
        submitError={submitError}
        onSaveDraft={() => upsertSubmission('draft')}
        onSubmit={() => upsertSubmission('submitted')}
      />
    </div>
  );
}
