import React, { memo } from '../../lib/teact/teact';

import type { OwnProps as AnimatedIconProps } from './AnimatedIcon';
import type { ApiSticker } from '../../api/types';
import { ApiMediaFormat } from '../../api/types';

import { getStickerPreviewHash } from '../../global/helpers';

import useMedia from '../../hooks/useMedia';

import AnimatedIconWithPreview from './AnimatedIconWithPreview';

type OwnProps =
  Partial<AnimatedIconProps>
  & { sticker?: ApiSticker; noLoad?: boolean; forcePreview?: boolean };

function AnimatedIconFromSticker(props: OwnProps) {
  const {
    sticker, noLoad, forcePreview, ...otherProps
  } = props;

  const thumbDataUri = sticker?.thumbnail?.dataUri;
  const localMediaHash = sticker && `sticker${sticker.id}`;
  const previewBlobUrl = useMedia(
    sticker ? getStickerPreviewHash(sticker.id) : undefined,
    noLoad && !forcePreview,
    ApiMediaFormat.BlobUrl,
  );
  const tgsUrl = useMedia(localMediaHash, noLoad);

  return (
    <AnimatedIconWithPreview
      tgsUrl={tgsUrl}
      previewUrl={previewBlobUrl}
      thumbDataUri={thumbDataUri}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...otherProps}
    />
  );
}

export default memo(AnimatedIconFromSticker);
