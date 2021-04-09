import { RefObject } from 'react';
import React, {
  FC, useLayoutEffect, useRef,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { ANIMATION_END_DELAY } from '../../config';
import { IS_MOBILE_SCREEN } from '../../util/environment';
import useForceUpdate from '../../hooks/useForceUpdate';
import usePrevious from '../../hooks/usePrevious';
import buildClassName from '../../util/buildClassName';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';

import './Transition.scss';

type ChildrenFn = (isActive: boolean, isFrom: boolean) => any;
type OwnProps = {
  ref?: RefObject<HTMLDivElement>;
  activeKey: number;
  name: (
    'none' | 'slide' | 'mv-slide' | 'slide-fade' | 'zoom-fade' | 'scroll-slide' | 'fade' | 'slide-layers'
    | 'push-slide' | 'reveal'
  );
  direction?: 'auto' | 'inverse' | 1 | -1;
  renderCount?: number;
  shouldRestoreHeight?: boolean;
  shouldCleanup?: boolean;
  id?: string;
  className?: string;
  onStart?: () => void;
  onStop?: () => void;
  children: ChildrenFn;
};

type StateProps = {
  animationLevel: number;
};

const ANIMATION_DURATION = {
  slide: 450,
  'mv-slide': 400,
  'slide-fade': 400,
  'zoom-fade': 150,
  'scroll-slide': 500,
  fade: 150,
  'slide-layers': IS_MOBILE_SCREEN ? 450 : 300,
  'push-slide': 300,
  reveal: 350,
};

const CLEANED_UP = Symbol('CLEANED_UP');

const Transition: FC<OwnProps & StateProps> = ({
  ref,
  activeKey,
  name,
  direction = 'auto',
  renderCount,
  shouldRestoreHeight,
  shouldCleanup,
  id,
  className,
  onStart,
  onStop,
  children,
  animationLevel,
}) => {
  // eslint-disable-next-line no-null/no-null
  let containerRef = useRef<HTMLDivElement>(null);
  if (ref) {
    containerRef = ref;
  }

  const rendersRef = useRef<Record<number, ChildrenFn | typeof CLEANED_UP>>({});
  const prevActiveKey = usePrevious<any>(activeKey);
  const activateTimeoutRef = useRef<number>();
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

      rendersRef.current = { [prevActiveKey]: CLEANED_UP };
      forceUpdate();
    }

    const container = containerRef.current!;

    const childElements = container.children;
    if (childElements.length === 1 && !activeKeyChanged) {
      childElements[0].classList.add('active');

      return;
    }

    const childNodes = Array.from(container.childNodes);

    if (!activeKeyChanged || !childNodes.length) {
      return;
    }

    if (activateTimeoutRef.current) {
      clearTimeout(activateTimeoutRef.current);
      activateTimeoutRef.current = undefined;
    }

    const isBackwards = (
      direction === -1
      || (direction === 'auto' && prevActiveKey > activeKey)
      || (direction === 'inverse' && prevActiveKey < activeKey)
    );

    container.classList.remove('animating');
    container.classList.toggle('backwards', isBackwards);

    const keys = Object.keys(rendersRef.current).map(Number);
    const prevActiveIndex = renderCount ? prevActiveKey : keys.indexOf(prevActiveKey);
    const activeIndex = renderCount ? activeKey : keys.indexOf(activeKey);

    if (name === 'none' || animationLevel === 0) {
      childNodes.forEach((node, i) => {
        if (node instanceof HTMLElement) {
          node.classList.remove('from', 'through', 'to');
          node.classList.toggle('active', i === activeIndex);
        }
      });

      cleanup();

      return;
    }

    childNodes.forEach((node, i) => {
      if (node instanceof HTMLElement) {
        node.classList.remove('active');
        node.classList.toggle('from', i === prevActiveIndex);
        node.classList.toggle('through', (
          (i > prevActiveIndex && i < activeIndex) || (i < prevActiveIndex && i > activeIndex)
        ));
        node.classList.toggle('to', i === activeIndex);
      }
    });

    if (name === 'scroll-slide') {
      const width = container.offsetWidth;
      container.scrollBy({
        left: activeIndex > prevActiveIndex ? width : -width,
        behavior: 'smooth',
      });
    }

    if (animationLevel > 0) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION[name] + ANIMATION_END_DELAY);
    }

    requestAnimationFrame(() => {
      container.classList.add('animating');

      activateTimeoutRef.current = window.setTimeout(() => {
        requestAnimationFrame(() => {
          container.classList.remove('animating', 'backwards');

          childNodes.forEach((node, i) => {
            if (node instanceof HTMLElement) {
              node.classList.remove('from', 'through', 'to');
              node.classList.toggle('active', i === activeIndex);
            }
          });

          if (name === 'scroll-slide') {
            container.scrollLeft = activeKey * container.offsetWidth;
          }

          if (shouldRestoreHeight) {
            const activeElement = container.querySelector<HTMLDivElement>('.active');

            if (activeElement) {
              activeElement.style.height = 'auto';
              container.style.height = `${activeElement.clientHeight}px`;
            }
          }

          cleanup();

          if (onStop) {
            onStop();
          }
        });
      }, ANIMATION_DURATION[name] + ANIMATION_END_DELAY);

      if (onStart) {
        onStart();
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
    animationLevel,
    forceUpdate,
  ]);

  useLayoutEffect(() => {
    if (shouldRestoreHeight) {
      const container = containerRef.current!;
      const activeElement = container.querySelector<HTMLDivElement>('.active')
        || container.querySelector<HTMLDivElement>('.from');

      if (activeElement) {
        activeElement.style.height = 'auto';
        container.style.height = `${activeElement.clientHeight}px`;
      }
    }
  }, [shouldRestoreHeight, children]);

  const renders = rendersRef.current;
  const collection = Object.keys(renderCount ? new Array(renderCount).fill(undefined) : renders).map(Number);
  const contents = collection.map((key) => {
    const render = renders[key];

    return (
      typeof render === 'function' ? <div key={key}>{render(key === activeKey, key === prevActiveKey)}</div> : undefined
    );
  });

  const fullClassName = buildClassName(
    'Transition',
    className,
    animationLevel === 0 && name === 'scroll-slide' ? 'slide' : name,
  );

  return (
    <div ref={containerRef} id={id} className={fullClassName}>
      {contents}
    </div>
  );
};

export default withGlobal<OwnProps>((global) => {
  const { animationLevel } = global.settings.byKey;
  return { animationLevel };
})(Transition);
