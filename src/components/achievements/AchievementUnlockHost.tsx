import { useEffect, useState } from 'react';
import { useAchievementUnlocks } from '../../hooks/useAchievementUnlocks';
import AchievementUnlockDialog from './AchievementUnlockDialog';

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);

/** Фокус в поле ввода или во встроенной форме — ученик что-то пишет. */
function isTyping(): boolean {
  const el = document.activeElement;
  if (!el || el === document.body) return false;
  if (el instanceof HTMLIFrameElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return true;
  }
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Показывает ученику окна о новых достижениях. Не перебивает ввод: пока фокус
 * в поле ответа или во встроенной Яндекс.Форме, окно ждёт.
 */
export default function AchievementUnlockHost({ userId, paused = false }: { userId: string; paused?: boolean }) {
  const { queue, dismiss } = useAchievementUnlocks(userId);
  const [open, setOpen] = useState(false);
  const hasQueue = queue.length > 0;

  useEffect(() => {
    if (open || paused || !hasQueue) return;
    const tryOpen = () => {
      if (document.visibilityState === 'visible' && !isTyping()) setOpen(true);
    };
    // На focusout фокус ещё не перешёл на новый элемент — проверяем следом.
    const onFocusOut = () => { window.setTimeout(tryOpen, 0); };
    tryOpen();
    const retry = window.setInterval(tryOpen, 1500);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('visibilitychange', tryOpen);
    return () => {
      window.clearInterval(retry);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('visibilitychange', tryOpen);
    };
  }, [open, paused, hasQueue]);

  if (!open || !hasQueue) return null;

  return <AchievementUnlockDialog items={queue} onDismiss={dismiss} onClosed={() => setOpen(false)} />;
}
