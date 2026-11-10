import { useCallback, useEffect, useState } from 'react';
import { readCollection, writeCollection, StorageKeys } from '../services/storage';
import { getMeta } from '../services/boxService';

/**
 * Demo Mode now means: "show the SIMULATOR controls". It only has an effect when the server has
 * dev tools enabled (never in production) and only ever acts on boxes flagged is_simulated.
 * Real boxes are never touched by it.
 */
export function useDemoMode() {
  const [enabled, setEnabled] = useState(() => readCollection(StorageKeys.DEMO_MODE, false));
  const [devTools, setDevTools] = useState(false);
  useEffect(() => { writeCollection(StorageKeys.DEMO_MODE, enabled); }, [enabled]);
  useEffect(() => { getMeta().then((m) => setDevTools(!!m.devTools)).catch(() => setDevTools(false)); }, []);
  const toggle = useCallback(() => setEnabled((v) => !v), []);
  return { demoMode: enabled && devTools, devToolsAvailable: devTools, setDemoMode: setEnabled, toggleDemoMode: toggle };
}
