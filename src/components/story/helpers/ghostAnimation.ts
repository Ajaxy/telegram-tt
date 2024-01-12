import type { IDimensions } from '../../../global/types';
import { StoryViewerOrigin } from '../../../types';

import { ANIMATION_END_DELAY } from '../../../config';
import fastBlur from '../../../lib/fastBlur';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getPeerStoryHtmlId } from '../../../global/helpers';
import { applyStyles } from '../../../util/animation';
import stopEvent from '../../../util/stopEvent';
import { IS_CANVAS_FILTER_SUPPORTED } from '../../../util/windowEnvironment';
import windowSize from '../../../util/windowSize';
import { REM } from '../../common/helpers/mediaDimensions';

import storyRibbonStyles from '../StoryRibbon.module.scss';
import styles from '../StoryViewer.module.scss';

const ANIMATION_DURATION = 200;
const OFFSET_BOTTOM = 3.5 * REM;
const MOBILE_OFFSET = 0.5 * REM;
const MOBILE_WIDTH = 600;

export function animateOpening(
  userId: string,
  origin: StoryViewerOrigin,
  thumb: string,
  bestImageData: string | undefined,
  dimensions: IDimensions,
) {
  const { mediaEl: fromImage } = getNodes(origin, userId);
  if (!fromImage) {
    return;
  }
  const { width: windowWidth, height: windowHeight } = windowSize.get();
  let { width: toWidth, height: toHeight } = dimensions;

  const isMobile = windowWidth <= MOBILE_WIDTH;

  if (isMobile) {
    toWidth = windowWidth - 2 * MOBILE_OFFSET;
    toHeight = windowHeight - OFFSET_BOTTOM - 2 * MOBILE_OFFSET;

    const safeAreaBottom = getComputedStyle(document.documentElement).getPropertyValue('--safe-area-bottom');
    if (safeAreaBottom) {
      toHeight -= parseFloat(safeAreaBottom);
    }
  }

  const toLeft = isMobile ? MOBILE_OFFSET : (windowWidth - toWidth) / 2;
  const toTop = isMobile ? MOBILE_OFFSET : (windowHeight - (toHeight + OFFSET_BOTTOM)) / 2;

  const {
    top: fromTop, left: fromLeft, width: fromWidth, height: fromHeight,
  } = fromImage.getBoundingClientRect();

  const fromTranslateX = (fromLeft + fromWidth / 2) - (toLeft + toWidth / 2);
  const fromTranslateY = (fromTop + fromHeight / 2) - (toTop + toHeight / 2);
  const fromScaleX = fromWidth / toWidth;
  const fromScaleY = fromHeight / toHeight;

  requestMutation(() => {
    const ghost = createGhost(bestImageData || thumb, !bestImageData);
    applyStyles(ghost, {
      top: `${toTop}px`,
      left: `${toLeft}px`,
      width: `${toWidth}px`,
      height: `${toHeight}px`,
      transform: `translate3d(${fromTranslateX}px, ${fromTranslateY}px, 0) scale(${fromScaleX}, ${fromScaleY})`,
    });

    const container = document.getElementById('StoryViewer')!;
    container.appendChild(ghost);
    document.body.classList.add('ghost-animating');

    requestMutation(() => {
      applyStyles(ghost, {
        transform: '',
      });

      setTimeout(() => {
        requestMutation(() => {
          if (container.contains(ghost)) {
            container.removeChild(ghost);
          }
          document.body.classList.remove('ghost-animating');
        });
      }, ANIMATION_DURATION + ANIMATION_END_DELAY);
    });
  });
}

