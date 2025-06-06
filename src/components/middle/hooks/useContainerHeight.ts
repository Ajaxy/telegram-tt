import type { ElementRef } from '../../../lib/teact/teact';
import { useEffect, useRef, useSignal } from '../../../lib/teact/teact';

import useLastCallback from '../../../hooks/useLastCallback';
import useResizeObserver from '../../../hooks/useResizeObserver';

export default function useContainerHeight(containerRef: ElementRef<HTMLDivElement>, isComposerVisible: boolean) {
  const [getContainerHeight, setContainerHeight] = useSignal<number | undefined>();

  // Container resize observer (caused by Composer reply/webpage panels)
  const handleResize = useLastCallback((entry: ResizeObserverEntry) => {
    setContainerHeight(entry.contentRect.height);
  });

  useResizeObserver(containerRef, handleResize);

  useEffect(() => {
    const currentNormalHeight = Number(containerRef.current!.dataset.normalHeight) || 0;
    const containerHeight = getContainerHeight();

    if (containerHeight && containerHeight > currentNormalHeight && isComposerVisible) {
      containerRef.current!.dataset.normalHeight = String(containerHeight);
    }
  }, [isComposerVisible, containerRef, getContainerHeight]);

  const prevContainerHeight = useRef<number>();

  return [getContainerHeight, prevContainerHeight] as const;
}
