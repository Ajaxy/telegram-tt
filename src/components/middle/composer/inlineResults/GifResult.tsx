import React, {
  FC, memo, useCallback,
} from '../../../../lib/teact/teact';

import { ApiBotInlineMediaResult, ApiBotInlineResult, ApiVideo } from '../../../../api/types';

import { ObserveFn } from '../../../../hooks/useIntersectionObserver';

import GifButton from '../../../common/GifButton';

type OwnProps = {
  inlineResult: ApiBotInlineMediaResult;
  isSavedMessages?: boolean;
  canSendGifs?: boolean;
  observeIntersection: ObserveFn;
  onClick: (result: ApiBotInlineResult, isSilent?: boolean, shouldSchedule?: boolean) => void;
};

const GifResult: FC<OwnProps> = ({
  inlineResult, isSavedMessages, canSendGifs, observeIntersection, onClick,
}) => {
  const { gif } = inlineResult;

  const handleClick = useCallback((_gif: ApiVideo, isSilent?: boolean, shouldSchedule?: boolean) => {
    onClick(inlineResult, isSilent, shouldSchedule);
  }, [inlineResult, onClick]);

  if (!gif) {
    return undefined;
  }

  return (
    <GifButton
      gif={gif}
      observeIntersection={observeIntersection}
      className="chat-item-clickable"
      onClick={canSendGifs ? handleClick : undefined}
      isSavedMessages={isSavedMessages}
    />
  );
};

export default memo(GifResult);
