import { ANIMATION_END_DELAY } from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { applyStyles } from '../../../util/animation';
import stopEvent from '../../../util/stopEvent';
import { REM } from '../../common/helpers/mediaDimensions';

import ribbonStyles from '../StoryRibbon.module.scss';
import togglerStyles from '../StoryToggler.module.scss';

export const ANIMATION_DURATION = 250;
const RIBBON_OFFSET = 0.25 * REM;
const RIBBON_Z_INDEX = 11;
const STROKE_OFFSET = 0.1875 * REM;
const CANVAS_OFFSET = 0.125 * REM;

const callbacks: Set<NoneToVoidFunction> = new Set();

export function animateOpening(isArchived?: boolean) {
  cancelDelayedCallbacks();

  const {
    container, toggler, leftMainHeader, ribbonPeers, toggleAvatars,
  } = getHTMLElements(isArchived);

  if (!toggler || !toggleAvatars || !ribbonPeers || !container || !leftMainHeader) {
    return;
  }

  const { bottom: headerBottom, right: headerRight } = leftMainHeader.getBoundingClientRect();
  const toTop = headerBottom + RIBBON_OFFSET;

  // Toggle avatars are in the reverse order
  const lastToggleAvatar = toggleAvatars[0];
  const firstToggleAvatar = toggleAvatars[toggleAvatars.length - 1];
  const lastId = getPeerId(lastToggleAvatar);

  Array.from(ribbonPeers).reverse().forEach((peer, index, { length }) => {
    const id = getPeerId(peer);
    if (!id) return;
    const isLast = id === lastId;
    let toggleAvatar = selectByPeerId(toggler, id);
    let zIndex = RIBBON_Z_INDEX + index + 1;
    if (!toggleAvatar) {
      const isSelf = index === length - 1;

      // Self story should appear from the first toggle avatar
      toggleAvatar = isSelf ? firstToggleAvatar : lastToggleAvatar;
      zIndex = RIBBON_Z_INDEX;
    }

    if (!toggleAvatar) return;

    let {
      // eslint-disable-next-line prefer-const
      top: fromTop,
      left: fromLeft,
      width: fromWidth,
    } = toggleAvatar.getBoundingClientRect();

    const {
      left: toLeft,
      width: toWidth,
    } = peer.getBoundingClientRect();

    if (toLeft > headerRight) {
      return;
    }

    fromLeft -= STROKE_OFFSET;
    fromWidth += 2 * STROKE_OFFSET;

    const fromTranslateX = fromLeft - toLeft;
    const fromTranslateY = fromTop - toTop;
    const fromScale = fromWidth / toWidth;

    fromTop -= STROKE_OFFSET;

    const toTranslateX = toLeft - fromLeft + 2 * STROKE_OFFSET;
    const toTranslateY = toTop - fromTop + STROKE_OFFSET;
    const toScale = toWidth / (fromWidth + 2 * STROKE_OFFSET);

    requestMutation(() => {
      if (!toggleAvatar) return;
      const ghost = createGhost(peer);

      let ghost2: HTMLElement | undefined;

      // If this is a toogle avatar we create a second ghost and do crossfade animation
      if (zIndex > RIBBON_Z_INDEX) {
        ghost2 = createGhost(toggleAvatar!);
        if (isLast) {
          ghost2.classList.add(togglerStyles.ghostLast);
        }
      } else {
        // Else we animate only name
        ghost.classList.add(togglerStyles.ghostAnimateName);
      }

      applyStyles(ghost, {
        top: `${toTop}px`,
        left: `${toLeft}px`,
        zIndex: `${zIndex}`,
        opacity: ghost2 ? '0' : '',
        transform: `translate3d(${fromTranslateX}px, ${fromTranslateY}px, 0) scale(${fromScale})`,
      });

      if (ghost2) {
        applyStyles(ghost2, {
          top: `${fromTop}px`,
          left: `${fromLeft}px`,
          zIndex: `${zIndex}`,
        });
      }

      container.appendChild(ghost);
      if (ghost2) {
        container.appendChild(ghost2);
      }
      toggleAvatar.classList.add('animating');
      peer.classList.add('animating');

      requestMutation(() => {
        applyStyles(ghost, {
          opacity: '',
          transform: '',
        });

        if (ghost2) {
          applyStyles(ghost2, {
            opacity: '0',
            transform: `translate3d(${toTranslateX}px, ${toTranslateY}px, 0) scale(${toScale})`,
          });
        } else {
          ghost.classList.add(togglerStyles.ghostRevealName);
        }

        const cb = createDelayedCallback(() => {
          requestMutation(() => {
            if (container.contains(ghost)) {
              container.removeChild(ghost);
            }
            if (ghost2 && container.contains(ghost2)) {
              container.removeChild(ghost2);
            }
            toggleAvatar?.classList.remove('animating');
            peer.classList.remove('animating');

            callbacks.delete(cb);
          });
        }, ANIMATION_DURATION + ANIMATION_END_DELAY);

        callbacks.add(cb);
      });
    });
  });
}

