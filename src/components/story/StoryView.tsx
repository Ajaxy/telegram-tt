import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiAvailableReaction, ApiPeer, ApiTypeStoryView, ApiUser,
} from '../../api/types';
import type { IconName } from '../../types/icons';

import { getUserFullName, isUserId } from '../../global/helpers';
import { selectPeer } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatDateAtTime } from '../../util/dateFormat';
import { REM } from '../common/helpers/mediaDimensions';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import GroupChatInfo from '../common/GroupChatInfo';
import PrivateChatInfo from '../common/PrivateChatInfo';
import ReactionStaticEmoji from '../common/ReactionStaticEmoji';
import ListItem, { type MenuItemContextAction } from '../ui/ListItem';

import styles from './StoryViewModal.module.scss';

type OwnProps = {
  storyView: ApiTypeStoryView;
};

type StateProps = {
  peer?: ApiPeer;
  availableReactions?: ApiAvailableReaction[];
};

const CLOSE_ANIMATION_DURATION = 100;
const DEFAULT_REACTION_SIZE = 1.5 * REM;
const BULLET = '\u2022';

const StoryView = ({
  storyView,
  peer,
  availableReactions,
}: OwnProps & StateProps) => {
  const {
    openChat,
    closeStoryViewer,
    unblockUser,
    blockUser,
    deleteContact,
    updateStoryView,
    focusMessage,
    openStoryViewer,
    closeStoryViewModal,
  } = getActions();

  const lang = useLang();

  const handleClick = useLastCallback(() => {
    const { type } = storyView;

    if (type === 'repost') {
      closeStoryViewModal();
      openStoryViewer({
        peerId: storyView.peerId,
        storyId: storyView.storyId,
      });
      return;
    }

    closeStoryViewer();

    setTimeout(() => {
      if (type === 'user') {
        openChat({ id: storyView.peerId });
      } else if (type === 'forward') {
        focusMessage({ chatId: storyView.peerId, messageId: storyView.messageId });
      }
    }, CLOSE_ANIMATION_DURATION);
  });

  const contextActions = useMemo(() => {
    if (!isUserId(storyView.peerId)) return undefined;
    const { peerId, areStoriesBlocked, isUserBlocked } = storyView;
    const user = peer as ApiUser;
    const { isContact } = user || {};
    const fullName = getUserFullName(user);

    const actions: MenuItemContextAction[] = [];

    if (!isUserBlocked) {
      if (!areStoriesBlocked) {
        actions.push({
          handler: () => {
            blockUser({ userId: peerId, isOnlyStories: true });
            updateStoryView({ userId: peerId, areStoriesBlocked: true });
          },
          title: lang('StoryHideFrom', fullName),
          icon: 'hand-stop',
        });
      } else {
        actions.push({
          handler: () => {
            unblockUser({ userId: peerId, isOnlyStories: true });
            updateStoryView({ userId: peerId, areStoriesBlocked: false });
          },
          title: lang('StoryShowBackTo', fullName),
          icon: 'play-story',
        });
      }
    }

    if (isContact) {
      actions.push({
        handler: () => {
          deleteContact({ userId: peerId });
        },
        title: lang('DeleteContact'),
        icon: 'delete-user',
        destructive: true,
      });
    } else {
      actions.push({
        handler: () => {
          if (isUserBlocked) {
            unblockUser({ userId: peerId });
            updateStoryView({ userId: peerId, isUserBlocked: false });
          } else {
            blockUser({ userId: peerId });
            updateStoryView({ userId: peerId, isUserBlocked: true });
          }
        },
        title: lang(isUserBlocked ? 'Unblock' : 'BlockUser'),
        icon: isUserBlocked ? 'user' : 'delete-user',
        destructive: !isUserBlocked,
      });
    }

    return actions;
  }, [lang, storyView, peer]);

  const statusIcon: IconName = storyView.type === 'user' ? 'message-read'
    : storyView.type === 'forward' ? 'forward' : 'loop';
  const shouldColorStatus = storyView.type === 'forward' || storyView.type === 'repost';

  const status = useMemo(() => {
    const isModified = storyView.type === 'repost' && storyView.story.forwardInfo?.isModified;
    const parts = [formatDateAtTime(lang, storyView.date * 1000)];
    if (isModified) {
      parts.push(lang('lng_edited'));
    }

    return parts.join(` ${BULLET} `);
  }, [lang, storyView]);

  return (
    <ListItem
      key={storyView.peerId}
      className={buildClassName(
        'chat-item-clickable small-icon',
        styles.opacityFadeIn,
        (storyView.isUserBlocked || storyView.areStoriesBlocked) && styles.blocked,
      )}
      onClick={handleClick}
      rightElement={storyView.type === 'user' && storyView.reaction ? (
        <ReactionStaticEmoji
          reaction={storyView.reaction}
          className={styles.viewReaction}
          size={DEFAULT_REACTION_SIZE}
          availableReactions={availableReactions}
          withIconHeart
        />
      ) : undefined}
      contextActions={contextActions}
      withPortalForMenu
      menuBubbleClassName={styles.menuBubble}
    >
      {isUserId(storyView.peerId) ? (
        <PrivateChatInfo
          className={buildClassName(shouldColorStatus && styles.withColoredStatus)}
          userId={storyView.peerId}
          noStatusOrTyping
          status={status}
          statusIcon={statusIcon}
          withStory
          forceShowSelf
        />
      ) : (
        <GroupChatInfo
          className={buildClassName(shouldColorStatus && styles.withColoredStatus)}
          chatId={storyView.peerId}
          status={status}
          statusIcon={statusIcon}
          withStory
        />
      )}
    </ListItem>
  );
};

export default memo(withGlobal<OwnProps>((global, { storyView }) => {
  const peer = selectPeer(global, storyView.peerId);

  return {
    peer,
    availableReactions: global.reactions.availableReactions,
  };
})(StoryView));
