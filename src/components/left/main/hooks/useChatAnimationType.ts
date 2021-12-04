import { useMemo } from '../../../../lib/teact/teact';

export enum ChatAnimationTypes {
  Move,
  Opacity,
  None,
}

export function useChatAnimationType(orderDiffById: Record<string, number>) {
  return useMemo(() => {
    const orderDiffs = Object.values(orderDiffById);
    const numberOfUp = orderDiffs.filter((diff) => diff < 0).length;
    const numberOfDown = orderDiffs.filter((diff) => diff > 0).length;

    return (chatId: string): ChatAnimationTypes => {
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
