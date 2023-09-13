import { useEffect } from '../../../lib/teact/teact';

import { createSignal } from '../../../util/signals';

export const [getIsVideoWaiting, setIsVideoWaiting] = createSignal(false);

export default function useVideoWaitingSignal() {
  useEffect(() => {
    return () => {
      setIsVideoWaiting(false);
    };
  }, []);
  return [getIsVideoWaiting, setIsVideoWaiting] as const;
}
