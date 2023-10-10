import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import type { ApiStory } from '../../api/types';

import { HEART_REACTION } from '../../config';
import { getStoryKey, isUserId } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import AvatarList from '../common/AvatarList';
import Icon from '../common/Icon';
import ReactionAnimatedEmoji from '../common/reactions/ReactionAnimatedEmoji';
import Button from '../ui/Button';

import styles from './StoryFooter.module.scss';

type OwnProps = {
  story: ApiStory;
  areViewsExpired?: boolean;
  className?: string;
};

const StoryFooter = ({
  story,
  areViewsExpired,
  className,
}: OwnProps) => {
  const { openStoryViewModal, openForwardMenu, sendStoryReaction } = getActions();
  const lang = useLang();

  const {
    viewsCount, reactionsCount, isOut, peerId, id: storyId, sentReaction,
  } = story;
  const isChannel = !isUserId(peerId);

  const isSentStoryReactionHeart = sentReaction && 'emoticon' in sentReaction
    ? sentReaction.emoticon === HEART_REACTION.emoticon : false;

  const canForward = Boolean(
    (isOut || isChannel)
    && story.isPublic
    && !story.noForwards,
  );

  const containerId = getStoryKey(peerId, storyId);

  const recentViewers = useMemo(() => {
    const { users: { byId: usersById } } = getGlobal();

    const recentViewerIds = story && 'recentViewerIds' in story ? story.recentViewerIds : undefined;
    if (!recentViewerIds) return undefined;

    return recentViewerIds.map((id) => usersById[id]).filter(Boolean);
  }, [story]);

  const handleOpenStoryViewModal = useLastCallback(() => {
    openStoryViewModal({ storyId });
  });

  const handleForwardClick = useLastCallback(() => {
    openForwardMenu({ fromChatId: peerId, storyId });
  });

  const handleLikeStory = useLastCallback(() => {
    const reaction = sentReaction ? undefined : HEART_REACTION;
    sendStoryReaction({
      peerId,
      storyId,
      containerId,
      reaction,
    });
  });

  if (!viewsCount) {
    return (
      <div className={buildClassName(styles.root, className)}>
        {lang('NobodyViewed')}
      </div>
    );
  }

  return (
    <div
      className={buildClassName(
        styles.root,
        className,
      )}
    >
      <div
        className={buildClassName(styles.viewInfo, !isChannel && styles.interactive)}
        onClick={!isChannel ? handleOpenStoryViewModal : undefined}
      >
        {!areViewsExpired && Boolean(recentViewers?.length) && (
          <AvatarList
            size="small"
            peers={recentViewers}
            className={styles.avatars}
          />
        )}

        {isChannel ? (
          <span className={styles.views}><Icon name="channelviews" className={styles.viewIcon} />{viewsCount}</span>
        ) : (
          <span className={styles.views}>{lang('Views', viewsCount, 'i')}</span>
        )}
        {Boolean(reactionsCount) && !isChannel && (
          <span className={styles.reactionCount}>
            <Icon name="heart" className={styles.reactionCountHeart} />
            {reactionsCount}
          </span>
        )}
      </div>
      <div className={styles.spacer} />
      {canForward && (
        <Button
          color="translucent"
          size="smaller"
          round
          onClick={handleForwardClick}
          ariaLabel={lang('Forward')}
        >
          <Icon name="forward" />
        </Button>
      )}
      {isChannel && (
        <div className={styles.channelReaction}>
          <Button
            round
            className={styles.reactionButton}
            color="translucent"
            size="smaller"
            onClick={handleLikeStory}
            ariaLabel={lang('AccDescrLike')}
          >
            {sentReaction && (
              <ReactionAnimatedEmoji
                key={'documentId' in sentReaction ? sentReaction.documentId : sentReaction.emoticon}
                containerId={containerId}
                reaction={sentReaction}
                withEffectOnly={isSentStoryReactionHeart}
              />
            )}
            {(!sentReaction || isSentStoryReactionHeart) && (
              <Icon
                name={isSentStoryReactionHeart ? 'heart' : 'heart-outline'}
                className={buildClassName(isSentStoryReactionHeart && styles.reactionHeart)}
              />
            )}
          </Button>
          {Boolean(reactionsCount) && (<span>{reactionsCount}</span>)}
        </div>
      )}
    </div>
  );
};

export default memo(StoryFooter);
