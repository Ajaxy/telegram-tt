import type { ElementRef } from '../lib/teact/teact';
import { useCallback, useLayoutEffect, useState } from '../lib/teact/teact';

import { DEBUG } from '../config';
import { IS_IOS, IS_PWA } from '../util/browser/windowEnvironment';
import safePlay, { getIsVideoPlaying } from '../util/safePlay';
import { createSignal } from '../util/signals';

type ReturnType = [boolean, () => void, boolean] | [false];
type CallbackType = () => void;

const signal = createSignal(false);
const setIsPictureInPicture = signal[1];

export const PICTURE_IN_PICTURE_SIGNAL = signal;

export default function usePictureInPicture(
  elRef: ElementRef<HTMLVideoElement>,
  onEnter: CallbackType,
  onLeave: CallbackType,
): ReturnType {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);

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
    const onEnterInternal = () => {
      onEnter();
      setIsActive(true);
      setIsPictureInPicture(true);
    };
    const onLeaveInternal = () => {
      setIsPictureInPicture(false);
      setIsActive(false);
      onLeave();
    };
    video.addEventListener('enterpictureinpicture', onEnterInternal);
    video.addEventListener('leavepictureinpicture', onLeaveInternal);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterInternal);
      video.removeEventListener('leavepictureinpicture', onLeaveInternal);
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

  return [isSupported, enterPictureInPicture, isActive];
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
