import React, { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiUser } from '../../api/types';

import { ANIMATION_END_DELAY, PREVIEW_AVATAR_COUNT } from '../../config';
import { selectPerformanceSettingsValue, selectTabState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { animateClosing, animateOpening, ANIMATION_DURATION } from './helpers/ribbonAnimation';

import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
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
  withAnimation?: boolean;
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
  withAnimation,
}: OwnProps & StateProps) {
  const { toggleStoryRibbon } = getActions();

  const lang = useLang();

  const users = useMemo(() => {
    if (orderedUserIds.length === 1) {
      return [usersById[orderedUserIds[0]]];
    }

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

  const isVisible = canShow && isShown;
  // For some reason, setting 'slow' here also fixes scroll freezes on iOS when collapsing Story Ribbon
  const { shouldRender, transitionClassNames } = useShowTransition(isVisible, undefined, undefined, 'slow');

  useEffect(() => {
    if (!withAnimation) return;
    if (isVisible) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateClosing(isArchived);
    } else {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateOpening(isArchived);
    }
  }, [isArchived, isVisible, withAnimation]);

  if (!shouldRender) {
    return undefined;
  }

  return (
    <button
      type="button"
      id="StoryToggler"
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
  const withAnimation = selectPerformanceSettingsValue(global, 'storyRibbonAnimations');

  return {
    currentUserId: global.currentUserId!,
    orderedUserIds: isArchived ? archived : active,
    isShown: isArchived ? !isArchivedRibbonShown : !isRibbonShown,
    withAnimation,
    usersById: global.users.byId,
  };
})(StoryToggler));
