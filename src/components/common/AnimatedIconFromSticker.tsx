import React, { memo } from '../../lib/teact/teact';

import type { ApiSticker } from '../../api/types';
import type { OwnProps as AnimatedIconProps } from './AnimatedIcon';
import { ApiMediaFormat } from '../../api/types';

import { getStickerMediaHash } from '../../global/helpers';

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
  const localMediaHash = sticker && getStickerMediaHash(sticker, 'full');
  const previewBlobUrl = useMedia(
    sticker ? getStickerMediaHash(sticker, 'preview') : undefined,
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
