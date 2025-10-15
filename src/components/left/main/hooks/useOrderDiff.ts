import { useMemo, useRef } from '../../../../lib/teact/teact';

import { mapValues } from '../../../../util/iteratees';
import { useChatAnimationType } from './useChatAnimationType';

import useForceUpdate from '../../../../hooks/useForceUpdate';
import useLastCallback from '../../../../hooks/useLastCallback';
import usePreviousDeprecated from '../../../../hooks/usePreviousDeprecated';
import useSyncEffect from '../../../../hooks/useSyncEffect';

const EMPTY_ORDER_DIFF = {};

export default function useOrderDiff(orderedIds: (string | number)[] | undefined, key?: string) {
  const orderById = useMemo(() => {
    if (!orderedIds) {
      return undefined;
    }

    return orderedIds.reduce((acc, id, i) => {
      acc[id] = i;
      return acc;
    }, {} as Record<string, number>);
  }, [orderedIds]);

  const prevOrderById = usePreviousDeprecated(orderById);
  const prevChatId = usePreviousDeprecated(key);

  const orderDiffByIdRef = useRef<Record<string | number, number>>(EMPTY_ORDER_DIFF);
  const forceUpdate = useForceUpdate();

  const onReorderAnimationEnd = useLastCallback(() => {
    if (orderDiffByIdRef.current === EMPTY_ORDER_DIFF) return;

    orderDiffByIdRef.current = EMPTY_ORDER_DIFF;
    forceUpdate();
  });

  useSyncEffect(() => {
    if (!orderById || !prevOrderById || key !== prevChatId) {
      orderDiffByIdRef.current = EMPTY_ORDER_DIFF;
      return;
    }

    const diff = mapValues(orderById, (order, id) => {
      return prevOrderById[id] !== undefined ? order - prevOrderById[id] : -Infinity;
    });

    const hasChanges = Object.values(diff).some((value) => value !== 0);
    orderDiffByIdRef.current = hasChanges ? diff : EMPTY_ORDER_DIFF;
  }, [key, orderById, prevChatId, prevOrderById]);

  const getAnimationType = useChatAnimationType(orderDiffByIdRef.current);

  return {
    orderDiffById: orderDiffByIdRef.current,
    getAnimationType,
    onReorderAnimationEnd,
  };
}
