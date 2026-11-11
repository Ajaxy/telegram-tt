import type { ElementRef } from '@teact';
import { useMemo, useState } from '@teact';

import type { Size } from '../render/transform';

import useResizeObserver from '../../../../hooks/useResizeObserver';

interface UseDisplaySizeOptions {
  canvasAreaRef: ElementRef<HTMLDivElement>;
  imageWidth: number;
  imageHeight: number;
  reservedHeight: number;
  isDisabled?: boolean;
}

const EMPTY_SIZE: Size = { width: 0, height: 0 };

export default function useDisplaySize({
  canvasAreaRef,
  imageWidth,
  imageHeight,
  reservedHeight,
  isDisabled,
}: UseDisplaySizeOptions) {
  const [areaSize, setAreaSize] = useState(EMPTY_SIZE);

  useResizeObserver(canvasAreaRef, ({ contentRect }) => {
    setAreaSize({ width: contentRect.width, height: contentRect.height });
  }, isDisabled);

  return useMemo(() => {
    const availableHeight = areaSize.height - reservedHeight;
    if (!imageWidth || !imageHeight || areaSize.width <= 0 || availableHeight <= 0) {
      return { displaySize: EMPTY_SIZE, displayScale: 0 };
    }

    const displayScale = Math.min(areaSize.width / imageWidth, availableHeight / imageHeight, 1);

    return {
      displaySize: { width: imageWidth * displayScale, height: imageHeight * displayScale },
      displayScale,
    };
  }, [areaSize, imageWidth, imageHeight, reservedHeight]);
}
