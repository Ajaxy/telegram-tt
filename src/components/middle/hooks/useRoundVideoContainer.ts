import { useEffect, useState } from '../../../lib/teact/teact';

import type { TrackKey } from '../../../util/audioPlayback/mediaPool';

import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import {
  getRoundVideoContainers, subscribeRoundVideoContainers,
} from '../../../util/audioPlayback/roundVideoContainers';
import getMiddleColumnVisibleBounds, { isMiddleColumnLayoutTransition } from '../helpers/getMiddleColumnVisibleBounds';

import useLastCallback from '../../../hooks/useLastCallback';
import useThrottledCallback from '../../../hooks/useThrottledCallback';

const INTERSECTION_THRESHOLDS = [0, 0.5, 1];
const HALF = 0.5;

export default function useRoundVideoContainer(trackKey: TrackKey | undefined, isSourceChat: boolean) {
  const [version, setVersion] = useState(0);
  const containers = trackKey ? getRoundVideoContainers(trackKey) : undefined;
  const [containerState, setContainerState] = useState<{
    key: TrackKey;
    isSourceChat: boolean;
    element?: HTMLDivElement;
  }>();

  const updateVisibility = useLastCallback(() => {
    if (!trackKey) {
      setContainerState(undefined);
      return;
    }

    let visibleElement: HTMLDivElement | undefined;
    const currentContainers = getRoundVideoContainers(trackKey);
    if (isSourceChat && currentContainers) {
      const column = document.getElementById('MiddleColumn')!;
      const columnBounds = getMiddleColumnVisibleBounds(column);
      const listBounds = new Map<Element, DOMRect>();

      for (const element of currentContainers) {
        const list = element.closest('.MessageList');
        if (!list || !element.isConnected) continue;

        const bounds = element.getBoundingClientRect();
        let viewport = listBounds.get(list);
        if (!viewport) {
          viewport = list.getBoundingClientRect();
          listBounds.set(list, viewport);
        }
        const top = Math.max(viewport.top, columnBounds.top);
        const bottom = Math.min(viewport.bottom, columnBounds.bottom);

        const centerY = bounds.top + bounds.height * HALF;
        if (bounds.width && centerY > top && centerY < bottom
          && bounds.right > Math.max(viewport.left, columnBounds.left)
          && bounds.left < Math.min(viewport.right, columnBounds.right)) {
          visibleElement = element;
          break;
        }
      }
    }
    setContainerState((current) => (current?.key === trackKey && current.isSourceChat === isSourceChat
      && current.element === visibleElement ? current : { key: trackKey, isSourceChat, element: visibleElement }));
  });
  const scheduleUpdate = useThrottledCallback(updateVisibility, [updateVisibility], requestMeasure);
  const handleTransitionEnd = useLastCallback((e: TransitionEvent) => {
    if (isMiddleColumnLayoutTransition(e)) scheduleUpdate();
  });
  const handleContainersChange = useLastCallback(() => {
    setVersion((current) => current + 1);
  });

  useEffect(() => {
    if (!trackKey) return undefined;

    const unsubscribe = subscribeRoundVideoContainers(trackKey, handleContainersChange);
    handleContainersChange();
    return unsubscribe;
  }, [trackKey]);

  useEffect(() => {
    scheduleUpdate();
    if (!trackKey || !isSourceChat || !containers) return undefined;

    const observer = new IntersectionObserver(scheduleUpdate, { threshold: INTERSECTION_THRESHOLDS });
    const lists = new Set<Element>();
    containers.forEach((element) => {
      observer.observe(element);
      const list = element.closest('.MessageList');
      if (list) lists.add(list);
    });
    lists.forEach((list) => list.addEventListener('scroll', scheduleUpdate));
    const column = document.getElementById('MiddleColumn')!;
    const layoutObserver = new MutationObserver(scheduleUpdate);
    layoutObserver.observe(column.closest('#Main')!, { attributes: true, attributeFilter: ['class'] });
    column.addEventListener('transitionend', handleTransitionEnd, true);
    window.addEventListener('resize', scheduleUpdate);
    window.visualViewport?.addEventListener('resize', scheduleUpdate);

    return () => {
      observer.disconnect();
      layoutObserver.disconnect();
      lists.forEach((list) => list.removeEventListener('scroll', scheduleUpdate));
      column.removeEventListener('transitionend', handleTransitionEnd, true);
      window.removeEventListener('resize', scheduleUpdate);
      window.visualViewport?.removeEventListener('resize', scheduleUpdate);
    };
  }, [trackKey, isSourceChat, containers, version, scheduleUpdate]);

  const isResolved = containerState?.key === trackKey && containerState?.isSourceChat === isSourceChat;
  const inlineContainer = isSourceChat && isResolved && containerState?.element?.isConnected
    ? containerState.element : undefined;

  return { inlineContainer, isVisibilityResolved: !isSourceChat || isResolved };
}
