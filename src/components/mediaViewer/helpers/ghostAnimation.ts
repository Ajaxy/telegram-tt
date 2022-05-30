import type { ApiMessage, ApiDimensions } from '../../../api/types';

import { MediaViewerOrigin } from '../../../types';

import { ANIMATION_END_DELAY } from '../../../config';
import {
  calculateDimensions,
  getMediaViewerAvailableDimensions,
  MEDIA_VIEWER_MEDIA_QUERY,
  REM,
} from '../../common/helpers/mediaDimensions';
import windowSize from '../../../util/windowSize';
import stopEvent from '../../../util/stopEvent';
import { IS_TOUCH_ENV } from '../../../util/environment';
import { getMessageHtmlId } from '../../../global/helpers';
import { isElementInViewport } from '../../../util/isElementInViewport';

const ANIMATION_DURATION = 200;

export function animateOpening(
  hasFooter: boolean,
  origin: MediaViewerOrigin,
  bestImageData: string,
  dimensions: ApiDimensions,
  isVideo: boolean,
  message?: ApiMessage,
) {
  const { mediaEl: fromImage } = getNodes(origin, message);
  if (!fromImage) {
    return;
  }

  const { width: windowWidth } = windowSize.get();
  const {
    width: availableWidth, height: availableHeight,
  } = getMediaViewerAvailableDimensions(hasFooter, isVideo);
  const { width: toWidth, height: toHeight } = calculateDimensions(
    availableWidth, availableHeight, dimensions.width, dimensions.height,
  );
  const toLeft = (windowWidth - toWidth) / 2;
  const toTop = getTopOffset(hasFooter) + (availableHeight - toHeight) / 2;

  let {
    top: fromTop, left: fromLeft, width: fromWidth, height: fromHeight,
  } = fromImage.getBoundingClientRect();

  if ([
    MediaViewerOrigin.SharedMedia,
    MediaViewerOrigin.Album,
    MediaViewerOrigin.ScheduledAlbum,
    MediaViewerOrigin.SearchResult,
  ].includes(origin)) {
    const uncovered = uncover(toWidth, toHeight, fromTop, fromLeft, fromWidth, fromHeight);
    fromTop = uncovered.top;
    fromLeft = uncovered.left;
    fromWidth = uncovered.width;
    fromHeight = uncovered.height;
  }

  const fromTranslateX = (fromLeft + fromWidth / 2) - (toLeft + toWidth / 2);
  const fromTranslateY = (fromTop + fromHeight / 2) - (toTop + toHeight / 2);
  const fromScaleX = fromWidth / toWidth;
  const fromScaleY = fromHeight / toHeight;

  const ghost = createGhost(bestImageData || fromImage);
  applyStyles(ghost, {
    top: `${toTop}px`,
    left: `${toLeft}px`,
    width: `${toWidth}px`,
    height: `${toHeight}px`,
    transform: `translate3d(${fromTranslateX}px, ${fromTranslateY}px, 0) scale(${fromScaleX}, ${fromScaleY})`,
  });
  applyShape(ghost, origin);

  document.body.classList.add('ghost-animating');

  requestAnimationFrame(() => {
    document.body.appendChild(ghost);

    requestAnimationFrame(() => {
      ghost.style.transform = '';
      clearShape(ghost);

      setTimeout(() => {
        requestAnimationFrame(() => {
          if (document.body.contains(ghost)) {
            document.body.removeChild(ghost);
          }
          document.body.classList.remove('ghost-animating');
        });
      }, ANIMATION_DURATION + ANIMATION_END_DELAY);
    });
  });
}

