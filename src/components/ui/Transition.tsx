import type { RefObject } from 'react';
import type { FC } from '../../lib/teact/teact';
import React, { useLayoutEffect, useRef } from '../../lib/teact/teact';
import { addExtraClass, removeExtraClass, toggleExtraClass } from '../../lib/teact/teact-dom';
import { getGlobal } from '../../global';

import type { GlobalState } from '../../global/types';

import { ANIMATION_LEVEL_MIN } from '../../config';
import buildClassName from '../../util/buildClassName';
import forceReflow from '../../util/forceReflow';
import { waitForAnimationEnd, waitForTransitionEnd } from '../../util/cssAnimationEndListeners';
import useForceUpdate from '../../hooks/useForceUpdate';
import usePrevious from '../../hooks/usePrevious';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';

import './Transition.scss';

export type ChildrenFn = (isActive: boolean, isFrom: boolean, currentKey: number) => React.ReactNode;
export type TransitionProps = {
  ref?: RefObject<HTMLDivElement>;
  activeKey: number;
  name: (
    'none' | 'slide' | 'slide-rtl' | 'mv-slide' | 'slide-fade' | 'zoom-fade' | 'slide-layers'
    | 'fade' | 'push-slide' | 'reveal' | 'slide-optimized' | 'slide-optimized-rtl' | 'slide-vertical'
    | 'slide-vertical-fade'
  );
  direction?: 'auto' | 'inverse' | 1 | -1;
  renderCount?: number;
  shouldRestoreHeight?: boolean;
  shouldCleanup?: boolean;
  cleanupExceptionKey?: number;
  isDisabled?: boolean;
  id?: string;
  className?: string;
  onStart?: NoneToVoidFunction;
  onStop?: NoneToVoidFunction;
  children: React.ReactNode | ChildrenFn;
};

const FALLBACK_ANIMATION_END = 1000;
const CLASSES = {
  active: 'Transition__slide--active',
};

const Transition: FC<TransitionProps> = ({
  ref,
  activeKey,
  name,
  direction = 'auto',
  renderCount,
  shouldRestoreHeight,
  shouldCleanup,
  cleanupExceptionKey,
  id,
  className,
  onStart,
  onStop,
  children,
}) => {
  // No need for a container to update on change
  const { animationLevel } = getGlobal().settings.byKey;
  const currentKeyRef = useRef<number>();

  // eslint-disable-next-line no-null/no-null
  let containerRef = useRef<HTMLDivElement>(null);
  if (ref) {
    containerRef = ref;
  }

  const rendersRef = useRef<Record<number, React.ReactNode | ChildrenFn>>({});
  const prevActiveKey = usePrevious<any>(activeKey);
  const forceUpdate = useForceUpdate();

  const activeKeyChanged = prevActiveKey !== undefined && activeKey !== prevActiveKey;

  if (!renderCount && activeKeyChanged) {
    rendersRef.current = { [prevActiveKey]: rendersRef.current[prevActiveKey] };
  }

  rendersRef.current[activeKey] = children;

  useLayoutEffect(() => {
    function cleanup() {
      if (!shouldCleanup) {
        return;
      }

      const preservedRender = cleanupExceptionKey !== undefined ? rendersRef.current[cleanupExceptionKey] : undefined;

      rendersRef.current = preservedRender ? { [cleanupExceptionKey!]: preservedRender } : {};

      forceUpdate();
    }

    const container = containerRef.current!;
    const childElements = container.children;

    if (childElements.length === 1 && !activeKeyChanged) {
      const firstChild = childElements[0] as HTMLElement;
      if (name.startsWith('slide-optimized')) {
        firstChild.style.transition = 'none';
        firstChild.style.transform = 'translate3d(0, 0, 0)';
      }

      addExtraClass(firstChild, CLASSES.active);

      return;
    }

    const childNodes = Array.from(container.childNodes);
    if (!activeKeyChanged || !childNodes.length) {
      return;
    }

    currentKeyRef.current = activeKey;

    const isBackwards = (
      direction === -1
      || (direction === 'auto' && prevActiveKey > activeKey)
      || (direction === 'inverse' && prevActiveKey < activeKey)
    );

    const keys = Object.keys(rendersRef.current).map(Number);
    const prevActiveIndex = renderCount ? prevActiveKey : keys.indexOf(prevActiveKey);
    const activeIndex = renderCount ? activeKey : keys.indexOf(activeKey);

    if (name === 'slide-optimized' || name === 'slide-optimized-rtl') {
      performSlideOptimized(
        animationLevel,
        name,
        isBackwards,
        cleanup,
        activeKey,
        currentKeyRef,
        container,
        shouldRestoreHeight,
        onStart,
        onStop,
        childNodes[activeIndex] as HTMLElement,
        childNodes[prevActiveIndex] as HTMLElement,
      );

      return;
    }

    removeExtraClass(container, 'animating');
    toggleExtraClass(container, 'backwards', isBackwards);

    if (name === 'none' || animationLevel === ANIMATION_LEVEL_MIN) {
      childNodes.forEach((node, i) => {
        if (node instanceof HTMLElement) {
          removeExtraClass(node, 'from');
          removeExtraClass(node, 'through');
          removeExtraClass(node, 'to');
          toggleExtraClass(node, CLASSES.active, i === activeIndex);
        }
      });

      cleanup();

      return;
    }

    childNodes.forEach((node, i) => {
      if (node instanceof HTMLElement) {
        removeExtraClass(node, CLASSES.active);

        toggleExtraClass(node, 'from', i === prevActiveIndex);
        const isThrough = (i > prevActiveIndex && i < activeIndex) || (i < prevActiveIndex && i > activeIndex);
        toggleExtraClass(node, 'through', isThrough);
        toggleExtraClass(node, 'to', i === activeIndex);
      }
    });

    const dispatchHeavyAnimationStop = dispatchHeavyAnimationEvent();

    requestAnimationFrame(() => {
      addExtraClass(container, 'animating');

      onStart?.();

      function onAnimationEnd() {
        requestAnimationFrame(() => {
          if (activeKey !== currentKeyRef.current) {
            return;
          }

          removeExtraClass(container, 'animating');
          removeExtraClass(container, 'backwards');

          childNodes.forEach((node, i) => {
            if (node instanceof HTMLElement) {
              removeExtraClass(node, 'from');
              removeExtraClass(node, 'through');
              removeExtraClass(node, 'to');
              toggleExtraClass(node, CLASSES.active, i === activeIndex);
            }
          });

          if (shouldRestoreHeight) {
            const activeElement = container.querySelector<HTMLDivElement>(`.${CLASSES.active}`);

            if (activeElement) {
              activeElement.style.height = 'auto';
              container.style.height = `${activeElement.clientHeight}px`;
            }
          }

          onStop?.();
          dispatchHeavyAnimationStop();
          cleanup();
        });
      }

      const watchedNode = name === 'mv-slide'
        ? childNodes[activeIndex]?.firstChild
        : name === 'reveal' && isBackwards
          ? childNodes[prevActiveIndex]
          : childNodes[activeIndex];

      if (watchedNode) {
        waitForAnimationEnd(watchedNode, onAnimationEnd, undefined, FALLBACK_ANIMATION_END);
      } else {
        onAnimationEnd();
      }
    });
  }, [
    activeKey,
    prevActiveKey,
    activeKeyChanged,
    direction,
    name,
    onStart,
    onStop,
    renderCount,
    shouldRestoreHeight,
    shouldCleanup,
    cleanupExceptionKey,
    animationLevel,
    forceUpdate,
  ]);

  useLayoutEffect(() => {
    if (shouldRestoreHeight) {
      const container = containerRef.current!;
      const activeElement = container.querySelector<HTMLDivElement>(`.${CLASSES.active}`)
        || container.querySelector<HTMLDivElement>('.from');
      const clientHeight = activeElement?.clientHeight;
      if (!clientHeight) {
        return;
      }

      activeElement.style.height = 'auto';
      container.style.height = `${clientHeight}px`;
      container.style.flexBasis = `${clientHeight}px`;
    }
  }, [shouldRestoreHeight, children]);

  const asFastList = !renderCount;
  const renders = rendersRef.current;
  const renderKeys = Object.keys(renderCount ? new Array(renderCount).fill(undefined) : renders).map(Number);
  const contents = renderKeys.map((key) => {
    const render = renders[key];
    if (!render) {
      return undefined;
    }

    return (
      <div key={key} teactOrderKey={key}>{
        typeof render === 'function'
          ? render(key === activeKey, key === prevActiveKey, activeKey)
          : render
      }
      </div>
    );
  });

  return (
    <div
      ref={containerRef}
      id={id}
      className={buildClassName('Transition', className, name)}
      teactFastList={asFastList}
    >
      {contents}
    </div>
  );
};

