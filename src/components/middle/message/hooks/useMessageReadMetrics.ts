import { type ElementRef, useEffect, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiMessageReadMetric } from '../../../../api/types';

import { requestMeasure } from '../../../../lib/fasterdom/fasterdom';
import { clamp } from '../../../../util/math';

import useLastCallback from '../../../../hooks/useLastCallback';
import { isBackgroundModeActive } from '../../../../hooks/window/useBackgroundMode';

const INITIAL_GRACE_MS = 300;
const END_GRACE_MS = 300;
const MIN_TIME_IN_VIEW_MS = 300;
const MAX_PHASE_DURATION_MS = 5 * 60 * 1000;
const ACTIVITY_TIMEOUT_MS = 15 * 1000;
const FULL_PERMILLE = 1000;
const INTERSECTION_THRESHOLD = 0;
const VIEW_ID_BYTES = 8;

type MessageReadMetricsOptions = {
  chatId: string;
  messageId: number;
  isEnabled?: boolean;
  isMessageListActive?: boolean;
  onReport: (trackedMessage: TrackedMessage, metric: ApiMessageReadMetric) => void;
};

type TrackedMessage = MessageReadMetricsOptions & {
  element: HTMLElement;
  isInViewport: boolean;
  hasReachedMaxLimit: boolean;
  activeUntilAt: number;
  phase?: TrackingPhase;
  endGraceTimeout?: number;
  maxDurationTimeout?: number;
};

type TrackingPhase = {
  viewId: string;
  lastTimestamp: number;
  timeInViewMs: number;
  activeTimeInViewMs: number;
  heightToViewportRatioPermille: number;
  postHeightPx: number;
  seenTopPx: number;
  seenBottomPx: number;
};

type VisibleBounds = {
  top: number;
  bottom: number;
};

type MessageReadMetricsTracker = ReturnType<typeof createMessageReadMetricsTracker>;

const trackers = new WeakMap<HTMLElement, MessageReadMetricsTracker>();

export default function useMessageReadMetrics({
  messageRef,
  containerRef,
  chatId,
  messageId,
  isEnabled,
  isMessageListActive,
}: {
  messageRef: ElementRef<HTMLDivElement>;
  containerRef?: ElementRef<HTMLDivElement>;
  chatId: string;
  messageId: number;
  isEnabled?: boolean;
  isMessageListActive?: boolean;
}) {
  const { scheduleMessageReadMetricsReport } = getActions();
  const trackedMessageRef = useRef<TrackedMessage>();
  const trackerRef = useRef<MessageReadMetricsTracker>();

  const handleReport = useLastCallback((trackedMessage: TrackedMessage, metric: ApiMessageReadMetric) => {
    scheduleMessageReadMetricsReport({ chatId: trackedMessage.chatId, metrics: [metric] });
  });

  useEffect(() => {
    const container = containerRef?.current;
    const element = messageRef.current;
    if (!container || !element || !isEnabled) {
      return undefined;
    }

    const tracker = getMessageReadMetricsTracker(container);
    trackerRef.current = tracker;
    const trackedMessage = tracker.addMessage(element, {
      chatId,
      messageId,
      isEnabled,
      isMessageListActive: undefined,
      onReport: handleReport,
    });
    trackedMessageRef.current = trackedMessage;

    return () => {
      tracker.removeMessage(trackedMessage);
      trackedMessageRef.current = undefined;
      trackerRef.current = undefined;
    };
  }, [chatId, containerRef, handleReport, isEnabled, messageId, messageRef]);

  useEffect(() => {
    if (!trackedMessageRef.current || !trackerRef.current) return;

    trackerRef.current.updateMessage(trackedMessageRef.current, {
      chatId,
      messageId,
      isEnabled,
      isMessageListActive,
      onReport: handleReport,
    });
  }, [chatId, containerRef, handleReport, isEnabled, isMessageListActive, messageId]);
}

function getMessageReadMetricsTracker(container: HTMLElement) {
  let tracker = trackers.get(container);

  if (!tracker) {
    tracker = createMessageReadMetricsTracker(container);
    trackers.set(container, tracker);
  }

  return tracker;
}

