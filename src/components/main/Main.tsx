import React, {
  FC, useEffect, memo, useCallback,
} from '../../lib/teact/teact';
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
import useBeforeUnload from '../../hooks/useBeforeUnload';

import LeftColumn from '../left/LeftColumn';
import MiddleColumn from '../middle/MiddleColumn';
import RightColumn from '../right/RightColumn';
import MediaViewer from '../mediaViewer/MediaViewer.async';
import AudioPlayer from '../middle/AudioPlayer';
import Notifications from './Notifications.async';
import Dialogs from './Dialogs.async';
import ForwardPicker from './ForwardPicker.async';
import SafeLinkModal from './SafeLinkModal.async';
import HistoryCalendar from './HistoryCalendar.async';

import './Main.scss';

type StateProps = {
  animationLevel: number;
  lastSyncTime?: number;
  isLeftColumnShown: boolean;
  isRightColumnShown: boolean;
  isMediaViewerOpen: boolean;
  isForwardModalOpen: boolean;
  hasNotifications: boolean;
  hasDialogs: boolean;
  audioMessage?: ApiMessage;
  safeLinkModalUrl?: string;
  isHistoryCalendarOpen: boolean;
  shouldSkipHistoryAnimations?: boolean;
};

type DispatchProps = Pick<GlobalActions, (
  'loadAnimatedEmojis' | 'loadNotificationSettings' | 'loadNotificationExceptions' | 'updateIsOnline' |
  'loadTopInlineBots'
)>;

const ANIMATION_DURATION = 350;
const NOTIFICATION_INTERVAL = 1000;

let rightColumnAnimationTimeout: number | undefined;
let notificationInterval: number | undefined;

let DEBUG_isLogged = false;

const Main: FC<StateProps & DispatchProps> = ({
  lastSyncTime,
  isLeftColumnShown,
  isRightColumnShown,
  isMediaViewerOpen,
  isForwardModalOpen,
  animationLevel,
  hasNotifications,
  hasDialogs,
  audioMessage,
  safeLinkModalUrl,
  isHistoryCalendarOpen,
  shouldSkipHistoryAnimations,
  loadAnimatedEmojis,
  loadNotificationSettings,
  loadNotificationExceptions,
  updateIsOnline,
  loadTopInlineBots,
}) => {
  if (DEBUG && !DEBUG_isLogged) {
    DEBUG_isLogged = true;
    // eslint-disable-next-line no-console
    console.log('>>> RENDER MAIN');
  }

  // Initial API calls
  useEffect(() => {
    if (lastSyncTime) {
      updateIsOnline(true);
      loadAnimatedEmojis();
      loadNotificationSettings();
      loadNotificationExceptions();
      loadTopInlineBots();
    }
  }, [
    lastSyncTime, loadAnimatedEmojis, loadNotificationExceptions, loadNotificationSettings, updateIsOnline,
    loadTopInlineBots,
  ]);

  const {
    transitionClassNames: middleColumnTransitionClassNames,
  } = useShowTransition(!isLeftColumnShown, undefined, true, undefined, shouldSkipHistoryAnimations);

  const {
    transitionClassNames: rightColumnTransitionClassNames,
  } = useShowTransition(isRightColumnShown, undefined, true, undefined, shouldSkipHistoryAnimations);


  const className = buildClassName(
    middleColumnTransitionClassNames.replace(/([\w-]+)/g, 'middle-column-$1'),
    rightColumnTransitionClassNames.replace(/([\w-]+)/g, 'right-column-$1'),
    shouldSkipHistoryAnimations && 'history-animation-disabled',
  );

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

  const handleBlur = useCallback(() => {
    updateIsOnline(false);

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
          updatePageTitle(`${newUnread} notification${newUnread > 1 ? 's' : ''}`);
          updateIcon(true);
        }
      } else {
        updatePageTitle(PAGE_TITLE);
        updateIcon(false);
      }

      index++;
    }, NOTIFICATION_INTERVAL);
  }, [updateIsOnline]);

  const handleFocus = useCallback(() => {
    updateIsOnline(true);

    clearInterval(notificationInterval);
    notificationInterval = undefined;

    if (!document.title.includes(INACTIVE_MARKER)) {
      updatePageTitle(PAGE_TITLE);
    }

    updateIcon(false);
  }, [updateIsOnline]);

  // Online status and browser tab indicators
  useBackgroundMode(handleBlur, handleFocus);
  useBeforeUnload(handleBlur);

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
      <Dialogs isOpen={hasDialogs} />
      {audioMessage && <AudioPlayer key={audioMessage.id} message={audioMessage} noUi />}
      <SafeLinkModal url={safeLinkModalUrl} />
      <HistoryCalendar isOpen={isHistoryCalendarOpen} />
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

// For some reason setting `document.title` to the same value
// causes increment of Chrome Dev Tools > Performance Monitor > DOM Nodes counter
function updatePageTitle(nextTitle: string) {
  if (document.title !== nextTitle) {
    document.title = nextTitle;
  }
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
      hasDialogs: Boolean(global.dialogs.length),
      audioMessage,
      safeLinkModalUrl: global.safeLinkModalUrl,
      isHistoryCalendarOpen: Boolean(global.historyCalendarSelectedAt),
      shouldSkipHistoryAnimations: global.shouldSkipHistoryAnimations,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'loadAnimatedEmojis', 'loadNotificationSettings', 'loadNotificationExceptions', 'updateIsOnline',
    'loadTopInlineBots',
  ]),
)(Main));
