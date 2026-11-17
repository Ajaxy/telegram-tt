import { useEffect, useLayoutEffect, useRef, useState } from '../lib/teact/teact';

import type { WallpaperRenderModel } from '../util/wallpaper';

import { requestMutation } from '../lib/fasterdom/fasterdom';
import { preloadImage } from '../util/files';
import { MIN_PATTERN_VIEW_HEIGHT } from '../util/wallpaper';
import useDevicePixelRatio from './window/useDevicePixelRatio';
import useDebouncedCallback from './useDebouncedCallback';
import useForceUpdate from './useForceUpdate';
import { WALLPAPER_TRANSITION_MS } from './useGradientBackground';
import useLastCallback from './useLastCallback';
import useResizeObserver from './useResizeObserver';

import backgroundStyles from '../styles/_patternBackground.module.scss';

type CanvasSize = {
  width: number;
  height: number;
};

type CachedPattern = {
  image: HTMLImageElement;
  // Rasterizing the SVG is too slow for a chat switch, while copying the last raster is not
  tile?: HTMLCanvasElement;
};

type DrawOptions = {
  // Paints the view with this color and cuts the pattern out of it
  fillColor?: string;
  shouldCover?: boolean;
  shouldAnimate?: boolean;
  // The wallpaper on screen before this render, to fade out as a snapshot
  snapshotModel?: WallpaperRenderModel;
};

const RESIZE_DEBOUNCE_MS = 100;
// Sub-pixel doodle lines have low edge coverage and break into dots. A second pass raises it without
// changing fully covered pixels.
const DRAW_PASSES = 2;
const MAX_CACHED_PATTERNS = 4;

// Blob URLs are revoked soon after a chat is left, so decoded patterns are cached by a stable key
// and a repeated pattern draws without waiting for anything
const patterns = new Map<string, CachedPattern>();
const failedPatternKeys = new Set<string>();

