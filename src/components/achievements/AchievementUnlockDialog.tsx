import { useEffect, useId, useRef, useState, type CSSProperties, type SyntheticEvent, type AnimationEvent } from 'react';
import { useTouchScrollLock } from '../../hooks/useTouchScrollLock';
import type { AchievementUnlock } from '../../lib/achievementUtils';
import AchievementImage from './AchievementImage';

type Props = {
  /** Первое показывается, остальные — следом, по «Круто!». */
  items: AchievementUnlock[];
  onDismiss: (id: string) => void;
  onClosed: () => void;
};

type Leaving = 'next' | 'close';

/** Конец анимации ухода может не прийти (вкладку свернули) — тогда по таймеру. */
const LEAVE_FALLBACK_MS = 600;

const STAR_PATH = 'M12 0C12.7 6.6 17.4 11.3 24 12 17.4 12.7 12.7 17.4 12 24 11.3 17.4 6.6 12.7 0 12 6.6 11.3 11.3 6.6 12 0Z';

const SPARKLES = [
  { x: '16%', y: '20%', size: 16, color: '#ffffff', delay: 0.5, duration: 2.4 },
  { x: '82%', y: '16%', size: 20, color: '#c7d2fe', delay: 0.9, duration: 2.8 },
  { x: '90%', y: '56%', size: 12, color: '#a5f3fc', delay: 1.3, duration: 2.2 },
  { x: '9%', y: '60%', size: 11, color: '#ddd6fe', delay: 1.7, duration: 2.6 },
  { x: '70%', y: '88%', size: 14, color: '#ffffff', delay: 0.7, duration: 3 },
  { x: '27%', y: '86%', size: 10, color: '#bae6fd', delay: 2.1, duration: 2.3 },
  { x: '52%', y: '5%', size: 11, color: '#e0e7ff', delay: 1.1, duration: 2.5 },
  { x: '96%', y: '34%', size: 8, color: '#ffffff', delay: 2.4, duration: 2 },
  { x: '4%', y: '36%', size: 13, color: '#c4b5fd', delay: 0.35, duration: 2.9 },
];

const BURST_COLORS = ['#e0e7ff', '#a5f3fc', '#ddd6fe'];
const BURST = Array.from({ length: 14 }, (_, i) => ({
  angle: (360 / 14) * i + (i % 2 ? 9 : 0),
  distance: [118, 96, 108][i % 3],
  size: i % 2 ? 4 : 6,
  color: BURST_COLORS[i % 3],
}));

const MOTES = [
  { x: '26%', size: 4, delay: 0.9, duration: 3.6, dx: -10 },
  { x: '40%', size: 3, delay: 2.2, duration: 4.2, dx: 8 },
  { x: '58%', size: 5, delay: 1.4, duration: 3.9, dx: -6 },
  { x: '72%', size: 3, delay: 2.9, duration: 4.4, dx: 12 },
  { x: '48%', size: 4, delay: 3.6, duration: 3.4, dx: 4 },
  { x: '33%', size: 3, delay: 4.3, duration: 4, dx: -4 },
];

/** Переменные для анимаций: в типе style нет свойств вида «--имя». */
function cssVars(values: Record<string, string | number>): CSSProperties {
  return values as CSSProperties;
}

