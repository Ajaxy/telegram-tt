import type { ElementRef } from '../../lib/teact/teact';
import { useEffect, useLayoutEffect, useState } from '../../lib/teact/teact';

import { IS_TAURI } from '../../util/browser/globalEnvironment';
import { IS_IOS } from '../../util/browser/windowEnvironment';

type ReturnType = [boolean, () => void, () => void] | [false];
type CallbackType = (isPlayed: boolean) => void;

const prop = getBrowserFullscreenElementProp();

export default function useFullscreen<T extends HTMLElement>(elRef: ElementRef<T>, exitCallback?: CallbackType,
  enterCallback?: CallbackType): ReturnType {
  const [isFullscreen, setIsFullscreen] = useState(Boolean(prop && document[prop]));

  const setFullscreen = () => {
    if (!elRef.current || !(prop || IS_IOS) || isFullscreen) {
      return;
    }
    safeRequestFullscreen(elRef.current);
    setIsFullscreen(true);
  };

  const exitFullscreen = () => {
    if (!elRef.current) {
      return;
    }
    safeExitFullscreen();
    setIsFullscreen(false);
  };

  useLayoutEffect(() => {
    const element = elRef.current;
    const listener = () => {
      const isEnabled = Boolean(prop && document[prop]);
      setIsFullscreen(isEnabled);
      if (isEnabled) {
        enterCallback?.(false);
      } else {
        exitCallback?.(false);
      }
      // In Firefox fullscreen video controls are not visible by default, so we force them manually
      if (element instanceof HTMLVideoElement) element.controls = isEnabled;
    };

    const listenerEnter = () => {
      setIsFullscreen(true);
      if (enterCallback) enterCallback(true);
    };

    const listenerExit = () => {
      setIsFullscreen(false);
      if (exitCallback) exitCallback(false);
    };

    document.addEventListener('fullscreenchange', listener, false);
    document.addEventListener('webkitfullscreenchange', listener, false);
    document.addEventListener('mozfullscreenchange', listener, false);

    if (element) {
      element.addEventListener('webkitbeginfullscreen', listenerEnter, false);
      element.addEventListener('webkitendfullscreen', listenerExit, false);
    }

    return () => {
      document.removeEventListener('fullscreenchange', listener, false);
      document.removeEventListener('webkitfullscreenchange', listener, false);
      document.removeEventListener('mozfullscreenchange', listener, false);
      if (element) {
        element.removeEventListener('webkitbeginfullscreen', listenerEnter, false);
        element.removeEventListener('webkitendfullscreen', listenerExit, false);
      }
    };
    // eslint-disable-next-line
  }, []);

  if (!prop && !IS_IOS) {
    return [false];
  }

  return [isFullscreen, setFullscreen, exitFullscreen];
}

export const useFullscreenStatus = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const listener = () => {
      setIsFullscreen(checkIfFullscreen());
    };

    let removeTauriListener: VoidFunction | undefined;
    const setupTauriListener = async () => {
      const tauriWindow = await window.tauri?.getCurrentWindow();
      removeTauriListener = await tauriWindow.onResized(() => {
        tauriWindow.isFullscreen().then(setIsFullscreen);
      });
    };

    if (IS_TAURI) {
      window.tauri?.getCurrentWindow().then((tauriWindow) => {
        tauriWindow.isFullscreen().then(setIsFullscreen);
      });
      setupTauriListener();
    }

    document.addEventListener('fullscreenchange', listener, false);
    document.addEventListener('webkitfullscreenchange', listener, false);
    document.addEventListener('mozfullscreenchange', listener, false);

    return () => {
      removeTauriListener?.();

      document.removeEventListener('fullscreenchange', listener, false);
      document.removeEventListener('webkitfullscreenchange', listener, false);
      document.removeEventListener('mozfullscreenchange', listener, false);
    };
  }, []);

  return isFullscreen;
};

function getBrowserFullscreenElementProp() {
  if (typeof document.fullscreenElement !== 'undefined') {
    return 'fullscreenElement';
  } else if (typeof document.mozFullScreenElement !== 'undefined') {
    return 'mozFullScreenElement';
  } else if (typeof document.webkitFullscreenElement !== 'undefined') {
    return 'webkitFullscreenElement';
  }
  return '';
}

export function checkIfFullscreen() {
  const fullscreenProp = getBrowserFullscreenElementProp();
  return Boolean(fullscreenProp && document[fullscreenProp]);
}

export function safeRequestFullscreen(element: HTMLElement) {
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if (element.webkitEnterFullscreen) {
    element.webkitEnterFullscreen();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  }
}

export function safeExitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.webkitCancelFullScreen) {
    document.webkitCancelFullScreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
}