// Rasterizes a wallpaper pattern at the device resolution of its canvas. A second canvas exists only during
// a crossfade with the previous pattern, which stays on screen until the new one is ready.
export default function usePatternCanvas(
  patternKey?: string, {
    fillColor, shouldCover, shouldAnimate, snapshotModel,
  }: DrawOptions = {},
) {
  const layerRef = useRef<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>();
  const drawnKeyRef = useRef<string>();
  const drawnFillRef = useRef<string>();
  const fadeTimeoutRef = useRef<number>();
  const pendingSnapshotRef = useRef<HTMLCanvasElement>();
  const activeSnapshotRef = useRef<HTMLCanvasElement>();
  const [size, setSize] = useState<CanvasSize>();
  const dpr = useDevicePixelRatio();

  const pattern = patternKey ? patterns.get(patternKey) : undefined;
  const hasPatternFailed = Boolean(patternKey && !pattern && failedPatternKeys.has(patternKey));

  // The canvases still show the previous wallpaper during this render
  if (snapshotModel && layerRef.current && size) {
    pendingSnapshotRef.current = createWallpaperSnapshot(
      layerRef.current, canvasRef.current, snapshotModel, Math.round(size.width * dpr), Math.round(size.height * dpr),
    );
  }

  useLayoutEffect(() => {
    const snapshot = pendingSnapshotRef.current;
    if (!snapshot) return;

    pendingSnapshotRef.current = undefined;
    activeSnapshotRef.current?.remove();
    activeSnapshotRef.current = snapshot;
    layerRef.current!.parentElement!.append(snapshot);
    window.setTimeout(() => requestMutation(() => snapshot.remove()), WALLPAPER_TRANSITION_MS);
  });

  useLayoutEffect(() => {
    const layer = layerRef.current!;

    if (!patternKey || hasPatternFailed) {
      window.clearTimeout(fadeTimeoutRef.current);
      layer.replaceChildren();
      canvasRef.current = undefined;
      drawnKeyRef.current = undefined;
      drawnFillRef.current = undefined;
      return;
    }

    if (!pattern || !size) return;

    const previousCanvas = canvasRef.current;
    const shouldCrossfade = shouldAnimate && previousCanvas
      && drawnKeyRef.current !== patternKey && drawnFillRef.current === fillColor;
    // A fading fill would let the gradient show through it across the whole background
    const shouldFadeIn = shouldCrossfade || (shouldAnimate && !previousCanvas && !fillColor);
    const canvas = previousCanvas && !shouldCrossfade ? previousCanvas : createPatternCanvas(layer);

    drawPattern(canvas, pattern, size.width, size.height, dpr, fillColor, shouldCover);

    if (shouldFadeIn) {
      window.clearTimeout(fadeTimeoutRef.current);
      removeOtherCanvases(layer, previousCanvas, canvas);
      previousCanvas?.classList.remove(backgroundStyles.patternCanvasEntering);
      previousCanvas?.classList.add(backgroundStyles.patternCanvasLeaving);
      canvas.classList.add(backgroundStyles.patternCanvasEntering);
      fadeTimeoutRef.current = window.setTimeout(() => {
        requestMutation(() => {
          // A newer fade may have started before this mutation ran
          if (canvasRef.current === canvas) finishCanvasFade(layer, canvas);
        });
      }, WALLPAPER_TRANSITION_MS);
    } else {
      // This drawing replaces whatever was fading
      window.clearTimeout(fadeTimeoutRef.current);
      finishCanvasFade(layer, canvas);
    }

    canvasRef.current = canvas;
    drawnKeyRef.current = patternKey;
    drawnFillRef.current = fillColor;
    // `shouldAnimate` only affects how the next drawing appears
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [patternKey, pattern, hasPatternFailed, size, dpr, fillColor, shouldCover]);

  const updateSize = useDebouncedCallback((width: number, height: number) => {
    setSize((prev) => (prev?.width === width && prev.height === height ? prev : { width, height }));
  }, [], RESIZE_DEBOUNCE_MS);

  useResizeObserver(layerRef, (entry) => {
    updateSize(entry.contentRect.width, entry.contentRect.height);
  });

  // The tile as this layer draws it. Tiles are shared with previews of other sizes, so it is re-fetched by size.
  const getDrawnTile = useLastCallback(() => (
    pattern && size ? getPatternTile(pattern, getPatternTileSize(pattern, size.width, size.height, dpr, shouldCover))
      : undefined
  ));

  return {
    patternLayerRef: layerRef,
    layerSize: size,
    isPatternDrawn: !patternKey || hasPatternFailed || Boolean(pattern && size),
    getDrawnTile,
    // Doodles are already cut out of the fill, or will be by the layout effect of this render
    isPatternFillReady: !hasPatternFailed
      && (Boolean(pattern && size) || (Boolean(fillColor) && drawnFillRef.current === fillColor)),
  };
}

export function getIsPatternSettled(patternKey: string) {
  return patterns.has(patternKey) || failedPatternKeys.has(patternKey);
}

// Loads the pattern ahead of showing it. The `url` may be unknown until the pattern is resolved.
export function usePatternLoader(patternKey?: string, url?: string) {
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    if (!patternKey || !url || getIsPatternSettled(patternKey)) return undefined;

    let isCanceled = false;
    loadPatternImage(url).then((image) => {
      cachePattern(patternKey, { image });
    }).catch(() => {
      // A broken pattern must not hold the previous wallpaper on screen: it is shown without doodles
      failedPatternKeys.add(patternKey);
    }).finally(() => {
      if (!isCanceled) forceUpdate();
    });

    return () => {
      isCanceled = true;
    };
  }, [patternKey, url, forceUpdate]);
}

// Composes the wallpaper layers the same way the stylesheet does, as styles can't be measured during render
function createWallpaperSnapshot(
  layer: HTMLDivElement,
  patternCanvas: HTMLCanvasElement | undefined,
  model: WallpaperRenderModel,
  width: number,
  height: number,
) {
  const background = layer.parentElement!;
  const snapshot = document.createElement('canvas');
  snapshot.className = backgroundStyles.wallpaperSnapshot;
  snapshot.width = width;
  snapshot.height = height;

  const ctx = snapshot.getContext('2d')!;
  ctx.fillStyle = model.baseColor!;
  ctx.fillRect(0, 0, width, height);

  const { isMaskedPattern } = model;
  const intensity = Math.abs(model.patternIntensity!) / 100;

  const gradient = background.querySelector<HTMLCanvasElement>(`.${backgroundStyles.gradientCanvas}`);
  // The masked gradient stays hidden until the pattern covers it
  if (gradient && (!isMaskedPattern || patternCanvas)) {
    ctx.globalAlpha = isMaskedPattern ? intensity : 1;
    ctx.drawImage(gradient, 0, 0, width, height);
  }

  if (patternCanvas) {
    ctx.globalAlpha = isMaskedPattern ? 1 : intensity;
    ctx.globalCompositeOperation = isMaskedPattern || model.colors.length === 1 ? 'source-over' : 'soft-light';
    ctx.drawImage(patternCanvas, 0, 0, width, height);
  }

  if (model.patternDimming !== undefined) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = model.patternDimming;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
  }

  return snapshot;
}

