import { createContext, useContext } from 'react';
import type { TimeView } from './schoolTime';

/**
 * Как показывать время событий: в кабинете сотрудника — по Москве, у
 * ученика — по часам его устройства с московским рядом. Вид задаёт кабинет
 * (TimeViewContext.Provider), а карточки, календарь и страницы занятий
 * берут его отсюда.
 */
export const TimeViewContext = createContext<TimeView>('viewer');

export function useTimeView(): TimeView {
  return useContext(TimeViewContext);
}
