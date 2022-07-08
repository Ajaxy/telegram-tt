import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';

import type { ApiBotInlineMediaResult, ApiBotInlineResult } from '../../../../api/types';

import { STICKER_SIZE_INLINE_BOT_RESULT } from '../../../../config';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';

import StickerButton from '../../../common/StickerButton';

type OwnProps = {
  inlineResult: ApiBotInlineMediaResult;
  isSavedMessages?: boolean;
  observeIntersection: ObserveFn;
  onClick: (result: ApiBotInlineResult, isSilent?: boolean, shouldSchedule?: boolean) => void;
  isCurrentUserPremium?: boolean;
};

const StickerResult: FC<OwnProps> = ({
  inlineResult,
  isSavedMessages,
  observeIntersection,
  onClick,
  isCurrentUserPremium,
}) => {
  const { sticker } = inlineResult;

  if (!sticker) {
    return undefined;
  }

  return (
    <StickerButton
      sticker={sticker}
      size={STICKER_SIZE_INLINE_BOT_RESULT}
      observeIntersection={observeIntersection}
      title={sticker.emoji}
      className="chat-item-clickable"
      onClick={onClick}
      clickArg={inlineResult}
      isSavedMessages={isSavedMessages}
      canViewSet
      isCurrentUserPremium={isCurrentUserPremium}
    />
  );
};

export default memo(StickerResult);