function createPatternCanvas(layer: HTMLDivElement) {
  const canvas = document.createElement('canvas');
  canvas.className = backgroundStyles.patternCanvas;
  layer.append(canvas);
  return canvas;
}

function removeOtherCanvases(layer: HTMLDivElement, ...keptCanvases: (HTMLCanvasElement | undefined)[]) {
  Array.from(layer.children).forEach((child) => {
    if (!keptCanvases.includes(child as HTMLCanvasElement)) child.remove();
  });
}

function finishCanvasFade(layer: HTMLDivElement, canvas: HTMLCanvasElement) {
  removeOtherCanvases(layer, canvas);
  canvas.classList.remove(backgroundStyles.patternCanvasEntering);
}

function cachePattern(patternKey: string, pattern: CachedPattern) {
  patterns.set(patternKey, pattern);
  if (patterns.size > MAX_CACHED_PATTERNS) {
    patterns.delete(patterns.keys().next().value!);
  }
}

// Canvases can't draw an SVG without intrinsic dimensions in every browser, so they are derived from its `viewBox`
async function loadPatternImage(url: string) {
  let svgUrl: string | undefined;
  try {
    const response = await fetch(url);
    const root = new DOMParser().parseFromString(await response.text(), 'image/svg+xml').documentElement;
    const viewBox = root instanceof SVGSVGElement ? root.viewBox.baseVal : undefined;
    if (!viewBox?.width || !viewBox.height) return await preloadImage(url);

    root.setAttribute('width', String(viewBox.width));
    root.setAttribute('height', String(viewBox.height));
    svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' }));
    return await preloadImage(svgUrl);
  } finally {
    if (svgUrl) URL.revokeObjectURL(svgUrl);
  }
}

// Matches the macOS layout. Multicolor patterns use a tile as tall as the view (at least `MIN_PATTERN_VIEW_HEIGHT`), repeated
// from the left edge when narrower than the view and centered otherwise. Single-color ones cover the view once.
function drawPattern(
  canvas: HTMLCanvasElement,
  pattern: CachedPattern,
  width: number,
  height: number,
  dpr: number,
  fillColor?: string,
  shouldCover?: boolean,
) {
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const ctx = canvas.getContext('2d')!;

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'destination-out';
  }

  const viewHeight = Math.max(MIN_PATTERN_VIEW_HEIGHT, height);
  const tile = getPatternTile(pattern, getPatternTileSize(pattern, width, height, dpr, shouldCover));
  const y = Math.round((viewHeight * dpr - tile.height) / 2);
  const startX = Math.round((canvas.width - tile.width) / 2);

  if (shouldCover) {
    ctx.drawImage(tile, startX, y);
    return;
  }

  for (let x = Math.min(0, startX); x < canvas.width; x += tile.width) {
    ctx.drawImage(tile, x, y);
  }
}

function getPatternTileSize(
  pattern: CachedPattern, width: number, height: number, dpr: number, shouldCover?: boolean,
): CanvasSize {
  const { naturalWidth, naturalHeight } = pattern.image;
  const viewHeight = Math.max(MIN_PATTERN_VIEW_HEIGHT, height);
  const scale = (shouldCover ? Math.max(width / naturalWidth, viewHeight / naturalHeight) : viewHeight / naturalHeight)
    * dpr;
  return { width: Math.round(naturalWidth * scale), height: Math.round(naturalHeight * scale) };
}

function getPatternTile(pattern: CachedPattern, { width, height }: CanvasSize) {
  if (pattern.tile?.width === width && pattern.tile.height === height) return pattern.tile;

  const tile = document.createElement('canvas');
  tile.width = width;
  tile.height = height;

  const ctx = tile.getContext('2d')!;
  for (let pass = 0; pass < DRAW_PASSES; pass++) {
    ctx.drawImage(pattern.image, 0, 0, width, height);
  }

  pattern.tile = tile;
  return tile;
}
