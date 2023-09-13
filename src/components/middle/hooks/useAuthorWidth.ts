import type { RefObject } from 'react';
import { useLayoutEffect } from '../../../lib/teact/teact';

import { requestForcedReflow } from '../../../lib/fasterdom/fasterdom';

export default function useAuthorWidth(
  containerRef: RefObject<HTMLDivElement>,
  signature?: string,
) {
  useLayoutEffect(() => {
    if (!signature) return;

    requestForcedReflow(() => {
      const width = containerRef.current!.querySelector<HTMLDivElement>('.message-signature')?.offsetWidth;
      if (!width) return undefined;

      return () => {
        containerRef.current!.style.setProperty('--meta-safe-author-width', `${width}px`);
      };
    });
  }, [containerRef, signature]);
}
