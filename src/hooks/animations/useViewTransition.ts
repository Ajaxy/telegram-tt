import {
  beginHeavyAnimation,
  useEffect,
  useRef,
  useState,
} from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { AnimationLevel } from '../../types';
import type { VTTypes } from '../../util/animations/viewTransitionTypes';

import { ANIMATION_LEVEL_MED, VT_CLASS_NAME, VT_TYPE_CLASS_PREFIX } from '../../config';
import { requestMutation, requestNextMutation } from '../../lib/fasterdom/fasterdom';
import { selectSharedSettings } from '../../global/selectors/sharedState';
import { IS_VIEW_TRANSITION_SUPPORTED } from '../../util/browser/windowEnvironment';
import Deferred from '../../util/Deferred';

type TransitionFunction = () => Promise<void> | void;

type TransitionState = 'idle' | 'capturing-old' | 'capturing-new' | 'animating' | 'skipped';
interface ViewTransitionController {
  transitionState: TransitionState;
  startViewTransition: (
    types: VTTypes, domUpdateCallback?: TransitionFunction, minimumAnimationLevel?: AnimationLevel,
  ) => PromiseLike<void> | void;
}

type ViewTransitionParameters = {
  domUpdateCallback?: TransitionFunction;
  types?: VTTypes;
};

const SKIP_TIMEOUT = 1000;

let hasActiveTransition = false;
export function hasActiveViewTransition(): boolean {
  return hasActiveTransition;
}

export function useViewTransition(): ViewTransitionController {
  const parameters = useRef<ViewTransitionParameters>();
  const [transitionState, setTransitionState] = useState<TransitionState>('idle');

  useEffect(() => {
    if (transitionState !== 'capturing-old') return;
    const { domUpdateCallback, types } = parameters.current || {};

    const onHeavyAnimationEnd = beginHeavyAnimation();
    const transition = document.startViewTransition(async () => {
      setTransitionState('capturing-new');
      if (domUpdateCallback) {
        await domUpdateCallback();
      }
      const deferred = new Deferred<void>();
      requestNextMutation(() => {
        deferred.resolve();
      });
      return deferred.promise;
    });

    types?.getTypes().forEach((type) => {
      transition.types?.add(type);
    });

    transition.finished.then(() => {
      onHeavyAnimationEnd();
      setTransitionState('idle');
      requestMutation(() => {
        cleanUp(types);
      });

      hasActiveTransition = false;
    });

    let isReady = false;

    transition.ready.then(() => {
      isReady = true;
      setTransitionState('animating');
    }).catch((e: unknown) => {
      // eslint-disable-next-line no-console
      console.error('View transition error', e, types?.getTypes());
      setTransitionState('skipped');
      requestMutation(() => {
        cleanUp(types);
      });

      hasActiveTransition = false;
    });

    setTimeout(() => {
      if (!isReady) { // Skip transition if it's not prepared in time
        transition.skipTransition();
      }
    }, SKIP_TIMEOUT);
  }, [transitionState]);

  function startViewTransition(
    types: VTTypes,
    updateCallback?: TransitionFunction,
    minimumAnimationLevel: AnimationLevel = ANIMATION_LEVEL_MED,
  ): PromiseLike<void> | void {
    const global = getGlobal();
    const { animationLevel } = selectSharedSettings(global);
    // Fallback: simply run the callback immediately if view transitions aren't supported.
    if (!IS_VIEW_TRANSITION_SUPPORTED || animationLevel < minimumAnimationLevel) {
      updateCallback?.();
      return;
    }

    if (hasActiveTransition) {
      // eslint-disable-next-line no-console
      console.warn('VT skipped because another transition is already active', types.getTypes());
      updateCallback?.();
      return;
    }

    parameters.current = {
      domUpdateCallback: updateCallback,
      types,
    };
    setTransitionState('capturing-old');
    requestMutation(() => {
      document.documentElement.classList.add(VT_CLASS_NAME);
      types.getTypes().forEach((type) => {
        document.documentElement.classList.add(`${VT_TYPE_CLASS_PREFIX}${type}`);
      });
    });

    hasActiveTransition = true;
  }

  return {
    transitionState,
    startViewTransition,
  };
}

function cleanUp(types?: VTTypes) {
  types?.getTypes().forEach((type) => {
    document.documentElement.classList.remove(`${VT_TYPE_CLASS_PREFIX}${type}`);
  });
  document.documentElement.classList.remove(VT_CLASS_NAME);
}
