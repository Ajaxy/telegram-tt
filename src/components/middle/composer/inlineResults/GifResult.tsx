import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';

import type { ApiBotInlineMediaResult, ApiVideo } from '../../../../api/types';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';

import useLastCallback from '../../../../hooks/useLastCallback';

import GifButton from '../../../common/GifButton';

type OwnProps = {
  inlineResult: ApiBotInlineMediaResult;
  isSavedMessages?: boolean;
  canSendGifs?: boolean;
  observeIntersection: ObserveFn;
  onClick: (result: ApiBotInlineMediaResult, isSilent?: boolean, shouldSchedule?: boolean) => void;
};

const GifResult: FC<OwnProps> = ({
  inlineResult, isSavedMessages, canSendGifs, observeIntersection, onClick,
}) => {
  const { gif } = inlineResult;

  const handleClick = useLastCallback((_gif: ApiVideo, isSilent?: boolean, shouldSchedule?: boolean) => {
    onClick(inlineResult, isSilent, shouldSchedule);
  });

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
