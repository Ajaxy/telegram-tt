import type { ElementRef, TeactNode } from '../../lib/teact/teact';
import { useEffect, useMemo, useRef } from '../../lib/teact/teact';

import { createGpuCanvas, getGpuCanvas } from '../../lib/gpuCanvas/gpuCanvas';
import buildClassName from '../../util/buildClassName';
import { measureSpoilers } from './spoiler/measureSpoilers';

import {
  requestSharedCanvasCoordsRecalculation,
  setSharedCanvasScroller,
  SharedCanvasContext,
  updateSharedCanvasOnScroll,
  useSharedCanvasRecalculation,
} from '../../hooks/useCoordsInSharedCanvas';
import useLastCallback from '../../hooks/useLastCallback';
import useResizeObserver from '../../hooks/useResizeObserver';
import useSharedIntersectionObserver from '../../hooks/useSharedIntersectionObserver';
import useThrottledCallback from '../../hooks/useThrottledCallback';
import useDevicePixelRatio from '../../hooks/window/useDevicePixelRatio';

import spoilerStyles from './spoiler/Spoiler.module.scss';

type OwnProps = {
  isGpu?: boolean;
  contentKey?: unknown;
  canvasRef?: ElementRef<HTMLCanvasElement>;
  // Keeps the canvas of tall scrolled content near the visible part, instead of covering all of it
  scrollerRef?: ElementRef<HTMLElement>;
  children?: TeactNode;
};

const RESIZE_THROTTLE_MS = 150;

// Draws custom emoji and stickers of the children, covering the parent positioned with `shared-canvas-container`
const SharedCanvas = (props: OwnProps) => {
  // A canvas taken over by a worker can't draw in 2D again, so everything remounts with a new one
  return <SharedCanvasInner key={props.isGpu ? 'gpu' : '2d'} {...props} />;
};

const SharedCanvasInner = ({
  isGpu,
  contentKey,
  canvasRef: externalCanvasRef,
  scrollerRef,
  children,
}: OwnProps) => {
  const ownCanvasRef = useRef<HTMLCanvasElement>();
  const canvasRef = externalCanvasRef || ownCanvasRef;
  const parentRef = useMemo<ElementRef<HTMLElement>>(() => ({
    get current() {
      return canvasRef.current?.parentElement || undefined;
    },
  }), [canvasRef]);

  useEffect(() => {
    if (!isGpu) return undefined;

    const gpuCanvas = createGpuCanvas(canvasRef.current!, 'text');

    return () => {
      gpuCanvas.destroy();
    };
  }, [isGpu, canvasRef]);

  useSharedCanvasRecalculation(isGpu ? canvasRef : undefined, ({ parent }) => {
    const canvas = canvasRef.current!;
    getGpuCanvas(canvas)?.setSpoilers(measureSpoilers(canvas, parent, `.${spoilerStyles.concealed}`));
  });

  const dpr = useDevicePixelRatio();
  const requestRecalculation = useLastCallback(() => requestSharedCanvasCoordsRecalculation(canvasRef));
  useEffect(requestRecalculation, [contentKey, dpr, requestRecalculation]);

  const throttledRequestRecalculation = useThrottledCallback(
    requestRecalculation, [requestRecalculation], RESIZE_THROTTLE_MS,
  );
  useResizeObserver(parentRef, throttledRequestRecalculation);
  useResizeObserver(scrollerRef, throttledRequestRecalculation, !scrollerRef);
  useSharedIntersectionObserver(canvasRef, throttledRequestRecalculation);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scroller = scrollerRef?.current;
    if (!canvas || !scroller) return undefined;

    setSharedCanvasScroller(canvas, scroller);
    const handleScroll = () => updateSharedCanvasOnScroll(canvasRef);
    scroller.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scroller.removeEventListener('scroll', handleScroll);
      setSharedCanvasScroller(canvas);
    };
  }, [canvasRef, scrollerRef]);

  useEffect(() => {
    const parent = parentRef.current;
    if (!isGpu || !parent) return undefined;

    function handleTransitionEnd(e: TransitionEvent) {
      if (e.propertyName === 'color' && (e.target as Element).classList.contains(spoilerStyles.concealed)) {
        throttledRequestRecalculation();
      }
    }

    parent.addEventListener('transitionend', handleTransitionEnd);

    return () => {
      parent.removeEventListener('transitionend', handleTransitionEnd);
    };
  }, [isGpu, parentRef, throttledRequestRecalculation]);

  const contextValue = useMemo(() => ({ canvasRef, isGpu }), [canvasRef, isGpu]);

  return (
    <>
      <canvas ref={canvasRef} className={buildClassName('shared-canvas', isGpu && 'gpu-shared-canvas')} />
      <SharedCanvasContext.Provider value={contextValue}>
        {children}
      </SharedCanvasContext.Provider>
    </>
  );
};

export default SharedCanvas;
