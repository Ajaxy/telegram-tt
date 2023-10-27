// Sometimes event is fired earlier than animation completes
const ANIMATION_END_DELAY = 50;

export function waitForTransitionEnd(
  node: Node, handler: NoneToVoidFunction, propertyName?: string, fallbackMs?: number,
) {
  return waitForEndEvent('transitionend', node, handler, propertyName, fallbackMs);
}

export function waitForAnimationEnd(
  node: Node, handler: NoneToVoidFunction, animationName?: string, fallbackMs?: number,
) {
  return waitForEndEvent('animationend', node, handler, animationName, fallbackMs);
}

function waitForEndEvent(
  eventType: 'transitionend' | 'animationend',
  node: Node,
  handler: NoneToVoidFunction,
  detailedName?: string,
  fallbackMs?: number,
) {
  let isHandled = false;

  function cleanup() {
    node.removeEventListener(eventType, handleAnimationEnd);
  }

  function handleAnimationEnd(e: TransitionEvent | AnimationEvent | Event) {
    if (isHandled || e.target !== e.currentTarget) {
      return;
    }

    if (detailedName && (
      (e instanceof TransitionEvent && e.propertyName === detailedName)
      || (e instanceof AnimationEvent && e.animationName === detailedName)
    )) {
      return;
    }

    isHandled = true;

    cleanup();

    setTimeout(() => {
      handler();
    }, ANIMATION_END_DELAY);
  }

  node.addEventListener(eventType, handleAnimationEnd);

  if (fallbackMs) {
    setTimeout(() => {
      if (isHandled) return;

      cleanup();

      handler();
    }, fallbackMs);
  }

  return cleanup;
}
