import { beginHeavyAnimation } from '../../../lib/teact/teact';

import type { ApiDimensions, ApiMessage } from '../../../api/types';
import { MediaViewerOrigin } from '../../../types';

import { ANIMATION_END_DELAY, MESSAGE_CONTENT_SELECTOR } from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getMessageHtmlId, getRichMessageMediaBlocks, isRichMediaMessage } from '../../../global/helpers';
import { applyStyles } from '../../../util/animation';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import { lerp } from '../../../util/math';
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
import { getPageMediaBlockId, isPageMediaBlock } from '../../iv/helpers/pageMedia';

type Rect = Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>;

type EditorGhostGeometry = {
  box: Rect;
  media: Rect;
  radii: number[];
};

type EditorGhost = {
  host: HTMLDivElement;
  ghost: HTMLDivElement;
  media: HTMLImageElement | HTMLCanvasElement;
  mediaSize: ApiDimensions;
  isAboveMediaViewer?: boolean;
  from: EditorGhostGeometry;
  to?: EditorGhostGeometry;
  animations: Animation[];
  fallbackTimeout?: number;
  isFadingOut?: boolean;
};

const ANIMATION_DURATION = 200;
const MIDDLE_HEADER_PANES_HEIGHT_PROPERTY = '--middle-header-panes-height';
const EDITOR_LANDING_TIMEOUT = 1500;
const EDITOR_GHOST_FLIGHT_STEPS = 16;
const CORNER_RADIUS_PROPERTIES = [
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
] as const;
const CORNER_ALIGNMENT_TOLERANCE = 1;
const MEDIA_VIEWER_SLIDE_SELECTOR = '.MediaViewerSlide--active img, .MediaViewerSlide--active video';

let editorGhost: EditorGhost | undefined;

export function getMediaViewerMedia() {
  return document.getElementById('MediaViewer')
    ?.querySelector<HTMLImageElement | HTMLVideoElement>(MEDIA_VIEWER_SLIDE_SELECTOR) || undefined;
}

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

// Puts a copy of the on-screen media exactly over it and keeps it there until it lands in the Media Editor.
// Measures, so it has to run in the measure phase. Returns `false` when the media can not be copied yet.
export function prepareMediaEditorGhost(
  fromEl: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement, isAboveMediaViewer?: boolean,
) {
  const mediaSize = getNaturalSize(fromEl);
  if (!mediaSize) return false;

  const elementRect = fromEl.getBoundingClientRect();
  const media = getFittedRect(mediaSize, elementRect, getComputedStyle(fromEl).objectFit);
  const { box, radii } = getClippedBox(intersectRects(elementRect, media), fromEl);
  if (!box.width || !box.height) return false;

  const host = document.createElement('div');
  host.className = 'ghost-host';
  const ghostEl = document.createElement('div');
  ghostEl.className = 'ghost for-media-editor';
  ghostEl.style.borderRadius = radii.map((radius) => `${radius}px`).join(' ');
  applyRect(ghostEl, box);
  const mediaEl = createEditorGhostMedia(fromEl, mediaSize);
  applyRect(mediaEl, getRelativeRect(media, box));
  ghostEl.appendChild(mediaEl);
  host.appendChild(ghostEl);

  const prevGhost = editorGhost;
  const ghost: EditorGhost = {
    host,
    ghost: ghostEl,
    media: mediaEl,
    mediaSize,
    isAboveMediaViewer,
    from: { box, media, radii },
    animations: [],
  };
  ghost.fallbackTimeout = window.setTimeout(() => {
    requestMutation(() => fadeOutEditorGhost(ghost));
  }, EDITOR_LANDING_TIMEOUT);
  editorGhost = ghost;

  requestMutation(() => {
    if (prevGhost) removeEditorGhost(prevGhost);
    if (editorGhost !== ghost) return;

    document.body.appendChild(host);
    if (isAboveMediaViewer) {
      // The Media Viewer is a modal `<dialog>` in the top layer, so a ghost on `body` would be under it
      host.popover = 'manual';
      host.showPopover();
      document.body.classList.add('ghost-animating');
    }
  });

  return true;
}

