import type { ApiDimensions, ApiMessage } from '../../../api/types';
import { MediaViewerOrigin } from '../../../types';

import { ANIMATION_END_DELAY, MESSAGE_CONTENT_SELECTOR } from '../../../config';
import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getMessageHtmlId } from '../../../global/helpers';
import { applyStyles } from '../../../util/animation';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import stopEvent from '../../../util/stopEvent';
import getOffsetToContainer from '../../../util/visibility/getOffsetToContainer';
import { isElementInViewport } from '../../../util/visibility/isElementInViewport';
import windowSize from '../../../util/windowSize';
import {
  calculateDimensions,
  getMediaViewerAvailableDimensions,
  MEDIA_VIEWER_MEDIA_QUERY,
  REM,
} from '../../common/helpers/mediaDimensions';

const ANIMATION_DURATION = 200;
const MIDDLE_HEADER_PANES_HEIGHT_PROPERTY = '--middle-header-panes-height';
const EDITOR_LANDING_TIMEOUT = 1500;

let pendingEditorGhost: { ghost: HTMLDivElement; host: HTMLElement; fallbackTimeout: number } | undefined;

export function animateOpening(
  hasFooter: boolean,
  origin: MediaViewerOrigin,
  bestImageData: string,
  dimensions: ApiDimensions,
  isVideo: boolean,
  message?: ApiMessage,
  mediaIndex?: number,
  sourceId?: string,
) {
  const { mediaEl: fromImage } = getNodes(origin, message, mediaIndex, sourceId);
  if (!fromImage) {
    return false;
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
  } = getRenderedMediaRect(fromImage, dimensions);

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

  requestMutation(() => {
    const ghost = createGhost(bestImageData || fromImage);
    applyStyles(ghost, {
      top: `${toTop}px`,
      left: `${toLeft}px`,
      width: `${toWidth}px`,
      height: `${toHeight}px`,
      transform: `translate3d(${fromTranslateX}px, ${fromTranslateY}px, 0) scale(${fromScaleX}, ${fromScaleY})`,
    });
    applyShape(ghost, origin);

    getGhostHost().appendChild(ghost);
    document.body.classList.add('ghost-animating');

    requestMutation(() => {
      ghost.style.transform = '';
      clearShape(ghost);

      setTimeout(() => {
        requestMutation(() => {
          removeGhost(ghost);
          document.body.classList.remove('ghost-animating');
        });
      }, ANIMATION_DURATION + ANIMATION_END_DELAY);
    });
  });

  return true;
}

export function animateClosing(
  origin: MediaViewerOrigin, bestImageData: string, dimensions: ApiDimensions,
  message?: ApiMessage, mediaIndex?: number, sourceId?: string,
) {
  const { container, mediaEl: toImage } = getNodes(origin, message, mediaIndex, sourceId);
  if (!container || !toImage) {
    return;
  }

  const fromImage = document.getElementById('MediaViewer')!.querySelector<HTMLImageElement>(
    '.MediaViewerSlide--active img, .MediaViewerSlide--active video',
  );
  if (!fromImage) {
    return;
  }

  const {
    top: fromTop, left: fromLeft, width: fromWidth, height: fromHeight,
  } = fromImage.getBoundingClientRect();
  const {
    top: targetTop, left: toLeft, width: toWidth, height: toHeight,
  } = getRenderedMediaRect(toImage, dimensions);

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
    [
      MediaViewerOrigin.Inline,
      MediaViewerOrigin.ScheduledInline,
      MediaViewerOrigin.Album,
      MediaViewerOrigin.ScheduledAlbum,
      MediaViewerOrigin.RichPageBlock,
    ].includes(origin)
    && !isMessageImageFullyVisible(toImage)
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

  let styles: Record<string, string>;
  if (existingGhost) {
    const {
      top, left, width, height,
    } = existingGhost.getBoundingClientRect();
    const scaleX = width / toWidth;
    const scaleY = height / toHeight;

    styles = {
      transition: 'none',
      top: `${toTop}px`,
      left: `${toLeft}px`,
      transformOrigin: 'top left',
      transform: `translate3d(${left - toLeft}px, ${top - toTop}px, 0) scale(${scaleX}, ${scaleY})`,
      width: `${toWidth}px`,
      height: `${toHeight}px`,
    };
  } else {
    styles = {
      top: `${toTop}px`,
      left: `${toLeft}px`,
      width: `${toWidth}px`,
      height: `${toHeight}px`,
      transform: `translate3d(${fromTranslateX}px, ${fromTranslateY}px, 0) scale(${fromScaleX}, ${fromScaleY})`,
    };
  }

  requestMutation(() => {
    applyStyles(ghost, styles);
    if (!existingGhost) getGhostHost().appendChild(ghost);
    document.body.classList.add('ghost-animating');

    requestMutation(() => {
      if (existingGhost) {
        existingGhost.style.transition = '';
      }

      ghost.style.transform = '';

      if (shouldFadeOut) {
        ghost.style.opacity = '0';
      }

      applyShape(ghost, origin);

      setTimeout(() => {
        requestMutation(() => {
          removeGhost(ghost);
          document.body.classList.remove('ghost-animating');
        });
      }, ANIMATION_DURATION + ANIMATION_END_DELAY);
    });
  });
}

