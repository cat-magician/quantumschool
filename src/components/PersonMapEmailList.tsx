import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardCheck, ClipboardCopy, Download, Mail } from 'lucide-react';
import type { PersonMapRow } from '../lib/selectionPersonMap';
import {
  collectEmails,
  describeSelection,
  downloadEmailListCsv,
  emailListText,
  type PersonMapSelection,
  type StageBasis,
} from '../lib/selectionStageStats';

/**
 * Список почт по текущему срезу карты: скопировать в письмо или забрать
 * таблицей. Работает ровно по тем строкам, что видно ниже, — иначе никогда не
 * понятно, кому именно уйдёт письмо.
 */

const COPY_RESET_MS = 2500;

export default function PersonMapEmailList({
  rows,
  basis,
  selection,
  onShowUnreachable,
}: {
  rows: PersonMapRow[];
  basis: StageBasis;
  selection: PersonMapSelection;
  onShowUnreachable?: () => void;
}) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'error'>('idle');
  const [revealed, setRevealed] = useState(false);

  const list = useMemo(() => collectEmails(rows), [rows]);
  const text = useMemo(() => emailListText(list.emails), [list.emails]);

  useEffect(() => {
    if (copied === 'idle') return undefined;
    const timer = window.setTimeout(() => setCopied('idle'), COPY_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('ok');
    } catch {
      // Буфер обмена может быть закрыт настройками браузера — тогда остаётся
      // выделить адреса руками, поэтому сразу их и показываем.
      setCopied('error');
      setRevealed(true);
    }
  };

  return (
    <section className="rounded-2xl bg-slate-900/60 border border-white/5 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Mail className="w-4 h-4 text-blue-400" />
            Список почт
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {describeSelection(selection)} · адресов: {list.emails.length} · человек: {list.people}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { void copy(); }}
            disabled={list.emails.length === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied === 'ok'
              ? <ClipboardCheck className="w-4 h-4" />
              : <ClipboardCopy className="w-4 h-4" />}
            {copied === 'ok' ? 'Скопировано' : 'Скопировать почты'}
          </button>
          <button
            type="button"
            onClick={() => downloadEmailListCsv(rows, basis, selection)}
            disabled={rows.length === 0}
            title="Почта, имя и чего не хватает — по каждому человеку из среза"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Скачать список
          </button>
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-expanded={revealed}
            className="px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white transition-colors"
          >
            {revealed ? 'Скрыть адреса' : 'Показать адреса'}
          </button>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {copied === 'ok' ? 'Адреса скопированы в буфер обмена' : ''}
        {copied === 'error' ? 'Скопировать не удалось, адреса показаны ниже' : ''}
      </p>

      {copied === 'error' && (
        <p className="text-xs text-amber-400">
          Браузер не дал доступ к буферу обмена — выделите адреса ниже и скопируйте вручную.
        </p>
      )}

      {list.unreachable.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-rose-300/90">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Без почты для связи: {list.unreachable.length} — в список они не попали.</span>
          {onShowUnreachable && (
            <button
              type="button"
              onClick={onShowUnreachable}
              className="underline decoration-rose-400/40 hover:decoration-rose-300 transition-colors"
            >
              Показать их
            </button>
          )}
        </p>
      )}

      {revealed && (
        <label className="block">
          <span className="sr-only">Адреса через запятую</span>
          <textarea
            readOnly
            value={text}
            rows={4}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="Ни одного адреса"
            className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-slate-300 text-xs leading-relaxed font-mono resize-y focus:outline-none focus:border-blue-500/60"
          />
        </label>
      )}
    </section>
  );
}
