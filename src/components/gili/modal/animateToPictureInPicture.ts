import { beginHeavyAnimation } from '../../../lib/teact/teact';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { IS_VIEW_TRANSITION_SUPPORTED } from '../../../util/browser/windowEnvironment';

import styles from './Modal.module.scss';

const ANIMATION_DURATION = 550;
const UNBLUR_DURATION = 750;
const FAST_UNBLUR_DURATION = 200;
const BACKDROP_ANIMATION_DURATION = 200;
const MOVEMENT_OFFSET = 0.8;
const ZOOM_SCALE = 0.9;
const MOTION_BLUR = 'blur(0.75rem)';
const NO_BLUR = 'blur(0)';
const WINDOW_BORDER_COUNT = 2;
const MAX_WINDOW_BORDER = 32;
const ANIMATION_EASING = 'cubic-bezier(0.45, 0, 0.2, 1)';
const SNAPSHOT_SELECTOR = '::view-transition-old(modal-picture-in-picture)';

export default function animateToPictureInPicture(
  panel: HTMLElement,
  pictureInPictureWindow: Window,
  transferModal: () => Promise<void>,
) {
  const sourceDocument = panel.ownerDocument;
  const sourceWindow = sourceDocument.defaultView!;
  const sourceRoot = sourceDocument.documentElement;
  const previousRootViewTransitionName = sourceRoot.style.viewTransitionName;
  const sourceDialog = panel.closest('dialog')!;
  const animations: Animation[] = [];
  let transition: ViewTransition | undefined;
  let transferPromise: Promise<void> | undefined;
  let endHeavyAnimation: NoneToVoidFunction | undefined;
  let isCanceled = false;

  pictureInPictureWindow.addEventListener('pagehide', cleanUp);

  requestMeasure(() => {
    if (isCanceled || pictureInPictureWindow.closed) {
      cleanUp();
      return;
    }

    const sourceRect = panel.getBoundingClientRect();
    const destinationRect = sourceRect.width && sourceRect.height
      ? getDestinationRect(sourceWindow, pictureInPictureWindow) : undefined;
    const destinationTransform = destinationRect
      ? `translate(${destinationRect.left - sourceRect.left}px, ${destinationRect.top - sourceRect.top}px) `
      + `scale(${destinationRect.width / sourceRect.width}, ${destinationRect.height / sourceRect.height})`
      : `scale(${ZOOM_SCALE})`;
    const entranceTransform = destinationRect
      ? `translate(${sourceRect.left - destinationRect.left}px, ${sourceRect.top - destinationRect.top}px) `
      + `scale(${sourceRect.width / destinationRect.width}, ${sourceRect.height / destinationRect.height})`
      : `scale(${ZOOM_SCALE})`;
    const canAnimate = !sourceDocument.body.classList.contains('no-page-transitions');

    requestMutation(() => {
      if (isCanceled || pictureInPictureWindow.closed) {
        cleanUp();
        return;
      }

      if (!canAnimate) {
        void transferModal().then(cleanUp, cleanUp);
        return;
      }

      endHeavyAnimation = beginHeavyAnimation();
      panel.classList.add(styles.pictureInPictureTransitionPanel);

      if (!IS_VIEW_TRANSITION_SUPPORTED || !sourceDocument.startViewTransition || sourceDocument.activeViewTransition) {
        sourceDialog.classList.add(styles.pictureInPictureFadingBackdrop);
        const animation = panel.animate([
          { opacity: 1, transform: 'none', filter: NO_BLUR },
          { opacity: 0, transform: `scale(${ZOOM_SCALE})`, filter: MOTION_BLUR },
        ], { duration: ANIMATION_DURATION, easing: ANIMATION_EASING, fill: 'forwards' });
        animations.push(animation);
        void animation.finished.then(async () => {
          if (isCanceled || pictureInPictureWindow.closed) {
            cleanUp();
            return;
          }
          await moveModal();
          requestMutation(() => {
            if (isCanceled || pictureInPictureWindow.closed) {
              cleanUp();
              return;
            }
            animations.splice(animations.indexOf(animation), 1);
            animation.cancel();
            playEntrance(`scale(${ZOOM_SCALE})`, true);
          });
        }).catch(cleanUp);
        return;
      }

      panel.style.setProperty('--modal-pip-transform-origin', destinationRect ? '0 0' : '50% 50%');
      sourceRoot.classList.add(styles.pictureInPictureTransition);
      // The page disables the root snapshot outside navigation transitions
      sourceRoot.style.viewTransitionName = 'root';
      transition = sourceDocument.startViewTransition(moveModal);

      void transition.ready.then(() => {
        requestMutation(() => {
          if (isCanceled || pictureInPictureWindow.closed) {
            cleanUp();
            return;
          }

          const outgoingAnimation = sourceRoot.animate([
            { transform: 'none', opacity: 1, filter: NO_BLUR, easing: ANIMATION_EASING },
            {
              transform: destinationTransform,
              opacity: destinationRect ? 1 : 0,
              filter: MOTION_BLUR,
              offset: MOVEMENT_OFFSET,
            },
            { transform: destinationTransform, opacity: 0, filter: MOTION_BLUR },
          ], {
            duration: ANIMATION_DURATION,
            fill: 'forwards',
            pseudoElement: SNAPSHOT_SELECTOR,
          });
          const backdropAnimation = sourceRoot.animate([
            { opacity: 1 },
            { opacity: 0 },
          ], {
            duration: BACKDROP_ANIMATION_DURATION,
            easing: 'ease-in',
            fill: 'forwards',
            pseudoElement: '::view-transition-old(root)',
          });
          animations.push(outgoingAnimation, backdropAnimation);
          playEntrance(entranceTransform, !destinationRect, [outgoingAnimation, backdropAnimation]);
        });
      }).catch(async () => {
        await moveModal();
        cleanUp();
      });
      void transition.finished.then(cleanUp, cleanUp);

      // The snapshot scales around its original top-left corner when matching the PiP bounds
      sourceRoot.style.setProperty('--modal-pip-transform-origin', destinationRect ? '0 0' : '50% 50%');
    });
  });

  function moveModal() {
    if (isCanceled || pictureInPictureWindow.closed) {
      cleanUp();
      return Promise.resolve();
    }
    transferPromise ||= new Promise<void>((resolve, reject) => {
      requestMutation(() => {
        if (isCanceled || pictureInPictureWindow.closed) {
          cleanUp();
          resolve();
          return;
        }
        panel.classList.add(styles.pictureInPictureEntering);
        void transferModal().then(resolve, reject);
      });
    });
    return transferPromise;
  }

  function playEntrance(transform: string, shouldFade: boolean, sourceAnimations: Animation[] = []) {
    const entranceAnimation = panel.animate([
      { transform, opacity: shouldFade ? 0 : 1 },
      { transform: 'none', opacity: 1 },
    ], {
      duration: ANIMATION_DURATION * MOVEMENT_OFFSET,
      easing: ANIMATION_EASING,
      fill: 'both',
    });
    const unblurAnimation = panel.animate([
      { filter: MOTION_BLUR },
      { filter: NO_BLUR },
    ], {
      duration: shouldFade ? FAST_UNBLUR_DURATION : UNBLUR_DURATION,
      easing: 'ease-in-out',
      fill: 'both',
    });
    animations.push(entranceAnimation, unblurAnimation);

    const pendingAnimations = [...sourceAnimations, entranceAnimation, unblurAnimation];
    pendingAnimations.forEach((animation) => animation.pause());
    void Promise.all(pendingAnimations.map((animation) => animation.ready)).then(() => {
      requestMutation(() => {
        if (isCanceled || pictureInPictureWindow.closed) {
          cleanUp();
          return;
        }

        // Each document timeline has its own origin and pending playback queue
        const startTime = sourceWindow.performance.timeOrigin + sourceWindow.performance.now();
        sourceAnimations.forEach((animation) => {
          animation.startTime = startTime - sourceWindow.performance.timeOrigin;
        });
        entranceAnimation.startTime = startTime - pictureInPictureWindow.performance.timeOrigin;
        unblurAnimation.startTime = startTime - pictureInPictureWindow.performance.timeOrigin;
        panel.classList.remove(styles.pictureInPictureEntering);
      });
    }).catch(cleanUp);
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(cleanUp);
  }

  function cleanUp() {
    if (isCanceled) return;
    isCanceled = true;
    transition?.skipTransition();
    pictureInPictureWindow.removeEventListener('pagehide', cleanUp);
    animations.forEach((animation) => animation.cancel());
    endHeavyAnimation?.();
    requestMutation(() => {
      panel.classList.remove(styles.pictureInPictureTransitionPanel, styles.pictureInPictureEntering);
      panel.style.removeProperty('--modal-pip-transform-origin');
      sourceDialog.classList.remove(styles.pictureInPictureFadingBackdrop);
      sourceRoot.classList.remove(styles.pictureInPictureTransition);
      if (transition) sourceRoot.style.viewTransitionName = previousRootViewTransitionName;
      sourceRoot.style.removeProperty('--modal-pip-transform-origin');
    });
  }

  return cleanUp;
}

