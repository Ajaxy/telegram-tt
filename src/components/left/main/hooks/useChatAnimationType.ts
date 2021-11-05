import { useCallback } from '../../../../lib/teact/teact';

export enum ChatAnimationTypes {
  Move,
  Opacity,
  None,
}

export function useChatAnimationType(orderDiffById: Record<string, number>) {
  const movesUp = useCallback((id: string) => orderDiffById[id] < 0, [orderDiffById]);
  const movesDown = useCallback((id: string) => orderDiffById[id] > 0, [orderDiffById]);

  const orderDiffIds = Object.keys(orderDiffById);
  const numberOfUp = orderDiffIds.filter(movesUp).length;
  const numberOfDown = orderDiffIds.filter(movesDown).length;

  return useCallback((chatId: string): ChatAnimationTypes => {
    const orderDiff = orderDiffById[chatId];

    if (orderDiff === 0) {
      return ChatAnimationTypes.None;
    }

    if (
      orderDiff === Infinity
      || orderDiff === -Infinity
      || (movesUp(chatId) && numberOfUp <= numberOfDown)
      || (movesDown(chatId) && numberOfDown < numberOfUp)
    ) {
      return ChatAnimationTypes.Opacity;
    }

    return ChatAnimationTypes.Move;
  }, [movesDown, movesUp, numberOfDown, numberOfUp, orderDiffById]);
}
