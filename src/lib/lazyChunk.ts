import { lazy, type ComponentType } from 'react';

/**
 * lazy() для чанков, которые могут пропасть с сервера после выкладки новой
 * версии. В этот момент обработчик vite:preloadError в main.tsx уже
 * перезагружает страницу, а импорт отдаёт undefined — тогда просто ждём
 * перезагрузки на заглушке загрузки, вместо того чтобы уронить приложение
 * ошибкой «Cannot read properties of undefined (reading 'default')».
 */
export function lazyChunk<P>(load: () => Promise<{ default: ComponentType<P> }>) {
  return lazy(() => load().then((module) => module ?? new Promise<never>(() => {})));
}
