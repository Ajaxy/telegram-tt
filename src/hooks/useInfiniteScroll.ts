import { useCallback, useEffect, useRef } from '../lib/teact/teact';
import { LoadMoreDirection } from '../types';

import { areSortedArraysEqual } from '../util/iteratees';
import useForceUpdate from './useForceUpdate';
import usePrevious from './usePrevious';

type GetMore = (args: { direction: LoadMoreDirection }) => void;
type LoadMoreBackwards = (args: { offsetId?: number }) => void;

const DEFAULT_LIST_SLICE = 30;

export default (
  loadMoreBackwards?: LoadMoreBackwards,
  listIds?: number[],
  isDisabled = false,
  listSlice = DEFAULT_LIST_SLICE,
  forceFullPreload = false,
): [number[]?, GetMore?] => {
  const lastParamsRef = useRef<{
    direction?: LoadMoreDirection;
    offsetId?: number;
  }>();

  const viewportIdsRef = useRef<number[] | undefined>((() => {
    // Only run once to initialize
    if (!listIds || lastParamsRef.current) {
      return undefined;
    }

    const { newViewportIds } = getViewportSlice(listIds, listIds[0], LoadMoreDirection.Forwards, listSlice);
    return newViewportIds;
  })());

  const forceUpdate = useForceUpdate();

  const prevListIds = usePrevious(listIds);
  const prevIsDisabled = usePrevious(isDisabled);
  if (listIds && !isDisabled && (listIds !== prevListIds || isDisabled !== prevIsDisabled)) {
    const { offsetId = listIds[0], direction = LoadMoreDirection.Forwards } = lastParamsRef.current || {};
    const { newViewportIds } = getViewportSlice(listIds, offsetId, direction, listSlice);

    if (!viewportIdsRef.current || !areSortedArraysEqual(viewportIdsRef.current, newViewportIds)) {
      viewportIdsRef.current = newViewportIds;
    }
  }

  useEffect(() => {
    if (listIds && !isDisabled && loadMoreBackwards && forceFullPreload) {
      const viewportIds = viewportIdsRef.current!;
      loadMoreBackwards({ offsetId: viewportIds[viewportIds.length - 1] });
    }
  }, [listIds, isDisabled, loadMoreBackwards, forceFullPreload]);

  const getMore: GetMore = useCallback(({
    direction,
    noScroll,
  }: { direction: LoadMoreDirection; noScroll?: boolean }) => {
    const viewportIds = viewportIdsRef.current;

    const offsetId = viewportIds
      ? direction === LoadMoreDirection.Backwards ? viewportIds[viewportIds.length - 1] : viewportIds[0]
      : undefined;

    if (!listIds) {
      if (loadMoreBackwards) {
        loadMoreBackwards({ offsetId });
      }

      return;
    }

    if (!noScroll) {
      lastParamsRef.current = { ...lastParamsRef.current, direction, offsetId };
    }

    const {
      newViewportIds, areSomeLocal, areAllLocal,
    } = getViewportSlice(listIds, offsetId, direction, listSlice);

    if (areSomeLocal && !(viewportIds && areSortedArraysEqual(viewportIds, newViewportIds))) {
      viewportIdsRef.current = newViewportIds;
      forceUpdate();
    }

    if (!areAllLocal && loadMoreBackwards) {
      loadMoreBackwards({ offsetId });
    }
  }, [listIds, listSlice, loadMoreBackwards, forceUpdate]);

  return isDisabled ? [listIds] : [viewportIdsRef.current, getMore];
};

function getViewportSlice(
  sourceIds: number[],
  offsetId = 0,
  direction: LoadMoreDirection,
  listSlice: number,
) {
  const { length } = sourceIds;
  const index = sourceIds.indexOf(offsetId);
  const isForwards = direction === LoadMoreDirection.Forwards;
  const indexForDirection = isForwards ? index : (index + 1) || length;
  const from = Math.max(0, indexForDirection - listSlice);
  const to = indexForDirection + listSlice - 1;
  const newViewportIds = sourceIds.slice(Math.max(0, from), to + 1);

  let areSomeLocal;
  let areAllLocal;
  switch (direction) {
    case LoadMoreDirection.Forwards:
      areSomeLocal = indexForDirection > 0;
      areAllLocal = from >= 0;
      break;
    case LoadMoreDirection.Backwards:
      areSomeLocal = indexForDirection < length;
      areAllLocal = to <= length - 1;
      break;
  }

  return { newViewportIds, areSomeLocal, areAllLocal };
}
