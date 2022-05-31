import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import type { MediaViewerOrigin } from '../../types';
import type { RealTouchEvent } from '../../util/captureEvents';

import { animateNumber, timingFunctions } from '../../util/animation';
import arePropsShallowEqual from '../../util/arePropsShallowEqual';
import buildClassName from '../../util/buildClassName';
import { captureEvents, IOS_SCREEN_EDGE_THRESHOLD } from '../../util/captureEvents';
import { IS_IOS, IS_TOUCH_ENV } from '../../util/environment';
import { clamp, isBetween, round } from '../../util/math';
import { debounce } from '../../util/schedulers';

import useDebouncedCallback from '../../hooks/useDebouncedCallback';
import useForceUpdate from '../../hooks/useForceUpdate';
import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';
import useTimeout from '../../hooks/useTimeout';
import useWindowSize from '../../hooks/useWindowSize';

import MediaViewerContent from './MediaViewerContent';

import './MediaViewerSlides.scss';

const { easeOutCubic, easeOutQuart } = timingFunctions;

type OwnProps = {
  messageId?: number;
  getMessageId: (fromId?: number, direction?: number) => number | undefined;
  isVideo?: boolean;
  isGif?: boolean;
  isPhoto?: boolean;
  isOpen?: boolean;
  selectMessage: (id?: number) => void;
  chatId?: string;
  threadId?: number;
  isActive?: boolean;
  avatarOwnerId?: string;
  profilePhotoIndex?: number;
  origin?: MediaViewerOrigin;
  animationLevel: 0 | 1 | 2;
  onClose: () => void;
  hasFooter?: boolean;
  onFooterClick: () => void;
  zoomLevelChange: number;
};

const SWIPE_X_THRESHOLD = 50;
const SWIPE_Y_THRESHOLD = 50;
const SLIDES_GAP = IS_TOUCH_ENV ? 40 : 0;
const ANIMATION_DURATION = 350;
const DEBOUNCE_MESSAGE = 350;
const DEBOUNCE_SWIPE = 500;
const DEBOUNCE_ACTIVE = 800;
const DOUBLE_TAP_ZOOM = 3;
const CLICK_Y_THRESHOLD = 80;
const HEADER_HEIGHT = 60;
const MAX_ZOOM = 4;
const MIN_ZOOM = 1;
let cancelAnimation: Function | undefined;
let cancelZoomAnimation: Function | undefined;

type Transform = {
  x: number;
  y: number;
  scale: number;
};

enum SwipeDirection {
  Horizontal,
  Vertical,
}

