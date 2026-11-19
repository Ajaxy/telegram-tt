import type { ElementRef } from '../lib/teact/teact';
import {
  createContext, useEffect, useMemo, useState,
} from '../lib/teact/teact';

import type { CallbackManager } from '../util/callbacks';

import { requestMeasure, requestMutation } from '../lib/fasterdom/fasterdom';
import { getGpuCanvas } from '../lib/gpuCanvas/gpuCanvas';
import { getTLottie } from '../lib/tlottie/TLottie.async';
import { createCallbackManager } from '../util/callbacks';
import { round } from '../util/math';
import { throttleWith } from '../util/schedulers';
import getOffsetToContainer from '../util/visibility/getOffsetToContainer';
import useContext from './data/useContext';
import useLastCallback from './useLastCallback';

type SharedCanvasMetrics = {
  parent: HTMLElement;
  left: number;
  top: number;
  renderedWidth: number;
  renderedHeight: number;
  width: number;
  height: number;
};

type SharedCanvasCoords = {
  x: number;
  y: number;
  canvasWidth: number;
  canvasHeight: number;
  dpr: number;
};

type SharedCanvasContextValue = {
  canvasRef: ElementRef<HTMLCanvasElement>;
  isGpu?: boolean;
};

export const SharedCanvasContext = createContext<SharedCanvasContextValue | undefined>();

const SHARED_CANVAS_RECALCULATION_MANAGERS = new WeakMap<
  HTMLCanvasElement,
  CallbackManager<(metrics: SharedCanvasMetrics) => void>
>();
const PENDING_SHARED_CANVAS_RECALCULATIONS = new Set<HTMLCanvasElement>();
// A canvas in a scroller covers its visible part and as much again, and moves when the scroller nears its edges
const SHARED_CANVAS_SCROLLERS = new WeakMap<HTMLCanvasElement, HTMLElement>();
const BUFFER_SCREENS = 3;
const BUFFER_EDGE_FRACTION = 0.5;

let snapshotCanvas: HTMLCanvasElement | undefined;
const SCHEDULE_SHARED_CANVAS_RECALCULATION = throttleWith(requestMeasure, flushSharedCanvasCoordsRecalculations);

export function useSharedCanvas() {
  return useContext(SharedCanvasContext);
}

export function requestSharedCanvasCoordsRecalculation(sharedCanvasRef?: ElementRef<HTMLCanvasElement>) {
  const canvas = sharedCanvasRef?.current;
  if (!canvas) return;

  PENDING_SHARED_CANVAS_RECALCULATIONS.add(canvas);
  SCHEDULE_SHARED_CANVAS_RECALCULATION();
}

export function setSharedCanvasScroller(canvas: HTMLCanvasElement, scroller?: HTMLElement) {
  if (scroller) {
    SHARED_CANVAS_SCROLLERS.set(canvas, scroller);
  } else {
    SHARED_CANVAS_SCROLLERS.delete(canvas);
  }
}

export function updateSharedCanvasOnScroll(sharedCanvasRef: ElementRef<HTMLCanvasElement>) {
  requestMeasure(() => {
    const canvas = sharedCanvasRef.current;
    const metrics = canvas && measureSharedCanvas(canvas);
    const buffer = metrics && calcSharedCanvasBuffer(canvas, metrics);
    if (buffer && (formatTop(buffer.top) !== canvas.style.top || buffer.height !== metrics.renderedHeight)) {
      requestSharedCanvasCoordsRecalculation(sharedCanvasRef);
    }
  });
}

export function useSharedCanvasRecalculation(
  sharedCanvasRef: ElementRef<HTMLCanvasElement> | undefined,
  callback: (metrics: SharedCanvasMetrics) => void,
) {
  const lastCallback = useLastCallback(callback);

  useEffect(() => {
    const canvas = sharedCanvasRef?.current;
    if (!canvas) {
      return undefined;
    }

    let manager = SHARED_CANVAS_RECALCULATION_MANAGERS.get(canvas);
    if (!manager) {
      manager = createCallbackManager();
      SHARED_CANVAS_RECALCULATION_MANAGERS.set(canvas, manager);
    }

    const removeCallback = manager.addCallback(lastCallback);
    requestSharedCanvasCoordsRecalculation(sharedCanvasRef);

    return () => {
      removeCallback();
      if (!manager.hasCallbacks()) {
        SHARED_CANVAS_RECALCULATION_MANAGERS.delete(canvas);
      }
    };
  }, [lastCallback, sharedCanvasRef]);
}

export default function useCoordsInSharedCanvas(containerRef: ElementRef<HTMLDivElement>) {
  const sharedCanvasRef = useSharedCanvas()?.canvasRef;
  const [coords, setCoords] = useState<SharedCanvasCoords>();

  useSharedCanvasRecalculation(sharedCanvasRef, (metrics) => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const target = container.classList.contains('sticker-set-cover') || container.classList.contains('sticker-reaction')
      ? container
      : container.querySelector('img');
    if (!target) {
      return;
    }

    const { left, top } = getOffsetToContainer(target, metrics.parent);
    const x = round((left - metrics.left) / metrics.renderedWidth, 4) || 0;
    const y = round((top - metrics.top) / metrics.renderedHeight, 4) || 0;
    const dpr = window.devicePixelRatio;
    setCoords((currentCoords) => (
      currentCoords?.x === x
      && currentCoords.y === y
      && currentCoords.canvasWidth === metrics.width
      && currentCoords.canvasHeight === metrics.height
      && currentCoords.dpr === dpr
        ? currentCoords
        : {
          x, y, canvasWidth: metrics.width, canvasHeight: metrics.height, dpr,
        }
    ));
  });

  return {
    sharedCanvasRef,
    coords: useMemo(() => (coords ? { x: coords.x, y: coords.y } : undefined), [coords]),
  };
}

