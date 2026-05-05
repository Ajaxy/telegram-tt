import {
  useEffect,
  useRef,
  useSignal,
  useState,
} from '../lib/teact/teact';

import { requestMeasure, requestMutation } from '../lib/fasterdom/fasterdom';
import { areArraysShallowEqual } from '../util/areShallowEqual';
import buildStyle from '../util/buildStyle';
import getPointerPosition from '../util/events/getPointerPosition';
import { REM } from '../components/common/helpers/mediaDimensions';
import useLastCallback from './useLastCallback';

type ReorderableId = number | string;

type ReorderableListOptions<T extends ReorderableId> = {
  itemIds: T[];
  isDisabled?: boolean;
  withAutoscroll?: boolean;
  onReorder: (itemIds: T[]) => void;
};

type DragState<T extends ReorderableId> = {
  id: T;
  offsetY: number;
  left: number;
  top: number;
  centerY: number;
  translateY: number;
  width: number;
  height: number;
};

type RowProps = {
  ref: (element?: HTMLElement) => void;
};

type DragElementProps = {
  ref: (element?: HTMLElement) => void;
};

type HandleProps = {
  ref: (element?: HTMLElement) => void;
  role: 'button';
  tabIndex: number;
  onMouseDown: (event: React.MouseEvent) => void;
  onTouchStart: (event: React.TouchEvent) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
};

const AUTOSCROLL_EDGE_DISTANCE = 4 * REM;
const AUTOSCROLL_MAX_DELTA = 0.5 * REM;