// Builds the flying ghost from the Media Viewer's current media while the viewer is still open, so
// the viewer can stay visible as an opaque backdrop until the editor is ready. Returns `false` when
// no source media is on screen, so the caller can close the viewer itself.
export function prepareMediaEditorGhost(bestImageData?: string) {
  const mediaViewer = document.getElementById('MediaViewer');
  const fromImage = mediaViewer?.querySelector<HTMLImageElement>(
    '.MediaViewerSlide--active img, .MediaViewerSlide--active video',
  );
  if (!fromImage) {
    return false;
  }

  const {
    top, left, width, height,
  } = fromImage.getBoundingClientRect();

  requestMutation(() => {
    discardPendingEditorGhost();

    // The closing Media Viewer is a modal `<dialog>` in the top layer, so a plain ghost on `body`
    // would be dimmed by its backdrop. A `manual` popover puts the ghost in the top layer too.
    const host = document.createElement('div');
    host.className = 'ghost-host';
    host.popover = 'manual';

    const ghost = createGhost(bestImageData || fromImage);
    ghost.classList.add('for-media-editor');
    applyStyles(ghost, {
      top: `${top}px`,
      left: `${left}px`,
      width: `${width}px`,
      height: `${height}px`,
    });

    host.appendChild(ghost);
    document.body.appendChild(host);
    host.showPopover();
    document.body.classList.add('ghost-animating');

    const fallbackTimeout = window.setTimeout(fadeOutPendingEditorGhost, EDITOR_LANDING_TIMEOUT);
    pendingEditorGhost = { ghost, host, fallbackTimeout };
  });

  return true;
}

export function landGhostInMediaEditor(target: HTMLElement, onLand: NoneToVoidFunction) {
  if (!pendingEditorGhost) {
    onLand();
    return;
  }

  const { ghost, host, fallbackTimeout } = pendingEditorGhost;
  clearTimeout(fallbackTimeout);
  pendingEditorGhost = undefined;

  requestMeasure(() => {
    const {
      top: toTop, left: toLeft, width: toWidth, height: toHeight,
    } = target.getBoundingClientRect();
    const {
      top: fromTop, left: fromLeft, width: fromWidth, height: fromHeight,
    } = ghost.getBoundingClientRect();

    const scaleX = fromWidth / toWidth;
    const scaleY = fromHeight / toHeight;

    requestMutation(() => {
      // Move the ghost box to the target, but keep it visually at the source via a transform, so
      // the transition lands on the exact target box (no residual transform / sub-pixel drift)
      applyStyles(ghost, {
        transition: 'none',
        top: `${toTop}px`,
        left: `${toLeft}px`,
        width: `${toWidth}px`,
        height: `${toHeight}px`,
        transformOrigin: 'top left',
        transform: `translate3d(${fromLeft - toLeft}px, ${fromTop - toTop}px, 0) scale(${scaleX}, ${scaleY})`,
      });

      requestMutation(() => {
        ghost.style.transition = '';
        ghost.style.transform = '';

        setTimeout(() => {
          onLand();

          setTimeout(() => {
            requestMutation(() => removeGhostHost(ghost, host));
          }, ANIMATION_END_DELAY);
        }, ANIMATION_DURATION + ANIMATION_END_DELAY);
      });
    });
  });
}

