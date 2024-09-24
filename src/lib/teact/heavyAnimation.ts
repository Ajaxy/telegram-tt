import { onIdle, throttleWith } from '../../util/schedulers';
import { createSignal } from '../../util/signals';
import { requestMeasure } from '../fasterdom/fasterdom';

const AUTO_END_TIMEOUT = 1000;

let counter = 0;
let counterBlocking = 0;

const [getIsAnimating, setIsAnimating] = createSignal(false);
const [getIsBlockingAnimating, setIsBlockingAnimating] = createSignal(false);

export const getIsHeavyAnimating = getIsAnimating;
export { getIsBlockingAnimating };

export function beginHeavyAnimation(duration = AUTO_END_TIMEOUT, isBlocking = false) {
  counter++;

  if (counter === 1) {
    setIsAnimating(true);
  }

  if (isBlocking) {
    counterBlocking++;

    if (counterBlocking === 1) {
      setIsBlockingAnimating(true);
    }
  }

  const timeout = window.setTimeout(onEnd, duration);

  let hasEnded = false;

  function onEnd() {
    if (hasEnded) return;
    hasEnded = true;

    clearTimeout(timeout);

    counter--;

    if (counter === 0) {
      setIsAnimating(false);
    }

    if (isBlocking) {
      counterBlocking--;

      if (counterBlocking === 0) {
        setIsBlockingAnimating(false);
      }
    }
  }

  return onEnd;
}

export function onFullyIdle(cb: NoneToVoidFunction) {
  onIdle(() => {
    if (getIsAnimating()) {
      requestMeasure(() => {
        onFullyIdle(cb);
      });
    } else {
      cb();
    }
  });
}

export function throttleWithFullyIdle<F extends AnyToVoidFunction>(fn: F) {
  return throttleWith(onFullyIdle, fn);
}
