import { forceMutation } from '../../../lib/fasterdom/fasterdom';
import { REM } from '../../common/helpers/mediaDimensions';

import senderGroupStyles from '../message/SenderGroupContainer.module.scss';

export const MIN_BOTTOM_INSET = 4.25 * REM;
const AVATAR_OFFSET = 0.5 * REM;
export const COMPOSER_BOTTOM_GAP = 0.5 * REM;
const NO_FOOTER_CLASS = 'no-footer';
const SELECT_MODE_CLASS = 'select-mode-active';
const BASE_RESERVE_CLASSES = ['type-pinned', 'saved-dialog'];
export const BOTTOM_PIN_THRESHOLD = 4;
export const TOP_PIN_THRESHOLD = 4;
export const SCROLL_BOTTOM_SENTINEL = 1e7;

export function getMessageListBottomReserve(scroller: HTMLElement) {
  if (scroller.classList.contains(SELECT_MODE_CLASS)) {
    return MIN_BOTTOM_INSET + COMPOSER_BOTTOM_GAP;
  }
  if (scroller.classList.contains(NO_FOOTER_CLASS)) return 0;
  if (BASE_RESERVE_CLASSES.some((cls) => scroller.classList.contains(cls))) {
    return MIN_BOTTOM_INSET + COMPOSER_BOTTOM_GAP;
  }
  const footer = scroller.parentElement?.querySelector<HTMLElement>(':scope > .middle-column-footer');
  if (!footer) return 0;
  if (getComputedStyle(footer).position !== 'absolute') return 0;
  const buttonContainer = footer.querySelector<HTMLElement>('.middle-column-footer-button-container');
  const footerHeight = Math.max(footer.offsetHeight, buttonContainer?.offsetHeight ?? 0);
  return Math.max(footerHeight + COMPOSER_BOTTOM_GAP, MIN_BOTTOM_INSET);
}

export function getMessageListTopReserve(scroller: HTMLElement) {
  const middleColumn = scroller.closest<HTMLElement>('#MiddleColumn');
  if (!middleColumn) return 0;

  const scrollerTop = scroller.getBoundingClientRect().top;
  let bottom = 0;

  const header = middleColumn.querySelector<HTMLElement>('.MiddleHeader');
  if (header?.offsetParent) {
    bottom = header.getBoundingClientRect().bottom - scrollerTop;
  }

  const panesWrapper = middleColumn.querySelector<HTMLElement>('.MiddleHeaderPanes');
  if (panesWrapper) {
    Array.from(panesWrapper.children).forEach((child) => {
      const paneEl = child as HTMLElement;
      if (paneEl.offsetParent) {
        bottom = Math.max(bottom, paneEl.getBoundingClientRect().bottom - scrollerTop);
      }
    });
  }

  return Math.max(0, bottom);
}

export function applyMessageListBottomInset(scroller: HTMLElement, bottomReserve: number) {
  const inset = bottomReserve > 0 ? `${bottomReserve}px` : '';
  const fade = bottomReserve > 0 ? `${Math.max(bottomReserve - COMPOSER_BOTTOM_GAP, 0)}px` : '';
  const avatarBottom = bottomReserve > 0 ? `${bottomReserve + AVATAR_OFFSET}px` : '';

  scroller.style.setProperty('--message-list-bottom-inset', inset);
  scroller.style.setProperty('--message-list-bottom-fade', fade);

  scroller.querySelectorAll<HTMLElement>('.messages-container').forEach((container) => {
    container.style.paddingBottom = inset;
  });
  scroller.querySelectorAll<HTMLElement>(`.${senderGroupStyles.senderAvatar}`).forEach((avatar) => {
    avatar.style.bottom = avatarBottom;
  });
}

export function syncMessageListBottomReserve(
  scroller: HTMLElement, shouldSkipBottomPin = false, forceBottomPin = false,
) {
  const bottomReserve = getMessageListBottomReserve(scroller);
  const isAtBottom = forceBottomPin
    || scroller.scrollHeight - scroller.scrollTop - scroller.offsetHeight <= BOTTOM_PIN_THRESHOLD;

  const insetTargets: HTMLElement[] = [
    // `applyMessageListBottomInset` writes the reserve/fade vars on the scroller itself, so it must be allowed too.
    scroller,
    ...scroller.querySelectorAll<HTMLElement>('.messages-container'),
    ...scroller.querySelectorAll<HTMLElement>(`.${senderGroupStyles.senderAvatar}`),
  ];

  forceMutation(() => {
    applyMessageListBottomInset(scroller, bottomReserve);
    if (isAtBottom && !shouldSkipBottomPin) {
      scroller.scrollTop = SCROLL_BOTTOM_SENTINEL;
    }
  }, insetTargets);
}
