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

import './WebPage.scss';

const MAX_TEXT_LENGTH = 170; // symbols

type OwnProps = {
  message: ApiMessage;
  observeIntersection?: ObserveFn;
  noAvatars?: boolean;
  shouldAutoLoad?: boolean;
  inPreview?: boolean;
  onMediaClick?: () => void;
  onCancelMediaTransfer?: () => void;
};

const WebPage: FC<OwnProps> = ({
  message,
  observeIntersection,
  noAvatars,
  shouldAutoLoad,
  inPreview,
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
  } = webPage;

  const isMediaInteractive = photo && onMediaClick && !isSquarePhoto && !webPage.hasDocument;
  const truncatedDescription = trimText(description, MAX_TEXT_LENGTH);

  const className = buildClassName(
    'WebPage',
    photo
      ? (isSquarePhoto && 'with-square-photo')
      : (!inPreview && 'without-photo'),
  );

  return (
    <div
      className={className}
      data-initial={(siteName || displayUrl)[0]}
      dir="auto"
    >
      {photo && (
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
    </div>
  );
};

export default memo(WebPage);
