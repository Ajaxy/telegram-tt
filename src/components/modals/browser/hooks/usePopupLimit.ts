import { useRef, useState } from '../../../../lib/teact/teact';

import useLastCallback from '../../../../hooks/useLastCallback';

export default function usePopupLimit(sequentialLimit: number, resetAfter: number) {
  const [unlockPopupsAt, setUnlockPopupsAt] = useState(0);
  const sequentialCallsRef = useRef(0);
  const lastClosedDateRef = useRef(0);

  const handlePopupOpened = useLastCallback(() => {
    const now = Date.now();

    if (now - lastClosedDateRef.current > resetAfter) {
      sequentialCallsRef.current = 0;
    }

    sequentialCallsRef.current += 1;

    if (sequentialCallsRef.current >= sequentialLimit) {
      setUnlockPopupsAt(now + resetAfter);
    }
  });

  const handlePopupClosed = useLastCallback(() => {
    if (unlockPopupsAt < Date.now()) { // Prevent confused user from extending lock time
      lastClosedDateRef.current = Date.now();
    }
  });

  return {
    unlockPopupsAt,
    handlePopupOpened,
    handlePopupClosed,
  };
}
