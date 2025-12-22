import { useMemo } from '../../../../lib/teact/teact';

export enum ChatAnimationTypes {
  Shift,
  Move,
  Opacity,
  None,
}

export const ARCHIVE_ANIMATION_ID = 'archive';

export function useChatAnimationType<T extends number | string>(
  orderDiffById: Record<T, number>,
  isInitialRender: boolean,
  isShifted?: boolean,
) {
  return useMemo(() => {
    if (isInitialRender) {
      return () => ChatAnimationTypes.None;
    }

    const orderDiffs = Object.values<number>(orderDiffById);
    const numberOfUp = orderDiffs.filter((diff) => diff < 0).length;
    const numberOfDown = orderDiffs.filter((diff) => diff > 0).length;

    return (chatId: T): ChatAnimationTypes => {
      const orderDiff = orderDiffById[chatId];
      if (!orderDiff) {
        if (isShifted) {
          return ChatAnimationTypes.Shift;
        }
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
  }, [orderDiffById, isShifted, isInitialRender]);
}
