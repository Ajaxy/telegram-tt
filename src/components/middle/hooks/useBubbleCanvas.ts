import type { ElementRef } from '../../../lib/teact/teact';
import { useLayoutEffect, useRef, useState } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { ThemeKey } from '../../../types';
import type { ThemePalette } from '../../../util/theme';
import type { GradientRenderer } from '../../../util/wallpaper/gradient';

import { CUSTOM_APPENDIX_ATTRIBUTE } from '../../../config';
import { mixColors } from '../../../lib/color';
import {
  forceMeasure, forceMutation, requestForcedReflow, requestMeasure, requestMutation,
} from '../../../lib/fasterdom/fasterdom';
import { selectCanAnimateInterface } from '../../../global/selectors';
import { animate } from '../../../util/animation';
import { buildColorFromHex, buildHexFromColor } from '../../../util/colors';
import { easeThemeSwitch, THEME_SWITCH_DURATION_MS } from '../../../util/switchTheme';
import getOffsetToContainer from '../../../util/visibility/getOffsetToContainer';
import { createGradientRenderer, renderStaticGradient } from '../../../util/wallpaper/gradient';
import themeColors from '../../../styles/themes.json';
import { requestAfterMessageListReflow } from '../helpers/messageListReflow';

import useLastCallback from '../../../hooks/useLastCallback';
import useResizeObserver from '../../../hooks/useResizeObserver';
import useSyncEffect from '../../../hooks/useSyncEffect';

// A buffered canvas paints viewport-anchored fills; animated bubbles use their visible bounds and opacity
const OWN_MESSAGE_SELECTOR = '.Message.own';
// A widget's bubble is of one colour, the background the widget is told (widget-sandbox sdk-v1 §5.1)
const OWN_BUBBLE_SELECTOR = `${OWN_MESSAGE_SELECTOR} .message-content.has-solid-background:not(.has-widget), `
  + `${OWN_MESSAGE_SELECTOR} .message-content.has-background:not(.has-widget), `
  + `${OWN_MESSAGE_SELECTOR}.is-album .message-content`;
// A top-level unsupported block tears its bubble, which only the canvas can draw
const TORN_BUBBLE_SELECTOR = '.message-content.has-solid-background:has([data-bubble-tear])';
const TORN_MESSAGE_SELECTOR = '.Message:has([data-bubble-tear])';
const ANIMATED_ELEMENT_SELECTOR = `${OWN_MESSAGE_SELECTOR}, ${OWN_MESSAGE_SELECTOR} > .message-content-wrapper, `
  + `${TORN_MESSAGE_SELECTOR}, ${TORN_MESSAGE_SELECTOR} > .message-content-wrapper`;

const BUFFER_SCREENS = 2;
const BUFFER_EDGE_FRACTION = 0.1;
const GRADIENT_SIZE = 100;
const MEDIA_TOP_INSET_DEVICE_PX = 0.5;

// Mirrors the `.has-shadow` box-shadow the transparent bubbles no longer render
const SHADOW_OFFSET_Y_PX = 1;
const SHADOW_BLUR_PX = 2;

// Mirrors the `.svg-appendix` metrics and the paths from `MessageAppendix.tsx`
const APPENDIX_WIDTH_PX = 9;
const APPENDIX_HEIGHT_PX = 18;
const APPENDIX_RIGHT_OVERHANG_PX = 8.816;
const APPENDIX_LEFT_OVERHANG_PX = 8.992;
const APPENDIX_BOTTOM_OVERHANG_PX = 1;
const OWN_APPENDIX_PATH = 'M6 17H0V0c.193 2.84.876 5.767 2.05 8.782.904 2.325 2.446 4.485 4.625 6.48A1 1 0 016 17z';
const APPENDIX_PATH = 'M3 17h6V0c-.193 2.84-.876 5.767-2.05 8.782-.904 2.325-2.446 4.485-4.625 6.48A1 1 0 003 17z';

// The torn edge mirrors Android's `TornEdge`: one unsmoothed sample per step reads as paper fibre, not a wave
const TEAR_STEP_PX = 2.5;
const TEAR_JITTER_PX = 1.9;
const TEAR_SEEDS_PER_MESSAGE = 100;
// Distance from a plate to the tear line around it
const TEAR_GAP_PX = 12;
// A run of bubble this short next to a tear is not drawn
const TEAR_SLIVER_PX = 8;
// Kept pieces reach past the bubble, so its tail and shadow are cut only at the tears
const TEAR_OVERHANG_PX = 24;

type BubbleRadii = [number, number, number, number];

