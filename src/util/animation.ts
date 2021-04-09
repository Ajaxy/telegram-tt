import { fastRaf } from './schedulers';

interface AnimationInstance {
  isCancelled: boolean;
}

let currentInstance: AnimationInstance | undefined;

export function animateSingle(tick: Function, instance?: AnimationInstance) {
  if (!instance) {
    if (currentInstance && !currentInstance.isCancelled) {
      currentInstance.isCancelled = true;
    }

    instance = { isCancelled: false };
    currentInstance = instance;
  }

  fastRaf(() => {
    if (!instance!.isCancelled && tick()) {
      animateSingle(tick, instance);
    }
  });
}

export function animate(tick: Function) {
  fastRaf(() => {
    if (tick()) {
      animate(tick);
    }
  });
}
