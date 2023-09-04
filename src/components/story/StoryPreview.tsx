import React, { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiTypeStory, ApiUser, ApiUserStories } from '../../api/types';
import type { StoryViewerOrigin } from '../../types';

import { selectTabState } from '../../global/selectors';
import renderText from '../common/helpers/renderText';
import { getStoryMediaHash, getUserFirstOrLastName } from '../../global/helpers';
import useMedia from '../../hooks/useMedia';

import Avatar from '../common/Avatar';

import styles from './StoryViewer.module.scss';

interface OwnProps {
  user?: ApiUser;
  userStories?: ApiUserStories;
}

interface StateProps {
  lastViewedId?: number;
  origin?: StoryViewerOrigin;
}

function StoryPreview({
  user, userStories, lastViewedId, origin,
}: OwnProps & StateProps) {
  const { openStoryViewer, loadUserSkippedStories } = getActions();

  const story = useMemo<ApiTypeStory | undefined>(() => {
    if (!userStories) {
      return undefined;
    }

    const {
      orderedIds, lastReadId, byId,
    } = userStories;
    const hasUnreadStories = orderedIds[orderedIds.length - 1] !== lastReadId;
    const previewIndexId = lastViewedId ?? (hasUnreadStories ? (lastReadId ?? -1) : -1);
    const resultId = byId[previewIndexId]?.id || orderedIds[0];

    return byId[resultId];
  }, [lastViewedId, userStories]);

  useEffect(() => {
    if (story && !('content' in story)) {
      loadUserSkippedStories({ userId: story.userId });
    }
  }, [story]);

  const video = story && 'content' in story ? story.content.video : undefined;
  const imageHash = story && 'content' in story
    ? getStoryMediaHash(story)
    : undefined;
  const imgBlobUrl = useMedia(imageHash);
  const thumbUrl = imgBlobUrl || video?.thumbnail?.dataUri;

  if (!user || !story || 'isDeleted' in story) {
    return undefined;
  }

  return (
    <div
      className={styles.slideInner}
      onClick={() => { openStoryViewer({ userId: story.userId, storyId: story.id, origin }); }}
    >
      {thumbUrl && (
        <img src={thumbUrl} alt="" className={styles.media} draggable={false} />
      )}

      <div className={styles.content}>
        <Avatar
          peer={user}
          withStory
          storyViewerMode="disabled"
        />
        <div className={styles.name}>{renderText(getUserFirstOrLastName(user) || '')}</div>
      </div>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, { user }): StateProps => {
  const {
    storyViewer: {
      lastViewedByUserIds,
      origin,
    },
  } = selectTabState(global);

  return {
    lastViewedId: user?.id ? lastViewedByUserIds?.[user.id] : undefined,
    origin,
  };
})(StoryPreview));
