import { useMemo } from '../../../../lib/teact/teact';

export enum ChatAnimationTypes {
  Move,
  Opacity,
  None,
}

export function useChatAnimationType<T extends number | string>(orderDiffById: Record<T, number>) {
  return useMemo(() => {
    const orderDiffs = Object.values(orderDiffById) as number[];
    const numberOfUp = orderDiffs.filter((diff) => diff < 0).length;
    const numberOfDown = orderDiffs.filter((diff) => diff > 0).length;

    return (chatId: T): ChatAnimationTypes => {
      const orderDiff = orderDiffById[chatId];
      if (orderDiff === 0) {
        return ChatAnimationTypes.None;
      }

      if (
        orderDiff === Infinity
        || orderDiff === -Infinity
        || (numberOfUp <= numberOfDown && orderDiff < 0)
        || (numberOfDown < numberOfUp && orderDiff > 0)
      ) {
        return ChatAnimationTypes.Opacity;
      }

      return ChatAnimationTypes.Move;
    };
  }, [orderDiffById]);
}
