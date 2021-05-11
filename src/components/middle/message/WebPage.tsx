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
  shouldAutoLoad?: boolean;
  inPreview?: boolean;
  onMediaClick?: () => void;
  onCancelMediaTransfer?: () => void;
};

const WebPage: FC<OwnProps> = ({
  message,
  observeIntersection,
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
    if (webPage && (isSquarePhoto || webPage.hasDocument)) {
      window.open(webPage.url);
    } else if (onMediaClick) {
      onMediaClick();
    }
  }, [webPage, isSquarePhoto, onMediaClick]);

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
    >
      {photo && (
        <Photo
          message={message}
          observeIntersection={observeIntersection}
          shouldAutoLoad={shouldAutoLoad}
          size={isSquarePhoto ? 'pictogram' : 'inline'}
          onClick={handleMediaClick}
          onCancelUpload={onCancelMediaTransfer}
        />
      )}
      <div>
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
