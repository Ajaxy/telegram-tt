import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiChat,
  ApiTypeStory,
  StatisticsStoryInteractionCounter,
} from '../../../api/types';
import type { OldLangFn } from '../../../hooks/useOldLang';

import { getStoryMediaHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { formatDateTimeToString } from '../../../util/dates/dateFormat';

import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import StatisticsRecentPostMeta from './StatisticsRecentPostMeta';

import styles from './StatisticsRecentPost.module.scss';

export type OwnProps = {
  chat: ApiChat;
  story?: ApiTypeStory;
  postStatistic: StatisticsStoryInteractionCounter;
};

function StatisticsRecentStory({ chat, story, postStatistic }: OwnProps) {
  const lang = useOldLang();
  const { toggleStoryStatistics } = getActions();
  const isLoaded = story && 'content' in story;

  const video = isLoaded ? story.content.video : undefined;
  const imageHash = isLoaded ? getStoryMediaHash(story) : undefined;
  const imgBlobUrl = useMedia(imageHash);
  const mediaThumbnail = imgBlobUrl || video?.thumbnail?.dataUri;

  const handleClick = useLastCallback(() => {
    toggleStoryStatistics({ storyId: postStatistic.storyId });
  });

  return (
    <div
      className={buildClassName(styles.root, styles.withImage)}
      onClick={handleClick}
    >
      <div className={styles.title}>
        <div className={styles.summary}>
          {renderSummary(lang, chat, imgBlobUrl || mediaThumbnail)}
        </div>
        <div className={styles.meta}>
          {lang('ChannelStats.ViewsCount', postStatistic.viewsCount, 'i')}
        </div>
      </div>

      <div className={styles.info}>
        <div className={styles.date}>
          {isLoaded && Boolean(story.date) && formatDateTimeToString(story.date * 1000, lang.code)}
        </div>
        <StatisticsRecentPostMeta postStatistic={postStatistic} />
      </div>
    </div>
  );
}

function renderSummary(lang: OldLangFn, chat: ApiChat, blobUrl?: string) {
  return (
    <span>
      {blobUrl ? (
        <span className={styles.imageContainer}>
          <img
            src={blobUrl}
            alt=""
            draggable={false}
            className={buildClassName(styles.image, styles.circle, styles.withStoryCircle)}
          />
        </span>
      ) : (
        <Avatar
          peer={chat}
          size="small"
          className={styles.image}
          withStorySolid
          forceUnreadStorySolid
        />
      )}

      {lang('Story')}
    </span>
  );
}

export default memo(StatisticsRecentStory);
