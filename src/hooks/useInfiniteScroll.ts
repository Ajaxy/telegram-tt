import { useRef } from '../lib/teact/teact';

import { LoadMoreDirection } from '../types';

import { areSortedArraysEqual } from '../util/iteratees';
import useForceUpdate from './useForceUpdate';
import useLastCallback from './useLastCallback';
import usePreviousDeprecated from './usePreviousDeprecated';

type GetMore = (args: { direction: LoadMoreDirection }) => void;
type LoadMoreBackwards = (args: { offsetId?: string | number }) => void;

const DEFAULT_LIST_SLICE = 30;

const useInfiniteScroll = <ListId extends string | number>(
  loadMoreBackwards?: LoadMoreBackwards,
  listIds?: ListId[],
  isDisabled = false,
  listSlice = DEFAULT_LIST_SLICE,
): [ListId[]?, GetMore?, number?] => {
  const requestParamsRef = useRef<{
    direction?: LoadMoreDirection;
    offsetId?: ListId;
  }>();

  const currentStateRef = useRef<{ viewportIds: ListId[]; isOnTop: boolean; offset: number } | undefined>();
  if (!currentStateRef.current && listIds && !isDisabled) {
    const {
      newViewportIds,
      newIsOnTop,
      fromOffset,
    } = getViewportSlice(listIds, LoadMoreDirection.Forwards, listSlice, listIds[0]);
    currentStateRef.current = { viewportIds: newViewportIds, isOnTop: newIsOnTop, offset: fromOffset };
  }

  const forceUpdate = useForceUpdate();

  if (isDisabled) {
    requestParamsRef.current = {};
  }

  const prevListIds = usePreviousDeprecated(listIds);
  const prevIsDisabled = usePreviousDeprecated(isDisabled);
  if (listIds && !isDisabled && (listIds !== prevListIds || isDisabled !== prevIsDisabled)) {
    const { viewportIds, isOnTop } = currentStateRef.current || {};
    const currentMiddleId = viewportIds && !isOnTop ? viewportIds[Math.round(viewportIds.length / 2)] : undefined;
    const defaultOffsetId = currentMiddleId && listIds.includes(currentMiddleId) ? currentMiddleId : listIds[0];
    const { offsetId = defaultOffsetId, direction = LoadMoreDirection.Forwards } = requestParamsRef.current || {};
    const { newViewportIds, newIsOnTop, fromOffset } = getViewportSlice(listIds, direction, listSlice, offsetId);

    requestParamsRef.current = {};

    if (!viewportIds || !areSortedArraysEqual(viewportIds, newViewportIds)) {
      currentStateRef.current = { viewportIds: newViewportIds, isOnTop: newIsOnTop, offset: fromOffset };
    }
  } else if (!listIds) {
    currentStateRef.current = undefined;
  }

  const getMore: GetMore = useLastCallback(({
    direction,
    noScroll,
  }: { direction: LoadMoreDirection; noScroll?: boolean }) => {
    const { viewportIds } = currentStateRef.current || {};

    const offsetId = viewportIds
      ? direction === LoadMoreDirection.Backwards ? viewportIds[viewportIds.length - 1] : viewportIds[0]
      : undefined;

    if (!listIds) {
      if (loadMoreBackwards) {
        loadMoreBackwards({ offsetId });
      }

      return;
    }

    const {
      newViewportIds, areSomeLocal, areAllLocal, newIsOnTop, fromOffset,
    } = getViewportSlice(listIds, direction, listSlice, offsetId);

    if (areSomeLocal && !(viewportIds && areSortedArraysEqual(viewportIds, newViewportIds))) {
      currentStateRef.current = { viewportIds: newViewportIds, isOnTop: newIsOnTop, offset: fromOffset };
      forceUpdate();
    }

    if (!areAllLocal && loadMoreBackwards) {
      if (!noScroll) {
        requestParamsRef.current = { ...requestParamsRef.current, direction, offsetId };
      }

      loadMoreBackwards({ offsetId });
    }
  });

  return isDisabled ? [listIds] : [currentStateRef.current?.viewportIds, getMore, currentStateRef.current?.offset];
};

function getViewportSlice<ListId extends string | number>(
  sourceIds: ListId[],
  direction: LoadMoreDirection,
  listSlice: number,
  offsetId?: ListId,
) {
  const { length } = sourceIds;
  const index = offsetId ? sourceIds.indexOf(offsetId) : 0;
  const isForwards = direction === LoadMoreDirection.Forwards;
  const indexForDirection = isForwards ? index : (index + 1) || length;
  const from = Math.max(0, indexForDirection - listSlice);
  const to = indexForDirection + listSlice - 1;
  const newViewportIds = sourceIds.slice(Math.max(0, from), to + 1);

  let areSomeLocal;
  let areAllLocal;
  switch (direction) {
    case LoadMoreDirection.Forwards:
      areSomeLocal = indexForDirection >= 0;
      areAllLocal = from >= 0;
      break;
    case LoadMoreDirection.Backwards:
      areSomeLocal = indexForDirection < length;
      areAllLocal = to <= length - 1;
      break;
  }

  return {
    newViewportIds,
    areSomeLocal,
    areAllLocal,
    newIsOnTop: newViewportIds[0] === sourceIds[0],
    fromOffset: from,
  };
}

export default useInfiniteScroll;
