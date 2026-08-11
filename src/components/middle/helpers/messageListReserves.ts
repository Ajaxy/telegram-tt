import { addExtraClass, removeExtraClass } from '../../../lib/teact/teact-dom';

import {
  forceMeasure, forceMutation, requestForcedReflow, requestMeasure,
} from '../../../lib/fasterdom/fasterdom';
import { isAnimatingScroll } from '../../../util/animateScroll';
import buildStyle from '../../../util/buildStyle';
import { REM } from '../../common/helpers/mediaDimensions';

import senderGroupStyles from '../message/SenderGroupContainer.module.scss';

const AVATAR_OFFSET = 0.5 * REM;
const MESSAGE_LIST_COMPOSER_GAP = 0.5 * REM; // Mirrors `--message-list-composer-gap`
const NO_FOOTER_CLASS = 'no-footer';
const SELECT_MODE_CLASS = 'select-mode-active';
const BOTTOM_SNAP_CLASS = 'with-bottom-snap';
export const AT_BOTTOM_THRESHOLD = 4;
export const AT_TOP_THRESHOLD = 4;
export const SCROLL_BOTTOM_SENTINEL = 1e7;
const SCROLL_POSITION_TOLERANCE = 1;

const SEND_COLLAPSE_MAX_DURATION = 600;
const RESERVE_EPSILON = 0.5;
// Matches the desktop `--composer-min-bottom-reserve`; used only before stylesheets load
const FALLBACK_MIN_BOTTOM_INSET = 4 * REM;

type SendCollapseLatch = { prevReserve: number; restoreTimer: number };

const sendCollapseLatches = new WeakMap<HTMLElement, SendCollapseLatch>();

const pendingTopGrowthByScroller = new WeakMap<HTMLElement, number>();

export function consumePendingTopGrowth(scroller: HTMLElement) {
  const value = pendingTopGrowthByScroller.get(scroller) || 0;
  pendingTopGrowthByScroller.delete(scroller);
  return value;
}

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
  const actionBar = footer.querySelector<HTMLElement>('[data-footer-action-bar]');
  return Math.max(footer.offsetHeight, actionBar?.offsetHeight ?? 0);
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

export function buildTopStackCacheKey(chatId: string, threadId: number | string, messageListType: string) {
  return `${chatId}_${threadId}_${messageListType}`;
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

  const panesWrapper = middleColumn.querySelector<HTMLElement>('.MiddleHeaderPanesIsland');
  if (panesWrapper) {
    Array.from(panesWrapper.children).forEach((child) => {
      const paneEl = child as HTMLElement;
      if (paneEl.offsetParent && paneEl.dataset.isPanelOpen) {
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

export function updateTopReserveWithScrollCompensation(
  middleColumn: HTMLElement,
  heightDelta: number,
  applyReserveMutation: NoneToVoidFunction,
  extraMutationTargets?: HTMLElement[],
) {
  const scrollers = heightDelta
    ? Array.from(middleColumn.querySelectorAll<HTMLElement>('.MessageList'))
    : [];

  requestForcedReflow(() => {
    const plans = scrollers
      .filter((scroller) => scroller.offsetParent)
      .map((scroller) => ({
        scroller,
        wasAtBottom: scroller.scrollHeight - scroller.scrollTop - scroller.offsetHeight <= AT_BOTTOM_THRESHOLD,
        wasAtTop: scroller.scrollTop <= AT_TOP_THRESHOLD,
        prevScrollTop: scroller.scrollTop,
        prevScrollHeight: scroller.scrollHeight,
        bottomDistance: scroller.scrollHeight - scroller.scrollTop,
        hadSnap: scroller.classList.contains(BOTTOM_SNAP_CLASS),
      }));

    forceMutation(() => {
      plans.forEach(({ scroller }) => removeExtraClass(scroller, BOTTOM_SNAP_CLASS));
      applyReserveMutation();
    }, [middleColumn, ...scrollers, ...(extraMutationTargets || [])]);

    if (!plans.length) return undefined;

    const validPlans = plans.filter(({ scroller, prevScrollTop }) => {
      const currentScrollTop = scroller.scrollTop;
      return Math.abs(currentScrollTop - prevScrollTop) <= SCROLL_POSITION_TOLERANCE
        || Math.abs(currentScrollTop - (prevScrollTop + heightDelta)) <= SCROLL_POSITION_TOLERANCE;
    });

    if (!validPlans.length) return undefined;

    const targets = validPlans.map(({
      scroller, wasAtBottom, wasAtTop, prevScrollTop, prevScrollHeight, bottomDistance, hadSnap,
    }) => {
      let scrollTop;
      if (wasAtBottom) {
        scrollTop = scroller.scrollHeight - scroller.clientHeight;
      } else if (wasAtTop) {
        scrollTop = prevScrollTop;
      } else {
        scrollTop = scroller.scrollHeight - bottomDistance;
      }
      const measuredGrowth = scroller.scrollHeight - prevScrollHeight;
      const validatedScrollTop = scroller.scrollTop;
      const shouldRestoreSnap = hadSnap && Math.abs(scrollTop - validatedScrollTop) <= SCROLL_POSITION_TOLERANCE;
      return {
        scroller, scrollTop, validatedScrollTop, measuredGrowth, shouldRestoreSnap,
      };
    });

    return () => {
      targets.forEach(({
        scroller, scrollTop, validatedScrollTop, measuredGrowth, shouldRestoreSnap,
      }) => {
        // All forced-reflow callbacks run before any of their deferred mutations, so another
        // task's mutation (e.g. the `MessageList` reflow restoring a freshly opened chat's
        // position) may land between the plan validation above and this write — such a writer
        // owns the position, and applying the plan over it would clobber a valid restore
        const liveScrollTop = forceMeasure(() => scroller.scrollTop);
        if (Math.abs(liveScrollTop - validatedScrollTop) <= SCROLL_POSITION_TOLERANCE) {
          scroller.scrollTop = scrollTop;
          if (shouldRestoreSnap) addExtraClass(scroller, BOTTOM_SNAP_CLASS);
        }
        const pending = (pendingTopGrowthByScroller.get(scroller) || 0) + measuredGrowth;
        if (pending > 0) {
          pendingTopGrowthByScroller.set(scroller, pending);
        } else {
          pendingTopGrowthByScroller.delete(scroller);
        }
      });
    };
  });
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
