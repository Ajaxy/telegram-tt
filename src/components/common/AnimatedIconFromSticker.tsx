import { memo } from '../../lib/teact/teact';

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
    sticker, noLoad, forcePreview, fitzModifier, ...otherProps
  } = props;

  const thumbDataUri = sticker?.thumbnail?.dataUri;
  const localMediaHash = sticker && getStickerMediaHash(sticker, 'full');
  const previewBlobUrl = useMedia(
    sticker ? getStickerMediaHash(sticker, 'preview') : undefined,
    Boolean(fitzModifier || (noLoad && !forcePreview)),
    ApiMediaFormat.BlobUrl,
  );
  const tgsUrl = useMedia(localMediaHash, noLoad);

  return (
    <AnimatedIconWithPreview
      tgsUrl={tgsUrl}
      previewUrl={fitzModifier ? undefined : previewBlobUrl}
      thumbDataUri={thumbDataUri}
      fitzModifier={fitzModifier}

      {...otherProps}
    />
  );
}

export default memo(AnimatedIconFromSticker);
