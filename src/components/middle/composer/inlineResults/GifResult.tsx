import React, {
  FC, memo, useCallback,
} from '../../../../lib/teact/teact';

import { ApiBotInlineMediaResult, ApiBotInlineResult } from '../../../../api/types';

import { ObserveFn } from '../../../../hooks/useIntersectionObserver';

import GifButton from '../../../common/GifButton';

type OwnProps = {
  inlineResult: ApiBotInlineMediaResult;
  observeIntersection: ObserveFn;
  onClick: (result: ApiBotInlineResult) => void;
};

const GifResult: FC<OwnProps> = ({
  inlineResult, observeIntersection, onClick,
}) => {
  const { gif } = inlineResult;

  const handleClick = useCallback(() => {
    onClick(inlineResult);
  }, [inlineResult, onClick]);

  if (!gif) {
    return undefined;
  }

  return (
    <GifButton
      gif={gif}
      observeIntersection={observeIntersection}
      className="chat-item-clickable"
      onClick={handleClick}
    />
  );
};

export default memo(GifResult);
