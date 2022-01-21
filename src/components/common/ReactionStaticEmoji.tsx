import { RefObject } from 'react';
import React, { FC, memo } from '../../lib/teact/teact';
import { getGlobal } from '../../lib/teact/teactn';

import { ApiMediaFormat } from '../../api/types';

import useMedia from '../../hooks/useMedia';
import buildClassName from '../../util/buildClassName';

import './ReactionStaticEmoji.scss';

type OwnProps = {
  reaction: string;
  ref?: RefObject<HTMLImageElement>;
  className?: string;
};

const ReactionStaticEmoji: FC<OwnProps> = ({
  reaction,
  ref,
  className,
}) => {
  const staticIconId = getGlobal().availableReactions?.find((l) => l.reaction === reaction)?.staticIcon?.id;
  const mediaData = useMedia(`document${staticIconId}`, !staticIconId, ApiMediaFormat.BlobUrl);

  return (
    <img
      className={buildClassName('ReactionStaticEmoji', className)}
      ref={ref}
      src={mediaData}
      alt=""
    />
  );
};

export default memo(ReactionStaticEmoji);
