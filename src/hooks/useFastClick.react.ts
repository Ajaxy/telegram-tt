import type React from 'react';

import { IS_TOUCH_ENV, MouseButton } from '../util/windowEnvironment';
import useLastCallback from './useLastCallback.react';

type EventArg<E> = React.MouseEvent<E>;
type EventHandler<E> = (e: EventArg<E>) => void;

export function useFastClick<T extends HTMLDivElement | HTMLButtonElement>(callback?: EventHandler<T>) {
  const handler = useLastCallback((e: EventArg<T>) => {
    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }

    callback!(e);
  });

  return IS_TOUCH_ENV
    ? { handleClick: callback ? handler : undefined }
    : { handleMouseDown: callback ? handler : undefined };
}
