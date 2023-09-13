import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiAvailableReaction, ApiStoryView, ApiUser } from '../../api/types';

import { selectUser } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { REM } from '../common/helpers/mediaDimensions';
import { formatDateAtTime } from '../../util/dateFormat';
import { getUserFullName } from '../../global/helpers';

import useLastCallback from '../../hooks/useLastCallback';
import useLang from '../../hooks/useLang';

import ListItem, { type MenuItemContextAction } from '../ui/ListItem';
import ReactionStaticEmoji from '../common/ReactionStaticEmoji';
import PrivateChatInfo from '../common/PrivateChatInfo';

import styles from './StoryViewModal.module.scss';

type OwnProps = {
  storyView: ApiStoryView;
};

type StateProps = {
  user?: ApiUser;
  availableReactions?: ApiAvailableReaction[];
};

const CLOSE_ANIMATION_DURATION = 100;
const DEFAULT_REACTION_SIZE = 1.5 * REM;

const StoryView = ({
  storyView,
  user,
  availableReactions,
}: OwnProps & StateProps) => {
  const {
    openChat, closeStoryViewer, unblockUser, blockUser, deleteContact, updateStoryView,
  } = getActions();

  const lang = useLang();

  const handleClick = useLastCallback(() => {
    closeStoryViewer();

    setTimeout(() => {
      openChat({ id: storyView.userId });
    }, CLOSE_ANIMATION_DURATION);
  });

  const contextActions = useMemo(() => {
    const { userId, areStoriesBlocked, isUserBlocked } = storyView;
    const { isContact } = user || {};
    const fullName = getUserFullName(user);

    const actions: MenuItemContextAction[] = [];

    if (!isUserBlocked) {
      if (!areStoriesBlocked) {
        actions.push({
          handler: () => {
            blockUser({ userId, isOnlyStories: true });
            updateStoryView({ userId, areStoriesBlocked: true });
          },
          title: lang('StoryHideFrom', fullName),
          icon: 'hand-stop',
        });
      } else {
        actions.push({
          handler: () => {
            unblockUser({ userId, isOnlyStories: true });
            updateStoryView({ userId, areStoriesBlocked: false });
          },
          title: lang('StoryShowBackTo', fullName),
          icon: 'play-story',
        });
      }
    }

    if (isContact) {
      actions.push({
        handler: () => {
          deleteContact({ userId });
        },
        title: lang('DeleteContact'),
        icon: 'delete-user',
        destructive: true,
      });
    } else {
      actions.push({
        handler: () => {
          if (isUserBlocked) {
            unblockUser({ userId });
            updateStoryView({ userId, isUserBlocked: false });
          } else {
            blockUser({ userId });
            updateStoryView({ userId, isUserBlocked: true });
          }
        },
        title: lang(isUserBlocked ? 'Unblock' : 'BlockUser'),
        icon: isUserBlocked ? 'user' : 'delete-user',
        destructive: !isUserBlocked,
      });
    }

    return actions;
  }, [lang, storyView, user]);

  return (
    <ListItem
      key={storyView.userId}
      className={buildClassName(
        'chat-item-clickable small-icon',
        styles.opacityFadeIn,
        (storyView.isUserBlocked || storyView.areStoriesBlocked) && styles.blocked,
      )}
      // eslint-disable-next-line react/jsx-no-bind
      onClick={() => handleClick()}
      rightElement={storyView.reaction ? (
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
      <PrivateChatInfo
        userId={storyView.userId}
        noStatusOrTyping
        status={formatDateAtTime(lang, storyView.date * 1000)}
        statusIcon="message-read"
        withStory
        forceShowSelf
      />
    </ListItem>
  );
};

export default memo(withGlobal<OwnProps>((global, { storyView }) => {
  const user = selectUser(global, storyView.userId);

  return {
    user,
    availableReactions: global.availableReactions,
  };
})(StoryView));
