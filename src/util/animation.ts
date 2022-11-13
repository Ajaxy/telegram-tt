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

  if (!instance!.isCancelled && tick()) {
    fastRaf(() => {
      animateSingle(tick, instance);
    });
  }
}

export function animate(tick: Function) {
  fastRaf(() => {
    if (tick()) {
      animate(tick);
    }
  });
}

export function animateInstantly(tick: Function) {
  if (tick()) {
    fastRaf(() => {
      animateInstantly(tick);
    });
  }
}

export type TimingFn = (t: number) => number;

export type AnimateNumberProps = {
  to: number | number[];
  from: number | number[];
  duration: number;
  onUpdate: (value: any) => void;
  timing?: TimingFn;
  onEnd?: () => void;
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

export function animateNumber({
  timing = timingFunctions.linear,
  onUpdate,
  duration,
  onEnd,
  from,
  to,
}: AnimateNumberProps) {
  const t0 = Date.now();
  let canceled = false;

  animateInstantly(() => {
    if (canceled) return false;
    const t1 = Date.now();
    let t = (t1 - t0) / duration;
    if (t > 1) t = 1;
    const progress = timing(t);
    if (typeof from === 'number' && typeof to === 'number') {
      onUpdate(from + ((to - from) * progress));
    } else if (Array.isArray(from) && Array.isArray(to)) {
      const result = from.map((f, i) => f + ((to[i] - f) * progress));
      onUpdate(result);
    }
    if (t === 1 && onEnd) onEnd();
    return t < 1;
  });

  return () => {
    canceled = true;
    if (onEnd) onEnd();
  };
}
