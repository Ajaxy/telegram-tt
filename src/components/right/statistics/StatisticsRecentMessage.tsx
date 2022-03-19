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
} from '../../../modules/helpers';
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
    <p className="StatisticsRecentMessage">
      <div className="StatisticsRecentMessage--title">
        <div className="StatisticsRecentMessage--summary">
          {renderSummary(lang, message, mediaBlobUrl || mediaThumbnail, isRoundVideo)}
        </div>
        <div className="StatisticsRecentMessage--meta">
          {lang('ChannelStats.ViewsCount', message.views)}
        </div>
      </div>

      <div className="StatisticsRecentMessage--info">
        <div className="StatisticsRecentMessage--date">
          {formatDateTimeToString(message.date * 1000, lang.code)}
        </div>
        <div className="StatisticsRecentMessage--meta">
          {message.forwards ? lang('ChannelStats.SharesCount', message.forwards) : 'No shares'}
        </div>
      </div>
    </p>
  );
};

function renderSummary(lang: LangFn, message: ApiMessage, blobUrl?: string, isRoundVideo?: boolean) {
  if (!blobUrl) {
    return renderMessageSummary(lang, message);
  }

  return (
    <span className="media-preview">
      <img src={blobUrl} alt="" className={buildClassName('media-preview--image', isRoundVideo && 'round')} />
      {getMessageVideo(message) && <i className="icon-play" />}
      {renderMessageSummary(lang, message, true)}
    </span>
  );
}

export default memo(StatisticsRecentMessage);
