import { useMemo } from '../../../../lib/teact/teact';

import { mapValues } from '../../../../util/iteratees';
import { useChatAnimationType } from './useChatAnimationType';

import usePreviousDeprecated from '../../../../hooks/usePreviousDeprecated';

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

  const orderDiffById = useMemo(() => {
    if (!orderById || !prevOrderById || key !== prevChatId) {
      return {};
    }

    return mapValues(orderById, (order, id) => {
      return prevOrderById[id] !== undefined ? order - prevOrderById[id] : -Infinity;
    });
  }, [key, orderById, prevChatId, prevOrderById]);

  const getAnimationType = useChatAnimationType(orderDiffById);

  return {
    orderDiffById,
    getAnimationType,
  };
}