function flushSharedCanvasCoordsRecalculations() {
  const canvases = Array.from(PENDING_SHARED_CANVAS_RECALCULATIONS);
  PENDING_SHARED_CANVAS_RECALCULATIONS.clear();

  canvases.forEach(runSharedCanvasCoordsRecalculations);
}

function runSharedCanvasCoordsRecalculations(canvas: HTMLCanvasElement) {
  const manager = SHARED_CANVAS_RECALCULATION_MANAGERS.get(canvas);
  const metrics = manager && measureSharedCanvas(canvas);
  if (!metrics) {
    return;
  }

  if (requestSharedCanvasSizeUpdate(canvas, metrics)) {
    requestMeasure(() => runSharedCanvasCoordsRecalculations(canvas));
    return;
  }

  manager.runCallbacks(metrics);
}

function measureSharedCanvas(canvas: HTMLCanvasElement): SharedCanvasMetrics | undefined {
  const parent = canvas.parentElement;
  const renderedWidth = canvas.offsetWidth;
  const renderedHeight = canvas.offsetHeight;
  const width = parent?.clientWidth;
  const height = parent?.clientHeight;
  if (!parent || !renderedWidth || !renderedHeight || !width || !height) {
    return undefined;
  }

  return {
    parent,
    ...getOffsetToContainer(canvas, parent),
    renderedWidth,
    renderedHeight,
    width,
    height,
  };
}

function calcSharedCanvasBuffer(
  canvas: HTMLCanvasElement, { height: parentHeight, renderedHeight }: SharedCanvasMetrics,
) {
  const scroller = SHARED_CANVAS_SCROLLERS.get(canvas);
  if (!scroller) return { top: 0, height: parentHeight };

  const viewportHeight = scroller.clientHeight;
  const height = Math.min(parentHeight, Math.ceil(viewportHeight * BUFFER_SCREENS));
  const maxTop = parentHeight - height;
  const currentTop = parseFloat(canvas.style.top) || 0;
  const { scrollTop } = scroller;
  const threshold = viewportHeight * BUFFER_EDGE_FRACTION;
  const isCovered = renderedHeight === height && currentTop <= maxTop
    && (!currentTop || scrollTop - currentTop >= threshold)
    && (currentTop === maxTop || currentTop + height - scrollTop - viewportHeight >= threshold);
  if (isCovered) return { top: currentTop, height };

  return { top: Math.round(Math.min(Math.max(scrollTop - (height - viewportHeight) / 2, 0), maxTop)), height };
}

function requestSharedCanvasSizeUpdate(canvas: HTMLCanvasElement, metrics: SharedCanvasMetrics) {
  const { width, renderedWidth, renderedHeight } = metrics;
  const { top, height } = calcSharedCanvasBuffer(canvas, metrics);
  const gpuCanvas = getGpuCanvas(canvas);
  const cssWidth = `${width}px`;
  const cssHeight = `${height}px`;
  const cssTop = formatTop(top);
  const isStyleStale = canvas.style.width !== cssWidth || canvas.style.height !== cssHeight
    || canvas.style.top !== cssTop;
  // The rendered size lags behind a stale style. Otherwise it follows CSS, which can cap the canvas below its parent,
  // as in the sticker picker header.
  const drawnWidth = isStyleStale ? width : renderedWidth;
  const drawnHeight = isStyleStale ? height : renderedHeight;
  gpuCanvas?.resize(drawnWidth, drawnHeight);

  const pixelWidth = Math.round(drawnWidth * window.devicePixelRatio);
  const pixelHeight = Math.round(drawnHeight * window.devicePixelRatio);
  // Setting the size clears the canvas even when it stays the same
  const shouldResizePixels = !gpuCanvas && (canvas.width !== pixelWidth || canvas.height !== pixelHeight);
  if (!isStyleStale && !shouldResizePixels) {
    return false;
  }

  const shift = Math.round(((parseFloat(canvas.style.top) || 0) - top) * window.devicePixelRatio);
  requestMutation(() => {
    canvas.style.width = cssWidth;
    canvas.style.height = cssHeight;
    canvas.style.top = cssTop;

    if (!gpuCanvas && (shouldResizePixels || shift)) {
      redrawShiftedImage(canvas, pixelWidth, pixelHeight, shift);
      if (shift) getTLottie()?.shiftSharedCanvasViews(canvas, shift);
    }
  });

  return true;
}

// Keeps the drawn frames in place until the views draw again at their new coords
function redrawShiftedImage(canvas: HTMLCanvasElement, width: number, height: number, shift: number) {
  snapshotCanvas ??= document.createElement('canvas');
  snapshotCanvas.width = canvas.width;
  snapshotCanvas.height = canvas.height;
  const snapshotContext = snapshotCanvas.getContext('2d')!;
  snapshotContext.drawImage(canvas, 0, 0);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, width, height);
  context.drawImage(snapshotCanvas, 0, shift);
  // Frees the memory of the snapshot until the next shift
  snapshotCanvas.width = 0;
  snapshotCanvas.height = 0;
}

function formatTop(top: number) {
  return top ? `${top}px` : '';
}
