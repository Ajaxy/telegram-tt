import { fastRaf } from '../schedulers';

export type Scheduler = typeof requestAnimationFrame | typeof fastRaf;

export function waitCurrentTransitionsEnd(element: HTMLElement) {
  return Promise.allSettled(
    element.getAnimations({ subtree: true })
      .filter((a) => a instanceof CSSTransition)
      .map((a) => a.finished),
  );
}

export function waitStartingTransitionsEnd(element: HTMLElement, scheduler: Scheduler = fastRaf) {
  return new Promise<void>((resolve) => {
    scheduler(() => {
      waitCurrentTransitionsEnd(element).then(() => resolve());
    });
  });
}
