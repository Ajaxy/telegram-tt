import type React from '../lib/teact/teact';

import { IS_TOUCH_ENV, MouseButton } from '../util/windowEnvironment';

type EventArg<E> = React.MouseEvent<E>;
type EventHandler<E> = (e: EventArg<E>) => void;

export function useFastClick<T extends HTMLDivElement | HTMLButtonElement>(callback?: EventHandler<T>) {
  const wrapperHandler = callback ? (e: EventArg<T>) => {
    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }

    callback(e);
  } : undefined;

  return IS_TOUCH_ENV
    ? { handleClick: wrapperHandler }
    : { handleMouseDown: wrapperHandler };
}