function createMessageReadMetricsTracker(container: HTMLElement) {
  const messages = new Map<HTMLElement, TrackedMessage>();
  const intersectionObserver = new IntersectionObserver(handleIntersection, {
    root: container,
    threshold: INTERSECTION_THRESHOLD,
  });
  const resizeObserver = new ResizeObserver(handleResize);

  let isDestroyed = false;
  let isMeasureScheduled = false;
  container.addEventListener('scroll', handleScroll, { passive: true });
  container.addEventListener('wheel', handleActivity, { passive: true });
  container.addEventListener('touchstart', handleActivity, { passive: true });
  container.addEventListener('touchmove', handleActivity, { passive: true });
  container.addEventListener('pointerdown', handleActivity, { passive: true });
  container.addEventListener('pointermove', handleActivity, { passive: true });
  document.addEventListener('keydown', handleKeyboardActivity);
  document.addEventListener('keypress', handleKeyboardActivity);
  window.addEventListener('blur', handleBlur);
  window.addEventListener('focus', handleFocus);

  function addMessage(element: HTMLElement, options: MessageReadMetricsOptions) {
    const trackedMessage: TrackedMessage = {
      ...options,
      element,
      isInViewport: false,
      hasReachedMaxLimit: false,
      activeUntilAt: Date.now() + ACTIVITY_TIMEOUT_MS,
    };

    messages.set(element, trackedMessage);
    intersectionObserver.observe(element);
    resizeObserver.observe(element);
    scheduleMeasure();

    return trackedMessage;
  }

  function updateMessage(trackedMessage: TrackedMessage, options: MessageReadMetricsOptions) {
    const now = Date.now();
    accumulateElapsedTime(trackedMessage, now);

    const wasEnabled = trackedMessage.isEnabled;
    const wasMessageListActive = trackedMessage.isMessageListActive;
    Object.assign(trackedMessage, options);

    if (!wasMessageListActive && trackedMessage.isMessageListActive) {
      trackedMessage.activeUntilAt = now + ACTIVITY_TIMEOUT_MS;
    }

    if (wasEnabled && !trackedMessage.isEnabled) {
      finishPhase(trackedMessage, now);
    } else {
      refreshMaxDurationTimer(trackedMessage, now);
    }

    scheduleMeasure();
  }

  function removeMessage(trackedMessage: TrackedMessage) {
    finishPhase(trackedMessage, Date.now());
    clearTimers(trackedMessage);

    intersectionObserver.unobserve(trackedMessage.element);
    resizeObserver.unobserve(trackedMessage.element);
    messages.delete(trackedMessage.element);

    if (!messages.size) {
      destroyTracker();
    }
  }

  function destroyTracker() {
    isDestroyed = true;
    trackers.delete(container);
    intersectionObserver.disconnect();
    resizeObserver.disconnect();
    container.removeEventListener('scroll', handleScroll);
    container.removeEventListener('wheel', handleActivity);
    container.removeEventListener('touchstart', handleActivity);
    container.removeEventListener('touchmove', handleActivity);
    container.removeEventListener('pointerdown', handleActivity);
    container.removeEventListener('pointermove', handleActivity);
    document.removeEventListener('keydown', handleKeyboardActivity);
    document.removeEventListener('keypress', handleKeyboardActivity);
    window.removeEventListener('blur', handleBlur);
    window.removeEventListener('focus', handleFocus);
  }

  function handleIntersection(entries: IntersectionObserverEntry[]) {
    const now = Date.now();

    entries.forEach((entry) => {
      const trackedMessage = messages.get(entry.target as HTMLElement);
      if (!trackedMessage?.isEnabled) return;

      if (!canUpdateTracking(trackedMessage)) {
        accumulateElapsedTime(trackedMessage, now);
        return;
      }

      if (entry.isIntersecting) {
        handleMessageEnter(trackedMessage, now);
      } else {
        handleMessageExit(trackedMessage, now);
      }
    });

    scheduleMeasure();
  }

  function handleResize() {
    scheduleMeasure();
  }

  function handleScroll() {
    handleActivity();
    scheduleMeasure();
  }

  function handleKeyboardActivity(e: KeyboardEvent) {
    if (e.target instanceof Node && !container.contains(e.target)) return;

    handleActivity();
  }

  function handleActivity() {
    const now = Date.now();
    messages.forEach((trackedMessage) => {
      if (trackedMessage.isEnabled && canUpdateTracking(trackedMessage)) {
        accumulateElapsedTime(trackedMessage, now);
        trackedMessage.activeUntilAt = now + ACTIVITY_TIMEOUT_MS;
      }
    });
  }

  function handleBlur() {
    const now = Date.now();
    messages.forEach((trackedMessage) => {
      accumulateElapsedTime(trackedMessage, now, true);
      refreshMaxDurationTimer(trackedMessage, now);
    });
  }

  function handleFocus() {
    const now = Date.now();
    messages.forEach((trackedMessage) => {
      if (trackedMessage.phase) {
        if (trackedMessage.isEnabled && trackedMessage.isMessageListActive) {
          trackedMessage.activeUntilAt = now + ACTIVITY_TIMEOUT_MS;
        }

        trackedMessage.phase.lastTimestamp = now;
        refreshMaxDurationTimer(trackedMessage, now);
      }
    });
    scheduleMeasure();
  }

  function scheduleMeasure() {
    if (isMeasureScheduled || isDestroyed) return;

    isMeasureScheduled = true;
    requestMeasure(measureMessages);
  }

  function measureMessages() {
    isMeasureScheduled = false;
    if (isDestroyed) return;

    const now = Date.now();
    const containerRect = container.getBoundingClientRect();
    const viewportHeight = containerRect.height;

    messages.forEach((trackedMessage) => {
      if (!trackedMessage.isEnabled) return;

      if (!canUpdateTracking(trackedMessage)) {
        accumulateElapsedTime(trackedMessage, now);
        return;
      }

      const messageRect = trackedMessage.element.getBoundingClientRect();
      const visibleBounds = getVisibleBounds(messageRect, containerRect);

      if (!visibleBounds) {
        handleMessageExit(trackedMessage, now);
        return;
      }

      handleMessageEnter(trackedMessage, now);
      updateVisibleRange(trackedMessage, messageRect, viewportHeight, visibleBounds);
    });
  }

  return {
    addMessage,
    updateMessage,
    removeMessage,
  };
}