/** Окно «Вы получили новое достижение!»: выезжает, держит очередь, закрывается по «Круто!». */
export default function AchievementUnlockDialog({ items, onDismiss, onClosed }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const leaving = useRef<Leaving | null>(null);
  const closedByUs = useRef(false);
  const leaveTimer = useRef<number | undefined>(undefined);
  const [leavingState, setLeavingState] = useState<Leaving | null>(null);
  const [position, setPosition] = useState(1);
  const headingId = useId();
  const textId = useId();

  const current = items[0];
  const total = position - 1 + items.length;

  useTouchScrollLock(true);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    closedByUs.current = false;
    if (!dialog.open) dialog.showModal();
    return () => {
      closedByUs.current = true;
      window.clearTimeout(leaveTimer.current);
      if (dialog.open) dialog.close();
    };
  }, []);

  const currentId = current?.id;
  useEffect(() => {
    buttonRef.current?.focus();
  }, [currentId]);

  if (!current) return null;

  const finishLeave = () => {
    const action = leaving.current;
    if (!action) return;
    leaving.current = null;
    window.clearTimeout(leaveTimer.current);
    if (action === 'next') {
      setLeavingState(null);
      setPosition((n) => n + 1);
      onDismiss(current.id);
      return;
    }
    closedByUs.current = true;
    dialogRef.current?.close();
    onDismiss(current.id);
    onClosed();
  };

  const acknowledge = () => {
    if (leaving.current) return;
    const action: Leaving = items.length > 1 ? 'next' : 'close';
    leaving.current = action;
    setLeavingState(action);
    leaveTimer.current = window.setTimeout(finishLeave, LEAVE_FALLBACK_MS);
  };

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    acknowledge();
  };

  // Esc сразу после открытия браузер отменить не даёт и закрывает окно сам.
  const handleClose = () => {
    if (closedByUs.current || dialogRef.current?.open) return;
    window.clearTimeout(leaveTimer.current);
    leaving.current = null;
    onDismiss(current.id);
    onClosed();
  };

  const handlePanelAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.animationName === 'achv-panel-out') finishLeave();
  };

  const maskImage = current.imageSrc ? `url(${JSON.stringify(current.imageSrc)})` : undefined;

  return (
    <dialog
      ref={dialogRef}
      className="achv-dialog m-0 h-full max-h-none w-full max-w-none overflow-y-auto overscroll-contain border-0 bg-transparent p-4 text-white open:flex"
      data-closing={leavingState === 'close' ? '' : undefined}
      aria-labelledby={headingId}
      aria-describedby={textId}
      onCancel={handleCancel}
      onClose={handleClose}
    >
      <div
        key={current.id}
        className="achv-panel relative m-auto w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-white/15 bg-slate-900/40 px-6 pb-6 pt-7 text-center backdrop-blur-md sm:px-8"
        data-leaving={leavingState ? '' : undefined}
        onAnimationEnd={handlePanelAnimationEnd}
      >
        <div className="achv-aura" aria-hidden />

        <h2
          id={headingId}
          className="achv-reveal relative text-[15px] font-semibold leading-snug"
          style={cssVars({ '--achv-delay': '120ms' })}
        >
          <span className="hero-subtitle-gradient">Вы получили новое достижение!</span>
        </h2>

        <div className="achv-stage relative mx-auto mt-1 h-56 w-56 sm:h-60 sm:w-60" aria-hidden>
          <div className="achv-rays" />
          <div className="achv-halo" />
          {MOTES.map((mote, i) => (
            <span
              key={i}
              className="achv-mote"
              style={cssVars({
                left: mote.x,
                '--achv-size': `${mote.size}px`,
                '--achv-delay': `${mote.delay}s`,
                '--achv-dur': `${mote.duration}s`,
                '--achv-dx': `${mote.dx}px`,
              })}
            />
          ))}
          <div className="achv-flash" />
          <div className="achv-ring" />
          <div className="achv-burst">
            {BURST.map((particle, i) => (
              <span
                key={i}
                style={cssVars({
                  '--achv-angle': `${particle.angle}deg`,
                  '--achv-distance': `${particle.distance}px`,
                  '--achv-size': `${particle.size}px`,
                  '--achv-color': particle.color,
                })}
              />
            ))}
          </div>
          <div className="achv-float absolute inset-0 flex items-center justify-center">
            <div className="achv-pop relative h-36 w-36 sm:h-40 sm:w-40">
              <AchievementImage code={current.code} imageSrc={current.imageSrc} className="achv-img h-full w-full" />
              {maskImage && (
                <div className="achv-sheen" style={{ WebkitMaskImage: maskImage, maskImage }} />
              )}
            </div>
          </div>
          {SPARKLES.map((sparkle, i) => (
            <svg
              key={i}
              viewBox="0 0 24 24"
              className="achv-sparkle"
              style={cssVars({
                left: sparkle.x,
                top: sparkle.y,
                '--achv-size': `${sparkle.size}px`,
                '--achv-color': sparkle.color,
                '--achv-delay': `${sparkle.delay}s`,
                '--achv-dur': `${sparkle.duration}s`,
              })}
            >
              <path d={STAR_PATH} fill="currentColor" />
            </svg>
          ))}
        </div>

        <div id={textId} className="relative">
          <p
            className="achv-reveal font-brand text-[1.35rem] leading-[1.15] text-white text-balance break-words sm:text-2xl"
            style={cssVars({ '--achv-delay': '460ms' })}
          >
            {current.title}
          </p>
          {current.description && (
            <p
              className="achv-reveal mt-3 text-[15px] leading-relaxed text-slate-300 text-pretty break-words"
              style={cssVars({ '--achv-delay': '540ms' })}
            >
              {current.description}
            </p>
          )}
        </div>

        <button
          ref={buttonRef}
          type="button"
          onClick={acknowledge}
          className="achv-reveal relative mt-7 flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 text-base font-semibold text-white transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          style={cssVars({ '--achv-delay': '640ms' })}
        >
          Круто!
        </button>

        {total > 1 && (
          <p
            className="achv-reveal relative mt-3 text-xs tabular-nums text-slate-400"
            style={cssVars({ '--achv-delay': '700ms' })}
          >
            {position} из {total}
          </p>
        )}
      </div>
    </dialog>
  );
}
