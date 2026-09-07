import { useEffect } from 'react';

// Realtime: chỉ cần fetch (hỗ trợ header x-auth-token, không dùng EventSource vì
// EventSource không gửi được custom header)
export function useEventSource(path, onEvent) {
  useEffect(() => {
    const token = localStorage.getItem('hs_token') || '';
    let cancelled = false;
    let retryTimer;

    async function connect() {
      try {
        const res = await fetch(path, {
          headers: token ? { 'x-auth-token': token } : undefined,
        });
        if (!res.ok || !res.body) throw new Error('SSE failed');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          // Tách frame SSE: mỗi frame kết thúc với \n\n
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const dataLine = frame
              .split('\n')
              .find((l) => l.startsWith('data: '));
            if (dataLine) {
              try {
                onEvent?.(JSON.parse(dataLine.slice(6)));
              } catch {
                /* ignore bad frame */
              }
            }
          }
        }
        try {
          reader.cancel();
        } catch {
          /* ignore */
        }
      } catch {
        // Kết nối mất -> kết nối lại sau 5s
        if (!cancelled) retryTimer = setTimeout(connect, 5000);
      }
    }

    connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
}