function handleMessageEnter(trackedMessage: TrackedMessage, now: number) {
  clearEndGraceTimeout(trackedMessage);

  if (trackedMessage.hasReachedMaxLimit) {
    trackedMessage.isInViewport = true;
    return;
  }

  const wasInViewport = trackedMessage.isInViewport;
  trackedMessage.isInViewport = true;

  if (trackedMessage.phase) {
    if (wasInViewport) {
      accumulateElapsedTime(trackedMessage, now);
    } else {
      trackedMessage.phase.lastTimestamp = now;
    }
  } else if (canStartPhase(trackedMessage)) {
    startPhase(trackedMessage, now);
  }

  refreshMaxDurationTimer(trackedMessage, now);
}

function handleMessageExit(trackedMessage: TrackedMessage, now: number) {
  if (!trackedMessage.isInViewport && !trackedMessage.phase) return;

  if (trackedMessage.phase) {
    accumulateElapsedTime(trackedMessage, now, true);
  }

  trackedMessage.isInViewport = false;
  trackedMessage.hasReachedMaxLimit = false;
  clearMaxDurationTimeout(trackedMessage);

  if (!trackedMessage.phase) return;

  if (trackedMessage.phase.timeInViewMs < INITIAL_GRACE_MS) {
    finishPhase(trackedMessage, now);
    return;
  }

  if (trackedMessage.endGraceTimeout) return;

  trackedMessage.endGraceTimeout = window.setTimeout(() => {
    finishPhase(trackedMessage, Date.now());
  }, END_GRACE_MS);
}

function startPhase(trackedMessage: TrackedMessage, now: number) {
  trackedMessage.phase = {
    viewId: generateViewId(),
    lastTimestamp: now,
    timeInViewMs: 0,
    activeTimeInViewMs: 0,
    heightToViewportRatioPermille: 0,
    postHeightPx: 0,
    seenTopPx: Number.POSITIVE_INFINITY,
    seenBottomPx: 0,
  };
}

function finishPhase(trackedMessage: TrackedMessage, now: number, hasReachedMaxLimit?: boolean) {
  const { phase } = trackedMessage;
  if (!phase) return;

  accumulateElapsedTime(trackedMessage, now);
  clearTimers(trackedMessage);

  if (hasReachedMaxLimit && trackedMessage.isInViewport) {
    trackedMessage.hasReachedMaxLimit = true;
  }

  trackedMessage.phase = undefined;

  if (phase.timeInViewMs < MIN_TIME_IN_VIEW_MS) return;

  const seenRangeRatioPermille = calculateSeenRangeRatioPermille(phase);
  trackedMessage.onReport(trackedMessage, {
    messageId: trackedMessage.messageId,
    viewId: phase.viewId,
    timeInViewMs: Math.round(phase.timeInViewMs),
    activeTimeInViewMs: Math.round(phase.activeTimeInViewMs),
    heightToViewportRatioPermille: Math.round(phase.heightToViewportRatioPermille),
    seenRangeRatioPermille,
  });
}

