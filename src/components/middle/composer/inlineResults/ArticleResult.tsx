import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';

import type { ApiBotInlineMediaResult, ApiBotInlineResult } from '../../../../api/types';

import useLastCallback from '../../../../hooks/useLastCallback';

import BaseResult from './BaseResult';

export type OwnProps = {
  focus?: boolean;
  inlineResult: ApiBotInlineResult | ApiBotInlineMediaResult;
  onClick: (result: ApiBotInlineResult | ApiBotInlineMediaResult) => void;
};

const ArticleResult: FC<OwnProps> = ({ focus, inlineResult, onClick }) => {
  const {
    title, description,
  } = inlineResult;

  const url = 'url' in inlineResult ? inlineResult.url : undefined;
  const webThumbnail = 'webThumbnail' in inlineResult ? inlineResult.webThumbnail : undefined;

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
