import { DEBUG } from '../../config';

type Handler = (e: Event) => void;

const NON_BUBBLEABLE_EVENTS = new Set(['scroll', 'mouseenter', 'mouseleave']);

const delegationRegistry: Record<string, Map<HTMLElement, Handler>> = {};
const delegatedEventsByElement = new Map<HTMLElement, Set<string>>();
const documentEventCounters: Record<string, number> = {};

export function addEventListener(element: HTMLElement, propName: string, handler: Handler) {
  const eventName = resolveEventName(propName, element);
  if (canUseEventDelegation(eventName, element)) {
    addDelegatedListener(eventName, element, handler);
  } else {
    element.addEventListener(eventName, handler);
  }
}

export function removeEventListener(element: HTMLElement, propName: string, handler: Handler) {
  const eventName = resolveEventName(propName, element);
  if (canUseEventDelegation(eventName, element)) {
    removeDelegatedListener(eventName, element);
  } else {
    element.removeEventListener(eventName, handler);
  }
}

function resolveEventName(propName: string, element: HTMLElement) {
  const eventName = propName.replace(/^on/, '').toLowerCase();

  if (eventName === 'change' && element.tagName !== 'SELECT') {
    // React behavior repeated here.
    // https://stackoverflow.com/questions/38256332/in-react-whats-the-difference-between-onchange-and-oninput
    return 'input';
  }

  if (eventName === 'doubleclick') {
    return 'dblclick';
  }

  // Replace focus/blur by their "bubbleable" versions
  if (eventName === 'focus') {
    return 'focusin';
  }

  if (eventName === 'blur') {
    return 'focusout';
  }

  return eventName;
}

function canUseEventDelegation(realEventName: string, element: HTMLElement) {
  return (
    !NON_BUBBLEABLE_EVENTS.has(realEventName)
    && element.tagName !== 'VIDEO'
    && element.tagName !== 'IFRAME'
  );
}

function addDelegatedListener(eventName: string, element: HTMLElement, handler: Handler) {
  if (!documentEventCounters[eventName]) {
    documentEventCounters[eventName] = 0;
    document.addEventListener(eventName, handleEvent);
  }

  resolveDelegationRegistryForName(eventName).set(element, handler);
  resolveDelegatedEventsForElement(element).add(eventName);
  documentEventCounters[eventName]++;
}

function removeDelegatedListener(eventName: string, element: HTMLElement) {
  documentEventCounters[eventName]--;
  if (!documentEventCounters[eventName]) {
    // Synchronous deletion on 0 will cause perf degradation in the case of 1 element
    // which is not a real case, so it's ok to do it this way
    document.removeEventListener(eventName, handleEvent);
  }

  delegationRegistry[eventName].delete(element);
  delegatedEventsByElement.get(element)!.delete(eventName);
}

export function removeAllDelegatedListeners(element: HTMLElement) {
  const eventNames = delegatedEventsByElement.get(element);
  if (!eventNames) {
    return;
  }

  eventNames.forEach((eventName) => removeDelegatedListener(eventName, element));
  delegatedEventsByElement.delete(element);
}

function handleEvent(realEvent: Event) {
  const events = delegationRegistry[realEvent.type];

  if (events) {
    let furtherCallsPrevented = false;
    let current: HTMLElement = realEvent.target as HTMLElement;

    const stopPropagation = () => {
      furtherCallsPrevented = true;
    };

    const preventDefault = () => {
      realEvent.preventDefault();
    };

    // Proxy is a simplest way to provide an access to the event property
    const event = new Proxy(realEvent, {
      get(target, p) {
        if (p === 'currentTarget') {
          return current;
        }
        if (p === 'stopPropagation' || p === 'stopImmediatePropagation') {
          return stopPropagation;
        }
        if (p === 'preventDefault') {
          // "this" is changed to proxy and one can't call methods via it
          return preventDefault;
        }
        return Reflect.get(target, p);
      },
    });

    // This can also be limited by teact root
    while (current && current !== document.body) {
      const handler = events.get(current);
      if (handler) {
        handler(event);
        if (furtherCallsPrevented) {
          return;
        }
      }

      current = current.parentNode as HTMLElement;
    }
  }
}

function resolveDelegationRegistryForName(eventName: string) {
  if (!delegationRegistry[eventName]) {
    delegationRegistry[eventName] = new Map();
  }

  return delegationRegistry[eventName];
}

function resolveDelegatedEventsForElement(element: HTMLElement) {
  const existing = delegatedEventsByElement.get(element);
  if (existing) {
    return existing;
  }

  const newSet = new Set<string>();
  delegatedEventsByElement.set(element, newSet);

  return newSet;
}

if (DEBUG) {
  document.addEventListener('dblclick', () => {
    // eslint-disable-next-line no-console
    console.log('DELEGATED EVENTS', { delegationRegistry, delegatedEventsByElement, documentEventCounters });
  });
}
