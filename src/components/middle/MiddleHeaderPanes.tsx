import { memo, useRef, useSignal } from '@teact';
import { setExtraStyles } from '@teact/teact-dom';
import { withGlobal } from '../../global';

import type { ApiChat, ApiUserFullInfo } from '../../api/types';
import type { MessageListType, ThreadId } from '../../types';
import type { Signal } from '../../util/signals';
import { MAIN_THREAD_ID } from '../../api/types';

import {
  selectCanAnimateRightColumn,
  selectChat,
  selectChatMessage,
  selectCurrentMiddleSearch,
  selectTabState,
  selectUserFullInfo,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useAppLayout from '../../hooks/useAppLayout';
import useEffectOnce from '../../hooks/useEffectOnce';
import useShowTransition from '../../hooks/useShowTransition';
import { useSignalEffect } from '../../hooks/useSignalEffect';
import { applyAnimationState, type PaneState } from './hooks/useHeaderPane';

import GroupCallTopPane from '../calls/group/GroupCallTopPane';
import AudioPlayer from './panes/AudioPlayer';
import BotAdPane from './panes/BotAdPane';
import BotVerificationPane from './panes/BotVerificationPane';
import ChatReportPane from './panes/ChatReportPane';
import HeaderPinnedMessage from './panes/HeaderPinnedMessage';
import PaidMessageChargePane from './panes/PaidMessageChargePane';

import styles from './MiddleHeaderPanes.module.scss';

type OwnProps = {
  className?: string;
  chatId: string;
  threadId: ThreadId;
  messageListType: MessageListType;
  getCurrentPinnedIndex: Signal<number>;
  getLoadingPinnedId: Signal<number | undefined>;
  onFocusPinnedMessage: (messageId: number) => void;
};

type StateProps = {
  chat?: ApiChat;
  userFullInfo?: ApiUserFullInfo;
  isAudioPlayerRendered?: boolean;
  isMiddleSearchOpen?: boolean;
  withRightColumnAnimation?: boolean;
};

const FALLBACK_PANE_STATE = { height: 0 };

const MiddleHeaderPanes = ({
  className,
  chatId,
  threadId,
  messageListType,
  chat,
  userFullInfo,
  getCurrentPinnedIndex,
  getLoadingPinnedId,
  isAudioPlayerRendered,
  isMiddleSearchOpen,
  withRightColumnAnimation,
  onFocusPinnedMessage,
}: OwnProps & StateProps) => {
  const { settings } = userFullInfo || {};

  const { isDesktop } = useAppLayout();
  const [getAudioPlayerState, setAudioPlayerState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getPinnedState, setPinnedState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getGroupCallState, setGroupCallState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getChatReportState, setChatReportState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getBotAdState, setBotAdState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getBotVerificationState, setBotVerificationState] = useSignal<PaneState>(FALLBACK_PANE_STATE);
  const [getPaidMessageChargeState, setPaidMessageChargeState] = useSignal<PaneState>(FALLBACK_PANE_STATE);

  const isPinnedMessagesFullWidth = isAudioPlayerRendered || !isDesktop;

  const isFirstRenderRef = useRef(true);
  const {
    shouldRender,
    ref,
  } = useShowTransition({
    isOpen: !isMiddleSearchOpen,
    withShouldRender: true,
    noMountTransition: true,
  });

  useEffectOnce(() => {
    isFirstRenderRef.current = false;
  });

  useSignalEffect(() => {
    const audioPlayerState = getAudioPlayerState();
    const botVerificationState = getBotVerificationState();
    const pinnedState = getPinnedState();
    const groupCallState = getGroupCallState();
    const chatReportState = getChatReportState();
    const botAdState = getBotAdState();
    const paidMessageState = getPaidMessageChargeState();

    // Keep in sync with the order of the panes in the DOM
    const stateArray = [audioPlayerState, groupCallState,
      chatReportState, botVerificationState, pinnedState, botAdState, paidMessageState];

    const isFirstRender = isFirstRenderRef.current;
    const totalHeight = stateArray.reduce((acc, state) => acc + state.height, 0);

    const middleColumn = document.getElementById('MiddleColumn');
    if (!middleColumn) return;

    applyAnimationState({ list: stateArray, noTransition: isFirstRender });

    setExtraStyles(middleColumn, {
      '--middle-header-panes-height': `${totalHeight}px`,
    });
  }, [getAudioPlayerState, getGroupCallState, getPinnedState,
    getChatReportState, getBotAdState, getBotVerificationState, getPaidMessageChargeState]);

  if (!shouldRender) return undefined;

  return (
    <div
      ref={ref}
      className={
        buildClassName(
          styles.root,
          withRightColumnAnimation && styles.root_withRightColumnAnimation,
          className,
        )
      }
    >
      <AudioPlayer
        isFullWidth
        onPaneStateChange={setAudioPlayerState}
        isHidden={isDesktop}
      />
      {threadId === MAIN_THREAD_ID && !chat?.isForum && (
        <GroupCallTopPane
          chatId={chatId}
          onPaneStateChange={setGroupCallState}
        />
      )}
      <ChatReportPane
        chatId={chatId}
        canAddContact={settings?.canAddContact}
        canBlockContact={settings?.canBlockContact}
        canReportSpam={settings?.canReportSpam}
        isAutoArchived={settings?.isAutoArchived}
        onPaneStateChange={setChatReportState}
      />
      <BotVerificationPane
        peerId={chatId}
        onPaneStateChange={setBotVerificationState}
      />
      <PaidMessageChargePane
        peerId={chatId}
        onPaneStateChange={setPaidMessageChargeState}
      />
      <HeaderPinnedMessage
        chatId={chatId}
        threadId={threadId}
        messageListType={messageListType}
        onFocusPinnedMessage={onFocusPinnedMessage}
        getLoadingPinnedId={getLoadingPinnedId}
        getCurrentPinnedIndex={getCurrentPinnedIndex}
        onPaneStateChange={setPinnedState}
        isFullWidth
        shouldHide={!isPinnedMessagesFullWidth}
      />
      <BotAdPane
        chatId={chatId}
        messageListType={messageListType}
        onPaneStateChange={setBotAdState}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, {
    chatId,
  }): Complete<StateProps> => {
    const { audioPlayer } = selectTabState(global);
    const chat = selectChat(global, chatId);
    const userFullInfo = selectUserFullInfo(global, chatId);

    const { chatId: audioChatId, messageId: audioMessageId } = audioPlayer;
    const audioMessage = audioChatId && audioMessageId
      ? selectChatMessage(global, audioChatId, audioMessageId)
      : undefined;

    const isMiddleSearchOpen = Boolean(selectCurrentMiddleSearch(global));

    return {
      chat,
      userFullInfo,
      isAudioPlayerRendered: Boolean(audioMessage),
      isMiddleSearchOpen,
      withRightColumnAnimation: selectCanAnimateRightColumn(global),
    };
  },
)(MiddleHeaderPanes));
