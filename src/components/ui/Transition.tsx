import type { RefObject } from 'react';
import React, {
  beginHeavyAnimation, useEffect, useLayoutEffect, useRef,
} from '../../lib/teact/teact';
import {
  addExtraClass, removeExtraClass, setExtraStyles, toggleExtraClass,
} from '../../lib/teact/teact-dom';
import { getGlobal } from '../../global';

import { requestForcedReflow, requestMutation } from '../../lib/fasterdom/fasterdom';
import { selectCanAnimateInterface } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { waitForAnimationEnd, waitForTransitionEnd } from '../../util/cssAnimationEndListeners';
import forceReflow from '../../util/forceReflow';
import { omit } from '../../util/iteratees';
import { allowSwipeControlForTransition } from '../../util/swipeController';

import useForceUpdate from '../../hooks/useForceUpdate';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';

import './Transition.scss';

type AnimationName = (
  'none' | 'slide' | 'slideRtl' | 'slideFade' | 'zoomFade' | 'zoomBounceSemiFade' | 'slideLayers'
  | 'fade' | 'pushSlide' | 'reveal' | 'slideOptimized' | 'slideOptimizedRtl' | 'semiFade'
  | 'slideVertical' | 'slideVerticalFade' | 'slideFadeAndroid'
  );
export type ChildrenFn = (isActive: boolean, isFrom: boolean, currentKey: number, activeKey: number) => React.ReactNode;
export type TransitionProps = {
  ref?: RefObject<HTMLDivElement>;
  activeKey: number;
  nextKey?: number;
  name: AnimationName;
  direction?: 'auto' | 'inverse' | 1 | -1;
  renderCount?: number;
  shouldRestoreHeight?: boolean;
  shouldCleanup?: boolean;
  cleanupExceptionKey?: number;
  cleanupOnlyKey?: number;
  // Used by async components which are usually remounted during first animation
  shouldWrap?: boolean;
  wrapExceptionKey?: number;
  id?: string;
  className?: string;
  slideClassName?: string;
  withSwipeControl?: boolean;
  isBlockingAnimation?: boolean;
  onStart?: NoneToVoidFunction;
  onStop?: NoneToVoidFunction;
  children: React.ReactNode | ChildrenFn;
};

const FALLBACK_ANIMATION_END = 1000;
const CLASSES = {
  slide: 'Transition_slide',
  active: 'Transition_slide-active',
  from: 'Transition_slide-from',
  to: 'Transition_slide-to',
  inactive: 'Transition_slide-inactive',
};

export const ACTIVE_SLIDE_CLASS_NAME = CLASSES.active;
export const TO_SLIDE_CLASS_NAME = CLASSES.to;

const DISABLEABLE_ANIMATIONS = new Set<AnimationName>([
  'slide', 'slideRtl', 'slideFade', 'zoomFade', 'zoomBounceSemiFade', 'slideLayers', 'pushSlide', 'reveal',
  'slideOptimized', 'slideOptimizedRtl', 'slideVertical', 'slideVerticalFade',
]);

