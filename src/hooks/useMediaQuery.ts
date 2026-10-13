import { useEffect, useState } from 'react';

/** Совпадает ли медиазапрос сейчас; следит за изменениями (поворот, размер окна). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}

/** Главный указатель — палец: телефон или планшет. */
export const TOUCH_POINTER_QUERY = '(pointer: coarse)';
