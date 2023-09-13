import { useEffect } from '../lib/teact/teact';

import { createSignal } from '../util/signals';

export const [getCurrentTime, setCurrentTime] = createSignal(0);

export default function useCurrentTimeSignal() {
  useEffect(() => {
    return () => {
      setCurrentTime(0);
    };
  }, []);
  return [getCurrentTime, setCurrentTime] as const;
}