function Transition({
  ref,
  activeKey,
  nextKey,
  name,
  direction = 'auto',
  renderCount,
  shouldRestoreHeight,
  shouldCleanup,
  cleanupExceptionKey,
  cleanupOnlyKey,
  shouldWrap,
  wrapExceptionKey,
  id,
  className,
  slideClassName,
  withSwipeControl,
  isBlockingAnimation,
  onStart,
  onStop,
  children,
}: TransitionProps) {
  const currentKeyRef = useRef<number>();
  // No need for a container to update on change
  const shouldDisableAnimation = DISABLEABLE_ANIMATIONS.has(name)
    && !selectCanAnimateInterface(getGlobal());

  // eslint-disable-next-line no-null/no-null
  let containerRef = useRef<HTMLDivElement>(null);
  if (ref) {
    containerRef = ref;
  }

  const rendersRef = useRef<Record<number, React.ReactNode | ChildrenFn>>({});
  const prevActiveKey = usePreviousDeprecated<any>(activeKey);
  const forceUpdate = useForceUpdate();
  const isAnimatingRef = useRef(false);
  const isSwipeJustCancelledRef = useRef(false);

  const hasActiveKeyChanged = prevActiveKey !== undefined && activeKey !== prevActiveKey;

  if (!renderCount && hasActiveKeyChanged) {
    rendersRef.current = { [prevActiveKey]: rendersRef.current[prevActiveKey] };
  }

  rendersRef.current[activeKey] = children;
  if (nextKey) {
    rendersRef.current[nextKey] = children;
  }

  const isBackwards = (
    direction === -1
    || (direction === 'auto' && prevActiveKey > activeKey)
    || (direction === 'inverse' && prevActiveKey < activeKey)
  );

  useLayoutEffect(() => {
    function cleanup() {
      if (!shouldCleanup) {
        return;
      }
      if (cleanupExceptionKey !== undefined) {
        rendersRef.current = { [cleanupExceptionKey]: rendersRef.current[cleanupExceptionKey] };
      } else if (cleanupOnlyKey !== undefined) {
        rendersRef.current = omit(rendersRef.current, [cleanupOnlyKey]);
      } else {
        rendersRef.current = {};
      }
      forceUpdate();
    }

    const isSlideOptimized = name === 'slideOptimized' || name === 'slideOptimizedRtl';
    const container = containerRef.current!;
    const keys = Object.keys(rendersRef.current).map(Number);
    const prevActiveIndex = renderCount ? prevActiveKey : keys.indexOf(prevActiveKey);
    const activeIndex = renderCount ? activeKey : keys.indexOf(activeKey);

    const childNodes = Array.from(container.childNodes);
    if (!childNodes.length) {
      return;
    }

    const childElements = Array.from(container.children) as HTMLElement[];
    childElements.forEach((el) => {
      addExtraClass(el, CLASSES.slide);

      if (slideClassName) {
        slideClassName.split(/\s+/).forEach((token) => {
          addExtraClass(el, token);
        });
      }
    });

    if (!hasActiveKeyChanged) {
      if (isAnimatingRef.current) {
        return;
      }

      childElements.forEach((childElement) => {
        if (childElement === childNodes[activeIndex]) {
          addExtraClass(childElement, CLASSES.active);

          if (isSlideOptimized) {
            setExtraStyles(childElement, {
              transition: 'none',
              transform: 'translate3d(0, 0, 0)',
            });
          }
        } else if (!isSlideOptimized) {
          addExtraClass(childElement, CLASSES.inactive);
        }
      });

      return;
    }

    currentKeyRef.current = activeKey;

    if (isSlideOptimized) {
      if (!childNodes[activeIndex]) {
        return;
      }

      performSlideOptimized(
        shouldDisableAnimation,
        name,
        isBackwards,
        cleanup,
        activeKey,
        currentKeyRef,
        isAnimatingRef,
        container,
        childNodes[activeIndex],
        childNodes[prevActiveIndex],
        shouldRestoreHeight,
        isBlockingAnimation,
        onStart,
        onStop,
      );

      return;
    }

    if (name === 'none' || shouldDisableAnimation || isSwipeJustCancelledRef.current) {
      if (isSwipeJustCancelledRef.current) {
        isSwipeJustCancelledRef.current = false;
      }

      childNodes.forEach((node, i) => {
        if (node instanceof HTMLElement) {
          removeExtraClass(node, CLASSES.from);
          removeExtraClass(node, CLASSES.to);
          toggleExtraClass(node, CLASSES.active, i === activeIndex);
          toggleExtraClass(node, CLASSES.inactive, i !== activeIndex);
        }
      });

      cleanup();

      return;
    }

    childNodes.forEach((node, i) => {
      if (node instanceof HTMLElement) {
        removeExtraClass(node, CLASSES.active);
        toggleExtraClass(node, CLASSES.from, i === prevActiveIndex);
        toggleExtraClass(node, CLASSES.to, i === activeIndex);
        toggleExtraClass(node, CLASSES.inactive, i !== prevActiveIndex && i !== activeIndex);
      }
    });

    isAnimatingRef.current = true;
    const endHeavyAnimation = beginHeavyAnimation(undefined, isBlockingAnimation);
    onStart?.();

    toggleExtraClass(container, `Transition-${name}`, !isBackwards);
    toggleExtraClass(container, `Transition-${name}Backwards`, isBackwards);

    function onAnimationEnd() {
      const activeElement = container.querySelector<HTMLDivElement>(`.${CLASSES.active}`);
      const { clientHeight } = activeElement || {};

      requestMutation(() => {
        if (activeKey !== currentKeyRef.current) {
          endHeavyAnimation();
          return;
        }

        removeExtraClass(container, `Transition-${name}`);
        removeExtraClass(container, `Transition-${name}Backwards`);

        childNodes.forEach((node, i) => {
          if (node instanceof HTMLElement) {
            removeExtraClass(node, CLASSES.from);
            removeExtraClass(node, CLASSES.to);
            toggleExtraClass(node, CLASSES.active, i === activeIndex);
            toggleExtraClass(node, CLASSES.inactive, i !== activeIndex);
          }
        });

        if (shouldRestoreHeight) {
          if (activeElement) {
            setExtraStyles(activeElement, { height: 'auto' });
            setExtraStyles(container, { height: `${clientHeight}px` });
          }
        }

        onStop?.();
        endHeavyAnimation();
        isAnimatingRef.current = false;

        cleanup();
      });
    }

    const watchedNode = (name === 'reveal' || name === 'slideFadeAndroid') && isBackwards
      ? childNodes[prevActiveIndex]
      : childNodes[activeIndex];

    if (watchedNode) {
      if (withSwipeControl && childNodes[prevActiveIndex]) {
        const giveUpAnimationEnd = waitForAnimationEnd(watchedNode, onAnimationEnd);

        allowSwipeControlForTransition(
          childNodes[prevActiveIndex] as HTMLElement,
          childNodes[activeIndex] as HTMLElement,
          () => {
            giveUpAnimationEnd();
            isSwipeJustCancelledRef.current = true;
            onStop?.();
            endHeavyAnimation();
            isAnimatingRef.current = false;
          },
        );
      } else {
        waitForAnimationEnd(watchedNode, onAnimationEnd, undefined, FALLBACK_ANIMATION_END);
      }
    } else {
      onAnimationEnd();
    }
  }, [
    activeKey,
    nextKey,
    prevActiveKey,
    hasActiveKeyChanged,
    isBackwards,
    name,
    onStart,
    onStop,
    renderCount,
    shouldRestoreHeight,
    shouldCleanup,
    slideClassName,
    cleanupExceptionKey,
    shouldDisableAnimation,
    forceUpdate,
    withSwipeControl,
    isBlockingAnimation,
    cleanupOnlyKey,
  ]);

  useEffect(() => {
    if (!shouldRestoreHeight) {
      return;
    }

    const container = containerRef.current!;
    const activeElement = container.querySelector<HTMLDivElement>(`:scope > .${CLASSES.active}`)
      || container.querySelector<HTMLDivElement>(`:scope > .${CLASSES.from}`);
    if (!activeElement) {
      return;
    }

    const { clientHeight, clientWidth } = activeElement || {};
    if (!clientHeight || !clientWidth) {
      return;
    }

    requestMutation(() => {
      setExtraStyles(activeElement, { height: 'auto' });
      setExtraStyles(container, {
        height: `${clientHeight}px`,
        flexBasis: `${clientHeight}px`,
      });
    });
  }, [shouldRestoreHeight, children]);

  const asFastList = !renderCount;
  const renders = rendersRef.current;
  const renderKeys = Object.keys(renderCount ? new Array(renderCount).fill(undefined) : renders).map(Number);
  const contents = renderKeys.map((key) => {
    const render = renders[key];
    if (!render) {
      return undefined;
    }

    const rendered = typeof render === 'function'
      ? render(key === activeKey, key === prevActiveKey, key, activeKey)
      : render;

    return (shouldWrap && key !== wrapExceptionKey) || asFastList
      ? <div key={key} teactOrderKey={key}>{rendered}</div>
      : rendered;
  });

  return (
    <div
      ref={containerRef}
      id={id}
      className={buildClassName('Transition', className)}
      teactFastList={asFastList}
    >
      {contents}
    </div>
  );
}