export function animateClosing(
  userId: string,
  origin: StoryViewerOrigin,
  bestImageData: string,
) {
  const { mediaEl: toImage } = getNodes(origin, userId);

  const fromImage = document.getElementById('StoryViewer')!.querySelector<HTMLImageElement>(
    `.${styles.mobileSlide} .${styles.media}, .${styles.activeSlide} .${styles.media}`,
  );
  if (!fromImage || !toImage) {
    return;
  }
  const {
    top: fromTop, left: fromLeft, width: fromWidth, height: fromHeight,
  } = fromImage.getBoundingClientRect();
  const {
    top: toTop, left: toLeft, width: toWidth, height: toHeight,
  } = toImage.getBoundingClientRect();

  const toTranslateX = (toLeft + toWidth / 2) - (fromLeft + fromWidth / 2);
  const toTranslateY = (toTop + toHeight / 2) - (fromTop + fromHeight / 2);
  const toScaleX = toWidth / fromWidth;
  const toScaleY = toHeight / fromHeight;

  requestMutation(() => {
    const ghost = createGhost(bestImageData);
    applyStyles(ghost, {
      top: `${fromTop}px`,
      left: `${fromLeft}px`,
      width: `${fromWidth}px`,
      height: `${fromHeight}px`,
    });

    const ghost2 = createGhost(toImage.src, undefined, true);
    const ghost2Top = (fromTop + fromHeight / 2) - fromWidth / 2;
    applyStyles(ghost2, {
      top: `${ghost2Top}px`,
      left: `${fromLeft}px`,
      width: `${fromWidth}px`,
      height: `${fromWidth}px`,
    });

    const container = document.getElementById('StoryViewer')!;
    container.appendChild(ghost);
    document.body.appendChild(ghost2);
    document.body.classList.add('ghost-animating');

    requestMutation(() => {
      applyStyles(ghost, {
        transform: `translate3d(${toTranslateX}px, ${toTranslateY}px, 0) scale(${toScaleX}, ${toScaleY})`,
      });

      applyStyles(ghost2, {
        transform: `translate3d(${toTranslateX}px, ${toTranslateY}px, 0) scale(${toScaleX})`,
        opacity: '1',
      });

      setTimeout(() => {
        requestMutation(() => {
          if (container.contains(ghost)) {
            container.removeChild(ghost);
          }

          if (document.body.contains(ghost2)) {
            document.body.removeChild(ghost2);
          }

          document.body.classList.remove('ghost-animating');
        });
      }, ANIMATION_DURATION + ANIMATION_END_DELAY);
    });
  });
}

const RADIUS = 2;
const ITERATIONS = 2;

function createGhost(source: string, hasBlur = false, isGhost2 = false) {
  const ghost = document.createElement('div');
  ghost.classList.add(!isGhost2 ? styles.ghost : styles.ghost2);

  const img = new Image();
  img.draggable = false;
  img.oncontextmenu = stopEvent;
  img.classList.add(styles.ghostImage);

  if (hasBlur) {
    const canvas = document.createElement('canvas');
    canvas.classList.add(styles.thumbnail);
    img.onload = () => {
      const ctx = canvas.getContext('2d', { alpha: false })!;
      const {
        width,
        height,
      } = img;

      requestMutation(() => {
        canvas.width = width;
        canvas.height = height;

        if (IS_CANVAS_FILTER_SUPPORTED) {
          ctx.filter = `blur(${RADIUS}px)`;
        }

        ctx.drawImage(img, -RADIUS * 2, -RADIUS * 2, width + RADIUS * 4, height + RADIUS * 4);

        if (!IS_CANVAS_FILTER_SUPPORTED) {
          fastBlur(ctx, 0, 0, width, height, RADIUS, ITERATIONS);
        }
      });
    };
    img.src = source;
    ghost.appendChild(canvas);
  } else {
    img.src = source;
    ghost.appendChild(img);
  }

  return ghost;
}

function getNodes(origin: StoryViewerOrigin, userId: string) {
  let containerSelector;
  const mediaSelector = `#${getPeerStoryHtmlId(userId)}`;

  switch (origin) {
    case StoryViewerOrigin.StoryRibbon:
      containerSelector = `#LeftColumn .${storyRibbonStyles.root}`;
      break;
    case StoryViewerOrigin.MiddleHeaderAvatar:
      containerSelector = '.MiddleHeader .Transition_slide-active .ChatInfo';
      break;
    case StoryViewerOrigin.ChatList:
      containerSelector = '#LeftColumn .chat-list';
      break;
    case StoryViewerOrigin.SearchResult:
      containerSelector = '#LeftColumn .LeftSearch';
      break;
  }

  const container = document.querySelector<HTMLElement>(containerSelector)!;
  const mediaEls = container && container.querySelectorAll<HTMLImageElement>(`${mediaSelector} img`);

  return {
    container,
    mediaEl: mediaEls?.[0],
  };
}
