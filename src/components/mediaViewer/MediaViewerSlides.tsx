import React, {
  FC, memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';

import { MediaViewerOrigin } from '../../types';

import useDebounce from '../../hooks/useDebounce';
import useForceUpdate from '../../hooks/useForceUpdate';
import { animateNumber, timingFunctions } from '../../util/animation';
import arePropsShallowEqual from '../../util/arePropsShallowEqual';
import { captureEvents, IOS_SCREEN_EDGE_THRESHOLD, RealTouchEvent } from '../../util/captureEvents';
import { IS_IOS, IS_TOUCH_ENV } from '../../util/environment';
import { debounce } from '../../util/schedulers';

import MediaViewerContent from './MediaViewerContent';

import './MediaViewerSlides.scss';
import useTimeout from '../../hooks/useTimeout';

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
  isZoomed?: boolean;
  animationLevel: 0 | 1 | 2;
  onClose: () => void;
  hasFooter?: boolean;
  onFooterClick: () => void;
};

const SWIPE_X_THRESHOLD = 50;
const SWIPE_Y_THRESHOLD = 50;
const SLIDES_GAP = 40;
const ANIMATION_DURATION = 350;
const DEBOUNCE_MESSAGE = 350;
const DEBOUNCE_SWIPE = 500;
const DEBOUNCE_ACTIVE = 800;
const MAX_ZOOM = 4;
const MIN_ZOOM = 0.6;
const DOUBLE_TAP_ZOOM = 3;
const CLICK_X_THRESHOLD = 40;
const CLICK_Y_THRESHOLD = 80;
let cancelAnimation: Function | undefined;

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
  ...rest
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const activeSlideRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 1 });
  const swipeDirectionRef = useRef<SwipeDirection | undefined>(undefined);
  const isActiveRef = useRef(true);
  const [activeMessageId, setActiveMessageId] = useState<number | undefined>(messageId);
  const forceUpdate = useForceUpdate();
  const [isFooterHidden, setIsFooterHidden] = useState<boolean>(true);

  const {
    isZoomed,
    onClose,
  } = rest;

  const setTransform = useCallback((value: Transform) => {
    transformRef.current = value;
    forceUpdate();
  }, [forceUpdate]);

  const setIsActive = useCallback((value: boolean) => {
    isActiveRef.current = value;
    forceUpdate();
  }, [forceUpdate]);

  const debounceSetMessage = useDebounce(DEBOUNCE_MESSAGE, true);
  const debounceSwipeDirection = useDebounce(DEBOUNCE_SWIPE, true);
  const debounceActive = useDebounce(DEBOUNCE_ACTIVE, true);

  const handleToggleFooterVisibility = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!IS_TOUCH_ENV) return;
    const isFooter = window.innerHeight - e.pageY < CLICK_Y_THRESHOLD;
    if (!isFooter && e.pageX < CLICK_X_THRESHOLD) return;
    if (!isFooter && e.pageX > window.innerWidth - CLICK_X_THRESHOLD) return;
    setIsFooterHidden(!isFooterHidden);
  }, [isFooterHidden]);

  useTimeout(() => setIsFooterHidden(false), ANIMATION_DURATION - 150);

  useEffect(() => {
    if (!IS_TOUCH_ENV || !containerRef.current || isZoomed || !activeMessageId) {
      return undefined;
    }
    let lastTransform = { x: 0, y: 0, scale: 1 };
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

    const changeSlide = (e: MouseEvent) => {
      if (transformRef.current.scale !== 1) return false;
      let direction = 0;
      if (window.innerHeight - e.pageY < CLICK_Y_THRESHOLD) {
        return false;
      }
      if (e.pageX < CLICK_X_THRESHOLD) {
        direction = -1;
      } else if (e.pageX > window.innerWidth - CLICK_X_THRESHOLD) {
        direction = 1;
      }
      const mId = getMessageId(activeMessageId, direction);
      if (mId) {
        const offset = (window.innerWidth + SLIDES_GAP) * direction;
        transformRef.current.x += offset;
        isActiveRef.current = false;
        setActiveMessageId(mId);
        debounceSetMessage(() => selectMessage(mId));
        debounceActive(() => {
          setIsActive(true);
        });
        lastTransform = { x: 0, y: 0, scale: 1 };
        cancelAnimation = animateNumber({
          from: transformRef.current.x,
          to: 0,
          duration: ANIMATION_DURATION,
          timing: timingFunctions.easeOutCubic,
          onUpdate: (value) => setTransform({
            y: 0,
            x: value,
            scale: 1,
          }),
        });
      }
      return direction !== 0;
    };

    return captureEvents(containerRef.current, {
      isNotPassive: true,
      excludedClosestSelector: '.MediaViewerFooter',
      onCapture: (e) => {
        if (checkIfControlTarget(e)) return;
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
      }) => {
        if (checkIfControlTarget(event)) return;
        // Avoid conflicts with swipe-to-back gestures
        if (IS_IOS) {
          const { pageX } = (captureEvent as RealTouchEvent).touches[0];
          if (pageX <= IOS_SCREEN_EDGE_THRESHOLD || pageX >= window.innerWidth - IOS_SCREEN_EDGE_THRESHOLD) {
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
          if ('touches' in event && event.touches.length === 1) {
            setTransform({
              x: lastTransform.x + dragOffsetX,
              y: lastTransform.y + dragOffsetY,
              scale,
            });
          }
          return;
        }
        if (swipeDirectionRef.current !== SwipeDirection.Vertical) {
          // If user is swiping horizontally or horizontal shift is dominant
          // we change only horizontal position
          if (swipeDirectionRef.current === SwipeDirection.Horizontal
            || Math.abs(x) > h || (absOffsetX > h && absOffsetY < h)) {
            swipeDirectionRef.current = SwipeDirection.Horizontal;
            isActiveRef.current = false;
            setTransform({
              x: dragOffsetX,
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
          setTransform({
            x: 0,
            y: dragOffsetY,
            scale,
          });
        }
      },
      onZoom: (e, {
        zoomFactor,
        initialCenterX,
        initialCenterY,
        dragOffsetX,
        dragOffsetY,
        currentCenterX,
        currentCenterY,
      }) => {
        // Calculate current scale based on zoom factor and limits, add max zoom margin for bounce back effect
        const scale = Math.min(MAX_ZOOM * 3, Math.max(lastTransform.scale * zoomFactor, MIN_ZOOM));
        const scaleFactor = scale / lastTransform.scale;
        const offsetX = Math.abs(Math.min(lastTransform.x, 0));
        const offsetY = Math.abs(Math.min(lastTransform.y, 0));

        // Calculate new center relative to the shifted image
        const scaledCenterX = offsetX + initialCenterX;
        const scaledCenterY = offsetY + initialCenterY;

        // Save last zoom center for bounce back effect
        lastZoomCenter.x = currentCenterX;
        lastZoomCenter.y = currentCenterY;

        // Calculate how much we need to shift the image to keep the zoom center at the same position
        const scaleOffsetX = (scaledCenterX - scaleFactor * scaledCenterX);
        const scaleOffsetY = (scaledCenterY - scaleFactor * scaledCenterY);

        setTransform({
          x: lastTransform.x + scaleOffsetX + dragOffsetX,
          y: lastTransform.y + scaleOffsetY + dragOffsetY,
          scale,
        });
      },
      onClick(e) {
        if (changeSlide(e as MouseEvent)) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      onDoubleClick(e, {
        centerX,
        centerY,
      }) {
        if (changeSlide(e as MouseEvent)) {
          e.preventDefault();
          e.stopPropagation();
          return undefined;
        }
        // Calculate how much we need to shift the image to keep the zoom center at the same position
        const scaleOffsetX = (centerX - DOUBLE_TAP_ZOOM * centerX);
        const scaleOffsetY = (centerY - DOUBLE_TAP_ZOOM * centerY);
        const {
          scale,
          x,
          y,
        } = transformRef.current;
        if (scale === 1) {
          if (x !== 0 || y !== 0) return undefined;
          lastTransform = {
            x: scaleOffsetX,
            y: scaleOffsetY,
            scale: DOUBLE_TAP_ZOOM,
          };
        } else {
          lastTransform = {
            x: 0,
            y: 0,
            scale: 1,
          };
        }
        return animateNumber({
          from: [x, y, scale],
          to: [lastTransform.x, lastTransform.y, lastTransform.scale],
          duration: ANIMATION_DURATION,
          timing: timingFunctions.easeOutCubic,
          onUpdate: (value) => setTransform({
            x: value[0],
            y: value[1],
            scale: value[2],
          }),
        });
      },
      onRelease: () => {
        const absX = Math.abs(transformRef.current.x);
        const absY = Math.abs(transformRef.current.y);
        const {
          scale,
          x,
          y,
        } = transformRef.current;

        debounceSwipeDirection(() => {
          swipeDirectionRef.current = undefined;
        });
        debounceActive(() => {
          setIsActive(true);
        });

        // If scale is less than 1 we need to bounce back
        if (scale < 1) {
          lastTransform = { x: 0, y: 0, scale: 1 };
          return animateNumber({
            from: [x, y, scale],
            to: [0, 0, 1],
            duration: ANIMATION_DURATION,
            timing: timingFunctions.easeOutCubic,
            onUpdate: (value) => setTransform({
              x: value[0],
              y: value[1],
              scale: value[2],
            }),
          });
        }
        if (scale > 1) {
          if (!content || !initialContentRect) {
            lastTransform = {
              x,
              y,
              scale,
            };
            return undefined;
          }
          // Get current content boundaries
          const boundaries = content.getBoundingClientRect();
          const s1 = Math.min(scale, MAX_ZOOM);
          const scaleFactor = s1 / scale;

          // Calculate new position based on the last zoom center to keep the zoom center
          // at the same position when bouncing back from max zoom
          let x1 = x * scaleFactor + (lastZoomCenter.x - scaleFactor * lastZoomCenter.x);
          let y1 = y * scaleFactor + (lastZoomCenter.y - scaleFactor * lastZoomCenter.y);

          // Arbitrary pan velocity coefficient
          const k = 0.15;

          // If scale didn't change, we need to add inertia to pan gesture
          if (lastTransform.scale === scale) {
            // Calculate user gesture velocity
            const Vx = Math.abs(lastDragOffset.x) / (Date.now() - lastGestureTime);
            const Vy = Math.abs(lastDragOffset.y) / (Date.now() - lastGestureTime);

            // Add extra distance based on gesture velocity and last pan delta
            x1 -= Math.abs(lastDragOffset.x) * Vx * k * panDelta.x;
            y1 -= Math.abs(lastDragOffset.y) * Vy * k * panDelta.y;
          }

          // If content is outside window we calculate offset boundaries
          // based on initial content rect and current scale
          if (boundaries.width > window.innerWidth) {
            const minOffsetX = -initialContentRect.left * s1;
            const maxOffsetX = window.innerWidth - initialContentRect.right * s1;
            x1 = Math.min(minOffsetX, Math.max(maxOffsetX, x1));
          } else {
            // Else we center the content on the screen
            x1 = (window.innerWidth - window.innerWidth * s1) / 2;
          }

          if (boundaries.height > window.innerHeight) {
            const minOffsetY = -initialContentRect.top * s1;
            const maxOffsetY = window.innerHeight - initialContentRect.bottom * s1;
            y1 = Math.min(minOffsetY, Math.max(maxOffsetY, y1));
          } else {
            y1 = (window.innerHeight - window.innerHeight * s1) / 2;
          }
          lastTransform = {
            x: x1,
            y: y1,
            scale: s1,
          };
          cancelAnimation = animateNumber({
            from: [x, y, scale],
            to: [x1, y1, s1],
            duration: ANIMATION_DURATION,
            timing: timingFunctions.easeOutCubic,
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
        if (absY >= SWIPE_Y_THRESHOLD) return onClose();
        // Bounce back if vertical swipe is below threshold
        if (absY > 0) {
          return animateNumber({
            from: y,
            to: 0,
            duration: ANIMATION_DURATION,
            timing: timingFunctions.easeOutCubic,
            onUpdate: (value) => setTransform({
              x: 0,
              y: value,
              scale,
            }),
          });
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
          const offset = (window.innerWidth + SLIDES_GAP) * direction;
          // If image is shifted by more than SWIPE_X_THRESHOLD,
          // We shift everything by one screen width and then set new active message id
          transformRef.current.x += offset;
          setActiveMessageId(mId);
          debounceSetMessage(() => selectMessage(mId));
        }
        // Then we always return to the original position
        cancelAnimation = animateNumber({
          from: transformRef.current.x,
          to: 0,
          duration: ANIMATION_DURATION,
          timing: timingFunctions.easeOutCubic,
          onUpdate: (value) => setTransform({
            y: 0,
            x: value,
            scale: transformRef.current.scale,
          }),
        });
        return undefined;
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isZoomed,
    onClose,
    setTransform,
    getMessageId,
    activeMessageId,
    setIsActive,
  ]);

  if (!activeMessageId) return undefined;

  const nextMessageId = getMessageId(activeMessageId, 1);
  const previousMessageId = getMessageId(activeMessageId, -1);
  const offsetX = transformRef.current.x;
  const offsetY = transformRef.current.y;
  const { scale } = transformRef.current;

  return (
    <div className="MediaViewerSlides" ref={containerRef}>
      {previousMessageId && scale === 1 && (
        <div className="MediaViewerSlide" style={getAnimationStyle(-window.innerWidth + offsetX - SLIDES_GAP)}>
          <MediaViewerContent
            /* eslint-disable-next-line react/jsx-props-no-spreading */
            {...rest}
            messageId={previousMessageId}
          />
        </div>
      )}
      {activeMessageId && (
        <div
          className={`MediaViewerSlide ${isActive ? 'MediaViewerSlide--active' : ''}`}
          onClick={handleToggleFooterVisibility}
          ref={activeSlideRef}
          style={getAnimationStyle(offsetX, offsetY, scale)}
        >
          <MediaViewerContent
            /* eslint-disable-next-line react/jsx-props-no-spreading */
            {...rest}
            messageId={activeMessageId}
            isActive={isActive && isActiveRef.current}
            setIsFooterHidden={setIsFooterHidden}
            isFooterHidden={isFooterHidden || isZoomed || scale !== 1}
          />
        </div>
      )}
      {nextMessageId && scale === 1 && (
        <div className="MediaViewerSlide" style={getAnimationStyle(window.innerWidth + offsetX + SLIDES_GAP)}>
          <MediaViewerContent
            /* eslint-disable-next-line react/jsx-props-no-spreading */
            {...rest}
            messageId={nextMessageId}
          />
        </div>
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
    if (checkIfInsideSelector(target, '.play, .fullscreen')) {
      return true;
    }
    e.preventDefault();
    return true;
  }
  return false;
}