function getDestinationRect(sourceWindow: Window, pictureInPictureWindow: Window) {
  if (sourceWindow.devicePixelRatio !== pictureInPictureWindow.devicePixelRatio) return undefined;
  if (sourceWindow.screenX === pictureInPictureWindow.screenX
    && sourceWindow.screenY === pictureInPictureWindow.screenY) return undefined;

  const sourceViewport = getViewportRect(sourceWindow);
  const destinationViewport = getViewportRect(pictureInPictureWindow);
  if (!sourceViewport || !destinationViewport) return undefined;

  const left = destinationViewport.left - sourceViewport.left;
  const top = destinationViewport.top - sourceViewport.top;
  const { width, height } = destinationViewport;
  if (left < 0 || top < 0 || left + width > sourceViewport.width || top + height > sourceViewport.height) {
    return undefined;
  }

  return { left, top, width, height };
}

function getViewportRect(targetWindow: Window) {
  const { screenX, screenY, outerWidth, outerHeight, innerWidth, innerHeight } = targetWindow;
  const border = (outerWidth - innerWidth) / WINDOW_BORDER_COUNT;
  const topInset = outerHeight - innerHeight - border;
  if (![screenX, screenY, border, topInset, innerWidth, innerHeight].every(Number.isFinite)
    || border < 0 || border > MAX_WINDOW_BORDER || topInset < 0 || innerWidth <= 0 || innerHeight <= 0) {
    return undefined;
  }

  // shortcut: Browser chrome insets are estimated; calibrate before relying on exact cross-window alignment
  return { left: screenX + border, top: screenY + topInset, width: innerWidth, height: innerHeight };
}
