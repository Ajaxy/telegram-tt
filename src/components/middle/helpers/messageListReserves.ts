import { forceMutation } from '../../../lib/fasterdom/fasterdom';
import { REM } from '../../common/helpers/mediaDimensions';

import senderGroupStyles from '../message/SenderGroupContainer.module.scss';

const AVATAR_OFFSET = 0.5 * REM;
const MESSAGE_LIST_COMPOSER_GAP = 0.5 * REM; // Mirrors `--message-list-composer-gap`
const NO_FOOTER_CLASS = 'no-footer';
const SELECT_MODE_CLASS = 'select-mode-active';
const BASE_RESERVE_CLASSES = ['type-pinned', 'saved-dialog'];
export const BOTTOM_PIN_THRESHOLD = 4;
export const TOP_PIN_THRESHOLD = 4;
export const SCROLL_BOTTOM_SENTINEL = 1e7;

export function getMessageListBottomReserve(scroller: HTMLElement) {
  if (scroller.classList.contains(SELECT_MODE_CLASS)) {
    return getMinBottomInset() + MESSAGE_LIST_COMPOSER_GAP;
  }
  if (scroller.classList.contains(NO_FOOTER_CLASS)) return 0;
  if (BASE_RESERVE_CLASSES.some((cls) => scroller.classList.contains(cls))) {
    return getMinBottomInset() + MESSAGE_LIST_COMPOSER_GAP;
  }
  const footer = scroller.parentElement?.querySelector<HTMLElement>(':scope > .middle-column-footer');
  if (!footer) return 0;
  if (getComputedStyle(footer).position !== 'absolute') return 0;
  return Math.max(measureFooterContentHeight(footer) + MESSAGE_LIST_COMPOSER_GAP, getMinBottomInset());
}

export function measureFooterContentHeight(footer: HTMLElement) {
  const buttonContainer = footer.querySelector<HTMLElement>('.middle-column-footer-button-container');
  return Math.max(footer.offsetHeight, buttonContainer?.offsetHeight ?? 0);
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
  const fade = bottomReserve > 0 ? `${Math.max(bottomReserve - MESSAGE_LIST_COMPOSER_GAP, 0)}px` : '';
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

let minBottomInset: number | undefined;

// The single source is `--composer-min-bottom-reserve`; its `calc()` cannot be parsed off
// a custom property, so a probe element evaluates it once
function getMinBottomInset() {
  if (minBottomInset === undefined) {
    const probe = document.createElement('div');
    probe.style.cssText = 'position: absolute; visibility: hidden; height: var(--composer-min-bottom-reserve)';
    document.body.appendChild(probe);
    minBottomInset = probe.offsetHeight || 4 * REM;
    probe.remove();
  }

  return minBottomInset;
}
