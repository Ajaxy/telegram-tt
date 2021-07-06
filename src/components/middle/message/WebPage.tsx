import React, { FC, memo, useCallback } from '../../../lib/teact/teact';

import { ApiMessage } from '../../../api/types';
import { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { getMessageWebPage } from '../../../modules/helpers';
import { calculateMediaDimensions } from './helpers/mediaDimensions';
import renderText from '../../common/helpers/renderText';
import trimText from '../../../util/trimText';
import buildClassName from '../../../util/buildClassName';

import SafeLink from '../../common/SafeLink';
import Photo from './Photo';
import Video from './Video';

import './WebPage.scss';

const MAX_TEXT_LENGTH = 170; // symbols

type OwnProps = {
  message: ApiMessage;
  observeIntersection?: ObserveFn;
  noAvatars?: boolean;
  shouldAutoLoad?: boolean;
  shouldAutoPlay?: boolean;
  inPreview?: boolean;
  lastSyncTime?: number;
  onMediaClick?: () => void;
  onCancelMediaTransfer?: () => void;
};

const WebPage: FC<OwnProps> = ({
  message,
  observeIntersection,
  noAvatars,
  shouldAutoLoad,
  shouldAutoPlay,
  inPreview,
  lastSyncTime,
  onMediaClick,
  onCancelMediaTransfer,
}) => {
  const webPage = getMessageWebPage(message);

  let isSquarePhoto = false;
  if (webPage && webPage.photo) {
    const { width, height } = calculateMediaDimensions(message);
    isSquarePhoto = width === height;
  }

  const handleMediaClick = useCallback(() => {
    onMediaClick!();
  }, [onMediaClick]);

  if (!webPage) {
    return undefined;
  }

  const {
    siteName,
    url,
    displayUrl,
    title,
    description,
    photo,
    video,
  } = webPage;
  const isMediaInteractive = (photo || video) && onMediaClick && !isSquarePhoto;
  const truncatedDescription = trimText(description, MAX_TEXT_LENGTH);

  const className = buildClassName(
    'WebPage',
    isSquarePhoto && 'with-square-photo',
    !photo && !video && !inPreview && 'without-media',
    video && 'with-video',
  );

  return (
    <div
      className={className}
      data-initial={(siteName || displayUrl)[0]}
      dir="auto"
    >
      {photo && !video && (
        <Photo
          message={message}
          observeIntersection={observeIntersection}
          noAvatars={noAvatars}
          shouldAutoLoad={shouldAutoLoad}
          size={isSquarePhoto ? 'pictogram' : 'inline'}
          nonInteractive={!isMediaInteractive}
          onClick={isMediaInteractive ? handleMediaClick : undefined}
          onCancelUpload={onCancelMediaTransfer}
        />
      )}
      <div className="WebPage-text">
        <SafeLink className="site-name" url={url} text={siteName || displayUrl} />
        {!inPreview && title && (
          <p className="site-title">{renderText(title)}</p>
        )}
        {truncatedDescription && (
          <p className="site-description">{renderText(truncatedDescription, ['emoji', 'br'])}</p>
        )}
      </div>
      {!inPreview && video && (
        <Video
          message={message}
          observeIntersection={observeIntersection!}
          noAvatars={noAvatars}
          shouldAutoLoad={shouldAutoLoad}
          shouldAutoPlay={shouldAutoPlay}
          lastSyncTime={lastSyncTime}
          onClick={isMediaInteractive ? handleMediaClick : undefined}
          onCancelUpload={onCancelMediaTransfer}
        />
      )}
    </div>
  );
};

export default memo(WebPage);
