import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CalendarClock, Check, Loader2, RefreshCw, Save } from 'lucide-react';
import { useAppDialog } from '../../lib/AppDialogContext';
import {
  loadNoTailsAutomationSettings,
  loadNoTailsSeminars,
  noTailsAwardStartsAt,
  NoTailsAutomationUpdateRequired,
  saveNoTailsAutomationSettings,
  type NoTailsAutomationSettings as AutomationSettings,
  type NoTailsSeminar,
} from '../../lib/noTailsAutomation';

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'Europe/Moscow',
});

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Дата не задана' : `${dateFormat.format(date)} мск`;
}

export default function NoTailsAutomationSettings({ onSaved }: { onSaved?: () => void }) {
  const { toast } = useAppDialog();
  const selectId = useId();
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [seminars, setSeminars] = useState<NoTailsSeminar[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<'update' | 'load' | null>(null);
  const [saveError, setSaveError] = useState(false);
  const request = useRef(0);
  const selectedRef = useRef('');
  const savedRef = useRef('');
  const loadedRef = useRef(false);
  const choiceVersion = useRef(0);

  const load = useCallback(async () => {
    const current = ++request.current;
    const version = choiceVersion.current;
    const keepDraft = loadedRef.current && selectedRef.current !== savedRef.current;
    setLoading(true);
    setLoadError(null);
    setSaveError(false);
    try {
      const [config, options] = await Promise.all([loadNoTailsAutomationSettings(), loadNoTailsSeminars()]);
      if (request.current !== current) return;
      setSettings(config);
      setSeminars(options);
      savedRef.current = config.finalSeminarId ?? '';
      if (!keepDraft && choiceVersion.current === version) {
        selectedRef.current = savedRef.current;
        setSelectedId(savedRef.current);
      }
      loadedRef.current = true;
    } catch (error) {
      if (request.current === current) setLoadError(error instanceof NoTailsAutomationUpdateRequired ? 'update' : 'load');
    } finally {
      if (request.current === current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => { request.current += 1; };
  }, [load]);

  const selected = seminars.find((seminar) => seminar.id === selectedId);
  const changed = selectedId !== (settings?.finalSeminarId ?? '');
  const missingSeminar = Boolean(selectedId && !selected);
  const awardStartsAt = selected
    ? (!changed && settings?.awardStartsAt ? settings.awardStartsAt : noTailsAwardStartsAt(selected))
    : null;
  const selectedPublished = !changed && settings?.isPublished != null ? settings.isPublished : selected?.isPublished;

  const save = async () => {
    if (saving || loading || !changed || missingSeminar) return;
    const current = ++request.current;
    const chosenId = selectedRef.current;
    setSaving(true);
    setSaveError(false);
    try {
      const config = await saveNoTailsAutomationSettings(chosenId || null);
      if (request.current !== current) return;
      setSettings(config);
      savedRef.current = config.finalSeminarId ?? '';
      // Keep the user's current choice; a response never overwrites a newer draft.
      toast(config.finalSeminarId ? 'Настройки выдачи сохранены' : 'Автоматическая выдача выключена', 'success');
      onSaved?.();
    } catch (error) {
      if (request.current !== current) return;
      if (error instanceof NoTailsAutomationUpdateRequired) setLoadError('update');
      else setSaveError(true);
    } finally {
      if (request.current === current) setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4 space-y-4" aria-labelledby={`${selectId}-heading`}>
      <div className="flex items-center justify-between gap-3">
        <h4 id={`${selectId}-heading`} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200"><CalendarClock className="h-4 w-4 shrink-0" aria-hidden />Когда выдавать</h4>
        <button type="button" onClick={() => { void load(); }} disabled={loading || saving} className="inline-flex min-h-9 items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />Обновить</button>
      </div>
      {loading ? (
        <p role="status" className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Загружаем настройки…</p>
      ) : loadError ? (
        <div role="status" className="space-y-2 text-sm text-slate-300">
          <p>{loadError === 'update' ? 'Настройка автоматической выдачи станет доступна после обновления базы сайта.' : 'Не удалось загрузить настройки. Попробуйте ещё раз.'}</p>
          <button type="button" onClick={() => { void load(); }} className="text-xs text-emerald-300 hover:text-white">Проверить снова</button>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400 leading-relaxed">Выберите заключительный семинар. Проверка начнётся через две недели от даты этого занятия.</p>
          <div className="space-y-2">
            <label htmlFor={selectId} className="block text-sm text-slate-300">Заключительный семинар</label>
            <select id={selectId} value={selectedId} disabled={saving} onChange={(event) => {
              choiceVersion.current += 1;
              selectedRef.current = event.target.value;
              setSelectedId(event.target.value);
              setSaveError(false);
            }} className="w-full min-w-0 rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400/60 disabled:opacity-50">
              <option value="">Не выбран — выдача выключена</option>
              {missingSeminar && <option value={selectedId} disabled>Ранее выбранный семинар недоступен</option>}
              {seminars.map((seminar) => <option key={seminar.id} value={seminar.id}>{seminar.title} · {formatDate(seminar.startsAt)}{seminar.isPublished ? '' : ' · черновик'}</option>)}
            </select>
            {seminars.length === 0 && <p className="text-xs text-slate-500">Семинаров пока нет. Создайте заключительный семинар и обновите список.</p>}
            {missingSeminar && <p role="status" className="text-xs text-amber-300">Выберите другой семинар или выключите выдачу.</p>}
          </div>

          {awardStartsAt ? (
            <div className="rounded-lg border border-emerald-400/15 bg-slate-950/40 p-3 space-y-1.5">
              <p className="text-xs text-slate-400">Начало проверки{changed ? ' после сохранения' : ''}</p>
              <p className="text-sm font-medium text-emerald-200">{formatDate(awardStartsAt)}</p>
              {selected?.usesDateOnly && <p className="text-xs text-slate-500">Время занятия не задано — отсчитываем от 00:00 мск указанной даты.</p>}
              {selected && selectedPublished === false && <p className="text-xs text-amber-300">Семинар ещё не опубликован. Выдача будет ждать публикации.</p>}
            </div>
          ) : !selectedId && <p className="text-xs text-slate-400">{changed ? 'После сохранения автоматическая выдача будет выключена.' : 'Автоматическая выдача выключена. Выберите семинар, чтобы её настроить.'}</p>}

          <p className="text-xs text-slate-400 leading-relaxed">{settings?.schedulerReady ? 'После наступления даты система проверяет раз в 5 минут: ' : 'После включения регулярной проверки и наступления даты система будет проверять раз в 5 минут: '}все опубликованные домашние задания, доступные ученику, должны быть проверены с оценкой не ниже 5 из 10.</p>
          {settings && !settings.schedulerReady && <p role="status" className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200">Регулярная проверка ещё не включена. Нужно применить SQL-обновление базы сайта.</p>}
          {saveError && <p role="status" className="text-xs text-rose-300">Не удалось сохранить настройки. Ваш выбор сохранён в форме — попробуйте ещё раз.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {!changed && settings?.finalSeminarId && <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Check className="h-3.5 w-3.5" aria-hidden />Настройки сохранены</span>}
            <button type="button" onClick={() => { void save(); }} disabled={saving || !changed || missingSeminar} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed">{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}{saving ? 'Сохраняем…' : 'Сохранить настройки'}</button>
          </div>
        </>
      )}
    </section>
  );
}
