import type { Scheduler } from './schedulers';

import { requestMeasure } from '../lib/fasterdom/fasterdom';

interface AnimationInstance {
  isCancelled: boolean;
}

let currentInstance: AnimationInstance | undefined;

export function animateSingle(tick: Function, schedulerFn: Scheduler, instance?: AnimationInstance) {
  if (!instance) {
    if (currentInstance && !currentInstance.isCancelled) {
      currentInstance.isCancelled = true;
    }

    instance = { isCancelled: false };
    currentInstance = instance;
  }

  if (!instance!.isCancelled && tick()) {
    schedulerFn(() => {
      animateSingle(tick, schedulerFn, instance);
    });
  }
}

export function cancelSingleAnimation() {
  const dumbScheduler = (cb: AnyFunction) => cb;
  const dumbCb = () => undefined;

  animateSingle(dumbCb, dumbScheduler);
}

export function animate(tick: Function, schedulerFn: Scheduler) {
  schedulerFn(() => {
    if (tick()) {
      animate(tick, schedulerFn);
    }
  });
}

export function animateInstantly(tick: Function, schedulerFn: Scheduler) {
  if (tick()) {
    schedulerFn(() => {
      animateInstantly(tick, schedulerFn);
    });
  }
}

type TimingFn = (t: number) => number;

type AnimateNumberProps<T extends number | number[]> = {
  to: T;
  from: T;
  duration: number;
  onUpdate: (value: T) => void;
  timing?: TimingFn;
  onEnd?: (isCanceled?: boolean) => void;
};

export const timingFunctions = {
  linear: (t: number) => t,
  easeIn: (t: number) => t ** 1.675,
  easeOut: (t: number) => -1 * t ** 1.675,
  easeInOut: (t: number) => 0.5 * (Math.sin((t - 0.5) * Math.PI) + 1),
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t ** 3,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => (t < 0.5 ? 4 * t ** 3 : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  easeInQuart: (t: number) => t ** 4,
  easeOutQuart: (t: number) => 1 - (--t) * t ** 3,
  easeInOutQuart: (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - 8 * (--t) * t ** 3),
  easeInQuint: (t: number) => t ** 5,
  easeOutQuint: (t: number) => 1 + (--t) * t ** 4,
  easeInOutQuint: (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 + 16 * (--t) * t ** 4),
};

export function animateNumber<T extends number | number[]>({
  timing = timingFunctions.linear,
  onUpdate,
  duration,
  onEnd,
  from,
  to,
}: AnimateNumberProps<T>) {
  const t0 = Date.now();

  let isCanceled = false;

  animateInstantly(() => {
    if (isCanceled) return false;

    const t1 = Date.now();
    const t = Math.min((t1 - t0) / duration, 1);

    const progress = timing(t);
    if (typeof from === 'number' && typeof to === 'number') {
      onUpdate((from + ((to - from) * progress)) as T);
    } else if (Array.isArray(from) && Array.isArray(to)) {
      const result = from.map((f, i) => f + ((to[i] - f) * progress));
      onUpdate(result as T);
    }

    if (t === 1) {
      onEnd?.();
    }

    return t < 1;
  }, requestMeasure);

  return () => {
    isCanceled = true;
    onEnd?.(true);
  };
}

export function applyStyles(element: HTMLElement, css: Record<string, string>) {
  Object.assign(element.style, css);
}