export default function useReorderableList<T extends ReorderableId>({
  itemIds,
  isDisabled,
  withAutoscroll,
  onReorder,
}: ReorderableListOptions<T>) {
  const rowElementsRef = useRef(new Map<T, HTMLElement>());
  const dragElementsRef = useRef(new Map<T, HTMLElement>());
  const handleElementsRef = useRef(new Map<T, HTMLElement>());
  const itemIdsRef = useRef(itemIds);
  const pendingFocusIdRef = useRef<T | undefined>();
  const isAutoscrollScheduledRef = useRef(false);
  const scrollContainerRef = useRef<HTMLElement | undefined>();
  const lastPointerYRef = useRef<number | undefined>();
  const [getDragState, setDragState] = useSignal<DragState<T> | undefined>();
  const [draggedId, setDraggedId] = useState<T | undefined>();
  const [draggedHeight, setDraggedHeight] = useState<number | undefined>();

  useEffect(() => {
    itemIdsRef.current = itemIds;

    const pendingFocusId = pendingFocusIdRef.current;
    if (pendingFocusId === undefined) {
      return;
    }

    pendingFocusIdRef.current = undefined;
    handleElementsRef.current?.get(pendingFocusId)?.focus();
  }, [itemIds]);

  const reorder = useLastCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return;
    }

    const nextItemIds = moveItem(itemIdsRef.current, fromIndex, toIndex);
    itemIdsRef.current = nextItemIds;
    onReorder(nextItemIds);
  });

  const reorderDraggedItem = useLastCallback((itemId: T, centerY: number, isMovingDown: boolean) => {
    const currentItemIds = itemIdsRef.current;
    const currentIndex = currentItemIds.indexOf(itemId);

    if (currentIndex < 0) {
      return;
    }

    const withoutDraggedItemIds = currentItemIds.filter((currentId) => currentId !== itemId);
    const targetIndex = getTargetIndex(withoutDraggedItemIds, rowElementsRef.current, centerY, isMovingDown);
    const nextItemIds = [...withoutDraggedItemIds];
    nextItemIds.splice(targetIndex, 0, itemId);

    if (areArraysShallowEqual(currentItemIds, nextItemIds)) {
      return;
    }

    itemIdsRef.current = nextItemIds;
    onReorder(nextItemIds);
  });

  const updateDragFromPointer = useLastCallback((y: number, isMovingDown?: boolean) => {
    const dragState = getDragState();

    if (!dragState) {
      return;
    }

    const bounds = getVerticalBounds(itemIdsRef.current, rowElementsRef.current);
    const nextTop = y - dragState.offsetY;
    const clampedTop = bounds
      ? clamp(nextTop, bounds.top, Math.max(bounds.top, bounds.bottom - dragState.height))
      : nextTop;
    const translateY = clampedTop - dragState.top;
    const centerY = clampedTop + dragState.height / 2;
    const nextDragState = {
      ...dragState,
      centerY,
      translateY,
    };

    setDragState(nextDragState);
    requestMutation(() => {
      const currentDragState = getDragState();
      const dragElement = dragElementsRef.current.get(dragState.id);

      if (currentDragState !== nextDragState || !dragElement) {
        return;
      }

      dragElement.style.transform = `translateY(${nextDragState.translateY}px)`;
    });
    reorderDraggedItem(dragState.id, centerY, isMovingDown ?? centerY > dragState.centerY);
  });

  const scheduleAutoscroll = useLastCallback(() => {
    isAutoscrollScheduledRef.current = true;

    requestMeasure(() => {
      const dragState = getDragState();
      const scrollContainer = scrollContainerRef.current;
      const pointerY = lastPointerYRef.current;

      if (!dragState || !scrollContainer || pointerY === undefined) {
        isAutoscrollScheduledRef.current = false;
        return;
      }

      const autoscrollState = getAutoscrollState(scrollContainer, pointerY);

      if (!autoscrollState) {
        isAutoscrollScheduledRef.current = false;
        return;
      }

      requestMutation(() => {
        const currentDragState = getDragState();

        if (currentDragState !== dragState || scrollContainerRef.current !== scrollContainer) {
          if (!currentDragState || scrollContainerRef.current !== scrollContainer) {
            isAutoscrollScheduledRef.current = false;
          }

          return;
        }

        scrollContainer.scrollTop = autoscrollState.targetScrollTop;

        if (autoscrollState.delta) {
          requestMeasure(() => {
            updateDragFromPointer(pointerY, autoscrollState.delta > 0);
          });
        }

        scheduleAutoscroll();
      });
    });
  });

  const restartAutoscrollIfNeeded = useLastCallback((pointerY: number) => {
    const scrollContainer = scrollContainerRef.current;

    if (
      isAutoscrollScheduledRef.current
      || !scrollContainer
      || !getAutoscrollState(scrollContainer, pointerY)
    ) {
      return;
    }

    scheduleAutoscroll();
  });

  const handleDrag = useLastCallback((event: MouseEvent | TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    const { y } = getPointerPosition(event);
    lastPointerYRef.current = y;

    updateDragFromPointer(y);
    restartAutoscrollIfNeeded(y);
  });

  const handleRelease = useLastCallback(() => {
    const dragState = getDragState();
    const dragElement = dragState ? dragElementsRef.current.get(dragState.id) : undefined;

    if (dragState && dragElement) {
      const releasedId = dragState.id;

      requestMutation(() => {
        if (
          getDragState()?.id === releasedId
          || dragElementsRef.current.get(releasedId) !== dragElement
        ) {
          return;
        }

        dragElement.style.transform = '';
      });
    }

    isAutoscrollScheduledRef.current = false;
    scrollContainerRef.current = undefined;
    lastPointerYRef.current = undefined;
    setDragState(undefined);
    setDraggedId(undefined);
    setDraggedHeight(undefined);
  });

  useEffect(() => {
    if (draggedId === undefined) {
      return undefined;
    }

    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleRelease);
    document.addEventListener('touchmove', handleDrag, { passive: true });
    document.addEventListener('touchend', handleRelease);
    document.addEventListener('touchcancel', handleRelease);

    return () => {
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleRelease);
      document.removeEventListener('touchmove', handleDrag);
      document.removeEventListener('touchend', handleRelease);
      document.removeEventListener('touchcancel', handleRelease);
    };
  }, [draggedId]);

  const startDrag = useLastCallback((event: React.MouseEvent | React.TouchEvent, itemId: T) => {
    if (isDisabled || itemIdsRef.current.length < 2) {
      return;
    }

    if ('button' in event && event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rowElement = rowElementsRef.current.get(itemId);
    if (!rowElement) {
      return;
    }

    const { y } = getPointerPosition(event);
    lastPointerYRef.current = y;
    const {
      left, top, width, height,
    } = rowElement.getBoundingClientRect();

    const nextDragState = {
      id: itemId,
      offsetY: y - top,
      left,
      top,
      centerY: top + height / 2,
      translateY: 0,
      width,
      height,
    };

    setDragState(nextDragState);
    setDraggedId(itemId);
    setDraggedHeight(height);
    scrollContainerRef.current = withAutoscroll ? findScrollableContainer(rowElement) : undefined;

    restartAutoscrollIfNeeded(y);
  });

  const handleKeyboardReorder = useLastCallback((event: React.KeyboardEvent, itemId: T) => {
    if (isDisabled || itemIdsRef.current.length < 2) {
      return;
    }

    const currentIndex = itemIdsRef.current.indexOf(itemId);
    if (currentIndex < 0) {
      return;
    }

    const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (!delta) {
      return;
    }

    const nextIndex = currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= itemIdsRef.current.length) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    pendingFocusIdRef.current = itemId;
    reorder(currentIndex, nextIndex);
  });

  const getRowProps = useLastCallback((itemId: T): RowProps => {
    return {
      ref: (element?: HTMLElement) => {
        if (element) {
          rowElementsRef.current?.set(itemId, element);
        } else {
          rowElementsRef.current?.delete(itemId);
        }
      },
    };
  });

  const getHandleProps = useLastCallback((itemId: T): HandleProps => {
    return {
      ref: (element?: HTMLElement) => {
        if (element) {
          handleElementsRef.current?.set(itemId, element);
        } else {
          handleElementsRef.current?.delete(itemId);
        }
      },
      role: 'button',
      tabIndex: isDisabled || itemIds.length < 2 ? -1 : 0,
      onMouseDown: (event) => startDrag(event, itemId),
      onTouchStart: (event) => startDrag(event, itemId),
      onKeyDown: (event) => handleKeyboardReorder(event, itemId),
    };
  });

  const getDragElementProps = useLastCallback((itemId: T): DragElementProps => {
    return {
      ref: (element?: HTMLElement) => {
        if (element) {
          dragElementsRef.current?.set(itemId, element);

          const dragState = getDragState();
          if (dragState?.id === itemId) {
            element.style.transform = `translateY(${dragState.translateY}px)`;
          }
        } else {
          dragElementsRef.current?.delete(itemId);
        }
      },
    };
  });

  const getPlaceholderStyle = useLastCallback((itemId: T) => {
    if (draggedId !== itemId || draggedHeight === undefined) {
      return undefined;
    }

    return `height: ${draggedHeight}px`;
  });

  const getDragStyle = useLastCallback((itemId: T) => {
    const dragState = getDragState();
    if (dragState?.id !== itemId) {
      return undefined;
    }

    return buildStyle(
      'position: fixed',
      `left: ${dragState.left}px`,
      `top: ${dragState.top}px`,
      `transform: translateY(${dragState.translateY}px)`,
      `width: ${dragState.width}px`,
      `height: ${dragState.height}px`,
    );
  });

  return {
    draggedId,
    getRowProps,
    getDragElementProps,
    getHandleProps,
    getPlaceholderStyle,
    getDragStyle,
  };
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);

  return nextItems;
}

