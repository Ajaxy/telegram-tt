import { useCallback } from '../../../../lib/teact/teact';

export enum ChatAnimationTypes {
  Move,
  Opacity,
  None,
}

export function useChatAnimationType(orderDiffById: Record<number, number>) {
  const movesUp = useCallback((id: number) => orderDiffById[id] < 0, [orderDiffById]);
  const movesDown = useCallback((id: number) => orderDiffById[id] > 0, [orderDiffById]);

  const orderDiffIds = Object.keys(orderDiffById).map(Number);
  const numberOfUp = orderDiffIds.filter(movesUp).length;
  const numberOfDown = orderDiffIds.filter(movesDown).length;

  return useCallback((chatId: number): ChatAnimationTypes => {
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
