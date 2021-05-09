type HandlerName = 'onEnter' | 'onBackspace' | 'onDelete' | 'onEsc' | 'onUp' | 'onDown' | 'onLeft' | 'onRight'
| 'onTab';
type Handler = (e: KeyboardEvent) => void;
type CaptureOptions = Partial<Record<HandlerName, Handler>>;

const keyToHandlerName: Record<string, HandlerName> = {
  Enter: 'onEnter',
  Backspace: 'onBackspace',
  Delete: 'onDelete',
  Esc: 'onEsc',
  Escape: 'onEsc',
  ArrowUp: 'onUp',
  ArrowDown: 'onDown',
  ArrowLeft: 'onLeft',
  ArrowRight: 'onRight',
  Tab: 'onTab',
};

const handlers: Record<HandlerName, Handler[]> = {
  onEnter: [],
  onDelete: [],
  onBackspace: [],
  onEsc: [],
  onUp: [],
  onDown: [],
  onLeft: [],
  onRight: [],
  onTab: [],
};

export default function captureKeyboardListeners(options: CaptureOptions) {
  if (!hasActiveHandlers()) {
    document.addEventListener('keydown', handleKeyDown, true);
  }

  (Object.keys(options) as Array<HandlerName>).forEach((handlerName) => {
    const handler = options[handlerName];
    if (!handler) {
      return;
    }

    const currentEventHandlers = handlers[handlerName];
    if (currentEventHandlers) {
      currentEventHandlers.push(handler);
    }
  });

  return () => {
    releaseKeyboardListener(options);
  };
}

function hasActiveHandlers() {
  return Object.values(handlers).some((keyHandlers) => Boolean(keyHandlers.length));
}

function handleKeyDown(e: KeyboardEvent) {
  const handlerName = keyToHandlerName[e.key];
  if (!handlerName) {
    return;
  }

  const { length } = handlers[handlerName];
  if (!length) {
    return;
  }
  e.stopPropagation();

  const handler = handlers[handlerName][length - 1];
  handler!(e);
}

function releaseKeyboardListener(options: CaptureOptions) {
  (Object.keys(options) as Array<HandlerName>).forEach((handlerName) => {
    const handler = options[handlerName];
    const currentEventHandlers = handlers[handlerName];
    if (currentEventHandlers) {
      const index = currentEventHandlers.findIndex((cb) => cb === handler);
      if (index !== -1) {
        currentEventHandlers.splice(index, 1);
      }
    }
  });

  if (!hasActiveHandlers()) {
    document.removeEventListener('keydown', handleKeyDown, false);
  }
}
