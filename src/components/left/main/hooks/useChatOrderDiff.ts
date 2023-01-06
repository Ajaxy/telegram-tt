import { useMemo } from '../../../../lib/teact/teact';
import usePrevious from '../../../../hooks/usePrevious';
import { mapValues } from '../../../../util/iteratees';
import { useChatAnimationType } from './useChatAnimationType';

export default function useChatOrderDiff(orderedIds: (string | number)[] | undefined) {
  const orderById = useMemo(() => {
    if (!orderedIds) {
      return undefined;
    }

    return orderedIds.reduce((acc, id, i) => {
      acc[id] = i;
      return acc;
    }, {} as Record<string, number>);
  }, [orderedIds]);

  const prevOrderById = usePrevious(orderById);

  const orderDiffById = useMemo(() => {
    if (!orderById || !prevOrderById) {
      return {};
    }

    return mapValues(orderById, (order, id) => {
      return prevOrderById[id] !== undefined ? order - prevOrderById[id] : -Infinity;
    });
  }, [orderById, prevOrderById]);

  const getAnimationType = useChatAnimationType(orderDiffById);

  return {
    orderDiffById,
    getAnimationType,
  };
}