function getTargetIndex<T extends ReorderableId>(
  itemIds: T[],
  rowElements: Map<T, HTMLElement>,
  centerY: number,
  isMovingDown: boolean,
) {
  const measuredItems = itemIds.reduce<{ id: T; top: number; height: number }[]>((result, id) => {
    const element = rowElements.get(id);
    if (!element) {
      return result;
    }

    const { top, height } = element.getBoundingClientRect();
    result.push({ id, top, height });

    return result;
  }, []);

  measuredItems.sort((a, b) => a.top - b.top);

  if (isMovingDown) {
    let targetIndex = 0;

    for (const { id, top } of measuredItems) {
      if (centerY >= top) {
        targetIndex = itemIds.indexOf(id) + 1;
      }
    }

    return targetIndex;
  }

  for (const { id, top, height } of measuredItems) {
    if (centerY <= top + height) {
      return itemIds.indexOf(id);
    }
  }

  return itemIds.length;
}

function getVerticalBounds<T extends ReorderableId>(itemIds: T[], rowElements: Map<T, HTMLElement>) {
  return itemIds.reduce<{ top: number; bottom: number } | undefined>((bounds, id) => {
    const element = rowElements.get(id);
    if (!element) {
      return bounds;
    }

    const { top, bottom } = element.getBoundingClientRect();
    if (!bounds) {
      return { top, bottom };
    }

    return {
      top: Math.min(bounds.top, top),
      bottom: Math.max(bounds.bottom, bottom),
    };
  }, undefined);
}

function findScrollableContainer(element: HTMLElement) {
  let currentElement = element.parentElement;

  while (currentElement) {
    const isScrollable = currentElement.scrollHeight > currentElement.clientHeight;

    if (isScrollable) {
      return currentElement;
    }

    currentElement = currentElement.parentElement;
  }

  return undefined;
}

function getAutoscrollState(scrollContainer: HTMLElement, pointerY: number) {
  const { top, bottom } = scrollContainer.getBoundingClientRect();
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
  const distanceToTop = pointerY - top;
  const distanceToBottom = bottom - pointerY;
  const maxScrollTop = scrollHeight - clientHeight;

  if (distanceToTop < AUTOSCROLL_EDGE_DISTANCE && scrollTop > 0) {
    const distanceIntoEdge = AUTOSCROLL_EDGE_DISTANCE - Math.max(distanceToTop, 0);
    const delta = -Math.min(
      getAutoscrollSpeed(distanceIntoEdge),
      scrollTop,
    );

    return {
      delta,
      targetScrollTop: scrollTop + delta,
    };
  }

  if (distanceToBottom < AUTOSCROLL_EDGE_DISTANCE && scrollTop < maxScrollTop) {
    const distanceIntoEdge = AUTOSCROLL_EDGE_DISTANCE - Math.max(distanceToBottom, 0);
    const delta = Math.min(
      getAutoscrollSpeed(distanceIntoEdge),
      maxScrollTop - scrollTop,
    );

    return {
      delta,
      targetScrollTop: scrollTop + delta,
    };
  }

  return undefined;
}

function getAutoscrollSpeed(distanceIntoEdge: number) {
  return clamp(
    (distanceIntoEdge / AUTOSCROLL_EDGE_DISTANCE) * AUTOSCROLL_MAX_DELTA,
    1,
    AUTOSCROLL_MAX_DELTA,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
