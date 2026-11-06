import { useEffect, useState } from 'react';
import { loadAchievementCatalog } from '../lib/achievementApi';
import type { AchievementDefinition } from '../lib/types';

/** Каталог достижений; null — ещё загружается. Запрос один на всю сессию. */
export function useAchievementCatalog(): AchievementDefinition[] | null {
  const [catalog, setCatalog] = useState<AchievementDefinition[] | null>(null);

  useEffect(() => {
    let active = true;
    void loadAchievementCatalog().then((loaded) => {
      if (active) setCatalog(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  return catalog;
}
