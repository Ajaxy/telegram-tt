import { forceMutation, requestMeasure } from '../../../lib/fasterdom/fasterdom';
import { isAnimatingScroll } from '../../../util/animateScroll';
import buildStyle from '../../../util/buildStyle';
import { REM } from '../../common/helpers/mediaDimensions';

import senderGroupStyles from '../message/SenderGroupContainer.module.scss';

const AVATAR_OFFSET = 0.5 * REM;
const MESSAGE_LIST_COMPOSER_GAP = 0.5 * REM; // Mirrors `--message-list-composer-gap`
const NO_FOOTER_CLASS = 'no-footer';
const SELECT_MODE_CLASS = 'select-mode-active';
export const AT_BOTTOM_THRESHOLD = 4;
export const AT_TOP_THRESHOLD = 4;
export const SCROLL_BOTTOM_SENTINEL = 1e7;

const SEND_COLLAPSE_MAX_DURATION = 600;
const RESERVE_EPSILON = 0.5;
// Matches the desktop `--composer-min-bottom-reserve`; used only before stylesheets load
const FALLBACK_MIN_BOTTOM_INSET = 4 * REM;

type SendCollapseLatch = { prevReserve: number; restoreTimer: number };

const sendCollapseLatches = new WeakMap<HTMLElement, SendCollapseLatch>();

function getMessageListBottomReserve(scroller: HTMLElement) {
  if (scroller.classList.contains(SELECT_MODE_CLASS)) {
    return getSettledBottomReserve();
  }
  if (scroller.classList.contains(NO_FOOTER_CLASS)) return 0;
  const footer = scroller.parentElement?.querySelector<HTMLElement>(':scope > .middle-column-footer');
  if (!footer) return 0;
  if (getComputedStyle(footer).position !== 'absolute') return 0;
  return Math.max(measureFooterContentHeight(footer) + MESSAGE_LIST_COMPOSER_GAP, getMinBottomInset());
}

export function measureFooterContentHeight(footer: HTMLElement) {
  const buttonContainer = footer.querySelector<HTMLElement>('.middle-column-footer-button-container');
  return Math.max(footer.offsetHeight, buttonContainer?.offsetHeight ?? 0);
}

// While armed, the reserve stays latched at the settled value for the whole composer collapse
// after a send — the shrinking pill is then a purely visual overlay over a static list
export function armSendCollapseReserve(scroller: HTMLElement) {
  const liveReserve = getMessageListBottomReserve(scroller);
  if (liveReserve <= getSettledBottomReserve() + RESERVE_EPSILON) return;

  const existing = sendCollapseLatches.get(scroller);
  if (existing) clearTimeout(existing.restoreTimer);

  const restoreTimer = window.setTimeout(() => {
    sendCollapseLatches.delete(scroller);
    if (scroller.isConnected) {
      requestMeasure(() => {
        syncMessageListBottomReserve(scroller);
      });
    }
  }, SEND_COLLAPSE_MAX_DURATION);

  sendCollapseLatches.set(scroller, { prevReserve: liveReserve, restoreTimer });
}

export function isSendCollapsePhaseActive(scroller: HTMLElement) {
  return sendCollapseLatches.has(scroller);
}

function disarmSendCollapseReserve(scroller: HTMLElement) {
  const latch = sendCollapseLatches.get(scroller);
  if (!latch) return;
  clearTimeout(latch.restoreTimer);
  sendCollapseLatches.delete(scroller);
}

export function getEffectiveMessageListBottomReserve(scroller: HTMLElement) {
  return isSendCollapsePhaseActive(scroller)
    ? getSettledBottomReserve()
    : getMessageListBottomReserve(scroller);
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
  scroller: HTMLElement, shouldSkipKeepAtBottom = false, forceKeepAtBottom = false,
) {
  const bottomReserve = getMessageListBottomReserve(scroller);
  const latch = sendCollapseLatches.get(scroller);
  if (latch) {
    const isSettled = bottomReserve <= getSettledBottomReserve() + RESERVE_EPSILON;
    const isGrowing = bottomReserve > latch.prevReserve + RESERVE_EPSILON;
    if (isSettled || isGrowing) {
      disarmSendCollapseReserve(scroller);
    } else {
      latch.prevReserve = bottomReserve;
      return;
    }
  }
  const isAtBottom = forceKeepAtBottom
    || scroller.scrollHeight - scroller.scrollTop - scroller.offsetHeight <= AT_BOTTOM_THRESHOLD;
  const canKeepAtBottom = !shouldSkipKeepAtBottom && !isAnimatingScroll(scroller);

  const insetTargets: HTMLElement[] = [
    // `applyMessageListBottomInset` writes the reserve/fade vars on the scroller itself, so it must be allowed too.
    scroller,
    ...scroller.querySelectorAll<HTMLElement>('.messages-container'),
    ...scroller.querySelectorAll<HTMLElement>(`.${senderGroupStyles.senderAvatar}`),
  ];

  forceMutation(() => {
    applyMessageListBottomInset(scroller, bottomReserve);
    if (isAtBottom && canKeepAtBottom) {
      scroller.scrollTop = SCROLL_BOTTOM_SENTINEL;
    }
  }, insetTargets);
}

function getSettledBottomReserve() {
  return getMinBottomInset() + MESSAGE_LIST_COMPOSER_GAP;
}

let minBottomInsetProbe: HTMLDivElement | undefined;

// The single source is `--composer-min-bottom-reserve`; its `calc()` cannot be parsed off
// a custom property, so a permanently mounted probe element evaluates it. The value is
// responsive (viewport, safe area, `body.keyboard-visible`), so it is re-read on every call.
function getMinBottomInset() {
  if (!minBottomInsetProbe) {
    minBottomInsetProbe = document.createElement('div');
    minBottomInsetProbe.style.cssText = buildStyle(
      'position: absolute',
      'visibility: hidden',
      'height: var(--composer-min-bottom-reserve)',
    );
    document.body.appendChild(minBottomInsetProbe);
  }

  return minBottomInsetProbe.offsetHeight || FALLBACK_MIN_BOTTOM_INSET;
}
