import { useUnmountCleanup } from '../lib/teact/teact';

import { createSignal } from '../util/signals';

export const [getCurrentTime, setCurrentTime] = createSignal(0);

export default function useCurrentTimeSignal() {
  useUnmountCleanup(() => {
    setCurrentTime(0);
  });

  return [getCurrentTime, setCurrentTime] as const;
}
