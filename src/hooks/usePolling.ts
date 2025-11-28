import { useEffect, useRef, useState } from 'react';

export type PollingInterval = 5000 | 30000 | 60000 | null;

export function usePolling(
  callback: () => void | Promise<void>,
  interval: PollingInterval
) {
  const savedCallback = useRef(callback);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (interval === null) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    const id = setInterval(async () => {
      await savedCallback.current();
    }, interval);

    return () => {
      clearInterval(id);
      setIsPolling(false);
    };
  }, [interval]);

  return isPolling;
}
