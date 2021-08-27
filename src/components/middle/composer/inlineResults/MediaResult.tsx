import React, { FC, memo, useCallback } from '../../../../lib/teact/teact';

import {
  ApiBotInlineMediaResult, ApiBotInlineResult, ApiPhoto, ApiThumbnail, ApiWebDocument,
} from '../../../../api/types';

import useMedia from '../../../../hooks/useMedia';
import useTransitionForMedia from '../../../../hooks/useTransitionForMedia';

import BaseResult from './BaseResult';

import './MediaResult.scss';

export type OwnProps = {
  focus?: boolean;
  isForGallery?: boolean;
  inlineResult: ApiBotInlineMediaResult | ApiBotInlineResult;
  onClick: (result: ApiBotInlineResult) => void;
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
  if ('webThumbnail' in inlineResult && isForGallery) {
    webThumbnail = inlineResult.webThumbnail;
  }

  const thumbnailDataUrl = useMedia(webThumbnail ? `webDocument:${webThumbnail.url}` : undefined);
  const mediaBlobUrl = useMedia(photo && `photo${photo.id}?size=m`);
  const {
    shouldRenderThumb, shouldRenderFullMedia, transitionClassNames,
  } = useTransitionForMedia(mediaBlobUrl, 'slow');

  const handleClick = useCallback(() => {
    onClick(inlineResult);
  }, [inlineResult, onClick]);

  if (isForGallery) {
    return (
      <div className="MediaResult chat-item-clickable" onClick={handleClick}>
        {shouldRenderThumb && (
          <img src={(photo?.thumbnail?.dataUri) || thumbnailDataUrl} alt="" />
        )}
        {shouldRenderFullMedia && (
          <img src={mediaBlobUrl} className={`${transitionClassNames} full-media`} alt="" />
        )}
      </div>
    );
  }

  const { title, description } = inlineResult;

  return (
    <BaseResult
      focus={focus}
      thumbUrl={shouldRenderFullMedia ? mediaBlobUrl : (thumbnail?.dataUri) || thumbnailDataUrl}
      transitionClassNames={shouldRenderFullMedia ? transitionClassNames : undefined}
      title={title}
      description={description}
      onClick={handleClick}
    />
  );
};

export default memo(MediaResult);
