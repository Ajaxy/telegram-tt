import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';

import type {
  ApiBotInlineMediaResult, ApiBotInlineResult, ApiPhoto, ApiThumbnail, ApiWebDocument,
} from '../../../../api/types';

import { getPhotoMediaHash, getWebDocumentHash } from '../../../../global/helpers';
import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';
import useMedia from '../../../../hooks/useMedia';
import useMediaTransitionDeprecated from '../../../../hooks/useMediaTransitionDeprecated';

import BaseResult from './BaseResult';

import './MediaResult.scss';

export type OwnProps = {
  focus?: boolean;
  isForGallery?: boolean;
  inlineResult: ApiBotInlineMediaResult | ApiBotInlineResult;
  onClick: (result: ApiBotInlineMediaResult | ApiBotInlineResult) => void;
};

const MediaResult: FC<OwnProps> = ({
  focus, isForGallery, inlineResult, onClick,
}) => {
  let photo: ApiPhoto | undefined;
  let thumbnail: ApiThumbnail | undefined;
  let webThumbnail: ApiWebDocument | undefined;

  if ('photo' in inlineResult) {
    photo = inlineResult.photo;
  }
  // For results with type=video (for example @stikstokbot)
  if ('thumbnail' in inlineResult) {
    thumbnail = inlineResult.thumbnail;
  }
  if ('webThumbnail' in inlineResult) {
    webThumbnail = inlineResult.webThumbnail;
  }

  const thumbnailBlobUrl = useMedia(getWebDocumentHash(webThumbnail));
  const mediaBlobUrl = useMedia(photo && getPhotoMediaHash(photo, 'pictogram'));
  const transitionClassNames = useMediaTransitionDeprecated(mediaBlobUrl || thumbnailBlobUrl);

  const handleClick = useLastCallback(() => {
    onClick(inlineResult);
  });

  if (isForGallery) {
    return (
      <div className="MediaResult chat-item-clickable" onClick={handleClick}>
        <img src={(photo?.thumbnail?.dataUri) || thumbnailBlobUrl} alt="" draggable={false} />
        <img
          src={mediaBlobUrl}
          className={buildClassName('full-media', transitionClassNames)}
          alt=""
          draggable={false}
        />
      </div>
    );
  }

  const { title, description } = inlineResult;

  return (
    <BaseResult
      focus={focus}
      thumbnail={webThumbnail}
      thumbUrl={mediaBlobUrl || thumbnail?.dataUri}
      transitionClassNames={transitionClassNames}
      title={title}
      description={description}
      onClick={handleClick}
    />
  );
};

export default memo(MediaResult);