function fadeOutPendingEditorGhost() {
  if (!pendingEditorGhost) return;

  const { ghost, host } = pendingEditorGhost;
  pendingEditorGhost = undefined;

  requestMutation(() => {
    ghost.style.opacity = '0';

    setTimeout(() => {
      requestMutation(() => removeGhostHost(ghost, host));
    }, ANIMATION_DURATION + ANIMATION_END_DELAY);
  });
}

function discardPendingEditorGhost() {
  if (!pendingEditorGhost) return;

  clearTimeout(pendingEditorGhost.fallbackTimeout);
  removeGhostHost(pendingEditorGhost.ghost, pendingEditorGhost.host);
  pendingEditorGhost = undefined;
}

function createGhost(
  source: string | HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  origin?: MediaViewerOrigin,
) {
  const ghost = document.createElement('div');
  ghost.classList.add('ghost');

  const img = new Image();
  img.draggable = false;
  img.oncontextmenu = stopEvent;

  if (typeof source === 'string') {
    img.src = source;
  } else if (source instanceof HTMLCanvasElement) {
    img.src = source.toDataURL();
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

function getGhostHost() {
  return document.getElementById('MediaViewer') || document.body;
}

function removeGhost(ghost: HTMLDivElement) {
  ghost.parentElement?.removeChild(ghost);
}

function removeGhostHost(ghost: HTMLDivElement, host: HTMLElement) {
  removeGhost(ghost);
  host.remove();
  document.body.classList.remove('ghost-animating');
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

function getRenderedMediaRect(mediaEl: HTMLElement, dimensions: ApiDimensions) {
  const rect = mediaEl.getBoundingClientRect();
  if (getComputedStyle(mediaEl).objectFit !== 'contain') {
    return rect;
  }

  const { width, height } = calculateContainedDimensions(
    rect.width, rect.height, dimensions.width, dimensions.height,
  );

  return {
    top: rect.top + (rect.height - height) / 2,
    left: rect.left + (rect.width - width) / 2,
    width,
    height,
  };
}

function calculateContainedDimensions(
  availableWidth: number,
  availableHeight: number,
  mediaWidth: number,
  mediaHeight: number,
): ApiDimensions {
  const scale = Math.min(availableWidth / mediaWidth, availableHeight / mediaHeight);

  return {
    width: mediaWidth * scale,
    height: mediaHeight * scale,
  };
}

function isMessageImageFullyVisible(imageEl: HTMLElement) {
  const messageListElement = document.querySelector<HTMLDivElement>('.Transition_slide-active > .MessageList')!;

  const { top } = getOffsetToContainer(imageEl, messageListElement);
  const computedStyle = getComputedStyle(messageListElement);
  const headerPanesHeight = parseFloat(computedStyle.getPropertyValue(MIDDLE_HEADER_PANES_HEIGHT_PROPERTY)) || 0;
  const visibleTop = messageListElement.scrollTop + headerPanesHeight;
  const visibleBottom = messageListElement.scrollTop + messageListElement.offsetHeight;

  return top > visibleTop
    && top + imageEl.offsetHeight < visibleBottom;
}

function getTopOffset(hasFooter: boolean) {
  const mql = window.matchMedia(MEDIA_VIEWER_MEDIA_QUERY);
  let topOffsetRem = 4.125;
  if (hasFooter && !IS_TOUCH_ENV) {
    topOffsetRem += mql.matches ? 0.875 : 2.125;
  }

  return topOffsetRem * REM;
}

function getNodes(origin: MediaViewerOrigin, message?: ApiMessage, index?: number, sourceId?: string) {
  let containerSelector;
  let mediaSelector;

  switch (origin) {
    case MediaViewerOrigin.RichPageBlock:
    case MediaViewerOrigin.IVPageBlock: {
      const container = sourceId ? document.getElementById(sourceId) : undefined;
      const pageBlockMediaSelector = 'img.full-media, video.full-media, img.thumbnail:not(.blurred-bg), '
        + 'canvas.thumbnail:not(.blurred-bg), img, video';
      const mediaEls = container?.querySelectorAll<HTMLImageElement | HTMLVideoElement | HTMLCanvasElement>(
        pageBlockMediaSelector,
      );

      return {
        container,
        mediaEl: mediaEls?.[0],
      };
    }

    case MediaViewerOrigin.Album:
    case MediaViewerOrigin.ScheduledAlbum:
      // eslint-disable-next-line @stylistic/max-len
      containerSelector = `.Transition_slide-active > .MessageList #album-media-${getMessageHtmlId(message!.id, index)}`;
      mediaSelector = '.full-media';
      break;

    case MediaViewerOrigin.PreviewMedia:
      containerSelector = `#preview-media${index}`;
      mediaSelector = 'img';
      break;

    case MediaViewerOrigin.PollPreview:
      containerSelector = `#poll-media${getMessageHtmlId(message!.id, index)}`;
      mediaSelector = 'img.full-media, video.full-media, img.thumbnail:not(.blurred-bg), img, video';
      break;

    case MediaViewerOrigin.SharedMedia:
      containerSelector = `#shared-media${getMessageHtmlId(message!.id, index)}`;
      mediaSelector = 'img';
      break;

    case MediaViewerOrigin.SearchResult:
      containerSelector = `#search-media${getMessageHtmlId(message!.id, index)}`;
      mediaSelector = 'img';
      break;

    case MediaViewerOrigin.MiddleHeaderAvatar:
      containerSelector = '.MiddleHeader .Transition_slide-active .ChatInfo .Avatar';
      mediaSelector = '.avatar-media';
      break;

    case MediaViewerOrigin.SettingsAvatar:
      containerSelector = '#Settings .ProfileInfo .Transition_slide-active .ProfilePhoto';
      mediaSelector = '.avatar-media';
      break;

    case MediaViewerOrigin.ProfileAvatar:
      containerSelector = '#RightColumn .ProfileInfo .Transition_slide-active .ProfilePhoto';
      mediaSelector = '.avatar-media';
      break;

    case MediaViewerOrigin.ChannelAvatar:
    case MediaViewerOrigin.SuggestedAvatar:
      containerSelector = `.Transition_slide-active > .MessageList #${getMessageHtmlId(message!.id, index)}`;
      mediaSelector = '.Avatar img';
      break;

    case MediaViewerOrigin.StarsTransaction:
      containerSelector = '.transaction-media-preview';
      mediaSelector = index === 0 ? `.stars-transaction-media-${index} :is(img, video)` : undefined;
      break;

    case MediaViewerOrigin.SponsoredMessage:
      containerSelector = '.Transition_slide-active > .MessageList .sponsored-media-preview';
      mediaSelector = `${MESSAGE_CONTENT_SELECTOR} img.full-media,`
        + `${MESSAGE_CONTENT_SELECTOR} video.full-media,`
        + `${MESSAGE_CONTENT_SELECTOR} img.thumbnail:not(.blurred-bg)`;
      break;

    case MediaViewerOrigin.ScheduledInline:
    case MediaViewerOrigin.Inline:
    default:
      containerSelector = `.Transition_slide-active > .MessageList #${getMessageHtmlId(message!.id, index)}`;
      mediaSelector = `${MESSAGE_CONTENT_SELECTOR} :not(.embedded-thumb) > img.full-media,`
        + `${MESSAGE_CONTENT_SELECTOR} :not(.embedded-thumb) > video.full-media,`
        + `${MESSAGE_CONTENT_SELECTOR} :not(.embedded-thumb) > img.thumbnail:not(.blurred-bg)`;
  }

  const container = document.querySelector<HTMLElement>(containerSelector)!;
  const mediaEls = mediaSelector
    ? container?.querySelectorAll<HTMLImageElement | HTMLVideoElement>(mediaSelector) : undefined;

  return {
    container,
    mediaEl: mediaEls?.[0],
  };
}

function applyShape(ghost: HTMLDivElement, origin: MediaViewerOrigin) {
  switch (origin) {
    case MediaViewerOrigin.Album:
    case MediaViewerOrigin.ScheduledAlbum:
    case MediaViewerOrigin.Inline:
    case MediaViewerOrigin.ScheduledInline:
    case MediaViewerOrigin.StarsTransaction:
    case MediaViewerOrigin.PreviewMedia:
    case MediaViewerOrigin.PollPreview:
      ghost.classList.add('rounded-corners');
      break;

    case MediaViewerOrigin.MiddleHeaderAvatar:
    case MediaViewerOrigin.SuggestedAvatar:
    case MediaViewerOrigin.ChannelAvatar:
      ghost.classList.add('circle');
      break;
  }
}

function clearShape(ghost: HTMLDivElement) {
  ghost.classList.remove('rounded-corners', 'circle');
}
