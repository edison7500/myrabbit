import { useCallback, useEffect, useRef, useState } from 'react';

export function useChartResource<T>(load: (signal: AbortSignal) => Promise<T>, resourceKey: unknown = load) {
  const [state, setState] = useState({ load, resourceKey, data: null as T | null, loading: true, error: '' });
  const request = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState(previous => ({ load, resourceKey, data: previous.resourceKey === resourceKey ? previous.data : null, loading: true, error: '' }));
    try {
      const result = await load(controller.signal);
      if (!controller.signal.aborted) setState({ load, resourceKey, data: result, loading: false, error: '' });
    } catch (issue) {
      if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: issue instanceof Error ? issue.message : 'Could not load this chart.' }));
    }
  }, [load, resourceKey]);
  useEffect(() => {
    void reload();
    return () => request.current?.abort();
  }, [reload]);
  return {
    data: state.resourceKey === resourceKey ? state.data : null,
    loading: state.load !== load || state.loading,
    error: state.load === load ? state.error : '',
    reload,
  };
}