const MediaViewerSlides: FC<OwnProps> = ({
  messageId,
  getMessageId,
  selectMessage,
  isVideo,
  isGif,
  isPhoto,
  isOpen,
  isActive,
  hasFooter,
  zoomLevelChange,
  animationLevel,
  ...rest
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const activeSlideRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const lastTransformRef = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const swipeDirectionRef = useRef<SwipeDirection | undefined>(undefined);
  const isActiveRef = useRef(true);
  const [activeMessageId, setActiveMessageId] = useState<number | undefined>(messageId);
  const prevZoomLevelChange = usePrevious(zoomLevelChange);
  const hasZoomChanged = prevZoomLevelChange !== undefined && prevZoomLevelChange !== zoomLevelChange;
  const forceUpdate = useForceUpdate();
  const [isFooterHidden, setIsFooterHidden] = useState(true);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const { height: windowHeight, width: windowWidth, isResizing } = useWindowSize();
  const { onClose } = rest;

  const lang = useLang();

  const setTransform = useCallback((value: Transform) => {
    transformRef.current = value;
    forceUpdate();
  }, [forceUpdate]);

  const selectMessageDebounced = useDebouncedCallback(selectMessage, [], DEBOUNCE_MESSAGE, true);
  const clearSwipeDirectionDebounced = useDebouncedCallback(() => {
    swipeDirectionRef.current = undefined;
  }, [], DEBOUNCE_SWIPE, true);
  const setIsActiveDebounced = useDebouncedCallback((value: boolean) => {
    isActiveRef.current = value;
    forceUpdate();
  }, [forceUpdate], DEBOUNCE_ACTIVE, true);

  const shouldCloseOnVideo = isGif && !IS_IOS;
  const clickXThreshold = IS_TOUCH_ENV ? 40 : windowWidth / 10;

  const handleToggleFooterVisibility = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!IS_TOUCH_ENV) return;
    const isFooter = windowHeight - e.pageY < CLICK_Y_THRESHOLD;
    if (!isFooter && e.pageX < clickXThreshold) return;
    if (!isFooter && e.pageX > windowWidth - clickXThreshold) return;
    setIsFooterHidden(!isFooterHidden);
  }, [clickXThreshold, isFooterHidden, windowHeight, windowWidth]);

  useTimeout(() => setIsFooterHidden(false), ANIMATION_DURATION - 150);

  useEffect(() => {
    if (!containerRef.current || !activeMessageId) {
      return undefined;
    }
    let lastTransform = lastTransformRef.current;
    const lastDragOffset = {
      x: 0,
      y: 0,
    };
    const lastZoomCenter = {
      x: 0,
      y: 0,
    };
    const panDelta = {
      x: 0,
      y: 0,
    };
    let lastGestureTime = Date.now();
    let initialContentRect: DOMRect;
    let content: HTMLElement | null;
    const setLastGestureTime = debounce(() => {
      lastGestureTime = Date.now();
    }, 500, false, true);

    const changeSlide = (direction: number) => {
      const mId = getMessageId(activeMessageId, direction);
      if (mId) {
        const offset = (windowWidth + SLIDES_GAP) * direction;
        transformRef.current.x += offset;
        isActiveRef.current = false;
        setActiveMessageId(mId);
        selectMessageDebounced(mId);
        setIsActiveDebounced(true);
        lastTransform = { x: 0, y: 0, scale: 1 };
        if (animationLevel === 0) {
          setTransform(lastTransform);
          return true;
        }
        cancelAnimation = animateNumber({
          from: transformRef.current.x,
          to: 0,
          duration: ANIMATION_DURATION,
          timing: easeOutCubic,
          onUpdate: (value) => setTransform({
            y: 0,
            x: value,
            scale: 1,
          }),
        });
        return true;
      }
      return false;
    };

    const changeSlideOnClick = (e: MouseEvent): [boolean, boolean] => {
      if (transformRef.current.scale !== 1) return [false, false];
      let direction = 0;
      if (windowHeight - e.pageY < CLICK_Y_THRESHOLD) {
        return [false, false];
      }
      if (e.pageX < clickXThreshold) {
        direction = -1;
      } else if (e.pageX > windowWidth - clickXThreshold) {
        direction = 1;
      }
      const hasNextSlide = changeSlide(direction);
      const isInThreshold = direction !== 0;
      return [isInThreshold, hasNextSlide];
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (transformRef.current.scale !== 1) return;
      switch (e.key) {
        case 'Left': // IE/Edge specific value
        case 'ArrowLeft':
          changeSlide(-1);
          break;

        case 'Right': // IE/Edge specific value
        case 'ArrowRight':
          changeSlide(1);
          break;
      }
    };

    const calculateOffsetBoundaries = (
      { x, y, scale }: Transform,
      offsetTop = 0,
    ):[Transform, boolean, boolean] => {
      if (!initialContentRect) return [{ x, y, scale }, true, true];
      // Get current content boundaries
      let inBoundsX = true;
      let inBoundsY = true;

      const centerX = (windowWidth - windowWidth * scale) / 2;
      const centerY = (windowHeight - windowHeight * scale) / 2;

      // If content is outside window we calculate offset boundaries
      // based on initial content rect and current scale
      const minOffsetX = Math.max(-initialContentRect.left * scale, centerX);
      const maxOffsetX = windowWidth - initialContentRect.right * scale;
      inBoundsX = isBetween(x, maxOffsetX, minOffsetX);
      x = clamp(x, maxOffsetX, minOffsetX);

      const minOffsetY = Math.max(-initialContentRect.top * scale + offsetTop, centerY);
      const maxOffsetY = windowHeight - initialContentRect.bottom * scale;
      inBoundsY = isBetween(y, maxOffsetY, minOffsetY);
      y = clamp(y, maxOffsetY, minOffsetY);

      return [{ x, y, scale }, inBoundsX, inBoundsY];
    };

    const cleanup = captureEvents(containerRef.current, {
      isNotPassive: true,
      withNativeDrag: true,
      excludedClosestSelector: '.MediaViewerFooter, .ZoomControls',
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      doubleTapZoom: DOUBLE_TAP_ZOOM,
      onCapture: (e) => {
        if (checkIfControlTarget(e)) return;
        if (e.type === 'mousedown') {
          setIsMouseDown(true);
          if (transformRef.current.scale !== 1) {
            e.preventDefault();
            return;
          }
        }
        lastGestureTime = Date.now();
        if (arePropsShallowEqual(transformRef.current, { x: 0, y: 0, scale: 1 })) {
          if (!activeSlideRef.current) return;
          content = activeSlideRef.current.querySelector('img, video');
          if (!content) return;
          // Store initial content rect, without transformations
          initialContentRect = content.getBoundingClientRect();
        }
      },
      onDrag: (event, captureEvent, {
        dragOffsetX,
        dragOffsetY,
      }, cancelDrag) => {
        if (checkIfControlTarget(event)) return;
        // Avoid conflicts with swipe-to-back gestures
        if (IS_IOS && captureEvent.type === 'touchstart') {
          const { pageX } = (captureEvent as RealTouchEvent).touches[0];
          if (pageX <= IOS_SCREEN_EDGE_THRESHOLD || pageX >= windowWidth - IOS_SCREEN_EDGE_THRESHOLD) {
            return;
          }
        }
        if (cancelAnimation) {
          cancelAnimation();
          cancelAnimation = undefined;
        }
        panDelta.x = lastDragOffset.x - dragOffsetX;
        panDelta.y = lastDragOffset.y - dragOffsetY;
        lastDragOffset.x = dragOffsetX;
        lastDragOffset.y = dragOffsetY;
        const absOffsetX = Math.abs(dragOffsetX);
        const absOffsetY = Math.abs(dragOffsetY);
        const {
          scale,
          x,
          y,
        } = transformRef.current;
        const h = 10;

        // If user is inactive but is still touching the screen
        // we reset last gesture time
        setLastGestureTime();

        // If image is scaled we just need to pan it
        if (scale !== 1) {
          const x1 = lastTransform.x + dragOffsetX;
          const y1 = lastTransform.y + dragOffsetY;
          if (['wheel', 'mousemove'].includes(event.type)) {
            const [transform, inBoundsX, inBoundsY] = calculateOffsetBoundaries({ x: x1, y: y1, scale }, HEADER_HEIGHT);
            if (cancelDrag) cancelDrag(!inBoundsX, !inBoundsY);
            setTransform(transform);
            return;
          }
          if ('touches' in event && event.touches.length === 1) {
            setTransform({
              x: x1,
              y: y1,
              scale,
            });
          }
          return;
        }
        if (['wheel', 'mousemove'].includes(event.type)) return;
        if (swipeDirectionRef.current !== SwipeDirection.Vertical) {
          // If user is swiping horizontally or horizontal shift is dominant
          // we change only horizontal position
          if (swipeDirectionRef.current === SwipeDirection.Horizontal
            || Math.abs(x) > h || (absOffsetX > h && absOffsetY < h)) {
            swipeDirectionRef.current = SwipeDirection.Horizontal;
            isActiveRef.current = false;
            const limit = windowWidth + SLIDES_GAP;
            setTransform({
              x: clamp(dragOffsetX, -limit, limit),
              y: 0,
              scale,
            });
            return;
          }
        }
        // If vertical shift is dominant we change only vertical position
        if (swipeDirectionRef.current === SwipeDirection.Vertical
          || Math.abs(y) > h || (absOffsetY > h && absOffsetX < h)) {
          swipeDirectionRef.current = SwipeDirection.Vertical;
          const limit = windowHeight;
          setTransform({
            x: 0,
            y: clamp(dragOffsetY, -limit, limit),
            scale,
          });
        }
      },
      onZoom: (e, {
        zoom,
        zoomFactor,
        initialCenterX,
        initialCenterY,
        dragOffsetX,
        dragOffsetY,
        currentCenterX,
        currentCenterY,
      }) => {
        if (cancelAnimation) cancelAnimation();
        initialCenterX = initialCenterX || windowWidth / 2;
        initialCenterY = initialCenterY || windowHeight / 2;
        currentCenterX = currentCenterX || windowWidth / 2;
        currentCenterY = currentCenterY || windowHeight / 2;

        // Calculate current scale based on zoom factor and limits, add zoom margin for bounce back effect
        const scale = zoom ?? clamp(lastTransform.scale * zoomFactor!, MIN_ZOOM * 0.5, MAX_ZOOM * 3);
        const scaleFactor = scale / lastTransform.scale;
        const offsetX = Math.abs(Math.min(lastTransform.x, 0));
        const offsetY = Math.abs(Math.min(lastTransform.y, 0));

        // Save last zoom center for bounce back effect
        lastZoomCenter.x = currentCenterX;
        lastZoomCenter.y = currentCenterY;

        // Calculate new center relative to the shifted image
        const scaledCenterX = offsetX + initialCenterX;
        const scaledCenterY = offsetY + initialCenterY;

        // Calculate how much we need to shift the image to keep the zoom center at the same position
        const scaleOffsetX = (scaledCenterX - scaleFactor * scaledCenterX);
        const scaleOffsetY = (scaledCenterY - scaleFactor * scaledCenterY);

        const [transform] = calculateOffsetBoundaries({
          x: lastTransform.x + scaleOffsetX + dragOffsetX,
          y: lastTransform.y + scaleOffsetY + dragOffsetY,
          scale,
        });

        setTransform(transform);
      },
      onClick(e) {
        const [isInThreshold, hasNextSlide] = changeSlideOnClick(e as MouseEvent);
        if (isInThreshold) {
          e.preventDefault();
          e.stopPropagation();
          if (IS_TOUCH_ENV) return;
          if (!hasNextSlide) onClose();
          return;
        }
        if (lastTransform.scale !== 1 || IS_TOUCH_ENV) return;
        if (shouldCloseOnVideo || !checkIfInsideSelector(e.target as HTMLElement, '.VideoPlayer')) {
          onClose();
        }
      },
      onDoubleClick(e, {
        centerX,
        centerY,
      }) {
        const [isInThreshold] = changeSlideOnClick(e as MouseEvent);
        if (isInThreshold) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (!IS_TOUCH_ENV && e.type !== 'wheel') return;
        // Calculate how much we need to shift the image to keep the zoom center at the same position
        const scaleOffsetX = (centerX - DOUBLE_TAP_ZOOM * centerX);
        const scaleOffsetY = (centerY - DOUBLE_TAP_ZOOM * centerY);
        const {
          scale,
          x,
          y,
        } = transformRef.current;
        if (scale === 1) {
          if (x !== 0 || y !== 0) return;
          lastTransform = calculateOffsetBoundaries({
            x: scaleOffsetX,
            y: scaleOffsetY,
            scale: DOUBLE_TAP_ZOOM,
          })[0];
        } else {
          lastTransform = {
            x: 0,
            y: 0,
            scale: 1,
          };
        }
        cancelAnimation = animateNumber({
          from: [x, y, scale],
          to: [lastTransform.x, lastTransform.y, lastTransform.scale],
          duration: ANIMATION_DURATION,
          timing: easeOutCubic,
          onUpdate: (value) => {
            const transform = {
              x: value[0],
              y: value[1],
              scale: value[2],
            };
            setTransform(transform);
          },
        });
      },
      onRelease: (e) => {
        if (e.type === 'mouseup') {
          setIsMouseDown(false);
        }
        const absX = Math.abs(transformRef.current.x);
        const absY = Math.abs(transformRef.current.y);
        const {
          scale,
          x,
          y,
        } = transformRef.current;

        clearSwipeDirectionDebounced();
        setIsActiveDebounced(true);

        // If scale is less than 1 we need to bounce back
        if (scale < 1) {
          lastTransform = { x: 0, y: 0, scale: 1 };
          cancelAnimation = animateNumber({
            from: [x, y, scale],
            to: [0, 0, 1],
            duration: ANIMATION_DURATION,
            timing: easeOutCubic,
            onUpdate: (value) => setTransform({
              x: value[0],
              y: value[1],
              scale: value[2],
            }),
          });
          return undefined;
        }
        if (scale > 1) {
          // Get current content boundaries
          const s1 = Math.min(scale, MAX_ZOOM);
          const scaleFactor = s1 / scale;

          // Calculate new position based on the last zoom center to keep the zoom center
          // at the same position when bouncing back from max zoom
          let x1 = x * scaleFactor + (lastZoomCenter.x - scaleFactor * lastZoomCenter.x);
          let y1 = y * scaleFactor + (lastZoomCenter.y - scaleFactor * lastZoomCenter.y);

          // Arbitrary pan velocity coefficient
          const k = 0.15;

          // If scale didn't change, we need to add inertia to pan gesture
          if (e.type !== 'wheel' && lastTransform.scale === scale) {
            // Calculate user gesture velocity
            const Vx = Math.abs(lastDragOffset.x) / (Date.now() - lastGestureTime);
            const Vy = Math.abs(lastDragOffset.y) / (Date.now() - lastGestureTime);

            // Add extra distance based on gesture velocity and last pan delta
            x1 -= Math.abs(lastDragOffset.x) * Vx * k * panDelta.x;
            y1 -= Math.abs(lastDragOffset.y) * Vy * k * panDelta.y;
          }

          [lastTransform] = calculateOffsetBoundaries({ x: x1, y: y1, scale: s1 }, HEADER_HEIGHT);
          cancelAnimation = animateNumber({
            from: [x, y, scale],
            to: [lastTransform.x, lastTransform.y, lastTransform.scale],
            duration: ANIMATION_DURATION,
            timing: easeOutCubic,
            onUpdate: (value) => setTransform({
              x: value[0],
              y: value[1],
              scale: value[2],
            }),
          });
          return undefined;
        }
        lastTransform = {
          x,
          y,
          scale,
        };
        if (e.type !== 'wheel' && absY >= SWIPE_Y_THRESHOLD) return onClose();
        // Bounce back if vertical swipe is below threshold
        if (absY > 0) {
          cancelAnimation = animateNumber({
            from: y,
            to: 0,
            duration: ANIMATION_DURATION,
            timing: easeOutCubic,
            onUpdate: (value) => setTransform({
              x: 0,
              y: value,
              scale,
            }),
          });
          return undefined;
        }
        // Get horizontal swipe direction
        const direction = x < 0 ? 1 : -1;
        const mId = getMessageId(activeMessageId, x < 0 ? 1 : -1);
        // Get the direction of the last pan gesture.
        // Could be different from the total horizontal swipe direction
        // if user starts a swipe in one direction and then changes the direction
        // we need to cancel slide transition
        const dirX = panDelta.x < 0 ? -1 : 1;
        if (mId && absX >= SWIPE_X_THRESHOLD && direction === dirX) {
          const offset = (windowWidth + SLIDES_GAP) * direction;
          // If image is shifted by more than SWIPE_X_THRESHOLD,
          // We shift everything by one screen width and then set new active message id
          transformRef.current.x += offset;
          setActiveMessageId(mId);
          selectMessageDebounced(mId);
        }
        // Then we always return to the original position
        cancelAnimation = animateNumber({
          from: transformRef.current.x,
          to: 0,
          duration: ANIMATION_DURATION,
          timing: easeOutCubic,
          onUpdate: (value) => setTransform({
            y: 0,
            x: value,
            scale: transformRef.current.scale,
          }),
        });
        return undefined;
      },
    });
    document.addEventListener('keydown', handleKeyDown, false);
    return () => {
      cleanup();
      document.removeEventListener('keydown', handleKeyDown, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    onClose,
    setTransform,
    getMessageId,
    activeMessageId,
    windowWidth,
    windowHeight,
    clickXThreshold,
    shouldCloseOnVideo,
    selectMessageDebounced,
    setIsActiveDebounced,
    clearSwipeDirectionDebounced,
    animationLevel,
    setIsMouseDown,
  ]);

  useEffect(() => {
    if (!containerRef.current || !hasZoomChanged) return;
    const { scale } = transformRef.current;
    const dir = zoomLevelChange > 0 ? -1 : +1;
    const minZoom = MIN_ZOOM * 0.5;
    const maxZoom = MAX_ZOOM * 3;
    const steps = 100;
    let prevValue = 0;
    if (scale <= minZoom && dir > 0) return;
    if (scale >= maxZoom && dir < 0) return;
    if (cancelZoomAnimation) cancelZoomAnimation();
    cancelZoomAnimation = animateNumber({
      from: dir,
      to: dir * steps,
      duration: ANIMATION_DURATION,
      timing: easeOutQuart,
      onUpdate: (value) => {
        if (!containerRef.current) return;
        const delta = round(value - prevValue, 2);
        prevValue = value;
        // To reuse existing logic we trigger wheel event for zoom buttons
        const wheelEvent = new WheelEvent('wheel', {
          deltaY: delta,
          ctrlKey: true,
        });
        containerRef.current.dispatchEvent(wheelEvent);
      },
    });
  }, [zoomLevelChange, hasZoomChanged]);

  if (!activeMessageId) return undefined;

  const nextMessageId = getMessageId(activeMessageId, 1);
  const previousMessageId = getMessageId(activeMessageId, -1);
  const offsetX = transformRef.current.x;
  const offsetY = transformRef.current.y;
  const { scale } = transformRef.current;

  return (
    <div className="MediaViewerSlides" ref={containerRef}>
      {previousMessageId && scale === 1 && !isResizing && (
        <div className="MediaViewerSlide" style={getAnimationStyle(-windowWidth + offsetX - SLIDES_GAP)}>
          <MediaViewerContent
            /* eslint-disable-next-line react/jsx-props-no-spreading */
            {...rest}
            animationLevel={animationLevel}
            isFooterHidden={isFooterHidden}
            messageId={previousMessageId}
          />
        </div>
      )}
      {activeMessageId && (
        <div
          className={buildClassName(
            'MediaViewerSlide',
            isActive && 'MediaViewerSlide--active',
            isMouseDown && scale > 1 && 'MediaViewerSlide--moving',
          )}
          onClick={handleToggleFooterVisibility}
          ref={activeSlideRef}
          style={getAnimationStyle(offsetX, offsetY, scale)}
        >
          <MediaViewerContent
            /* eslint-disable-next-line react/jsx-props-no-spreading */
            {...rest}
            messageId={activeMessageId}
            animationLevel={animationLevel}
            isActive={isActive && isActiveRef.current}
            setIsFooterHidden={setIsFooterHidden}
            isFooterHidden={isFooterHidden || scale !== 1}
          />
        </div>
      )}
      {nextMessageId && scale === 1 && !isResizing && (
        <div className="MediaViewerSlide" style={getAnimationStyle(windowWidth + offsetX + SLIDES_GAP)}>
          <MediaViewerContent
            /* eslint-disable-next-line react/jsx-props-no-spreading */
            {...rest}
            animationLevel={animationLevel}
            isFooterHidden={isFooterHidden}
            messageId={nextMessageId}
          />
        </div>
      )}
      {previousMessageId && scale === 1 && !IS_TOUCH_ENV && (
        <button
          type="button"
          className={`navigation prev ${isVideo && !isGif && 'inline'}`}
          aria-label={lang('AccDescrPrevious')}
          dir={lang.isRtl ? 'rtl' : undefined}
        />
      )}
      {nextMessageId && scale === 1 && !IS_TOUCH_ENV && (
        <button
          type="button"
          className={`navigation next ${isVideo && !isGif && 'inline'}`}
          aria-label={lang('Next')}
          dir={lang.isRtl ? 'rtl' : undefined}
        />
      )}
    </div>
  );
};

export default memo(MediaViewerSlides);

function getAnimationStyle(x = 0, y = 0, scale = 1) {
  return `transform: translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0px) scale(${scale.toFixed(3)});`;
}

function checkIfInsideSelector(element: HTMLElement, selector: string) {
  if (!element) return false;
  if (element.matches(selector)) return true;
  return Boolean(element.closest(selector));
}

function checkIfControlTarget(e: TouchEvent | MouseEvent) {
  const target = e.target as HTMLElement;
  if (checkIfInsideSelector(target, '.VideoPlayerControls')) {
    if (checkIfInsideSelector(
      target,
      '.play, .fullscreen, .volume, .volume-slider, .playback-rate, .playback-rate-menu',
    )) {
      return true;
    }
    e.preventDefault();
    return true;
  }
  return false;
}
