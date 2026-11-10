import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeRealtime, connectionListeners } from '../services/realtime';

/**
 * useApi(fn, deps, { live }) -> { data, error, loading, reload, stale }
 * - `live: true` re-fetches (debounced) when the server pushes a relevant real-time event,
 *   and on every socket reconnect, so the screen never relies on missed events.
 * - `stale` is true when the socket is disconnected (data may be out of date).
 */
export function useApi(fn, deps = [], { live = false } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [stale, setStale] = useState(false);
  const seq = useRef(0);
  const fnRef = useRef(fn); fnRef.current = fn;

  const load = useCallback(async (silent = false) => {
    const my = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (my === seq.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (my === seq.current) setState((s) => ({ data: silent ? s.data : null, error, loading: false }));
    }
  }, []);

  useEffect(() => { load(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, deps);

  useEffect(() => {
    if (!live) return undefined;
    let t = null;
    const debounced = () => { clearTimeout(t); t = setTimeout(() => load(true), 300); };
    const off = subscribeRealtime(debounced);
    const onConn = (s) => { setStale(s === 'disconnected'); if (s === 'connected') debounced(); };
    connectionListeners.add(onConn);
    return () => { clearTimeout(t); off(); connectionListeners.delete(onConn); };
  }, [live, load]);

  return { ...state, reload: () => load(true), stale };
}
