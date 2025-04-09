import { DEBUG } from '../../config';

type Handler = (e: Event) => void;
type DelegationRegistry = Map<Element, Handler>;

const NON_BUBBLEABLE_EVENTS = new Set(['scroll', 'mouseenter', 'mouseleave', 'load', 'error']);

const documentEventCounters: Record<string, number> = {};
const delegationRegistryByEventType: Record<string, DelegationRegistry> = {};
const delegatedEventTypesByElement = new Map<Element, Set<string>>();

export function addEventListener(element: Element, propName: string, handler: Handler, asCapture = false) {
  const eventType = resolveEventType(propName, element);
  if (canUseEventDelegation(eventType, element, asCapture)) {
    addDelegatedListener(eventType, element, handler);
  } else {
    element.addEventListener(eventType, handler, asCapture);
  }
}

export function removeEventListener(element: Element, propName: string, handler: Handler, asCapture = false) {
  const eventType = resolveEventType(propName, element);
  if (canUseEventDelegation(eventType, element, asCapture)) {
    removeDelegatedListener(eventType, element);
  } else {
    element.removeEventListener(eventType, handler, asCapture);
  }
}

export function resolveEventType(propName: string, element: Element) {
  const eventType = propName
    .replace(/^on/, '')
    .replace(/Capture$/, '').toLowerCase();

  if (eventType === 'change' && element.tagName !== 'SELECT') {
    // React behavior repeated here.
    // https://stackoverflow.com/questions/38256332/in-react-whats-the-difference-between-onchange-and-oninput
    return 'input';
  }

  if (eventType === 'doubleclick') {
    return 'dblclick';
  }

  // Replace focus/blur by their "bubbleable" versions
  if (eventType === 'focus') {
    return 'focusin';
  }

  if (eventType === 'blur') {
    return 'focusout';
  }

  return eventType;
}

function canUseEventDelegation(realEventType: string, element: Element, asCapture: boolean) {
  return (
    !asCapture
    && !NON_BUBBLEABLE_EVENTS.has(realEventType)
    && element.tagName !== 'VIDEO'
    && element.tagName !== 'IFRAME'
  );
}

function addDelegatedListener(eventType: string, element: Element, handler: Handler) {
  if (!documentEventCounters[eventType]) {
    documentEventCounters[eventType] = 0;
    document.addEventListener(eventType, handleEvent);
  }

  resolveDelegationRegistry(eventType).set(element, handler);
  resolveDelegatedEventTypes(element).add(eventType);
  documentEventCounters[eventType]++;
}

function removeDelegatedListener(eventType: string, element: Element) {
  documentEventCounters[eventType]--;
  if (!documentEventCounters[eventType]) {
    // Synchronous deletion on 0 will cause perf degradation in the case of 1 element
    // which is not a real case, so it's ok to do it this way
    document.removeEventListener(eventType, handleEvent);
  }

  delegationRegistryByEventType[eventType].delete(element);
  delegatedEventTypesByElement.get(element)!.delete(eventType);
}

export function removeAllDelegatedListeners(element: Element) {
  const eventTypes = delegatedEventTypesByElement.get(element);
  if (!eventTypes) {
    return;
  }

  eventTypes.forEach((eventType) => removeDelegatedListener(eventType, element));
  delegatedEventTypesByElement.delete(element);
}

function handleEvent(realEvent: Event) {
  const events = delegationRegistryByEventType[realEvent.type];

  if (events) {
    let furtherCallsPrevented = false;
    let current: Element = realEvent.target as Element;

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

      current = current.parentNode as Element;
    }
  }
}

function resolveDelegationRegistry(eventType: string) {
  if (!delegationRegistryByEventType[eventType]) {
    delegationRegistryByEventType[eventType] = new Map();
  }

  return delegationRegistryByEventType[eventType];
}

function resolveDelegatedEventTypes(element: Element) {
  const existing = delegatedEventTypesByElement.get(element);
  if (existing) {
    return existing;
  }

  const newSet = new Set<string>();
  delegatedEventTypesByElement.set(element, newSet);

  return newSet;
}

if (DEBUG) {
  document.addEventListener('dblclick', () => {
    const documentListenersCount = Object.keys(documentEventCounters).length;
    const delegatedHandlersCount1 = Object.values(documentEventCounters)
      .reduce((acc, counter) => acc + counter, 0);
    const delegationRegistriesCount = Object.keys(delegationRegistryByEventType).length;
    const delegatedHandlersCount2 = Object.values(delegationRegistryByEventType)
      .reduce((acc, delegationRegistry) => acc + delegationRegistry.size, 0);
    const delegationElementsCount = delegatedEventTypesByElement.size;
    const delegatedEventTypesCount = Array.from(delegatedEventTypesByElement.values())
      .reduce((acc, eventTypes) => acc + eventTypes.size, 0);

    // eslint-disable-next-line no-console
    console.warn('DELEGATED EVENTS STATS', {
      delegatedHandlersCount1,
      delegatedHandlersCount2,
      delegatedEventTypesCount,
      delegationRegistriesCount,
      delegationElementsCount,
      documentListenersCount,
    });
  });
}
