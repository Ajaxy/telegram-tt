import type { ElementRef } from '../lib/teact/teact';
import {
  useEffect, useMemo, useState,
} from '../lib/teact/teact';

import type { CallbackManager } from '../util/callbacks';

import { requestMeasure, requestMutation } from '../lib/fasterdom/fasterdom';
import { createCallbackManager } from '../util/callbacks';
import { round } from '../util/math';
import { throttleWith } from '../util/schedulers';
import getOffsetToContainer from '../util/visibility/getOffsetToContainer';
import useLastCallback from './useLastCallback';
import useResizeObserver from './useResizeObserver';
import useSharedIntersectionObserver from './useSharedIntersectionObserver';
import useThrottledCallback from './useThrottledCallback';

type SharedCanvasMetrics = {
  parent: HTMLElement;
  left: number;
  top: number;
  renderedWidth: number;
  renderedHeight: number;
  width: number;
  height: number;
  sizeFactor: number;
};

type SharedCanvasCoords = {
  x: number;
  y: number;
  canvasWidth: number;
  canvasHeight: number;
};

const THROTTLE_MS = 150;
const SHARED_CANVAS_RECALCULATION_MANAGERS = new WeakMap<
  HTMLCanvasElement,
  CallbackManager<(metrics: SharedCanvasMetrics) => void>
>();
const PENDING_SHARED_CANVAS_RECALCULATIONS = new Set<HTMLCanvasElement>();
const SCHEDULE_SHARED_CANVAS_RECALCULATION = throttleWith(requestMeasure, flushSharedCanvasCoordsRecalculations);

export function requestSharedCanvasCoordsRecalculation(
  ...sharedCanvasRefs: Array<ElementRef<HTMLCanvasElement> | undefined>
) {
  sharedCanvasRefs.forEach((sharedCanvasRef) => {
    const canvas = sharedCanvasRef?.current;
    if (canvas) {
      PENDING_SHARED_CANVAS_RECALCULATIONS.add(canvas);
    }
  });

  if (PENDING_SHARED_CANVAS_RECALCULATIONS.size) {
    SCHEDULE_SHARED_CANVAS_RECALCULATION();
  }
}

export default function useCoordsInSharedCanvas(
  containerRef: ElementRef<HTMLDivElement>,
  sharedCanvasRef?: ElementRef<HTMLCanvasElement>,
) {
  const [coords, setCoords] = useState<SharedCanvasCoords>();
  const sharedCanvasContainerRef = useMemo<ElementRef<HTMLElement>>(() => ({
    get current() {
      return sharedCanvasRef?.current?.parentElement || undefined;
    },
  }), [sharedCanvasRef]);

  const recalculate = useLastCallback((canvasMetrics?: SharedCanvasMetrics) => {
    const container = containerRef.current;
    const canvas = sharedCanvasRef?.current;
    if (!container || !canvas) {
      return;
    }

    const metrics = canvasMetrics || measureSharedCanvas(canvas);
    if (!metrics) {
      return;
    }
    if (!canvasMetrics) {
      requestSharedCanvasSizeUpdate(canvas, metrics);
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
    setCoords((currentCoords) => (
      currentCoords?.x === x
      && currentCoords.y === y
      && currentCoords.canvasWidth === metrics.width
      && currentCoords.canvasHeight === metrics.height
        ? currentCoords
        : { x, y, canvasWidth: metrics.width, canvasHeight: metrics.height }
    ));
  });

  useEffect(() => {
    if (sharedCanvasRef?.current) {
      requestSharedCanvasCoordsRecalculation(sharedCanvasRef);
    }
  }, [sharedCanvasRef]);
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

    const removeCallback = manager.addCallback(recalculate);
    return () => {
      removeCallback();
      if (!manager.hasCallbacks()) {
        SHARED_CANVAS_RECALCULATION_MANAGERS.delete(canvas);
      }
    };
  }, [recalculate, sharedCanvasRef]);

  const throttledRequestRecalculation = useThrottledCallback(
    () => requestSharedCanvasCoordsRecalculation(sharedCanvasRef),
    [sharedCanvasRef],
    THROTTLE_MS,
  );
  useResizeObserver(sharedCanvasContainerRef, throttledRequestRecalculation);
  useSharedIntersectionObserver(sharedCanvasRef, throttledRequestRecalculation);

  return useMemo(() => (coords ? { x: coords.x, y: coords.y } : undefined), [coords]);
}

function flushSharedCanvasCoordsRecalculations() {
  const canvases = Array.from(PENDING_SHARED_CANVAS_RECALCULATIONS);
  PENDING_SHARED_CANVAS_RECALCULATIONS.clear();

  canvases.forEach((canvas) => {
    const manager = SHARED_CANVAS_RECALCULATION_MANAGERS.get(canvas);
    if (!manager) {
      return;
    }

    runSharedCanvasCoordsRecalculations(canvas, manager);
  });
}

function runSharedCanvasCoordsRecalculations(
  canvas: HTMLCanvasElement,
  manager: CallbackManager<(metrics: SharedCanvasMetrics) => void>,
) {
  const metrics = measureSharedCanvas(canvas);
  if (!metrics) {
    return;
  }

  if (requestSharedCanvasSizeUpdate(canvas, metrics)) {
    requestMeasure(() => runSharedCanvasCoordsRecalculations(canvas, manager));
    return;
  }

  manager.runCallbacks(metrics);
}

function measureSharedCanvas(canvas?: HTMLCanvasElement): SharedCanvasMetrics | undefined {
  if (!canvas) {
    return undefined;
  }

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
    sizeFactor: canvas.width / renderedWidth,
  };
}

function requestSharedCanvasSizeUpdate(
  canvas: HTMLCanvasElement,
  { width, height, sizeFactor }: SharedCanvasMetrics,
) {
  const cssWidth = `${width}px`;
  const cssHeight = `${height}px`;
  if (canvas.style.width === cssWidth && canvas.style.height === cssHeight) {
    return false;
  }

  requestMutation(() => {
    canvas.style.width = cssWidth;
    canvas.style.height = cssHeight;
    canvas.width = Math.round(width * sizeFactor);
    canvas.height = Math.round(height * sizeFactor);
  });

  return true;
}
