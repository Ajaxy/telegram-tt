import { useRef, useState } from '../../../../lib/teact/teact';

import useLastCallback from '../../../../hooks/useLastCallback';

export default function usePopupLimit(sequentialLimit: number, resetAfter: number) {
  const [unlockPopupsAt, setUnlockPopupsAt] = useState(0);
  const sequentialCalls = useRef(0);
  const lastClosedDate = useRef(0);

  const handlePopupOpened = useLastCallback(() => {
    const now = Date.now();

    if (now - lastClosedDate.current > resetAfter) {
      sequentialCalls.current = 0;
    }

    sequentialCalls.current += 1;

    if (sequentialCalls.current >= sequentialLimit) {
      setUnlockPopupsAt(now + resetAfter);
    }
  });

  const handlePopupClosed = useLastCallback(() => {
    if (unlockPopupsAt < Date.now()) { // Prevent confused user from extending lock time
      lastClosedDate.current = Date.now();
    }
  });

  return {
    unlockPopupsAt,
    handlePopupOpened,
    handlePopupClosed,
  };
}