export default Transition;

function performSlideOptimized(
  animationLevel: GlobalState['settings']['byKey']['animationLevel'],
  name: 'slide-optimized' | 'slide-optimized-rtl',
  isBackwards: boolean,
  cleanup: NoneToVoidFunction,
  activeKey: number,
  currentKeyRef: { current: number | undefined },
  container: HTMLElement,
  shouldRestoreHeight?: boolean,
  onStart?: NoneToVoidFunction,
  onStop?: NoneToVoidFunction,
  toSlide?: HTMLElement,
  fromSlide?: HTMLElement,
) {
  if (!fromSlide || !toSlide) {
    return;
  }

  if (animationLevel === ANIMATION_LEVEL_MIN) {
    fromSlide.style.transition = 'none';
    fromSlide.style.transform = '';
    removeExtraClass(fromSlide, CLASSES.active);

    toSlide.style.transition = 'none';
    toSlide.style.transform = 'translate3d(0, 0, 0)';
    addExtraClass(toSlide, CLASSES.active);

    cleanup();

    return;
  }

  if (name === 'slide-optimized-rtl') {
    isBackwards = !isBackwards;
  }

  const dispatchHeavyAnimationStop = dispatchHeavyAnimationEvent();

  requestAnimationFrame(() => {
    onStart?.();

    fromSlide.style.transition = 'none';
    fromSlide.style.transform = 'translate3d(0, 0, 0)';

    toSlide.style.transition = 'none';
    toSlide.style.transform = `translate3d(${isBackwards ? '-' : ''}100%, 0, 0)`;

    forceReflow(toSlide);

    fromSlide.style.transition = '';
    fromSlide.style.transform = `translate3d(${isBackwards ? '' : '-'}100%, 0, 0)`;

    toSlide.style.transition = '';
    toSlide.style.transform = 'translate3d(0, 0, 0)';

    removeExtraClass(fromSlide, CLASSES.active);
    addExtraClass(toSlide, CLASSES.active);

    waitForTransitionEnd(fromSlide, () => {
      if (activeKey !== currentKeyRef.current) {
        return;
      }

      fromSlide.style.transition = 'none';
      fromSlide.style.transform = '';

      if (shouldRestoreHeight) {
        toSlide.style.height = 'auto';
        container.style.height = `${toSlide.clientHeight}px`;
      }

      onStop?.();
      dispatchHeavyAnimationStop();
      cleanup();
    });
  });
}