export function animateClosing(origin: MediaViewerOrigin, bestImageData: string, message?: ApiMessage) {
  const { container, mediaEl: toImage } = getNodes(origin, message);
  if (!toImage) {
    return;
  }

  const fromImage = document.getElementById('MediaViewer')!.querySelector<HTMLImageElement>(
    '.MediaViewerSlide--active img, .MediaViewerSlide--active video',
  );
  if (!fromImage || !toImage) {
    return;
  }

  const {
    top: fromTop, left: fromLeft, width: fromWidth, height: fromHeight,
  } = fromImage.getBoundingClientRect();
  const {
    top: targetTop, left: toLeft, width: toWidth, height: toHeight,
  } = toImage.getBoundingClientRect();

  let toTop = targetTop;
  if (!isElementInViewport(container)) {
    const { height: windowHeight } = windowSize.get();
    toTop = targetTop < fromTop ? -toHeight : windowHeight;
  }

  const fromTranslateX = (fromLeft + fromWidth / 2) - (toLeft + toWidth / 2);
  const fromTranslateY = (fromTop + fromHeight / 2) - (toTop + toHeight / 2);
  let fromScaleX = fromWidth / toWidth;
  let fromScaleY = fromHeight / toHeight;

  const shouldFadeOut = (
    [MediaViewerOrigin.Inline, MediaViewerOrigin.ScheduledInline].includes(origin)
    && !isMessageImageFullyVisible(container, toImage)
  ) || (
    [MediaViewerOrigin.Album, MediaViewerOrigin.ScheduledAlbum].includes(origin)
    && !isMessageImageFullyVisible(container, toImage)
  );

  if ([
    MediaViewerOrigin.SharedMedia,
    MediaViewerOrigin.Album,
    MediaViewerOrigin.ScheduledAlbum,
    MediaViewerOrigin.SearchResult,
  ].includes(origin)) {
    if (fromScaleX > fromScaleY) {
      fromScaleX = fromScaleY;
    } else if (fromScaleY > fromScaleX) {
      fromScaleY = fromScaleX;
    }
  }

  const existingGhost = document.getElementsByClassName('ghost')[0] as HTMLDivElement;

  const ghost = existingGhost || createGhost(bestImageData || toImage, origin);
  if (!existingGhost) {
    applyStyles(ghost, {
      top: `${toTop}px`,
      left: `${toLeft}px`,
      width: `${toWidth}px`,
      height: `${toHeight}px`,
      transform: `translate3d(${fromTranslateX}px, ${fromTranslateY}px, 0) scale(${fromScaleX}, ${fromScaleY})`,
    });
  }

  requestAnimationFrame(() => {
    if (existingGhost) {
      const {
        top,
        left,
        width,
        height,
      } = existingGhost.getBoundingClientRect();
      const scaleX = width / toWidth;
      const scaleY = height / toHeight;

      applyStyles(ghost, {
        transition: 'none',
        top: `${toTop}px`,
        left: `${toLeft}px`,
        transformOrigin: 'top left',
        transform: `translate3d(${left - toLeft}px, ${top - toTop}px, 0) scale(${scaleX}, ${scaleY})`,
        width: `${toWidth}px`,
        height: `${toHeight}px`,
      });
    }
    document.body.classList.add('ghost-animating');
    if (!existingGhost) document.body.appendChild(ghost);

    requestAnimationFrame(() => {
      if (existingGhost) {
        existingGhost.style.transition = '';
      }

      ghost.style.transform = '';

      if (shouldFadeOut) {
        ghost.style.opacity = '0';
      }

      applyShape(ghost, origin);

      setTimeout(() => {
        requestAnimationFrame(() => {
          if (document.body.contains(ghost)) {
            document.body.removeChild(ghost);
          }
          document.body.classList.remove('ghost-animating');
        });
      }, ANIMATION_DURATION + ANIMATION_END_DELAY);
    });
  });
}

function createGhost(source: string | HTMLImageElement | HTMLVideoElement, origin?: MediaViewerOrigin) {
  const ghost = document.createElement('div');
  ghost.classList.add('ghost');

  const img = new Image();
  img.draggable = false;
  img.oncontextmenu = stopEvent;

  if (typeof source === 'string') {
    img.src = source;
  } else if (source instanceof HTMLVideoElement) {
    img.src = source.poster;
  } else {
    img.src = source.src;
  }

  ghost.appendChild(img);

  if (origin === MediaViewerOrigin.ProfileAvatar || origin === MediaViewerOrigin.SettingsAvatar) {
    ghost.classList.add('ProfileInfo');
    if (origin === MediaViewerOrigin.SettingsAvatar) {
      ghost.classList.add('self');
    }
    const profileInfo = document.querySelector(
      origin === MediaViewerOrigin.ProfileAvatar
        ? '#RightColumn .ProfileInfo .info'
        : '#Settings .ProfileInfo .info',
    );
    if (profileInfo) {
      ghost.appendChild(profileInfo.cloneNode(true));
    }
  }

  return ghost;
}

function uncover(realWidth: number, realHeight: number, top: number, left: number, width: number, height: number) {
  if (realWidth === realHeight) {
    const size = Math.max(width, height) * (realWidth / realHeight);
    left -= (size - width) / 2;
    top -= (size - height) / 2;
    width = size;
    height = size;
  } else if (realWidth > realHeight) {
    const srcWidth = width;
    width = height * (realWidth / realHeight);
    left -= (width - srcWidth) / 2;
  } else if (realHeight > realWidth) {
    const srcHeight = height;
    height = width * (realHeight / realWidth);
    top -= (height - srcHeight) / 2;
  }

  return {
    top, left, width, height,
  };
}