// Bubble-relative tear lines; a missing one means the band runs off the bubble's edge
type TearBand = { top?: number; bottom?: number };

type BubbleGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  opacity: number;
  radii: BubbleRadii;
  hasTail: boolean;
  hasShadow: boolean;
  hasTopMedia: boolean;
  isOwn: boolean;
  messageId: number;
  tearBands?: TearBand[];
};

type TornPath = {
  path: Path2D;
  clip: Path2D;
  opacity: number;
  hasShadow: boolean;
  isOwn: boolean;
};

// All coordinates live in `.messages-container` space (the canvas parent); the scroller's
// `scrollTop` is converted through `contentOffsetTop`
type CanvasState = {
  geometry: BubbleGeometry[];
  // The own bubbles are measured only for a gradient theme
  isGradientMeasured: boolean;
  contentWidth: number;
  contentHeight: number;
  viewportHeight: number;
  contentOffsetTop: number;
  bufferTop: number;
  scrollTop: number;
  shadowColor: string;
  incomingColor: string;
  outgoingColor: string;
  path?: Path2D;
  shadowPath?: Path2D;
  shadowCanvas?: HTMLCanvasElement;
  translucentPaths: { path: Path2D; opacity: number; hasShadow: boolean }[];
  tornPaths: TornPath[];
  gradientCanvas?: HTMLCanvasElement;
};

type BubbleStyle = { radii: BubbleRadii; hasShadow: boolean };
type ColorStop = ReturnType<typeof buildColorFromHex>;
type BubbleStyleCache = WeakMap<HTMLElement, { key: string; style: BubbleStyle }>;

let ownTailPath: Path2D | undefined;
let tailPath: Path2D | undefined;

