// Sometimes event is fired earlier than animation completes
const ANIMATION_END_DELAY = 50;

export function waitForTransitionEnd(node: Node, handler: NoneToVoidFunction, propertyName?: string) {
  waitForEndEvent('transitionend', node, handler, propertyName);
}

export function waitForAnimationEnd(node: Node, handler: NoneToVoidFunction, animationName?: string) {
  waitForEndEvent('animationend', node, handler, animationName);
}

function waitForEndEvent(
  eventType: 'transitionend' | 'animationend',
  node: Node,
  handler: NoneToVoidFunction,
  detailedName?: string,
) {
  let isHandled = false;

  node.addEventListener(eventType, function handleAnimationEnd(e: TransitionEvent | AnimationEvent) {
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

    node.removeEventListener(eventType, handleAnimationEnd as EventListener);

    setTimeout(() => {
      handler();
    }, ANIMATION_END_DELAY);
  } as EventListener);
}
