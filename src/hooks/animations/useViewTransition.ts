import {
  useEffect,
  useRef,
  useState,
} from '../../lib/teact/teact';

import { requestNextMutation } from '../../lib/fasterdom/fasterdom';
import Deferred from '../../util/Deferred';
import { IS_VIEW_TRANSITION_SUPPORTED } from '../../util/windowEnvironment';

type TransitionFunction = () => Promise<void> | void;

type TransitionState = 'idle' | 'capturing-old' | 'capturing-new' | 'animating' | 'skipped';
interface ViewTransitionController {
  transitionState: TransitionState;
  shouldApplyVtn?: boolean;
  startViewTransition: (domUpdateCallback?: TransitionFunction) => PromiseLike<void> | void;
}

let hasActiveTransition = false;
export function hasActiveViewTransition(): boolean {
  return hasActiveTransition;
}

export function useViewTransition(): ViewTransitionController {
  const domUpdaterFn = useRef<TransitionFunction>();
  const [transitionState, setTransitionState] = useState<TransitionState>('idle');

  useEffect(() => {
    if (transitionState !== 'capturing-old') return;

    const transition = document.startViewTransition(async () => {
      setTransitionState('capturing-new');
      if (domUpdaterFn.current) await domUpdaterFn.current();
      const deferred = new Deferred<void>();
      requestNextMutation(() => {
        deferred.resolve();
      });
      return deferred.promise;
    });

    transition.finished.then(() => {
      setTransitionState('idle');
      hasActiveTransition = false;
    });

    transition.ready.then(() => {
      setTransitionState('animating');
    }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      setTransitionState('skipped');
      hasActiveTransition = false;
    });
  }, [transitionState]);

  function startViewTransition(updateCallback?: TransitionFunction): PromiseLike<void> | void {
    // Fallback: simply run the callback immediately if view transitions aren't supported.
    if (!IS_VIEW_TRANSITION_SUPPORTED) {
      if (updateCallback) updateCallback();
      return;
    }

    domUpdaterFn.current = updateCallback;
    setTransitionState('capturing-old');
    hasActiveTransition = true;
  }

  return {
    shouldApplyVtn: transitionState === 'capturing-old'
      || transitionState === 'capturing-new' || transitionState === 'animating',
    transitionState,
    startViewTransition,
  };
}