// Paints the own bubbles of a gradient theme and every bubble torn around an unsupported block
export default function useBubbleCanvas(
  containerRef: ElementRef<HTMLDivElement>,
  canvasRef: ElementRef<HTMLCanvasElement>,
  palette: ThemePalette,
  hasTornBubbles?: boolean,
  messageIds?: number[],
  theme?: ThemeKey,
  areColorsAnimated?: boolean,
  shouldSnapColors?: boolean,
) {
  const colors = palette.outgoingColors;
  const isGradient = Boolean(colors && colors.length > 1);
  const isEnabled = isGradient || Boolean(hasTornBubbles);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement>();
  const updateCanvasElement = useLastCallback(() => setCanvasElement(canvasRef.current));
  useSyncEffect(() => {
    canvasRef.onChange = updateCanvasElement;
  }, [canvasRef, updateCanvasElement]);

  const stateRef = useRef<CanvasState>({
    geometry: [],
    isGradientMeasured: false,
    contentWidth: 0,
    contentHeight: 0,
    viewportHeight: 0,
    contentOffsetTop: 0,
    bufferTop: 0,
    scrollTop: 0,
    shadowColor: '',
    incomingColor: palette.incomingColor,
    outgoingColor: palette.outgoingColor,
    translucentPaths: [],
    tornPaths: [],
  });
  // The stops currently on the canvas: the theme colors, or an interpolation while they morph
  const renderColorsRef = useRef<string[]>();
  const morphRef = useRef<{ stops: ColorStop[]; cancel: NoneToVoidFunction }>();
  const isDrawnRef = useRef(false);
  const styleCacheRef = useRef<BubbleStyleCache>(new WeakMap());
  const resizeObserverRef = useRef<ResizeObserver>();
  const observedElementsRef = useRef(new Set<Element>());
  const lastSizesRef = useRef(new WeakMap<Element, { width: number; height: number }>());
  const isMeasurePendingRef = useRef(false);
  const isDrawPendingRef = useRef(false);
  const isShadowDirtyRef = useRef(false);
  const rendererRef = useRef<GradientRenderer>();

  // Reads only; returns `false` when the list or canvas is gone
  const measure = useLastCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!isEnabled || !container || !canvas || !canvas.parentElement) return false;

    const content = canvas.parentElement;
    const state = stateRef.current;
    state.contentWidth = content.clientWidth;
    state.contentHeight = content.offsetHeight;
    state.viewportHeight = container.clientHeight;
    state.contentOffsetTop = getOffsetToContainer(content, container).top;
    // The inline `--color-default-shadow` is mid-animation during a mode switch, so the target is read directly
    state.shadowColor = themeColors['--color-default-shadow'][theme === 'dark' ? 1 : 0];

    const observer = resizeObserverRef.current;
    const observed = observedElementsRef.current;
    const lastSizes = lastSizesRef.current;
    const tracked = new Set<Element>();
    const trackResize = (element: HTMLElement, width: number, height: number) => {
      tracked.add(element);
      lastSizes.set(element, { width, height });
      if (!observer || observed.has(element)) return;
      observed.add(element);
      observer.observe(element, { box: 'border-box' });
    };
    // The content grows with any message, catching layout shifts the container observer misses
    trackResize(content, content.offsetWidth, state.contentHeight);
    content.querySelectorAll<HTMLElement>('.message-list-item, .first-message-date-group, .live-tail')
      .forEach((element) => {
        trackResize(element, element.offsetWidth, element.offsetHeight);
      });

    const styleCache = styleCacheRef.current;
    const contentBounds = content.getBoundingClientRect();
    const selector = isGradient ? `${OWN_BUBBLE_SELECTOR}, ${TORN_BUBBLE_SELECTOR}` : TORN_BUBBLE_SELECTOR;
    state.isGradientMeasured = isGradient;
    state.geometry = Array.from(content.querySelectorAll<HTMLElement>(selector)).map((bubble) => {
      const width = bubble.offsetWidth;
      const height = bubble.offsetHeight;
      const bounds = bubble.getBoundingClientRect();
      const mediaBounds = bubble.classList.contains('media')
        ? bubble.querySelector<HTMLElement>(':scope > .content-inner > .media-inner, :scope > .content-inner > .Album')
          ?.getBoundingClientRect()
        : undefined;
      const message = bubble.closest<HTMLElement>('.Message')!;
      const wrapper = bubble.closest<HTMLElement>('.message-content-wrapper')!;
      const isOwn = message.classList.contains('own');
      const tearZones = Array.from(bubble.querySelectorAll('[data-bubble-tear]'), (element) => {
        const zone = element.getBoundingClientRect();
        return [zone.top - bounds.top, zone.bottom - bounds.top] as const;
      });
      // Tears stay within the rich content, clear of the header and the meta around it
      const richBounds = tearZones.length
        ? getRichContentBounds(bubble.querySelector<HTMLElement>('[data-rich-copy-root]')) : undefined;
      trackResize(bubble, width, height);
      return {
        x: bounds.left - contentBounds.left,
        y: bounds.top - contentBounds.top,
        width: bounds.width,
        height: bounds.height,
        scale: width ? bounds.width / width : 1,
        opacity: Number(getComputedStyle(message).opacity) * Number(getComputedStyle(wrapper).opacity),
        ...getBubbleStyle(bubble, styleCache),
        hasTail: bubble.classList.contains('has-appendix') && !bubble.hasAttribute(CUSTOM_APPENDIX_ATTRIBUTE),
        hasTopMedia: mediaBounds?.top === bounds.top && mediaBounds.left === bounds.left
          && mediaBounds.right === bounds.right,
        isOwn,
        messageId: Number(message.dataset.messageId),
        tearBands: tearZones.length ? resolveTearBands(
          tearZones,
          bounds.height,
          width ? bounds.width / width : 1,
          richBounds ? richBounds.top - bounds.top : 0,
          richBounds ? richBounds.bottom - bounds.top : bounds.height,
        ) : undefined,
      };
    });

    // Bubbles that left the rendered slice must not linger in the observer
    observed.forEach((element) => {
      if (tracked.has(element)) return;
      observer?.unobserve(element);
      observed.delete(element);
      lastSizes.delete(element);
    });

    return true;
  });

  // Writes only
  const applyMeasure = useLastCallback((scrollTop: number) => {
    const canvas = canvasRef.current;
    const renderColors = renderColorsRef.current;
    // The canvas can disappear between the measure and mutation phases
    if (!isEnabled || !canvas) return;

    const state = stateRef.current;
    state.scrollTop = scrollTop;
    isDrawnRef.current = true;
    isDrawPendingRef.current = false;
    syncCanvasSize(canvas, state);
    recenterBuffer(canvas, state, scrollTop, renderColors, true);
    isShadowDirtyRef.current = false;
    drawBubbles(canvas, state, scrollTop, renderColors);
  });

  // Runs in the measure phase and defers the writes to the mutation phase
  const measureAndApply = useLastCallback(() => {
    if (!measure()) return;

    const { scrollTop } = containerRef.current!;
    requestMutation(() => {
      applyMeasure(scrollTop);
    });
  });

  const scheduleMeasure = useLastCallback(() => {
    if (!isEnabled || isMeasurePendingRef.current) return;

    isMeasurePendingRef.current = true;
    requestMeasure(() => {
      isMeasurePendingRef.current = false;
      measureAndApply();
    });
  });

  const scheduleDraw = useLastCallback(() => {
    if (!isEnabled || isDrawPendingRef.current) return;
    isDrawPendingRef.current = true;
    requestMutation(() => {
      if (!isDrawPendingRef.current) return;
      isDrawPendingRef.current = false;
      const canvas = canvasRef.current;
      const state = stateRef.current;
      if (!canvas) return;
      const previousPath = state.path;
      recenterBuffer(canvas, state, state.scrollTop, renderColorsRef.current);
      if (isShadowDirtyRef.current && state.path === previousPath) {
        renderShadowLayer(canvas, state, renderColorsRef.current);
      }
      isShadowDirtyRef.current = false;
      drawBubbles(canvas, state, state.scrollTop, renderColorsRef.current);
    });
  });

  const updateOnScroll = useLastCallback((container: HTMLElement) => {
    const state = stateRef.current;
    const canvas = canvasRef.current;
    if (!isEnabled || !canvas || !state.geometry.length) return;

    state.scrollTop = container.scrollTop;
    scheduleDraw();
  });

  // An interrupted morph continues from its current stops
  const startColorsMorph = useLastCallback((from: string[], to: string[]) => {
    const currentStops = morphRef.current?.stops ?? from.map(buildColorFromHex);
    morphRef.current?.cancel();

    const count = Math.max(currentStops.length, to.length);
    const fromStops = resampleStops(currentStops, count);
    const toStops = resampleStops(to.map(buildColorFromHex), count);
    const startAt = Date.now();
    let isCancelled = false;
    const morph = {
      stops: fromStops,
      cancel: () => {
        isCancelled = true;
      },
    };
    morphRef.current = morph;
    animate(() => {
      if (isCancelled) return false;

      const t = Math.min((Date.now() - startAt) / THEME_SWITCH_DURATION_MS, 1);
      const ratio = easeThemeSwitch(t);
      morph.stops = fromStops.map((stop, index) => mixColors(stop, toStops[index], ratio, { space: 'srgb' }));
      renderColorsRef.current = t >= 1 ? to : morph.stops.map(buildHexFromColor);
      if (stateRef.current.gradientCanvas) {
        if (rendererRef.current) {
          rendererRef.current.update(renderColorsRef.current, true);
        } else {
          renderStaticGradient(stateRef.current.gradientCanvas, renderColorsRef.current);
        }
      }
      scheduleDraw();

      if (t >= 1) morphRef.current = undefined;
      return t < 1;
    }, requestMutation);
  });

  // Editing a message can change only its bubble's width, which neither `messageIds` nor the
  // container size reflect, so every measured element is size-tracked. The initial `observe`
  // callback is filtered out by comparing against the sizes stored during the measure.
  const handleElementResize = useLastCallback((entries: ResizeObserverEntry[]) => {
    const lastSizes = lastSizesRef.current;
    const hasChanges = entries.some((entry) => {
      if (!entry.contentRect.width && !entry.contentRect.height) return false;

      const last = lastSizes.get(entry.target);
      const box = entry.borderBoxSize?.[0];
      const width = Math.round(box ? box.inlineSize : entry.contentRect.width);
      const height = Math.round(box ? box.blockSize : entry.contentRect.height);
      return !last || last.width !== width || last.height !== height;
    });
    if (!hasChanges || !measure()) return;

    const { scrollTop } = containerRef.current!;
    // ResizeObserver runs after layout, so the canvas is repainted before the resized messages appear
    forceMutation(() => applyMeasure(scrollTop), canvasRef.current!);
  });

  useLayoutEffect(() => {
    if (!isEnabled) return undefined;

    resizeObserverRef.current = new ResizeObserver(handleElementResize);
    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = undefined;
      observedElementsRef.current = new Set();
    };
  }, [isEnabled, handleElementResize]);

  // A gradient-to-gradient theme change morphs the stops on the same timer as the theme colors
  const colorsKey = colors?.join(',');
  const isFreeform = Boolean(colors && colors.length > 2);
  useLayoutEffect(() => {
    if (!isEnabled || !isFreeform) return undefined;

    const state = stateRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = GRADIENT_SIZE;
    canvas.height = GRADIENT_SIZE;
    rendererRef.current = createGradientRenderer(canvas, colors!, undefined, {
      noPositionAnimation: !areColorsAnimated,
      onRender: scheduleDraw,
    });
    if (rendererRef.current) {
      state.gradientCanvas = canvas;
    } else {
      const fallback = document.createElement('canvas');
      renderStaticGradient(fallback, colors!);
      state.gradientCanvas = fallback;
    }
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = undefined;
      state.gradientCanvas = undefined;
    };
    // Color changes update the existing renderer during the morph
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [isEnabled, isFreeform, areColorsAnimated, scheduleDraw]);

  useLayoutEffect(() => {
    const previous = renderColorsRef.current;
    if (!isGradient || !previous || shouldSnapColors || document.visibilityState !== 'visible'
      || !document.hasFocus() || !selectCanAnimateInterface(getGlobal())) {
      morphRef.current?.cancel();
      morphRef.current = undefined;
      renderColorsRef.current = colors;
      if (isFreeform && colors) {
        if (rendererRef.current) {
          rendererRef.current.update(colors, true);
        } else if (stateRef.current.gradientCanvas) {
          renderStaticGradient(stateRef.current.gradientCanvas, colors);
        }
      }
      return;
    }

    startColorsMorph(previous, colors!);
    // `colorsKey` stands in for `colors`, whose identity changes without its content
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [colorsKey, isGradient, isFreeform, shouldSnapColors, startColorsMorph]);

  useLayoutEffect(() => {
    return () => {
      morphRef.current?.cancel();
    };
  }, []);

  // Reads the geometry now and applies it once the scroll position is final
  const measureForReflow = useLastCallback(() => {
    if (!measure()) return undefined;

    return () => {
      const container = containerRef.current;
      if (!container) return;

      applyMeasure(forceMeasure(() => container.scrollTop));
    };
  });

  useLayoutEffect(() => {
    const content = canvasElement?.parentElement;
    if (!isEnabled || !content) return undefined;

    let isCancelled = false;
    let isTrackingAnimation = false;
    let isRedrawPending = false;

    const trackAnimations = () => {
      if (isCancelled) return false;
      measureAndApply();
      isTrackingAnimation = content.getAnimations({ subtree: true }).some((animation) => {
        const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : undefined;
        return target instanceof HTMLElement && target.matches(ANIMATED_ELEMENT_SELECTOR)
          && (animation.playState === 'running' || animation.pending);
      });
      return isTrackingAnimation;
    };

    const redraw = () => {
      if (isRedrawPending) return;
      isRedrawPending = true;
      // The observer runs after Teact commits classes, before Fasterdom's forced measure phase
      requestForcedReflow(() => {
        isRedrawPending = false;
        if (isCancelled) return undefined;
        if (!isTrackingAnimation) {
          isTrackingAnimation = true;
          animate(trackAnimations, requestMeasure);
        }
        return measureForReflow();
      });
    };

    const observer = new MutationObserver((records) => {
      if (records.some(({ type, target }) => type === 'childList'
        || (target instanceof HTMLElement
          && target.matches('.message-list-item, .message-content, .message-content-wrapper, .live-tail')))) {
        redraw();
      }
    });
    observer.observe(content, {
      subtree: true, childList: true, attributes: true, attributeFilter: ['class', CUSTOM_APPENDIX_ATTRIBUTE],
    });

    const handleAnimation = (e: Event) => {
      if (e.target instanceof HTMLElement && e.target.matches(ANIMATED_ELEMENT_SELECTOR)) redraw();
    };
    content.addEventListener('transitionrun', handleAnimation);
    content.addEventListener('animationstart', handleAnimation);
    redraw();

    return () => {
      isCancelled = true;
      observer.disconnect();
      content.removeEventListener('transitionrun', handleAnimation);
      content.removeEventListener('animationstart', handleAnimation);
    };
  }, [isEnabled, canvasElement, measureAndApply, measureForReflow]);

  // The list restores its scroll position within the same frame while a regular measure lands a frame
  // later, so the geometry is measured inside the list reflow instead; the regular measure only
  // covers frames where the list skips its reflow.
  useLayoutEffect(() => {
    if (!isEnabled) return;

    let isMeasured = false;
    requestAfterMessageListReflow(() => {
      const mutation = measureForReflow();
      isMeasured = Boolean(mutation);
      return mutation;
    });

    requestMeasure(() => {
      if (!isMeasured) measureAndApply();
    });
  }, [messageIds, isEnabled, measureForReflow, measureAndApply]);

  // Initial canvas activation measures synchronously; color changes reuse the cached bubble paths
  useLayoutEffect(() => {
    if (!isEnabled) {
      isDrawnRef.current = false;
      return;
    }

    const state = stateRef.current;
    // Solid torn bubbles snap to the target colors, which the CSS bubbles animate towards
    state.incomingColor = palette.incomingColor;
    state.outgoingColor = palette.outgoingColor;
    if (isDrawnRef.current && state.isGradientMeasured === isGradient) {
      state.shadowColor = themeColors['--color-default-shadow'][theme === 'dark' ? 1 : 0];
      isShadowDirtyRef.current = true;
      scheduleDraw();
      return;
    }

    requestForcedReflow(measureForReflow);
  }, [
    isEnabled, isGradient, colorsKey, theme, palette.incomingColor, palette.outgoingColor, measureForReflow,
    scheduleDraw,
  ]);

  useResizeObserver(containerRef, scheduleMeasure, !isEnabled);

  return { scheduleMeasure, updateOnScroll };
}

