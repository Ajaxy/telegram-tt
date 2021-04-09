import { useEffect, useRef } from '../lib/teact/teact';

import fastBlur from '../lib/fastBlur';
import { imgToCanvas } from '../util/files';
import useForceUpdate from './useForceUpdate';

const RADIUS = 2;
const ITERATIONS = 2;
const MAX_CACHE_SIZE = 1000;

const cache = new Map<string, string>();

export default function useBlur(dataUri?: string, isDisabled = false, delay?: number) {
  const blurredRef = useRef<string | undefined>(dataUri ? cache.get(dataUri) : undefined);
  const timeoutRef = useRef<number>();
  const forceUpdate = useForceUpdate();

  if (timeoutRef.current && isDisabled) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = undefined;
  }

  useEffect(() => {
    if (!dataUri || blurredRef.current || isDisabled) {
      return;
    }

    const img = new Image();

    img.onload = () => {
      const canvas = imgToCanvas(img);
      fastBlur(canvas.getContext('2d'), 0, 0, canvas.width, canvas.height, RADIUS, ITERATIONS);
      const blurredDataUri = canvas.toDataURL();

      blurredRef.current = blurredDataUri;
      forceUpdate();

      if (cache.size >= MAX_CACHE_SIZE) {
        cache.clear();
      }
      cache.set(dataUri, blurredDataUri);
    };

    if (delay) {
      timeoutRef.current = window.setTimeout(() => {
        img.src = dataUri;
      }, delay);
    } else {
      img.src = dataUri;
    }
  }, [dataUri, delay, forceUpdate, isDisabled]);

  return blurredRef.current;
}
