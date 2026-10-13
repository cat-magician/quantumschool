import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Ссылка с якорем (/#contact, /privacy#contacts) открывала страницу в самом
 * верху: браузер ищет раздел до того, как React его нарисовал. Доводим сами —
 * при загрузке страницы и при переходе ссылкой внутри сайта. Переходы по
 * якорям на самой странице и «Назад» браузер прокручивает сам, их не трогаем.
 *
 * ready — содержимое выше раздела уже на месте и не сдвинет его.
 */
export function useScrollToHash(ready = true) {
  const { hash, key } = useLocation();
  const navigationType = useNavigationType();
  const firstRef = useRef(true);
  const handledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const first = firstRef.current;
    firstRef.current = false;
    if (!hash || handledKeyRef.current === key) return;
    handledKeyRef.current = key;
    if (!first && navigationType === 'POP') return;

    document
      .getElementById(decodeURIComponent(hash.slice(1)))
      ?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, [ready, hash, key, navigationType]);
}