function updateVisibleRange(
  trackedMessage: TrackedMessage,
  messageRect: DOMRect,
  viewportHeight: number,
  visibleBounds: VisibleBounds,
) {
  const { phase } = trackedMessage;
  if (!phase || messageRect.height <= 0 || viewportHeight <= 0) return;

  const postHeight = messageRect.height;
  const seenTop = clamp(visibleBounds.top - messageRect.top, 0, postHeight);
  const seenBottom = clamp(visibleBounds.bottom - messageRect.top, 0, postHeight);

  phase.postHeightPx = postHeight;
  phase.heightToViewportRatioPermille = (postHeight / viewportHeight) * FULL_PERMILLE;
  phase.seenTopPx = Math.min(phase.seenTopPx, seenTop);
  phase.seenBottomPx = Math.max(phase.seenBottomPx, seenBottom);
}

function accumulateElapsedTime(trackedMessage: TrackedMessage, now: number, shouldForceForeground?: boolean) {
  const { phase } = trackedMessage;
  if (!phase) return;

  if (!canAccumulateElapsedTime(trackedMessage, shouldForceForeground)) {
    phase.lastTimestamp = now;
    return;
  }

  const delta = Math.max(0, now - phase.lastTimestamp);
  const activeDelta = Math.max(0, Math.min(now, trackedMessage.activeUntilAt) - phase.lastTimestamp);

  phase.timeInViewMs += delta;
  phase.activeTimeInViewMs += activeDelta;
  phase.lastTimestamp = now;
}

function refreshMaxDurationTimer(trackedMessage: TrackedMessage, now: number) {
  const { phase } = trackedMessage;
  clearMaxDurationTimeout(trackedMessage);

  if (!phase) return;

  if (phase.timeInViewMs >= MAX_PHASE_DURATION_MS) {
    finishPhase(trackedMessage, now, true);
    return;
  }

  if (!canAccumulateElapsedTime(trackedMessage)) return;

  trackedMessage.maxDurationTimeout = window.setTimeout(() => {
    handleMaxDurationTimeout(trackedMessage);
  }, MAX_PHASE_DURATION_MS - phase.timeInViewMs);
}

function handleMaxDurationTimeout(trackedMessage: TrackedMessage) {
  const now = Date.now();
  trackedMessage.maxDurationTimeout = undefined;

  if (!canAccumulateElapsedTime(trackedMessage)) return;

  accumulateElapsedTime(trackedMessage, now);

  if (!trackedMessage.phase) return;

  if (trackedMessage.phase.timeInViewMs < MAX_PHASE_DURATION_MS) {
    refreshMaxDurationTimer(trackedMessage, now);
    return;
  }

  finishPhase(trackedMessage, now, true);
}

function canUpdateTracking(trackedMessage: TrackedMessage) {
  return Boolean(trackedMessage.isMessageListActive && !isBackgroundModeActive());
}

function canAccumulateElapsedTime(trackedMessage: TrackedMessage, shouldForceForeground?: boolean) {
  return Boolean(trackedMessage.isInViewport
    && trackedMessage.isMessageListActive
    && (shouldForceForeground || !isBackgroundModeActive()));
}

function getVisibleBounds(messageRect: DOMRect, containerRect: DOMRect): VisibleBounds | undefined {
  const top = Math.max(messageRect.top, containerRect.top);
  const bottom = Math.min(messageRect.bottom, containerRect.bottom);

  return bottom > top ? { top, bottom } : undefined;
}

function calculateSeenRangeRatioPermille(phase: TrackingPhase) {
  if (!phase.postHeightPx || !Number.isFinite(phase.seenTopPx) || phase.seenBottomPx <= phase.seenTopPx) {
    return 0;
  }

  return Math.round(clamp(
    ((phase.seenBottomPx - phase.seenTopPx) / phase.postHeightPx) * FULL_PERMILLE,
    0,
    FULL_PERMILLE,
  ));
}

function canStartPhase(trackedMessage: TrackedMessage) {
  return trackedMessage.isEnabled
    && canUpdateTracking(trackedMessage);
}

function clearTimers(trackedMessage: TrackedMessage) {
  clearEndGraceTimeout(trackedMessage);
  clearMaxDurationTimeout(trackedMessage);
}

function clearMaxDurationTimeout(trackedMessage: TrackedMessage) {
  if (trackedMessage.maxDurationTimeout) {
    clearTimeout(trackedMessage.maxDurationTimeout);
    trackedMessage.maxDurationTimeout = undefined;
  }
}

function clearEndGraceTimeout(trackedMessage: TrackedMessage) {
  if (!trackedMessage.endGraceTimeout) return;

  clearTimeout(trackedMessage.endGraceTimeout);
  trackedMessage.endGraceTimeout = undefined;
}

function generateViewId() {
  const bytes = new Uint8Array(VIEW_ID_BYTES);
  crypto.getRandomValues(bytes);

  return new DataView(bytes.buffer).getBigInt64(0, true).toString();
}