// Radii and the shadow follow the group-position classes of the message and the bubble, so both
// class strings key the cache
function getBubbleStyle(bubble: HTMLElement, cache: BubbleStyleCache): BubbleStyle {
  const message = bubble.closest<HTMLElement>('.Message');
  const key = `${message?.className} ${bubble.className}`;
  const cached = cache.get(bubble);
  if (cached && cached.key === key) return cached.style;

  const computed = getComputedStyle(bubble);
  const style: BubbleStyle = {
    radii: [
      parseFloat(computed.borderTopLeftRadius) || 0,
      parseFloat(computed.borderTopRightRadius) || 0,
      parseFloat(computed.borderBottomRightRadius) || 0,
      parseFloat(computed.borderBottomLeftRadius) || 0,
    ],
    // Only the first document of a group casts a shadow (see `Message.scss`)
    hasShadow: !message?.classList.contains('is-in-document-group')
      || message.classList.contains('first-in-document-group'),
  };
  cache.set(bubble, { key, style });
  return style;
}

// The buffer never exceeds the content, or the canvas would inflate the scroller's overflow
// Gradients with a different stop count are matched by sampling the shorter one evenly
function resampleStops(stops: ColorStop[], count: number): ColorStop[] {
  if (stops.length === count) return stops;

  return Array.from({ length: count }, (_value, index) => {
    const position = (index / (count - 1)) * (stops.length - 1);
    const from = Math.floor(position);
    const to = Math.min(from + 1, stops.length - 1);
    return mixColors(stops[from], stops[to], position - from, { space: 'srgb' });
  });
}