// Flies the ghost from wherever it is into the target and keeps it there. Measures, so it has to run in the
// measure phase.
export function landGhostInMediaEditor(target: HTMLElement, onLand: NoneToVoidFunction) {
  const ghost = editorGhost;
  if (!ghost || ghost.isFadingOut) {
    onLand();
    return;
  }

  clearTimeout(ghost.fallbackTimeout);
  const targetRect = target.getBoundingClientRect();
  const radius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
  const to: EditorGhostGeometry = {
    box: targetRect,
    media: getFittedRect(ghost.mediaSize, targetRect, 'cover'),
    radii: CORNER_RADIUS_PROPERTIES.map(() => radius),
  };

  requestMutation(() => {
    if (editorGhost !== ghost) return;
    if (ghost.isFadingOut) {
      onLand();
      return;
    }

    const from = getCurrentGeometry(ghost);
    ghost.animations.forEach((animation) => animation.cancel());
    ghost.from = from;
    ghost.to = to;
    ghost.ghost.style.borderRadius = `${radius}px`;
    applyRect(ghost.ghost, to.box);
    applyRect(ghost.media, getRelativeRect(to.media, to.box));

    // Only `transform` runs on the compositor, so the non-composited radius has an animation of its own
    const keyframes = buildFlightKeyframes(from, to);
    const timing: KeyframeAnimationOptions = { duration: ANIMATION_DURATION, easing: 'ease' };
    const flight = ghost.ghost.animate(keyframes.ghost, timing);
    flight.onfinish = onLand;
    ghost.animations = [
      flight,
      ghost.media.animate(keyframes.media, timing),
      ghost.ghost.animate(keyframes.radius, timing),
    ];
    beginHeavyAnimation(ANIMATION_DURATION + ANIMATION_END_DELAY);
  });
}

// Has to run in the mutation phase
export function fadeOutMediaEditorGhost(onEnd: NoneToVoidFunction) {
  if (!editorGhost || editorGhost.isFadingOut) {
    onEnd();
    return;
  }

  fadeOutEditorGhost(editorGhost, onEnd);
}

// Has to run in the mutation phase
export function discardMediaEditorGhost() {
  if (!editorGhost) return;

  removeEditorGhost(editorGhost);
  editorGhost = undefined;
}

function fadeOutEditorGhost(ghost: EditorGhost, onEnd?: NoneToVoidFunction) {
  if (editorGhost !== ghost) return;

  clearTimeout(ghost.fallbackTimeout);
  ghost.isFadingOut = true;
  const fade = ghost.ghost.animate(
    { opacity: [1, 0] }, { duration: ANIMATION_DURATION, easing: 'ease', fill: 'forwards' },
  );
  ghost.animations.push(fade);
  fade.onfinish = () => {
    onEnd?.();

    requestMutation(() => {
      if (editorGhost !== ghost) return;

      removeEditorGhost(ghost);
      editorGhost = undefined;
    });
  };
}

function removeEditorGhost({
  host, animations, fallbackTimeout, isAboveMediaViewer,
}: EditorGhost) {
  clearTimeout(fallbackTimeout);
  animations.forEach((animation) => animation.cancel());
  host.remove();
  if (isAboveMediaViewer) {
    document.body.classList.remove('ghost-animating');
  }
}

function createEditorGhostMedia(
  fromEl: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement, { width, height }: ApiDimensions,
) {
  if (fromEl instanceof HTMLImageElement) {
    const img = new Image();
    img.className = 'ghost-media';
    img.draggable = false;
    img.decoding = 'sync';
    img.src = fromEl.currentSrc || fromEl.src;
    return img;
  }

  const { width: windowWidth, height: windowHeight } = windowSize.get();
  const { devicePixelRatio } = window;
  const scale = Math.min(1, (windowWidth * devicePixelRatio) / width, (windowHeight * devicePixelRatio) / height);
  const canvas = document.createElement('canvas');
  canvas.className = 'ghost-media';
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')!.drawImage(fromEl, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function getNaturalSize(el: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): ApiDimensions | undefined {
  if (el instanceof HTMLImageElement) {
    return el.complete && el.naturalWidth ? { width: el.naturalWidth, height: el.naturalHeight } : undefined;
  }

  if (el instanceof HTMLCanvasElement) {
    return el.width && el.height ? { width: el.width, height: el.height } : undefined;
  }

  return el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && el.videoWidth
    ? { width: el.videoWidth, height: el.videoHeight } : undefined;
}

function getCurrentGeometry({ from, to, animations }: EditorGhost) {
  if (!to) return from;

  const progress = animations[0]?.effect?.getComputedTiming().progress;
  return interpolateGeometry(from, to, progress ?? 1);
}

// The ghost box moves from `from.box` to the target with a plain transform, while a counter-transform keeps
// its media at the interpolated media rect, so a cropped preview uncrops without distortion
function buildFlightKeyframes(from: EditorGhostGeometry, to: EditorGhostGeometry) {
  const mediaOffset = getRelativeRect(to.media, to.box);
  const ghost: Keyframe[] = [];
  const media: Keyframe[] = [];
  const radius: Keyframe[] = [];

  for (let step = 0; step <= EDITOR_GHOST_FLIGHT_STEPS; step++) {
    const { box, media: mediaRect, radii } = interpolateGeometry(from, to, step / EDITOR_GHOST_FLIGHT_STEPS);
    const scaleX = box.width / to.box.width;
    const scaleY = box.height / to.box.height;
    const mediaX = (mediaRect.left - box.left) / scaleX - mediaOffset.left;
    const mediaY = (mediaRect.top - box.top) / scaleY - mediaOffset.top;
    const mediaScaleX = mediaRect.width / (scaleX * to.media.width);
    const mediaScaleY = mediaRect.height / (scaleY * to.media.height);
    const radiiX = radii.map((r) => `${r / scaleX}px`).join(' ');
    const radiiY = radii.map((r) => `${r / scaleY}px`).join(' ');

    ghost.push({
      transform: `translate(${box.left - to.box.left}px, ${box.top - to.box.top}px) scale(${scaleX}, ${scaleY})`,
    });
    media.push({ transform: `translate(${mediaX}px, ${mediaY}px) scale(${mediaScaleX}, ${mediaScaleY})` });
    radius.push({ borderRadius: `${radiiX} / ${radiiY}` });
  }

  return { ghost, media, radius };
}