export default Transition;

function performSlideOptimized(
  shouldDisableAnimation: boolean,
  name: 'slideOptimized' | 'slideOptimizedRtl',
  isBackwards: boolean,
  cleanup: NoneToVoidFunction,
  activeKey: number,
  currentKeyRef: { current: number | undefined },
  isAnimatingRef: { current: boolean | undefined },
  container: HTMLElement,
  toSlide: ChildNode,
  fromSlide?: ChildNode,
  shouldRestoreHeight?: boolean,
  isBlockingAnimation?: boolean,
  onStart?: NoneToVoidFunction,
  onStop?: NoneToVoidFunction,
) {
  if (shouldDisableAnimation) {
    toggleExtraClass(container, `Transition-${name}`, !isBackwards);
    toggleExtraClass(container, `Transition-${name}Backwards`, isBackwards);

    if (fromSlide instanceof HTMLElement) {
      removeExtraClass(fromSlide, CLASSES.active);
      setExtraStyles(fromSlide, {
        transition: 'none',
        transform: '',
      });
    }

    if (toSlide instanceof HTMLElement) {
      addExtraClass(toSlide, CLASSES.active);
      setExtraStyles(toSlide, {
        transition: 'none',
        transform: 'translate3d(0, 0, 0)',
      });
    }

    cleanup();

    return;
  }

  if (name === 'slideOptimizedRtl') {
    isBackwards = !isBackwards;
  }

  isAnimatingRef.current = true;
  const endHeavyAnimation = beginHeavyAnimation(undefined, isBlockingAnimation);
  onStart?.();

  toggleExtraClass(container, `Transition-${name}`, !isBackwards);
  toggleExtraClass(container, `Transition-${name}Backwards`, isBackwards);

  if (fromSlide instanceof HTMLElement) {
    setExtraStyles(fromSlide, {
      transition: 'none',
      transform: 'translate3d(0, 0, 0)',
    });
  }

  if (toSlide instanceof HTMLElement) {
    setExtraStyles(toSlide, {
      transition: 'none',
      transform: `translate3d(${isBackwards ? '-' : ''}100%, 0, 0)`,
    });
  }

  requestForcedReflow(() => {
    if (toSlide instanceof HTMLElement) {
      forceReflow(toSlide);
    }

    return () => {
      if (fromSlide instanceof HTMLElement) {
        removeExtraClass(fromSlide, CLASSES.active);
        setExtraStyles(fromSlide, {
          transition: '',
          transform: `translate3d(${isBackwards ? '' : '-'}100%, 0, 0)`,
        });
      }

      if (toSlide instanceof HTMLElement) {
        addExtraClass(toSlide, CLASSES.active);
        setExtraStyles(toSlide, {
          transition: '',
          transform: 'translate3d(0, 0, 0)',
        });
      }
    };
  });

  waitForTransitionEnd(toSlide, () => {
    const clientHeight = toSlide instanceof HTMLElement ? toSlide.clientHeight : undefined;

    requestMutation(() => {
      if (activeKey !== currentKeyRef.current) {
        endHeavyAnimation();
        return;
      }

      if (fromSlide instanceof HTMLElement) {
        setExtraStyles(fromSlide, {
          transition: 'none',
          transform: '',
        });
      }

      if (shouldRestoreHeight && clientHeight && toSlide instanceof HTMLElement) {
        setExtraStyles(toSlide, { height: 'auto' });
        setExtraStyles(container, { height: `${clientHeight}px` });
      }

      onStop?.();
      endHeavyAnimation();
      isAnimatingRef.current = false;

      cleanup();
    });
  });
}
