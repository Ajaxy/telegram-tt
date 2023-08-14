import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiUser } from '../../api/types';

import { PREVIEW_AVATAR_COUNT } from '../../config';
import buildClassName from '../../util/buildClassName';
import { selectTabState } from '../../global/selectors';

import useLang from '../../hooks/useLang';
import useShowTransition from '../../hooks/useShowTransition';
import useStoryPreloader from './hooks/useStoryPreloader';

import Avatar from '../common/Avatar';

import styles from './StoryToggler.module.scss';

interface OwnProps {
  isArchived?: boolean;
  canShow?: boolean;
}

interface StateProps {
  currentUserId: string;
  orderedUserIds: string[];
  isShown: boolean;
  usersById: Record<string, ApiUser>;
}

const PRELOAD_USERS = 5;

function StoryToggler({
  currentUserId,
  orderedUserIds,
  usersById,
  canShow,
  isShown,
  isArchived,
}: OwnProps & StateProps) {
  const { toggleStoryRibbon } = getActions();

  const lang = useLang();

  const users = useMemo(() => {
    return orderedUserIds
      .map((id) => usersById[id])
      .filter((user) => user && user.id !== currentUserId)
      .slice(0, PREVIEW_AVATAR_COUNT)
      .reverse();
  }, [currentUserId, orderedUserIds, usersById]);

  const preloadUserIds = useMemo(() => {
    return orderedUserIds.slice(0, PRELOAD_USERS);
  }, [orderedUserIds]);
  useStoryPreloader(preloadUserIds);

  const { shouldRender, transitionClassNames } = useShowTransition(canShow && isShown);

  if (!shouldRender) {
    return undefined;
  }

  return (
    <button
      type="button"
      className={buildClassName(styles.root, transitionClassNames)}
      aria-label={lang('Chat.Context.Peer.OpenStory')}
      onClick={() => toggleStoryRibbon({ isShown: true, isArchived })}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      {users.map((user) => (
        <Avatar
          key={user.id}
          peer={user}
          size="tiny"
          className={styles.avatar}
          withStorySolid
        />
      ))}
    </button>
  );
}

export default memo(withGlobal<OwnProps>((global, { isArchived }): StateProps => {
  const { orderedUserIds: { archived, active } } = global.stories;
  const { storyViewer: { isRibbonShown, isArchivedRibbonShown } } = selectTabState(global);

  return {
    currentUserId: global.currentUserId!,
    orderedUserIds: isArchived ? archived : active,
    isShown: isArchived ? !isArchivedRibbonShown : !isRibbonShown,
    usersById: global.users.byId,
  };
})(StoryToggler));