export function animateClosing(isArchived?: boolean) {
  cancelDelayedCallbacks();

  const {
    container,
    toggler,
    toggleAvatars,
    ribbonPeers,
    leftMainHeader,
  } = getHTMLElements(isArchived);

  if (!toggler || !toggleAvatars || !ribbonPeers || !container || !leftMainHeader) {
    return;
  }
  const { right: headerRight } = leftMainHeader.getBoundingClientRect();

  // Toggle avatars are in the reverse order
  const lastToggleAvatar = toggleAvatars[0];
  const firstToggleAvatar = toggleAvatars[toggleAvatars.length - 1];
  const lastId = getPeerId(lastToggleAvatar);

  Array.from(ribbonPeers).reverse().forEach((peer, index, { length }) => {
    const id = getPeerId(peer);
    if (!id) return;
    const isLast = id === lastId;
    let toggleAvatar = selectByPeerId(toggler, id);
    let zIndex = RIBBON_Z_INDEX + index + 1;
    if (!toggleAvatar) {
      const isSelf = index === length - 1;

      // Self story should appear from the first toggle avatar
      toggleAvatar = isSelf ? firstToggleAvatar : lastToggleAvatar;
      zIndex = RIBBON_Z_INDEX;
    }

    if (!toggleAvatar) return;

    const {
      top: fromTop,
      left: fromLeft,
      width: fromWidth,
    } = peer.getBoundingClientRect();

    let {
      left: toLeft,
      width: toWidth,
      top: toTop,
    } = toggleAvatar.getBoundingClientRect();

    if (fromLeft > headerRight) {
      return;
    }

    toLeft -= STROKE_OFFSET;
    toWidth += 2 * STROKE_OFFSET;

    const toTranslateX = toLeft - fromLeft;
    const toTranslateY = toTop - fromTop - CANVAS_OFFSET;
    const toScale = toWidth / fromWidth;

    toTop -= STROKE_OFFSET;

    const fromTranslateX = fromLeft - toLeft + 2 * STROKE_OFFSET;
    const fromTranslateY = fromTop - toTop + STROKE_OFFSET;
    const fromScale = fromWidth / (toWidth + 2 * STROKE_OFFSET);

    requestMutation(() => {
      const ghost = createGhost(peer);
      let ghost2: HTMLElement | undefined;

      if (zIndex > RIBBON_Z_INDEX) {
        ghost2 = createGhost(toggleAvatar!);
        if (isLast) {
          ghost2.classList.add(togglerStyles.ghostLast);
        }
      } else {
        ghost.classList.add(togglerStyles.ghostAnimateName, togglerStyles.ghostRevealName);
      }

      applyStyles(ghost, {
        top: `${fromTop}px`,
        left: `${fromLeft}px`,
        width: `${fromWidth}px`,
        zIndex: `${zIndex}`,
      });

      if (ghost2) {
        applyStyles(ghost2, {
          top: `${toTop}px`,
          left: `${toLeft}px`,
          zIndex: `${zIndex}`,
          opacity: '0',
          transform: `translate3d(${fromTranslateX}px, ${fromTranslateY}px, 0) scale(${fromScale})`,
        });
      }

      peer.classList.add('animating');
      toggleAvatar!.classList.add('animating');

      container.appendChild(ghost);
      if (ghost2) {
        container.appendChild(ghost2);
      }

      requestMutation(() => {
        applyStyles(ghost, {
          opacity: ghost2 ? '0' : '',
          transform: `translate3d(${toTranslateX}px, ${toTranslateY}px, 0) scale(${toScale})`,
        });

        if (ghost2) {
          applyStyles(ghost2!, {
            opacity: '',
            transform: '',
          });
        } else {
          ghost.classList.remove(togglerStyles.ghostRevealName);
        }

        const cb = createDelayedCallback(() => {
          requestMutation(() => {
            if (container.contains(ghost)) {
              container.removeChild(ghost);
            }
            if (ghost2 && container.contains(ghost2)) {
              container.removeChild(ghost2);
            }
            peer.classList.remove('animating');
            toggleAvatar!.classList.remove('animating');
          });

          callbacks.delete(cb);
        }, ANIMATION_DURATION + ANIMATION_END_DELAY);

        callbacks.add(cb);
      });
    });
  });
}

function getHTMLElements(isArchived?: boolean) {
  let container = document.getElementById('LeftColumn');
  if (container && isArchived) {
    container = container.querySelector<HTMLElement>('.ArchivedChats');
  }
  if (!container) return {};
  const toggler = container.querySelector<HTMLElement>('#StoryToggler');
  const ribbon = container.querySelector<HTMLElement>('#StoryRibbon');
  const leftMainHeader = container.querySelector<HTMLElement>('.left-header');
  const ribbonPeers = ribbon?.querySelectorAll<HTMLElement>(`.${ribbonStyles.peer}`);
  const toggleAvatars = toggler?.querySelectorAll<HTMLElement>('.Avatar');

  return {
    container,
    toggler,
    leftMainHeader,
    ribbonPeers,
    toggleAvatars,
  };
}

function createGhost(sourceEl: HTMLElement) {
  const ghost = sourceEl.cloneNode(true) as HTMLElement;
  ghost.classList.add(togglerStyles.ghost);

  // Avoid source animating class being copied to the ghost
  ghost.classList.remove('animating');

  ghost.draggable = false;
  ghost.oncontextmenu = stopEvent;

  const sourceCanvas = sourceEl.querySelector('canvas');
  if (sourceCanvas) {
    const canvas = ghost.querySelector('canvas');
    canvas?.getContext('2d')?.drawImage(sourceCanvas, 0, 0);
  }

  return ghost;
}

function getPeerId(el: HTMLElement) {
  return el?.getAttribute('data-peer-id');
}

function selectByPeerId(el: HTMLElement, id: string) {
  return el?.querySelector<HTMLElement>(`[data-peer-id="${id}"]`);
}

function createDelayedCallback(callback: NoneToVoidFunction, ms: number) {
  const timeout = setTimeout(callback, ms);

  return () => {
    clearTimeout(timeout);
    callback();
  };
}

function cancelDelayedCallbacks() {
  callbacks.forEach((cb) => cb());
  callbacks.clear();
}
