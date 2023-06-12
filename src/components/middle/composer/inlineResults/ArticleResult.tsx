import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';

import type { ApiBotInlineResult } from '../../../../api/types';

import useLastCallback from '../../../../hooks/useLastCallback';

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

  const handleClick = useLastCallback(() => {
    onClick(inlineResult);
  });

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