function isMessageImageFullyVisible(container: HTMLElement, imageEl: HTMLElement) {
  const messageListElement = document.querySelector<HTMLDivElement>('.Transition__slide--active > .MessageList')!;
  let imgOffsetTop = container.offsetTop + imageEl.closest<HTMLDivElement>('.content-inner, .WebPage')!.offsetTop;
  if (container.id.includes('album-media-')) {
    imgOffsetTop += container.parentElement!.offsetTop + container.closest<HTMLDivElement>('.Message')!.offsetTop;
  }

  return imgOffsetTop > messageListElement.scrollTop
    && imgOffsetTop + imageEl.offsetHeight < messageListElement.scrollTop + messageListElement.offsetHeight;
}

function getTopOffset(hasFooter: boolean) {
  const mql = window.matchMedia(MEDIA_VIEWER_MEDIA_QUERY);
  let topOffsetRem = 4.125;
  if (hasFooter && !IS_TOUCH_ENV) {
    topOffsetRem += mql.matches ? 0.875 : 2.125;
  }

  return topOffsetRem * REM;
}

function applyStyles(element: HTMLElement, styles: Record<string, string>) {
  Object.assign(element.style, styles);
}

function getNodes(origin: MediaViewerOrigin, message?: ApiMessage) {
  let containerSelector;
  let mediaSelector;

  switch (origin) {
    case MediaViewerOrigin.Album:
    case MediaViewerOrigin.ScheduledAlbum:
      containerSelector = `.Transition__slide--active > .MessageList #album-media-${getMessageHtmlId(message!.id)}`;
      mediaSelector = '.full-media';
      break;

    case MediaViewerOrigin.SharedMedia:
      containerSelector = `#shared-media${getMessageHtmlId(message!.id)}`;
      mediaSelector = 'img';
      break;

    case MediaViewerOrigin.SearchResult:
      containerSelector = `#search-media${getMessageHtmlId(message!.id)}`;
      mediaSelector = 'img';
      break;

    case MediaViewerOrigin.MiddleHeaderAvatar:
      containerSelector = '.MiddleHeader .Transition__slide--active .ChatInfo .Avatar';
      mediaSelector = '.avatar-media';
      break;

    case MediaViewerOrigin.SettingsAvatar:
      containerSelector = '#Settings .ProfileInfo .Transition__slide--active .ProfilePhoto';
      mediaSelector = '.avatar-media';
      break;

    case MediaViewerOrigin.ProfileAvatar:
      containerSelector = '#RightColumn .ProfileInfo .Transition__slide--active .ProfilePhoto';
      mediaSelector = '.avatar-media';
      break;

    case MediaViewerOrigin.ScheduledInline:
    case MediaViewerOrigin.Inline:
    default:
      containerSelector = `.Transition__slide--active > .MessageList #${getMessageHtmlId(message!.id)}`;
      mediaSelector = '.message-content .full-media, .message-content .thumbnail';
  }

  const container = document.querySelector<HTMLElement>(containerSelector)!;
  const mediaEls = container && container.querySelectorAll<HTMLImageElement | HTMLVideoElement>(mediaSelector);

  return {
    container,
    mediaEl: mediaEls?.[mediaEls.length - 1],
  };
}

function applyShape(ghost: HTMLDivElement, origin: MediaViewerOrigin) {
  switch (origin) {
    case MediaViewerOrigin.Album:
    case MediaViewerOrigin.ScheduledAlbum:
    case MediaViewerOrigin.Inline:
    case MediaViewerOrigin.ScheduledInline:
      ghost.classList.add('rounded-corners');
      break;

    case MediaViewerOrigin.SharedMedia:
    case MediaViewerOrigin.SettingsAvatar:
    case MediaViewerOrigin.ProfileAvatar:
    case MediaViewerOrigin.SearchResult:
      (ghost.firstChild as HTMLElement).style.objectFit = 'cover';
      break;

    case MediaViewerOrigin.MiddleHeaderAvatar:
      ghost.classList.add('circle');
      break;
  }
}

function clearShape(ghost: HTMLDivElement) {
  (ghost.firstChild as HTMLElement).style.objectFit = 'default';
  ghost.classList.remove('rounded-corners', 'circle');
}