function getBufferHeight(state: CanvasState) {
  return Math.min(state.viewportHeight * BUFFER_SCREENS, state.contentHeight);
}

function syncCanvasSize(canvas: HTMLCanvasElement, state: CanvasState) {
  const dpr = window.devicePixelRatio || 1;
  const bufferHeight = getBufferHeight(state);
  const width = Math.max(1, Math.round(state.contentWidth * dpr));
  const height = Math.max(1, Math.round(bufferHeight * dpr));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  canvas.style.width = `${state.contentWidth}px`;
  canvas.style.height = `${bufferHeight}px`;
}

function recenterBuffer(
  canvas: HTMLCanvasElement, state: CanvasState, scrollTop: number, colors?: string[], force = false,
) {
  const contentScrollTop = scrollTop - state.contentOffsetTop;
  const bufferHeight = getBufferHeight(state);
  const maxTop = Math.max(0, state.contentHeight - bufferHeight);
  const threshold = state.viewportHeight * BUFFER_EDGE_FRACTION;
  const isNearTopEdge = state.bufferTop > 0 && contentScrollTop - state.bufferTop < threshold;
  const isNearBottomEdge = state.bufferTop < maxTop
    && state.bufferTop + bufferHeight - (contentScrollTop + state.viewportHeight) < threshold;
  if (!force && !isNearTopEdge && !isNearBottomEdge) return;

  state.bufferTop = Math.min(maxTop, Math.max(0, contentScrollTop - (bufferHeight - state.viewportHeight) / 2));
  canvas.style.top = `${state.bufferTop}px`;
  buildBubblePaths(state);
  renderShadowLayer(canvas, state, colors);
}

