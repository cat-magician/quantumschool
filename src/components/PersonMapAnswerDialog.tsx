import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRightLeft, Check, ExternalLink, Link2, Link2Off, Loader2, X,
} from 'lucide-react';
import { SearchableActionList, type PickerRow } from './SearchablePicker';
import { FORM_KIND_LABELS, type FormKind } from '../lib/identityMatching';
import { formatMapStamp } from '../lib/selectionPersonMap';

/** Safari пока не умеет закрывать окно кликом мимо сам — там это делаем мы. */
const NATIVE_LIGHT_DISMISS = typeof HTMLDialogElement !== 'undefined'
  && 'closedBy' in HTMLDialogElement.prototype;

/**
 * Оболочка окон карты — нативный <dialog>. Он сам держит фокус внутри,
 * делает страницу под собой недоступной, закрывается по Esc, жесту «назад» и
 * клику мимо (closedby="any") и, закрываясь, возвращает фокус на кнопку,
 * которой окно открыли. Как бы окно ни закрылось, React узнаёт об этом по
 * событию close.
 */
export function MapDialogShell({
  label,
  kind,
  title,
  subtitle,
  onClose,
  children,
}: {
  label: string;
  kind: FormKind;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    // В типах React этого атрибута ещё нет.
    dialog.setAttribute('closedby', 'any');
    if (!dialog.open) dialog.showModal();
    // Закрываем, пока элемент ещё в документе: из удалённого окна браузер
    // фокус на место не вернёт.
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={() => {
        // Запоздалое close от прошлого открытия (двойной запуск эффектов в
        // режиме разработки) окно уже открытым не застанет.
        if (!ref.current?.open) onClose();
      }}
      onClick={NATIVE_LIGHT_DISMISS ? undefined : (event) => {
        const dialog = event.currentTarget;
        // Клик по затемнению приходит в сам <dialog>, по содержимому — нет;
        // рамка окна тоже <dialog>, поэтому проверяем ещё и координаты.
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        const inside = box.top <= event.clientY && event.clientY <= box.bottom
          && box.left <= event.clientX && event.clientX <= box.right;
        if (!inside) dialog.close();
      }}
      className="w-[calc(100%-2rem)] max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-slate-900 border border-white/10 text-slate-200 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {FORM_KIND_LABELS[kind]}
            </p>
            <h3 className="text-base font-semibold text-white truncate">{title}</h3>
            {subtitle}
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Закрыть"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

/** Отметка человека на сайте — с ней сверяют время ответов. */
export function PersonMarkLine({ mark, hint }: { mark: string | null; hint?: string }) {
  return (
    <p className="text-xs text-slate-400 mt-0.5">
      {mark
        ? `Отметка на сайте: ${formatMapStamp(mark)}${hint ? ` — ${hint}` : ''}`
        : 'Отметки на сайте по этой форме нет'}
    </p>
  );
}

/** Ответ формы, уже привязанный к человеку, — для окна «кто связан». */
export type MapLinkedAnswer = {
  /** Как ответ адресуется в действиях: сохранённая связь или строка разбора. */
  key: string;
  /** Лежит в базе — меняется сразу; иначе это решение разбора до сохранения. */
  saved: boolean;
  /** Разбор только предлагает связь: человек её ещё не подтверждал. */
  unconfirmed?: boolean;
  title: string;
  /** Кто в форме, когда, откуда — по строке. */
  details: string[];
  workUrl: string | null;
  /** На чём сошлось — словами; пусто, если связь поставили вручную. */
  reasons: string;
  /** Итог проверки честности — у контеста. */
  note: string | null;
};

type Step =
  | { mode: 'idle' }
  | { mode: 'moving'; key: string }
  | { mode: 'unlinking'; key: string };

const BUTTON = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const PLAIN = `${BUTTON} bg-white/5 text-slate-200 border-white/10 hover:bg-white/10`;
const DANGER = `${BUTTON} bg-rose-500/10 text-rose-300 border-rose-500/25 hover:bg-rose-500/20`;
const GOOD = `${BUTTON} bg-emerald-500/10 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20`;

function noteTone(note: string): string {
  if (/подозрительно/.test(note)) return 'text-rose-300';
  return /есть вопросы/.test(note) ? 'text-amber-300' : 'text-emerald-300/80';
}

/**
 * Кто связан с человеком по форме — и что с этим сделать: ответ оказался
 * чужим (перенести к другому аккаунту), лишним (отвязать) или разбор его
 * только предложил (подтвердить). Сохранённые связи меняются сразу, решения
 * разбора — вместе с остальными по кнопке «Сохранить связи».
 */
export default function PersonMapAnswerDialog({
  personName,
  personMark,
  kind,
  answers,
  accountOptions,
  onMove,
  onUnlink,
  onConfirm,
  onPickAnother,
  onClose,
}: {
  personName: string;
  personMark: string | null;
  kind: FormKind;
  answers: MapLinkedAnswer[];
  /** Кому можно отдать ответ: аккаунты сайта, похожие на него — первыми. */
  accountOptions: (answerKey: string) => PickerRow[];
  /** Возвращают текст ошибки или null. */
  onMove: (answerKey: string, profileId: string) => Promise<string | null>;
  onUnlink: (answerKey: string) => Promise<string | null>;
  onConfirm?: (answerKey: string) => void;
  /** Привязать этому человеку ещё один ответ — открывает список ответов. */
  onPickAnother?: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>({ mode: 'idle' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    setError(null);
    const failure = await action();
    setBusy(false);
    if (failure) setError(failure);
    else setStep({ mode: 'idle' });
  };

  return (
    <MapDialogShell
      label={`${FORM_KIND_LABELS[kind]}: кто связан с ${personName}`}
      kind={kind}
      title={personName}
      subtitle={<PersonMarkLine mark={personMark} />}
      onClose={onClose}
    >
      {answers.length === 0 ? (
        <p className="text-sm text-slate-400">Связей по этой форме у человека больше нет.</p>
      ) : (
        <ul className="space-y-3">
          {answers.map((answer) => {
            const moving = step.mode === 'moving' && step.key === answer.key;
            const unlinking = step.mode === 'unlinking' && step.key === answer.key;
            const later = 'Решение войдёт в «Сохранить связи» внизу карты.';

            return (
              <li key={answer.key} className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-white break-words min-w-0">{answer.title}</p>
                  <span className={`shrink-0 text-[11px] ${answer.saved ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {answer.saved ? 'сохранено' : answer.unconfirmed ? 'предложено разбором' : 'не сохранено'}
                  </span>
                </div>
                {answer.details.map((line) => (
                  <p key={line} className="text-xs text-slate-400 break-words">{line}</p>
                ))}
                {answer.workUrl && (
                  <a
                    href={answer.workUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-300 hover:text-blue-200 underline decoration-blue-400/40"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    открыть работу
                  </a>
                )}
                <p className="text-[11px] text-slate-500">
                  {answer.reasons ? `На чём сошлось: ${answer.reasons}` : 'Связь поставлена вручную'}
                </p>
                {answer.note && (
                  <p className={`text-[11px] leading-snug ${noteTone(answer.note)}`}>{answer.note}</p>
                )}

                {step.mode === 'idle' && (
                  <div className="flex flex-wrap gap-2 pt-1.5">
                    {answer.unconfirmed && onConfirm && (
                      <button type="button" onClick={() => onConfirm(answer.key)} className={GOOD}>
                        <Check className="w-3.5 h-3.5" />
                        Это он — подтвердить
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setStep({ mode: 'moving', key: answer.key })}
                      className={PLAIN}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Перенести к другому аккаунту…
                    </button>
                    <button
                      type="button"
                      onClick={() => (answer.saved
                        ? setStep({ mode: 'unlinking', key: answer.key })
                        : void run(() => onUnlink(answer.key)))}
                      className={DANGER}
                    >
                      <Link2Off className="w-3.5 h-3.5" />
                      Отвязать
                    </button>
                  </div>
                )}

                {unlinking && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 space-y-2">
                    <p className="text-xs text-rose-200">
                      Отвязать этот ответ от «{personName}»? Связь удалится из базы сразу, ответ
                      станет ничьим — его можно будет привязать заново.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => onUnlink(answer.key))}
                        className={DANGER}
                      >
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
                        Отвязать
                      </button>
                      <button type="button" disabled={busy} onClick={() => setStep({ mode: 'idle' })} className={PLAIN}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {moving && (
                  <div className="space-y-2 pt-1.5">
                    <p className="text-xs text-slate-300">
                      Чей это ответ на самом деле?{' '}
                      {answer.saved ? 'Перенос сохранится в базе сразу.' : later}
                    </p>
                    {busy ? (
                      <p className="flex items-center gap-2 text-xs text-slate-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Переношу…
                      </p>
                    ) : (
                      <SearchableActionList
                        items={accountOptions(answer.key)}
                        onPick={(profileId) => void run(() => onMove(answer.key, profileId))}
                        searchPlaceholder="Имя, почта, логин…"
                        emptyText="Других аккаунтов нет"
                      />
                    )}
                    <button type="button" disabled={busy} onClick={() => setStep({ mode: 'idle' })} className={PLAIN}>
                      Отмена
                    </button>
                  </div>
                )}

                {step.mode === 'idle' && (
                  <p className="text-[10px] text-slate-600">
                    {answer.saved ? 'Перенос и отвязка сохраняются в базе сразу.' : later}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}

      {onPickAnother && (
        <div className="pt-3 border-t border-white/5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={onPickAnother} className={PLAIN}>
            <Link2 className="w-3.5 h-3.5" />
            {answers.length > 0 ? 'Привязать ещё один ответ…' : 'Выбрать ответ…'}
          </button>
          {answers.length > 0 && (
            <p className="text-[11px] text-slate-500 min-w-[12rem] flex-1">
              Например, второй аккаунт в Контесте. Неверный ответ сначала отвяжите.
            </p>
          )}
        </div>
      )}
    </MapDialogShell>
  );
}
