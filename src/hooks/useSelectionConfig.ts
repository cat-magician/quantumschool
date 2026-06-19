import { useCallback, useEffect, useState } from 'react';
import { fetchSelectionConfig } from '../lib/selectionConfig';
import type { SelectionStageConfig } from '../lib/types';
import { DEFAULT_SELECTION_CONFIG } from '../lib/selectionConfig';

export function useSelectionConfig() {
  const [config, setConfig] = useState<SelectionStageConfig>(DEFAULT_SELECTION_CONFIG);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setConfig(await fetchSelectionConfig());
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { config, loading, reload };
}
