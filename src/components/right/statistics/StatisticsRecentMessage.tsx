import type { FC } from '../../../lib/teact/teact';
import { memo, useCallback } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage, StatisticsMessageInteractionCounter } from '../../../api/types';

import {
  getMessageRoundVideo,
  getMessageVideo,
} from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { formatDateTimeToString } from '../../../util/dates/dateFormat';
import { type LangFn } from '../../../util/localization';
import { renderMessageSummary } from '../../common/helpers/renderMessageText';

import useMessageMediaHash from '../../../hooks/media/useMessageMediaHash';
import useThumbnail from '../../../hooks/media/useThumbnail';
import useLang from '../../../hooks/useLang';
import useMedia from '../../../hooks/useMedia';

import Icon from '../../common/icons/Icon';
import StatisticsRecentPostMeta from './StatisticsRecentPostMeta';

import styles from './StatisticsRecentPost.module.scss';

export type OwnProps = {
  postStatistic: StatisticsMessageInteractionCounter;
  message: ApiMessage;
};

const StatisticsRecentMessage: FC<OwnProps> = ({ postStatistic, message }) => {
  const lang = useLang();
  const { toggleMessageStatistics } = getActions();

  const thumbDataUri = useThumbnail(message);
  const mediaHash = useMessageMediaHash(message, 'micro');
  const mediaBlobUrl = useMedia(mediaHash);
  const isRoundVideo = Boolean(getMessageRoundVideo(message));

  const handleClick = useCallback(() => {
    toggleMessageStatistics({ messageId: message.id });
  }, [toggleMessageStatistics, message.id]);

  return (
    <div
      className={buildClassName(
        styles.root,
        Boolean(mediaBlobUrl || thumbDataUri) && styles.withImage,
      )}
      onClick={handleClick}
    >
      <div className={styles.title}>
        <div className={styles.summary}>
          {renderSummary(lang, message, mediaBlobUrl || thumbDataUri, isRoundVideo)}
        </div>
        <div className={styles.meta}>
          {lang(
            'ChannelStatsViewsCount',
            { count: postStatistic.viewsCount },
            { pluralValue: postStatistic.viewsCount },
          )}
        </div>
      </div>

      <div className={styles.info}>
        <div className={styles.date}>
          {formatDateTimeToString(message.date * 1000, lang.code)}
        </div>
        <StatisticsRecentPostMeta postStatistic={postStatistic} />
      </div>
    </div>
  );
};

function renderSummary(lang: LangFn, message: ApiMessage, blobUrl?: string, isRoundVideo?: boolean) {
  if (!blobUrl) {
    return renderMessageSummary(lang, message);
  }

  return (
    <span>
      <img
        src={blobUrl}
        alt=""
        draggable={false}
        className={buildClassName(styles.image, isRoundVideo && styles.round)}
      />
      {getMessageVideo(message) && <Icon name="play" />}
      {renderMessageSummary(lang, message, true)}
    </span>
  );
}

export default memo(StatisticsRecentMessage);
