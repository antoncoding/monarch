import { useEffect, useState } from 'react';

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function useDeferredQueryEnable(enabled: boolean, defer = false, timeoutMs = 1500): boolean {
  const [ready, setReady] = useState(!defer);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }

    if (!defer) {
      setReady(true);
      return;
    }

    setReady(false);

    const idleWindow = window as WindowWithIdleCallback;
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(() => setReady(true), { timeout: timeoutMs });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    const handle = window.setTimeout(() => setReady(true), timeoutMs);
    return () => window.clearTimeout(handle);
  }, [defer, enabled, timeoutMs]);

  return enabled && ready;
}