function interpolateGeometry(from: EditorGhostGeometry, to: EditorGhostGeometry, progress: number) {
  return {
    box: interpolateRect(from.box, to.box, progress),
    media: interpolateRect(from.media, to.media, progress),
    radii: from.radii.map((radius, i) => lerp(radius, to.radii[i], progress)),
  };
}

function interpolateRect(from: Rect, to: Rect, progress: number): Rect {
  return {
    left: lerp(from.left, to.left, progress),
    top: lerp(from.top, to.top, progress),
    width: lerp(from.width, to.width, progress),
    height: lerp(from.height, to.height, progress),
  };
}

function getFittedRect({ width, height }: ApiDimensions, rect: Rect, objectFit: string): Rect {
  if (objectFit !== 'cover' && objectFit !== 'contain') return rect;

  const scale = objectFit === 'cover'
    ? Math.max(rect.width / width, rect.height / height)
    : Math.min(rect.width / width, rect.height / height);
  const fittedWidth = width * scale;
  const fittedHeight = height * scale;

  return {
    left: rect.left + (rect.width - fittedWidth) / 2,
    top: rect.top + (rect.height - fittedHeight) / 2,
    width: fittedWidth,
    height: fittedHeight,
  };
}

// Clips the box by every scrolling or clipping ancestor and takes over their rounding at the shared corners
function getClippedBox(rect: Rect, el: HTMLElement) {
  const clips: { rect: Rect; style: CSSStyleDeclaration }[] = [];
  let box = rect;
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.overflow === 'visible') continue;

    const clipRect = parent.getBoundingClientRect();
    box = intersectRects(box, clipRect);
    clips.push({ rect: clipRect, style });
  }

  const radii = CORNER_RADIUS_PROPERTIES.map((property, corner) => clips.reduce((radius, clip) => (
    isCornerAligned(box, clip.rect, corner) ? Math.max(radius, parseFloat(clip.style[property]) || 0) : radius
  ), 0));

  return { box, radii };
}

function isCornerAligned(box: Rect, clip: Rect, corner: number) {
  const isRight = corner === 1 || corner === 2;
  const isBottom = corner === 2 || corner === 3;
  const deltaX = isRight ? box.left + box.width - clip.left - clip.width : box.left - clip.left;
  const deltaY = isBottom ? box.top + box.height - clip.top - clip.height : box.top - clip.top;

  return Math.abs(deltaX) <= CORNER_ALIGNMENT_TOLERANCE && Math.abs(deltaY) <= CORNER_ALIGNMENT_TOLERANCE;
}

function intersectRects(a: Rect, b: Rect): Rect {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);

  return {
    left,
    top,
    width: Math.max(0, Math.min(a.left + a.width, b.left + b.width) - left),
    height: Math.max(0, Math.min(a.top + a.height, b.top + b.height) - top),
  };
}

function getRelativeRect(rect: Rect, origin: Rect): Rect {
  return {
    left: rect.left - origin.left,
    top: rect.top - origin.top,
    width: rect.width,
    height: rect.height,
  };
}

function applyRect(element: HTMLElement, {
  left, top, width, height,
}: Rect) {
  applyStyles(element, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  });
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
  return getComputedStyle(mediaEl).objectFit === 'contain' ? getFittedRect(dimensions, rect, 'contain') : rect;
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

  if ((origin === MediaViewerOrigin.Inline || origin === MediaViewerOrigin.Album)
    && message && isRichMediaMessage(message)) {
    const block = getRichMessageMediaBlocks(message.content.richMessage!)[index || 0];
    return getPageBlockNodes(block && isPageMediaBlock(block)
      // eslint-disable-next-line @stylistic/max-len
      ? document.querySelector<HTMLElement>(`.Transition_slide-active > .MessageList #${getMessageHtmlId(message.id)} [id*="-page-media-"][id$="-${getPageMediaBlockId(block)}"]`) || undefined
      : undefined);
  }

  switch (origin) {
    case MediaViewerOrigin.RichPageBlock:
    case MediaViewerOrigin.IVPageBlock:
      return getPageBlockNodes(sourceId ? document.getElementById(sourceId) || undefined : undefined);

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

function getPageBlockNodes(container?: HTMLElement) {
  const mediaEls = container?.querySelectorAll<HTMLImageElement | HTMLVideoElement | HTMLCanvasElement>(
    'img.full-media, video.full-media, img.thumbnail:not(.blurred-bg), canvas.thumbnail:not(.blurred-bg), img, video',
  );

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
