import React, { FC, useEffect, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';

import '../../modules/actions/all';
import { ANIMATION_END_DELAY, DEBUG } from '../../config';
import { pick } from '../../util/iteratees';
import { selectIsForwardModalOpen, selectIsMediaViewerOpen, selectIsRightColumnShown } from '../../modules/selectors';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import useShowTransition from '../../hooks/useShowTransition';
import buildClassName from '../../util/buildClassName';

import LeftColumn from '../left/LeftColumn';
import MiddleColumn from '../middle/MiddleColumn';
import RightColumn from '../right/RightColumn';
import MediaViewer from '../mediaViewer/MediaViewer.async';
import ForwardPicker from './ForwardPicker.async';
import Notifications from './Notifications.async';
import Errors from './Errors.async';

import './Main.scss';

type StateProps = {
  animationLevel: number;
  lastSyncTime?: number;
  isLeftColumnShown: boolean;
  isRightColumnShown: boolean;
  isMediaViewerOpen: boolean;
  isForwardModalOpen: boolean;
  hasNotifications: boolean;
  hasErrors: boolean;
};

type DispatchProps = Pick<GlobalActions, 'loadAnimatedEmojis'>;

const ANIMATION_DURATION = 350;

let timeout: number | undefined;

let DEBUG_isLogged = false;

const Main: FC<StateProps & DispatchProps> = ({
  lastSyncTime,
  loadAnimatedEmojis,
  isLeftColumnShown,
  isRightColumnShown,
  isMediaViewerOpen,
  isForwardModalOpen,
  animationLevel,
  hasNotifications,
  hasErrors,
}) => {
  if (DEBUG && !DEBUG_isLogged) {
    DEBUG_isLogged = true;
    // eslint-disable-next-line no-console
    console.log('>>> RENDER MAIN');
  }

  // Initial API calls
  useEffect(() => {
    if (lastSyncTime) {
      loadAnimatedEmojis();
    }
  }, [lastSyncTime, loadAnimatedEmojis]);

  const {
    transitionClassNames: middleColumnTransitionClassNames,
  } = useShowTransition(!isLeftColumnShown, undefined, true);

  const {
    transitionClassNames: rightColumnTransitionClassNames,
  } = useShowTransition(isRightColumnShown, undefined, true);

  const className = buildClassName(
    middleColumnTransitionClassNames.replace(/([\w-]+)/g, 'middle-column-$1'),
    rightColumnTransitionClassNames.replace(/([\w-]+)/g, 'right-column-$1'),
  );

  useEffect(() => {
    // For animating Symbol Menu on mobile
    document.body.classList.toggle('is-middle-column-open', className.includes('middle-column-open'));
    // For animating components in portals (i.e. Notification)
    document.body.classList.toggle('is-right-column-shown', className.includes('right-column-open'));
  }, [className]);

  // Add `body` classes when toggling right column
  useEffect(() => {
    if (animationLevel > 0) {
      document.body.classList.add('animating-right-column');
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);

      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }

      timeout = window.setTimeout(() => {
        document.body.classList.remove('animating-right-column');
        timeout = undefined;
      }, ANIMATION_DURATION + ANIMATION_END_DELAY);
    }
  }, [animationLevel, isRightColumnShown]);

  function stopEvent(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div id="Main" className={className} onDrop={stopEvent} onDragOver={stopEvent}>
      <LeftColumn />
      <MiddleColumn />
      <RightColumn />
      <MediaViewer isOpen={isMediaViewerOpen} />
      <ForwardPicker isOpen={isForwardModalOpen} />
      <Notifications isOpen={hasNotifications} />
      <Errors isOpen={hasErrors} />
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => ({
    animationLevel: global.settings.byKey.animationLevel,
    lastSyncTime: global.lastSyncTime,
    isLeftColumnShown: global.isLeftColumnShown,
    isRightColumnShown: selectIsRightColumnShown(global),
    isMediaViewerOpen: selectIsMediaViewerOpen(global),
    isForwardModalOpen: selectIsForwardModalOpen(global),
    hasNotifications: Boolean(global.notifications.length),
    hasErrors: Boolean(global.errors.length),
  }),
  (setGlobal, actions): DispatchProps => pick(actions, ['loadAnimatedEmojis']),
)(Main));
