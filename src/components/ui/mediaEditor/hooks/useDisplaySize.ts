import type { ElementRef } from '@teact';
import { useEffect, useState } from '@teact';

import useLastCallback from '../../../../hooks/useLastCallback';

interface UseDisplaySizeOptions {
  canvasAreaRef: ElementRef<HTMLDivElement>;
  imageWidth: number;
  imageHeight: number;
  reservedHeight?: number;
}

export default function useDisplaySize({
  canvasAreaRef,
  imageWidth,
  imageHeight,
  reservedHeight = 0,
}: UseDisplaySizeOptions) {
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  const getDisplayScale = useLastCallback(() => {
    if (displaySize.width === 0 || imageWidth === 0) return 1;
    return Math.min(
      displaySize.width / imageWidth,
      displaySize.height / imageHeight,
    );
  });

  useEffect(() => {
    const canvasArea = canvasAreaRef.current;
    if (!canvasArea || imageWidth === 0) return undefined;

    const updateDisplaySize = () => {
      const areaRect = canvasArea.getBoundingClientRect();
      const style = getComputedStyle(canvasArea);
      const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const availableWidth = areaRect.width - paddingX;
      const availableHeight = areaRect.height - paddingY - reservedHeight;

      if (availableWidth <= 0 || availableHeight <= 0) return;

      const scaleToFit = Math.min(
        availableWidth / imageWidth,
        availableHeight / imageHeight,
      );

      const scale = Math.min(scaleToFit, 1);

      setDisplaySize({
        width: imageWidth * scale,
        height: imageHeight * scale,
      });
    };

    updateDisplaySize();

    window.addEventListener('resize', updateDisplaySize);
    return () => window.removeEventListener('resize', updateDisplaySize);
  }, [canvasAreaRef, imageWidth, imageHeight, reservedHeight]);

  const resetDisplaySize = useLastCallback(() => {
    setDisplaySize({ width: 0, height: 0 });
  });

  return {
    displaySize,
    getDisplayScale,
    resetDisplaySize,
  };
}
