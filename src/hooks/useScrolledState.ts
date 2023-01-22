import { useCallback, useState } from '../lib/teact/teact';

const THRESHOLD = 5;

export default function useScrolledState(threshold = THRESHOLD) {
  const [isAtBeginning, setIsAtBeginning] = useState(true);
  const [isAtEnd, setIsAtEnd] = useState(true);

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const { scrollHeight, scrollTop, clientHeight } = e.target as HTMLElement;

    setIsAtBeginning(scrollTop < threshold);
    setIsAtEnd(scrollHeight - scrollTop - clientHeight < threshold);
  }, [threshold]);

  return { isAtBeginning, isAtEnd, handleScroll };
}
