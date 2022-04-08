import React, { FC, memo } from '../../../lib/teact/teact';

import useLang, { LangFn } from '../../../hooks/useLang';

import { ApiMessage, StatisticsRecentMessage as StatisticsRecentMessageType } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { formatDateTimeToString } from '../../../util/dateFormat';
import {
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessageVideo,
  getMessageRoundVideo,
} from '../../../global/helpers';
import { renderMessageSummary } from '../../common/helpers/renderMessageText';
import useMedia from '../../../hooks/useMedia';

import './StatisticsRecentMessage.scss';

export type OwnProps = {
  message: ApiMessage & StatisticsRecentMessageType;
};

const StatisticsRecentMessage: FC<OwnProps> = ({ message }) => {
  const lang = useLang();

  const mediaThumbnail = getMessageMediaThumbDataUri(message);
  const mediaBlobUrl = useMedia(getMessageMediaHash(message, 'micro'));
  const isRoundVideo = Boolean(getMessageRoundVideo(message));

  return (
    <div
      className={buildClassName(
        'StatisticsRecentMessage',
        Boolean(mediaBlobUrl || mediaThumbnail) && 'StatisticsRecentMessage--with-image',
      )}
    >
      <div className="StatisticsRecentMessage__title">
        <div className="StatisticsRecentMessage__summary">
          {renderSummary(lang, message, mediaBlobUrl || mediaThumbnail, isRoundVideo)}
        </div>
        <div className="StatisticsRecentMessage__meta">
          {lang('ChannelStats.ViewsCount', message.views)}
        </div>
      </div>

      <div className="StatisticsRecentMessage__info">
        <div className="StatisticsRecentMessage__date">
          {formatDateTimeToString(message.date * 1000, lang.code)}
        </div>
        <div className="StatisticsRecentMessage__meta">
          {message.forwards ? lang('ChannelStats.SharesCount', message.forwards) : 'No shares'}
        </div>
      </div>
    </div>
  );
};

function renderSummary(lang: LangFn, message: ApiMessage, blobUrl?: string, isRoundVideo?: boolean) {
  if (!blobUrl) {
    return renderMessageSummary(lang, message);
  }

  return (
    <span className="media-preview">
      <img src={blobUrl} alt="" className={buildClassName('media-preview__image', isRoundVideo && 'round')} />
      {getMessageVideo(message) && <i className="icon-play" />}
      {renderMessageSummary(lang, message, true)}
    </span>
  );
}

export default memo(StatisticsRecentMessage);
