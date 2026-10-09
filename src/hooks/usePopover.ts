import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

export type DismissReason = 'outside' | 'escape';

const OFFSCREEN: CSSProperties = { top: -10000, left: -10000 };

/**
 * Закрыть всплывающую панель кликом мимо неё или клавишей Escape. Escape
 * ловится на погружении и дальше не идёт — иначе вместе с панелью закрылась
 * бы и модалка, в которой стоит поле.
 */
export function useDismissOnOutside(
  open: boolean,
  onClose: (reason: DismissReason) => void,
  refs: RefObject<HTMLElement | null>[],
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      onClose('outside');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose('escape');
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose, refs]);
}

/**
 * Место для панели у поля: под ним, а если снизу не помещается — над ним.
 * Считается по видимой области: на телефоне её съедает клавиатура, и панель
 * под полем времени иначе пряталась бы за ней. Пока место не посчитано,
 * панель стоит за краем экрана: не мигает в углу, но уже может получить
 * фокус (календарь сразу ставит его на выбранный день).
 */
export function usePopoverPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  {
    matchWidth = false,
    maxHeight = Infinity,
    gap = 6,
    margin = 8,
  }: { matchWidth?: boolean; maxHeight?: number; gap?: number; margin?: number } = {},
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>(OFFSCREEN);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(OFFSCREEN);
      return;
    }
    const update = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const rect = anchor.getBoundingClientRect();
      const vv = window.visualViewport;
      const viewTop = vv ? vv.offsetTop : 0;
      const viewLeft = vv ? vv.offsetLeft : 0;
      const viewBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const viewRight = vv ? vv.offsetLeft + vv.width : window.innerWidth;

      const width = matchWidth ? rect.width : panel.offsetWidth;
      const height = panel.scrollHeight;
      const below = viewBottom - rect.bottom - gap - margin;
      const above = rect.top - viewTop - gap - margin;
      const placeBelow = Math.min(height, maxHeight) <= below || below >= above;
      const room = Math.min(maxHeight, Math.max(120, placeBelow ? below : above));
      const shown = Math.min(height, room);
      const top = placeBelow ? rect.bottom + gap : rect.top - gap - shown;
      const left = Math.max(viewLeft + margin, Math.min(rect.left, viewRight - margin - width));

      setStyle({
        top,
        left,
        width: matchWidth ? rect.width : undefined,
        maxHeight: room,
      });
    };
    update();
    const vv = window.visualViewport;
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
    };
  }, [open, anchorRef, panelRef, matchWidth, maxHeight, gap, margin]);

  return style;
}
