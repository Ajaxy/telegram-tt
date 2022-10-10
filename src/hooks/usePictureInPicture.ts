import { useLayoutEffect, useCallback, useState } from '../lib/teact/teact';
import { DEBUG } from '../config';
import { IS_IOS, IS_PWA } from '../util/environment';
import safePlay, { getIsVideoPlaying } from '../util/safePlay';

type RefType = {
  current: HTMLVideoElement | null;
};

type ReturnType = [boolean, () => void] | [false];
type CallbackType = () => void;

export default function usePictureInPicture(
  elRef: RefType,
  onEnter: CallbackType,
  onLeave: CallbackType,
): ReturnType {
  const [isSupported, setIsSupported] = useState(false);

  useLayoutEffect(() => {
    // PIP is not supported in PWA on iOS, despite being detected
    if ((IS_IOS && IS_PWA) || !elRef.current) return undefined;
    const video = elRef.current;
    const setMode = getSetPresentationMode(video);
    const isEnabled = (document.pictureInPictureEnabled && !elRef.current?.disablePictureInPicture)
      || setMode !== undefined;
    if (!isEnabled) return undefined;
    // @ts-ignore
    video.autoPictureInPicture = true;
    setIsSupported(true);
    video.addEventListener('enterpictureinpicture', onEnter);
    video.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnter);
      video.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, [elRef, onEnter, onLeave]);

  const exitPictureInPicture = useCallback(() => {
    if (!elRef.current) return;
    const video = elRef.current;
    const setMode = getSetPresentationMode(video);
    if (setMode) {
      setMode('inline');
    } else {
      exitPictureInPictureIfNeeded();
    }
  }, [elRef]);

  const enterPictureInPicture = useCallback(() => {
    if (!elRef.current) return;
    exitPictureInPicture();
    const video = elRef.current;
    const isPlaying = getIsVideoPlaying(video);
    const setMode = getSetPresentationMode(video);
    if (setMode) {
      setMode('picture-in-picture');
    } else {
      requestPictureInPicture(video);
    }
    // Muted video stops in PiP mode, so we need to play it again
    if (isPlaying) {
      safePlay(video);
    }
  }, [elRef, exitPictureInPicture]);

  if (!isSupported) {
    return [false];
  }

  return [isSupported, enterPictureInPicture];
}

function getSetPresentationMode(video: HTMLVideoElement) {
  // @ts-ignore
  if (video.webkitSupportsPresentationMode && typeof video.webkitSetPresentationMode === 'function') {
    // @ts-ignore
    return video.webkitSetPresentationMode.bind(video);
  }
  return undefined;
}

function requestPictureInPicture(video: HTMLVideoElement) {
  if (video.requestPictureInPicture) {
    try {
      video.requestPictureInPicture();
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[MV] PictureInPicture Error', err);
      }
    }
  }
}

export function exitPictureInPictureIfNeeded() {
  if (document.pictureInPictureElement) {
    try {
      document.exitPictureInPicture();
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[MV] PictureInPicture Error', err);
      }
    }
  }
}
