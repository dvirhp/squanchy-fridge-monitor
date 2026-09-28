import { useEffect, useState } from 'react';
import { request } from '../api/client';
export function useApi<T>(path: string) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true });
    request<T>(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ data, loading: false });
    }).catch((error: Error) => { if (!controller.signal.aborted) setState({ error: error.message, loading: false }); });
    return () => controller.abort();
  }, [path, attempt]);
  return { ...state, retry: () => setAttempt(a => a + 1) };
}