// The blur is expensive, so the shadow is pre-rendered here and only composited on scroll.
// The path is filled along with the shadow: the body is covered by the gradient afterwards,
// and a mid-gradient fill keeps the blended edge pixels in the palette. Torn bubbles cast their
// shadows as they are drawn.
function renderShadowLayer(canvas: HTMLCanvasElement, state: CanvasState, colors?: string[]) {
  const layer = state.shadowCanvas ||= document.createElement('canvas');
  if (layer.width !== canvas.width) layer.width = canvas.width;
  if (layer.height !== canvas.height) layer.height = canvas.height;

  const ctx = layer.getContext('2d');
  if (!ctx || !state.shadowPath || !colors) return;

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, state.contentWidth, getBufferHeight(state));
  ctx.shadowColor = state.shadowColor;
  // Shadow offset and blur ignore the transform, so they are given in device pixels
  ctx.shadowOffsetY = SHADOW_OFFSET_Y_PX * dpr;
  ctx.shadowBlur = SHADOW_BLUR_PX * dpr;
  ctx.fillStyle = colors[Math.floor(colors.length / 2)];
  ctx.fill(state.shadowPath);
}

function buildBubblePaths(state: CanvasState) {
  const path = new Path2D();
  const shadowPath = new Path2D();
  const bufferHeight = getBufferHeight(state);
  const dpr = window.devicePixelRatio || 1;
  state.translucentPaths = [];
  state.tornPaths = [];
  ownTailPath ||= new Path2D(OWN_APPENDIX_PATH);
  tailPath ||= new Path2D(APPENDIX_PATH);

  state.geometry.forEach(({
    x, y, width, height, scale, opacity, radii, hasTail, hasShadow, hasTopMedia, isOwn, messageId, tearBands,
  }) => {
    const top = y - state.bufferTop;
    if (!opacity || !width || !height || top + height < 0 || top > bufferHeight) return;

    const bubblePath = new Path2D();
    // The image's antialiased top edge exposes a fill drawn at the same fractional position
    const topInset = hasTopMedia ? Math.min(MEDIA_TOP_INSET_DEVICE_PX / dpr, height) : 0;
    bubblePath.roundRect(x, top + topInset, width, height - topInset, radii.map((radius) => radius * scale));
    if (hasTail) {
      const matrix = new DOMMatrix();
      matrix.a = scale;
      matrix.d = scale;
      matrix.e = isOwn
        ? x + width + (APPENDIX_RIGHT_OVERHANG_PX - APPENDIX_WIDTH_PX) * scale
        : x - APPENDIX_LEFT_OVERHANG_PX * scale;
      matrix.f = top + height + (APPENDIX_BOTTOM_OVERHANG_PX - APPENDIX_HEIGHT_PX) * scale;
      bubblePath.addPath(isOwn ? ownTailPath! : tailPath!, matrix);
    }

    if (tearBands) {
      state.tornPaths.push({
        path: bubblePath,
        clip: buildTearClip(x, top, width, height, tearBands, scale, messageId),
        opacity,
        hasShadow,
        isOwn,
      });
    } else if (opacity < 1) {
      state.translucentPaths.push({ path: bubblePath, opacity, hasShadow });
    } else {
      path.addPath(bubblePath);
      if (hasShadow) shadowPath.addPath(bubblePath);
    }
  });

  state.path = path;
  state.shadowPath = shadowPath;
}

