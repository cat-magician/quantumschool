import { useEffect } from 'react';
import { TOUCH_POINTER_QUERY } from './useMediaQuery';

/**
 * Пока открыто окно или меню, страница под ним на телефоне не прокручивается:
 * иначе свайп по затемнению листал сайт за окном. Только для сенсорных
 * устройств — на компьютере пропажа полосы прокрутки сдвигала бы вёрстку.
 */
export function useTouchScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || !window.matchMedia(TOUCH_POINTER_QUERY).matches) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [active]);
}
