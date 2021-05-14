import React, { FC, useEffect, memo } from '../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiMessage } from '../../api/types';

import '../../modules/actions/all';
import {
  ANIMATION_END_DELAY, DEBUG, INACTIVE_MARKER, PAGE_TITLE,
} from '../../config';
import { pick } from '../../util/iteratees';
import {
  selectChatMessage,
  selectCountNotMutedUnread,
  selectIsForwardModalOpen,
  selectIsMediaViewerOpen,
  selectIsRightColumnShown,
} from '../../modules/selectors';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import buildClassName from '../../util/buildClassName';
import useShowTransition from '../../hooks/useShowTransition';
import useBackgroundMode from '../../hooks/useBackgroundMode';

import LeftColumn from '../left/LeftColumn';
import MiddleColumn from '../middle/MiddleColumn';
import RightColumn from '../right/RightColumn';
import MediaViewer from '../mediaViewer/MediaViewer.async';
import AudioPlayer from '../middle/AudioPlayer';
import Notifications from './Notifications.async';
import Errors from './Errors.async';
import ForwardPicker from './ForwardPicker.async';
import SafeLinkModal from './SafeLinkModal.async';

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
  audioMessage?: ApiMessage;
  safeLinkModalUrl?: string;
};

type DispatchProps = Pick<GlobalActions, 'loadAnimatedEmojis'>;

const ANIMATION_DURATION = 350;
const NOTIFICATION_INTERVAL = 1000;

let rightColumnAnimationTimeout: number | undefined;
let notificationInterval: number | undefined;

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
  audioMessage,
  safeLinkModalUrl,
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

      if (rightColumnAnimationTimeout) {
        clearTimeout(rightColumnAnimationTimeout);
        rightColumnAnimationTimeout = undefined;
      }

      rightColumnAnimationTimeout = window.setTimeout(() => {
        document.body.classList.remove('animating-right-column');
        rightColumnAnimationTimeout = undefined;
      }, ANIMATION_DURATION + ANIMATION_END_DELAY);
    }
  }, [animationLevel, isRightColumnShown]);

  useBackgroundMode(() => {
    const initialUnread = selectCountNotMutedUnread(getGlobal());
    let index = 0;

    clearInterval(notificationInterval);
    notificationInterval = window.setInterval(() => {
      if (document.title.includes(INACTIVE_MARKER)) {
        updateIcon(false);
        return;
      }

      if (index % 2 === 0) {
        const newUnread = selectCountNotMutedUnread(getGlobal()) - initialUnread;
        if (newUnread > 0) {
          document.title = `${newUnread} notification${newUnread > 1 ? 's' : ''}`;
          updateIcon(true);
        }
      } else {
        document.title = PAGE_TITLE;
        updateIcon(false);
      }

      index++;
    }, NOTIFICATION_INTERVAL);
  }, () => {
    clearInterval(notificationInterval);
    notificationInterval = undefined;

    if (!document.title.includes(INACTIVE_MARKER)) {
      document.title = PAGE_TITLE;
    }

    updateIcon(false);
  });

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
      {audioMessage && <AudioPlayer key={audioMessage.id} message={audioMessage} noUi />}
      <SafeLinkModal url={safeLinkModalUrl} />
    </div>
  );
};

function updateIcon(asUnread: boolean) {
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')
    .forEach((link) => {
      if (asUnread) {
        if (!link.href.includes('favicon-unread')) {
          link.href = link.href.replace('favicon', 'favicon-unread');
        }
      } else {
        link.href = link.href.replace('favicon-unread', 'favicon');
      }
    });
}

export default memo(withGlobal(
  (global): StateProps => {
    const { chatId: audioChatId, messageId: audioMessageId } = global.audioPlayer;
    const audioMessage = audioChatId && audioMessageId
      ? selectChatMessage(global, audioChatId, audioMessageId)
      : undefined;

    return {
      animationLevel: global.settings.byKey.animationLevel,
      lastSyncTime: global.lastSyncTime,
      isLeftColumnShown: global.isLeftColumnShown,
      isRightColumnShown: selectIsRightColumnShown(global),
      isMediaViewerOpen: selectIsMediaViewerOpen(global),
      isForwardModalOpen: selectIsForwardModalOpen(global),
      hasNotifications: Boolean(global.notifications.length),
      hasErrors: Boolean(global.errors.length),
      audioMessage,
      safeLinkModalUrl: global.safeLinkModalUrl,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['loadAnimatedEmojis']),
)(Main));