function drawBubbles(canvas: HTMLCanvasElement, state: CanvasState, scrollTop: number, colors?: string[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const bufferHeight = getBufferHeight(state);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, state.contentWidth, bufferHeight);
  if (!state.path) return;

  if (state.shadowCanvas && colors) {
    ctx.drawImage(state.shadowCanvas, 0, 0, state.contentWidth, bufferHeight);
  }

  const gradientFill = colors && buildGradientFill(ctx, state, scrollTop, colors);
  const drawPath = (path: Path2D, opacity: number, hasShadow: boolean, clip?: Path2D) => {
    ctx.save();
    if (clip) ctx.clip(clip);
    ctx.globalAlpha = opacity;
    if (hasShadow) {
      ctx.shadowColor = state.shadowColor;
      ctx.shadowOffsetY = SHADOW_OFFSET_Y_PX * dpr;
      ctx.shadowBlur = SHADOW_BLUR_PX * dpr;
    }
    ctx.fill(path);
    ctx.restore();
  };

  if (gradientFill) {
    ctx.fillStyle = gradientFill;
    ctx.fill(state.path);
    state.translucentPaths.forEach(({ path, opacity, hasShadow }) => drawPath(path, opacity, hasShadow));
  }

  state.tornPaths.forEach(({
    path, clip, opacity, hasShadow, isOwn,
  }) => {
    ctx.fillStyle = (isOwn && gradientFill) || (isOwn ? state.outgoingColor : state.incomingColor);
    drawPath(path, opacity, hasShadow, clip);
  });
}

function buildGradientFill(ctx: CanvasRenderingContext2D, state: CanvasState, scrollTop: number, colors: string[]) {
  const viewportY = scrollTop - state.contentOffsetTop - state.bufferTop;
  if (state.gradientCanvas) {
    const source = state.gradientCanvas;
    const pattern = ctx.createPattern(source, 'repeat');
    pattern?.setTransform(new DOMMatrix([
      state.contentWidth / source.width, 0, 0, state.viewportHeight / source.height, 0, viewportY,
    ]));
    return pattern || undefined;
  }

  const gradient = ctx.createLinearGradient(0, viewportY, 0, viewportY + state.viewportHeight);
  // The first server color belongs at the bottom of the viewport
  colors.forEach((color, index) => {
    gradient.addColorStop(1 - index / (colors.length - 1), color);
  });
  return gradient;
}

