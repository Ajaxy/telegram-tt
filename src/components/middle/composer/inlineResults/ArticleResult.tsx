import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../../lib/teact/teact';

import type { ApiBotInlineResult } from '../../../../api/types';

import BaseResult from './BaseResult';

export type OwnProps = {
  focus?: boolean;
  inlineResult: ApiBotInlineResult;
  onClick: (result: ApiBotInlineResult) => void;
};

const ArticleResult: FC<OwnProps> = ({ focus, inlineResult, onClick }) => {
  const {
    title, url, description, webThumbnail,
  } = inlineResult;

  const handleClick = useCallback(() => {
    onClick(inlineResult);
  }, [inlineResult, onClick]);

  return (
    <BaseResult
      focus={focus}
      thumbnail={webThumbnail}
      title={title || url}
      description={description}
      onClick={handleClick}
    />
  );
};

export default memo(ArticleResult);
