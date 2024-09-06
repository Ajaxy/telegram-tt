import type { RefObject } from 'react';
import { useLayoutEffect, useRef, useSignal } from '../lib/teact/teact';
import { addExtraClass, toggleExtraClass } from '../lib/teact/teact-dom';

import { requestMeasure } from '../lib/fasterdom/fasterdom';
import useDerivedState from './useDerivedState';
import useLastCallback from './useLastCallback';
import { useStateRef } from './useStateRef';
import useSyncEffectWithPrevDeps from './useSyncEffectWithPrevDeps';

const CLOSE_DURATION = 350;

type State =
  'closed'
  | 'scheduled-open'
  | 'open'
  | 'closing';

export default function useShowTransition<RefType extends HTMLElement = HTMLDivElement>({
  isOpen,
  ref,
  noMountTransition = false,
  noOpenTransition = false,
  noCloseTransition = false,
  closeDuration = CLOSE_DURATION,
  className = 'fast',
  prefix = '',
  onCloseAnimationEnd,
  withShouldRender,
}: {
  isOpen: boolean | undefined;
  ref?: RefObject<RefType>;
  noMountTransition?: boolean;
  noOpenTransition?: boolean;
  noCloseTransition?: boolean;
  closeDuration?: number;
  className?: string | false;
  prefix?: string;
  withShouldRender?: boolean;
  onCloseAnimationEnd?: NoneToVoidFunction;
}) {
  // eslint-disable-next-line no-null/no-null
  const localRef = useRef<RefType>(null);
  ref ||= localRef;
  const closingTimeoutRef = useRef<number>();
  const [getState, setState] = useSignal<State | undefined>();
  const optionsRef = useStateRef({
    closeDuration, noMountTransition, noOpenTransition, noCloseTransition,
  });
  const onCloseEndLast = useLastCallback(onCloseAnimationEnd);

  useSyncEffectWithPrevDeps(([prevIsOpen]) => {
    const options = optionsRef.current;

    if (isOpen) {
      if (closingTimeoutRef.current) {
        clearTimeout(closingTimeoutRef.current);
        closingTimeoutRef.current = undefined;
      }

      if (options.noOpenTransition || (prevIsOpen === undefined && options.noMountTransition)) {
        setState('open');
      } else {
        setState('scheduled-open');
        requestMeasure(() => {
          setState('open');
        });
      }
    } else if (prevIsOpen === undefined || options.noCloseTransition) {
      setState('closed');
    } else {
      setState('closing');

      closingTimeoutRef.current = window.setTimeout(() => {
        setState('closed');
        onCloseEndLast();
      }, options.closeDuration);
    }
  }, [isOpen]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    addExtraClass(element, 'opacity-transition');
    if (className !== false) {
      addExtraClass(element, className);
    }

    const state = getState();
    const shouldRender = state !== 'closed';
    const hasOpenClass = state === 'open';
    const isClosing = state === 'closing';

    toggleExtraClass(element, `${prefix}shown`, shouldRender);
    toggleExtraClass(element, `${prefix}not-shown`, !shouldRender);
    toggleExtraClass(element, `${prefix}open`, hasOpenClass);
    toggleExtraClass(element, `${prefix}not-open`, !hasOpenClass);
    toggleExtraClass(element, `${prefix}closing`, isClosing);
  }, [className, getState, prefix, ref]);

  const shouldRender = useDerivedState(
    () => (withShouldRender && getState() !== 'closed'),
    [withShouldRender, getState],
  );

  return { ref, shouldRender };
}