// The edge margins of the first and last blocks collapse through the content root, so they are added back
function getRichContentBounds(root?: HTMLElement | null) {
  if (!root) return undefined;

  const { top, bottom } = root.getBoundingClientRect();
  const first = root.firstElementChild;
  const last = root.lastElementChild;
  return {
    top: top - (first ? parseFloat(getComputedStyle(first).marginTop) || 0 : 0),
    bottom: bottom + (last ? parseFloat(getComputedStyle(last).marginBottom) || 0 : 0),
  };
}

// Grows the zones of the plates into bands, within the content bounds; runs of bubble too short to draw join
// the band next to them. Zones come in document order, from top to bottom.
function resolveTearBands(
  zones: (readonly [number, number])[], height: number, scale: number, contentTop: number, contentBottom: number,
): TearBand[] {
  const gap = TEAR_GAP_PX * scale;
  const sliver = TEAR_SLIVER_PX * scale;
  const bands: [number, number][] = [];
  zones.forEach(([zoneTop, zoneBottom]) => {
    const top = Math.max(zoneTop - gap, contentTop);
    const bottom = Math.min(zoneBottom + gap, contentBottom);
    const last = bands[bands.length - 1];
    if (last && top - last[1] <= sliver) {
      last[1] = Math.max(last[1], bottom);
    } else {
      bands.push([top, bottom]);
    }
  });

  return bands.map(([top, bottom]) => ({
    top: top > sliver ? top : undefined,
    bottom: height - bottom > sliver ? bottom : undefined,
  }));
}

// The kept runs of a torn bubble, each with a torn edge facing a band. As on Android, a band's seed comes from
// the message and the band's index, and both of its edges share it.
function buildTearClip(
  x: number, top: number, width: number, height: number, bands: TearBand[], scale: number, messageId: number,
) {
  const clip = new Path2D();
  const overhang = TEAR_OVERHANG_PX * scale;
  let pieceTop = top - overhang;
  let pieceTopSeed: number | undefined;
  for (let index = 0; index < bands.length; index++) {
    const band = bands[index];
    const seed = messageId * TEAR_SEEDS_PER_MESSAGE + index;
    if (band.top !== undefined) {
      addTornPiece(clip, x, width, pieceTop, pieceTopSeed, top + band.top, seed, scale);
    }
    if (band.bottom === undefined) return clip;

    pieceTop = top + band.bottom;
    pieceTopSeed = seed;
  }

  addTornPiece(clip, x, width, pieceTop, pieceTopSeed, top + height + overhang, undefined, scale);
  return clip;
}

// An edge without a seed is straight
function addTornPiece(
  path: Path2D,
  x: number,
  width: number,
  top: number,
  topSeed: number | undefined,
  bottom: number,
  bottomSeed: number | undefined,
  scale: number,
) {
  const overhang = TEAR_OVERHANG_PX * scale;
  const step = TEAR_STEP_PX * scale;
  // Samples are indexed from the bubble's left edge, so the pattern does not depend on its width
  const first = Math.floor(-overhang / step);
  const last = Math.ceil((width + overhang) / step);

  if (topSeed !== undefined) {
    path.moveTo(x + first * step, top + getTearOffset(first, topSeed) * scale);
    for (let i = first + 1; i <= last; i++) {
      path.lineTo(x + i * step, top + getTearOffset(i, topSeed) * scale);
    }
  } else {
    path.moveTo(x + first * step, top);
    path.lineTo(x + last * step, top);
  }

  if (bottomSeed !== undefined) {
    for (let i = last; i >= first; i--) {
      path.lineTo(x + i * step, bottom + getTearOffset(i, bottomSeed) * scale);
    }
  } else {
    path.lineTo(x + last * step, bottom);
    path.lineTo(x + first * step, bottom);
  }

  path.closePath();
}

// Ports the integer hash of Android's `TornEdge`, so the samples are uncorrelated yet stable
function getTearOffset(index: number, seed: number) {
  let hash = (Math.imul(index, 374761393) + Math.imul(seed, 668265263)) | 0;
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  hash ^= hash >>> 16;
  return ((hash >>> 8) / 16777216 - 0.5) * 2 * TEAR_JITTER_PX;
}
