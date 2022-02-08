import { RefObject } from 'react';
import React, {
  FC, useLayoutEffect, useRef,
} from '../../lib/teact/teact';
import { getGlobal } from '../../lib/teact/teactn';
import { GlobalState } from '../../global/types';

import { ANIMATION_LEVEL_MIN } from '../../config';
import buildClassName from '../../util/buildClassName';
import forceReflow from '../../util/forceReflow';
import { waitForAnimationEnd, waitForTransitionEnd } from '../../util/cssAnimationEndListeners';
import useForceUpdate from '../../hooks/useForceUpdate';
import usePrevious from '../../hooks/usePrevious';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';

import './Transition.scss';

type ChildrenFn = (isActive: boolean, isFrom: boolean, currentKey: number) => any;
export type TransitionProps = {
  ref?: RefObject<HTMLDivElement>;
  activeKey: number;
  name: (
    'none' | 'slide' | 'slide-rtl' | 'mv-slide' | 'slide-fade' | 'zoom-fade' | 'slide-layers'
    | 'fade' | 'push-slide' | 'reveal' | 'slide-optimized' | 'slide-optimized-rtl'
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
  children: ChildrenFn;
};

const classNames = {
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

  const rendersRef = useRef<Record<number, ChildrenFn>>({});
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
      if (name.startsWith('slide-optimized')) {
        (childElements[0] as HTMLElement).style.transition = 'none';
        (childElements[0] as HTMLElement).style.transform = 'translate3d(0, 0, 0)';
      }

      childElements[0].classList.add(classNames.active);

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

    container.classList.remove('animating');
    container.classList.toggle('backwards', isBackwards);

    if (name === 'none' || animationLevel === ANIMATION_LEVEL_MIN) {
      childNodes.forEach((node, i) => {
        if (node instanceof HTMLElement) {
          node.classList.remove('from', 'through', 'to');
          node.classList.toggle(classNames.active, i === activeIndex);
        }
      });

      cleanup();

      return;
    }

    childNodes.forEach((node, i) => {
      if (node instanceof HTMLElement) {
        node.classList.remove(classNames.active);
        node.classList.toggle('from', i === prevActiveIndex);
        node.classList.toggle('through', (
          (i > prevActiveIndex && i < activeIndex) || (i < prevActiveIndex && i > activeIndex)
        ));
        node.classList.toggle('to', i === activeIndex);
      }
    });

    const dispatchHeavyAnimationStop = dispatchHeavyAnimationEvent();

    requestAnimationFrame(() => {
      container.classList.add('animating');

      onStart?.();

      function onAnimationEnd() {
        requestAnimationFrame(() => {
          if (activeKey !== currentKeyRef.current) {
            return;
          }

          container.classList.remove('animating', 'backwards');

          childNodes.forEach((node, i) => {
            if (node instanceof HTMLElement) {
              node.classList.remove('from', 'through', 'to');
              node.classList.toggle(classNames.active, i === activeIndex);
            }
          });

          if (shouldRestoreHeight) {
            const activeElement = container.querySelector<HTMLDivElement>(`.${classNames.active}`);

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
        waitForAnimationEnd(watchedNode, onAnimationEnd);
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
      const activeElement = container.querySelector<HTMLDivElement>(`.${classNames.active}`)
        || container.querySelector<HTMLDivElement>('.from');

      if (activeElement) {
        activeElement.style.height = 'auto';
        container.style.height = `${activeElement.clientHeight}px`;
        container.style.flexBasis = `${activeElement.clientHeight}px`;
      }
    }
  }, [shouldRestoreHeight, children]);

  const renders = rendersRef.current;
  const collection = Object.keys(renderCount ? new Array(renderCount).fill(undefined) : renders).map(Number);

  const contents = collection.map((key) => {
    const render = renders[key];
    if (!render) {
      return undefined;
    }

    return (
      <div key={key} teactOrderKey={key}>{render(key === activeKey, key === prevActiveKey, activeKey)}</div>
    );
  });

  return (
    <div
      ref={containerRef}
      id={id}
      className={buildClassName('Transition', className, name)}
      teactFastList={!renderCount && !shouldCleanup}
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
    fromSlide.classList.remove(classNames.active);

    toSlide.style.transition = 'none';
    toSlide.style.transform = 'translate3d(0, 0, 0)';
    toSlide.classList.add(classNames.active);

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

    fromSlide.classList.remove(classNames.active);
    toSlide.classList.add(classNames.active);

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
