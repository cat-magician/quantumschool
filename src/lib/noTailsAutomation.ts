import { supabase } from './supabase';
import { schoolDayStartMs } from './schoolTime';

export type NoTailsAutomationSettings = {
  finalSeminarId: string | null;
  awardStartsAt: string | null;
  isPublished: boolean | null;
  schedulerReady: boolean;
  updatedAt: string | null;
};

export type NoTailsSeminar = {
  id: string;
  title: string;
  isPublished: boolean;
  startsAt: string;
  usesDateOnly: boolean;
};

type SeminarRow = {
  id: string;
  title: string;
  lesson_date: string;
  is_published: boolean;
  schedule_events: { id: string; scheduled_at: string }[] | { id: string; scheduled_at: string } | null;
};

export class NoTailsAutomationUpdateRequired extends Error {
  constructor() {
    super('Для настройки автоматической выдачи нужно обновить базу сайта.');
    this.name = 'NoTailsAutomationUpdateRequired';
  }
}

function throwRequestError(error: { code?: string; message?: string }): never {
  if (['PGRST200', 'PGRST202', 'PGRST205', '42883', '42P01'].includes(error.code ?? '')) {
    throw new NoTailsAutomationUpdateRequired();
  }
  throw error;
}

function parseSettings(value: unknown): NoTailsAutomationSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Не удалось прочитать настройки');
  const row = value as Record<string, unknown>;
  return {
    finalSeminarId: typeof row.final_seminar_id === 'string' ? row.final_seminar_id : null,
    awardStartsAt: typeof row.award_starts_at === 'string' ? row.award_starts_at : null,
    isPublished: typeof row.is_published === 'boolean' ? row.is_published : null,
    schedulerReady: row.scheduler_ready === true,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  };
}

export async function loadNoTailsAutomationSettings(): Promise<NoTailsAutomationSettings> {
  const { data, error } = await supabase.rpc('superadmin_get_no_tails_automation');
  if (error) throwRequestError(error);
  return parseSettings(data);
}

export async function saveNoTailsAutomationSettings(finalSeminarId: string | null): Promise<NoTailsAutomationSettings> {
  const { data, error } = await supabase.rpc('superadmin_set_no_tails_final_seminar', { p_seminar_id: finalSeminarId });
  if (error) throwRequestError(error);
  return parseSettings(data);
}

/** Explicit choice only: sorting options never selects the latest existing seminar. */
export async function loadNoTailsSeminars(): Promise<NoTailsSeminar[]> {
  const pages: SeminarRow[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('lesson_pages')
      .select('id,title,lesson_date,is_published,schedule_events(id,scheduled_at)')
      .eq('lesson_type', 'seminar')
      .order('lesson_date', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throwRequestError(error);
    const rows = (data ?? []) as unknown as SeminarRow[];
    pages.push(...rows);
    if (rows.length < pageSize) break;
  }
  return pages.map((page) => {
    const events = Array.isArray(page.schedule_events) ? page.schedule_events : page.schedule_events ? [page.schedule_events] : [];
    const event = events.filter((item) => Number.isFinite(Date.parse(item.scheduled_at)))
      .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at))[0];
    return {
      id: page.id,
      title: page.title,
      isPublished: page.is_published,
      startsAt: event?.scheduled_at ?? new Date(schoolDayStartMs(page.lesson_date.slice(0, 10))).toISOString(),
      usesDateOnly: !event,
    };
  });
}

export function noTailsAwardStartsAt(seminar: Pick<NoTailsSeminar, 'startsAt'>): string {
  return new Date(Date.parse(seminar.startsAt) + 14 * 86_400_000).toISOString();
}
