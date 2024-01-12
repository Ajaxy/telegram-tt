import { useEffect, useLayoutEffect, useState } from '../../lib/teact/teact';

import { ElectronEvent } from '../../types/electron';

import { IS_IOS } from '../../util/windowEnvironment';

type RefType = {
  current: HTMLVideoElement | null;
};

type ReturnType = [boolean, () => void, () => void] | [false];
type CallbackType = (isPlayed: boolean) => void;

const prop = getBrowserFullscreenElementProp();

export default function useFullscreen(elRef: RefType, setIsPlayed: CallbackType): ReturnType {
  const [isFullscreen, setIsFullscreen] = useState(Boolean(prop && document[prop]));

  const setFullscreen = () => {
    if (!elRef.current || !(prop || IS_IOS)) {
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
    const video = elRef.current;
    const listener = () => {
      const isEnabled = Boolean(prop && document[prop]);
      setIsFullscreen(isEnabled);
      // In Firefox fullscreen video controls are not visible by default, so we force them manually
      video!.controls = isEnabled;
    };
    const listenerEnter = () => { setIsFullscreen(true); };
    const listenerExit = () => {
      setIsFullscreen(false);
      setIsPlayed(false);
    };

    document.addEventListener('fullscreenchange', listener, false);
    document.addEventListener('webkitfullscreenchange', listener, false);
    document.addEventListener('mozfullscreenchange', listener, false);

    if (video) {
      video.addEventListener('webkitbeginfullscreen', listenerEnter, false);
      video.addEventListener('webkitendfullscreen', listenerExit, false);
    }

    return () => {
      document.removeEventListener('fullscreenchange', listener, false);
      document.removeEventListener('webkitfullscreenchange', listener, false);
      document.removeEventListener('mozfullscreenchange', listener, false);
      if (video) {
        video.removeEventListener('webkitbeginfullscreen', listenerEnter, false);
        video.removeEventListener('webkitendfullscreen', listenerExit, false);
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

    const removeElectronListener = window.electron?.on(ElectronEvent.FULLSCREEN_CHANGE, setIsFullscreen);
    window.electron?.isFullscreen().then(setIsFullscreen);

    document.addEventListener('fullscreenchange', listener, false);
    document.addEventListener('webkitfullscreenchange', listener, false);
    document.addEventListener('mozfullscreenchange', listener, false);

    return () => {
      removeElectronListener?.();

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

export function safeRequestFullscreen(video: HTMLVideoElement) {
  if (video.requestFullscreen) {
    video.requestFullscreen();
  } else if (video.webkitRequestFullscreen) {
    video.webkitRequestFullscreen();
  } else if (video.webkitEnterFullscreen) {
    video.webkitEnterFullscreen();
  } else if (video.mozRequestFullScreen) {
    video.mozRequestFullScreen();
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
