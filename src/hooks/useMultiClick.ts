import { useCallback, useRef } from '../lib/teact/teact';

const CLICK_TIMEOUT = 300;

export default function useMultiClick(amount: number, callback: NoneToVoidFunction) {
  const currentAmountRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleClick = useCallback(() => {
    currentAmountRef.current++;
    if (currentAmountRef.current === amount) {
      currentAmountRef.current = 0;
      callback();
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      currentAmountRef.current = 0;
    }, CLICK_TIMEOUT);
  }, [amount, callback]);

  return handleClick;
}
