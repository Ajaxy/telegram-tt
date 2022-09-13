import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../lib/teact/teact';

import type { ApiMessage } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { ISettings } from '../../../types';

import { getMessageWebPage } from '../../../global/helpers';
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
  canAutoLoad?: boolean;
  canAutoPlay?: boolean;
  inPreview?: boolean;
  lastSyncTime?: number;
  isDownloading?: boolean;
  isProtected?: boolean;
  theme: ISettings['theme'];
  onMediaClick?: () => void;
  onCancelMediaTransfer?: () => void;
};

const WebPage: FC<OwnProps> = ({
  message,
  observeIntersection,
  noAvatars,
  canAutoLoad,
  canAutoPlay,
  inPreview,
  lastSyncTime,
  isDownloading = false,
  isProtected,
  theme,
  onMediaClick,
  onCancelMediaTransfer,
}) => {
  const webPage = getMessageWebPage(message);

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
  const truncatedDescription = trimText(description, MAX_TEXT_LENGTH);
  const isArticle = Boolean(truncatedDescription || title || siteName);
  let isSquarePhoto = false;
  if (isArticle && webPage?.photo && !webPage.video) {
    const { width, height } = calculateMediaDimensions(message);
    isSquarePhoto = width === height;
  }
  const isMediaInteractive = (photo || video) && onMediaClick && !isSquarePhoto;

  const className = buildClassName(
    'WebPage',
    inPreview && 'in-preview',
    isSquarePhoto && 'with-square-photo',
    !photo && !video && !inPreview && 'without-media',
    video && 'with-video',
    !isArticle && 'no-article',
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
          canAutoLoad={canAutoLoad}
          size={isSquarePhoto ? 'pictogram' : 'inline'}
          nonInteractive={!isMediaInteractive}
          onClick={isMediaInteractive ? handleMediaClick : undefined}
          onCancelUpload={onCancelMediaTransfer}
          isDownloading={isDownloading}
          isProtected={isProtected}
          withAspectRatio
          theme={theme}
        />
      )}
      {isArticle && (
        <div className="WebPage-text">
          <SafeLink className="site-name" url={url} text={siteName || displayUrl} />
          {!inPreview && title && (
            <p className="site-title">{renderText(title)}</p>
          )}
          {truncatedDescription && (
            <p className="site-description">{renderText(truncatedDescription, ['emoji', 'br'])}</p>
          )}
        </div>
      )}
      {!inPreview && video && (
        <Video
          message={message}
          observeIntersection={observeIntersection!}
          noAvatars={noAvatars}
          canAutoLoad={canAutoLoad}
          canAutoPlay={canAutoPlay}
          lastSyncTime={lastSyncTime}
          onClick={isMediaInteractive ? handleMediaClick : undefined}
          onCancelUpload={onCancelMediaTransfer}
          isDownloading={isDownloading}
          isProtected={isProtected}
          withAspectRatio
        />
      )}
    </div>
  );
};

export default memo(WebPage);
