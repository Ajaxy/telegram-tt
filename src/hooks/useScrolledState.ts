import { useState } from '../lib/teact/teact';

import useLastCallback from './useLastCallback';

const THRESHOLD = 5;

export default function useScrolledState(threshold = THRESHOLD) {
  const [isAtBeginning, setIsAtBeginning] = useState(true);
  const [isAtEnd, setIsAtEnd] = useState(true);

  const handleScroll = useLastCallback((e: React.UIEvent<HTMLElement>) => {
    const { scrollHeight, scrollTop, clientHeight } = e.target as HTMLElement;

    setIsAtBeginning(scrollTop < threshold);
    setIsAtEnd(scrollHeight - scrollTop - clientHeight < threshold);
  });

  const updateScrollState = useLastCallback((element: HTMLElement | undefined) => {
    if (!element) {
      setIsAtBeginning(true);
      setIsAtEnd(true);
      return;
    }

    const { scrollHeight, scrollTop, clientHeight } = element;
    setIsAtBeginning(scrollTop < threshold);
    setIsAtEnd(scrollHeight - scrollTop - clientHeight < threshold);
  });

  return { isAtBeginning, isAtEnd, handleScroll, updateScrollState };
}
