type HandlerName =
  'onEnter'
  | 'onBackspace'
  | 'onDelete'
  | 'onEsc'
  | 'onUp'
  | 'onDown'
  | 'onLeft'
  | 'onRight'
  | 'onTab'
  | 'onSpace';
type Handler = (e: KeyboardEvent) => void | boolean;
type CaptureOptions = Partial<Record<HandlerName, Handler>>;
type Handlers = Record<HandlerName, Handler[]>;

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
  ' ': 'onSpace',
};

const handlersByDocument = new WeakMap<Document, Handlers>();

export default function captureKeyboardListeners(options: CaptureOptions, targetDocument = document) {
  const handlers: Handlers = handlersByDocument.get(targetDocument) || {
    onEnter: [],
    onDelete: [],
    onBackspace: [],
    onEsc: [],
    onUp: [],
    onDown: [],
    onLeft: [],
    onRight: [],
    onTab: [],
    onSpace: [],
  };
  handlersByDocument.set(targetDocument, handlers);

  if (!hasActiveHandlers(handlers)) {
    targetDocument.addEventListener('keydown', handleKeyDown, true);
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
    releaseKeyboardListener(options, targetDocument, handlers);
  };
}

function hasActiveHandlers(handlers: Handlers) {
  return Object.values(handlers).some((keyHandlers) => Boolean(keyHandlers.length));
}

export function hasActiveHandler(key: string, targetDocument = document) {
  const handlerName = keyToHandlerName[key];
  return handlerName ? Boolean(handlersByDocument.get(targetDocument)?.[handlerName].length) : false;
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.isComposing) {
    return;
  }

  const handlerName = keyToHandlerName[e.key];
  if (!handlerName) {
    return;
  }

  const handlers = handlersByDocument.get(e.currentTarget as Document)!;
  const { length } = handlers[handlerName];
  if (!length) {
    return;
  }

  for (let i = length - 1; i >= 0; i--) {
    const handler = handlers[handlerName][i];
    if (handler(e) !== false) {
      e.stopPropagation();
      break;
    }
  }
}

function releaseKeyboardListener(options: CaptureOptions, targetDocument: Document, handlers: Handlers) {
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

  if (!hasActiveHandlers(handlers)) {
    targetDocument.removeEventListener('keydown', handleKeyDown, true);
  }
}
