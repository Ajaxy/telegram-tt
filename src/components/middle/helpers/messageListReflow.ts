import { requestForcedReflow } from '../../../lib/fasterdom/fasterdom';

type ReflowCallback = () => (NoneToVoidFunction | void);

let afterReflowCallbacks: ReflowCallback[] = [];

// For children effects that need to run after the message list reflow
export function requestAfterMessageListReflow(cb: ReflowCallback) {
  afterReflowCallbacks.push(cb);
}

export function requestMessageListReflow(cb: ReflowCallback) {
  requestForcedReflow(() => {
    const mutationFn = cb();

    const callbacks = afterReflowCallbacks;
    afterReflowCallbacks = [];
    for (const afterCb of callbacks) {
      requestForcedReflow(afterCb);
    }

    return mutationFn;
  });
}
