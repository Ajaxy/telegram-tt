import {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { TabState } from '../../global/types';
import type { ForwardTarget, ThreadId } from '../../types';
import type { ChatSelectionKey } from '../../util/keys/chatSelectionKey';

import { getChatTitle, getUserFirstOrLastName } from '../../global/helpers';
import {
  selectCanCopyMessageLink,
  selectChat,
  selectChatMessages,
  selectPeerPaidMessagesStars,
  selectTabState,
  selectUser,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { isUserId } from '../../util/entities/ids';
import { formatStarsAsIcon, formatStarsAsText } from '../../util/localization/format';

import useFlag from '../../hooks/useFlag';
import useFrozenProps from '../../hooks/useFrozenProps';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';

import AnimatedCounter from '../common/AnimatedCounter';
import Icon from '../common/icons/Icon';
import RecipientPicker from '../common/RecipientPicker';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import ConfirmDialog from '../ui/ConfirmDialog';
import Transition from '../ui/Transition';

import styles from './ForwardRecipientPicker.module.scss';

export type OwnProps = {
  isOpen: boolean;
};

interface StateProps {
  currentUserId?: string;
  isStory?: boolean;
  isAudioTrack?: boolean;
  isForwarding?: boolean;
  fromChatId?: string;
  forwardMessageIds?: number[];
  shouldPaidMessageAutoApprove?: boolean;
  audioPendingSend?: TabState['forwardMessages']['audioPendingSend'];
}

const ForwardRecipientPicker = ({
  isOpen,
  currentUserId,
  isStory,
  isAudioTrack,
  isForwarding,
  fromChatId,
  forwardMessageIds,
  shouldPaidMessageAutoApprove,
  audioPendingSend,
}: OwnProps & StateProps) => {
  const {
    openChatOrTopicWithReplyInDraft,
    setForwardChatOrTopic,
    exitForwardMode,
    forwardToSavedMessages,
    forwardToMultipleChats,
    forwardStory,
    forwardAudio,
    showNotification,
    copyMessageLink,
    openStarsBalanceModal,
    setPaidMessageAutoApprove,
    clearAudioPendingSend,
  } = getActions();

  const lang = useLang();

  const renderingIsStory = usePreviousDeprecated(isStory, true);
  const [isShown, markIsShown, unmarkIsShown] = useFlag();
  const [selectedIds, setSelectedIds] = useState<ChatSelectionKey[]>([]);
  const [caption, setCaption] = useState('');
  const [isPaymentConfirmOpen, openPaymentConfirm, closePaymentConfirm] = useFlag();
  const [shouldAutoApprove, setShouldAutoApprove] = useState(shouldPaidMessageAutoApprove);
  const [pendingMusicTarget, setPendingMusicTarget] = useState<
  { recipientId: string; threadId?: ThreadId; stars: number } | undefined
  >();

  const isMultiSelect = isForwarding && !isStory && !isAudioTrack;
  const messageCount = forwardMessageIds?.length || 0;

  const paidChatsInfo = useMemo(() => {
    if (!selectedIds.length) return { paidChatsCount: 0, totalStars: 0, totalMessages: 0 };

    const global = getGlobal();
    const paidChatIds = new Set<string>();
    let totalStars = 0;
    const hasCaption = caption.trim().length > 0;
    const totalMessages = messageCount + (hasCaption ? 1 : 0);

    for (const { peerId: chatId } of selectedIds) {
      const paidStars = selectPeerPaidMessagesStars(global, chatId);
      if (paidStars) {
        paidChatIds.add(chatId);
        totalStars += paidStars * totalMessages;
      }
    }

    return { paidChatsCount: paidChatIds.size, totalStars, totalMessages };
  }, [selectedIds, messageCount, caption]);

  const canCopyLink = useMemo(() => {
    if (!fromChatId || forwardMessageIds?.length !== 1) return false;

    const global = getGlobal();
    const chatMessages = selectChatMessages(global, fromChatId);
    if (!chatMessages) return false;

    const message = chatMessages[forwardMessageIds[0]];
    return message && selectCanCopyMessageLink(global, message);
  }, [fromChatId, forwardMessageIds]);

  useEffect(() => {
    if (isOpen) {
      markIsShown();
    }
  }, [isOpen, markIsShown]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedIds([]);
      setCaption('');
      setPendingMusicTarget(undefined);
    }
  }, [isOpen]);

  const forwardToSelf = useLastCallback(() => {
    forwardToSavedMessages({});
    showNotification({
      message: {
        key: 'FwdMessagesToSaved',
        options: {
          withNodes: true,
          withMarkdown: true,
          pluralValue: messageCount,
        },
      },
    });
  });

  const sendAudio = useLastCallback((recipientId: string, threadId?: ThreadId, confirmedStars?: number) => {
    forwardAudio({ toChatId: recipientId, toThreadId: threadId, confirmedStars });
  });

  useEffect(() => {
    if (!audioPendingSend) return;

    setPendingMusicTarget({
      recipientId: audioPendingSend.toChatId,
      threadId: audioPendingSend.toThreadId,
      stars: audioPendingSend.stars,
    });
    clearAudioPendingSend();
    openPaymentConfirm();
  }, [audioPendingSend]);

  const handleSelectRecipient = useCallback((recipientId: string, threadId?: ThreadId) => {
    const isSelf = recipientId === currentUserId;
    if (isAudioTrack) {
      sendAudio(recipientId, threadId);
      return;
    }

    if (isStory) {
      forwardStory({ toChatId: recipientId });
      const global = getGlobal();
      if (isUserId(recipientId)) {
        showNotification({
          message: isSelf
            ? {
              key: 'ConversationStoryForwardTooltipSavedMessagesOne',
              options: { withNodes: true, withMarkdown: true, renderTextFilters: ['br', 'links'] },
            }
            : {
              key: 'StorySharedTo',
              variables: { user: getUserFirstOrLastName(lang, selectUser(global, recipientId)) },
              options: { withNodes: true, withMarkdown: true, renderTextFilters: ['br', 'links'] },
            },
        });
      } else {
        const chat = selectChat(global, recipientId);
        if (!chat) return;

        showNotification({
          message: {
            key: 'StorySharedTo',
            variables: { user: getChatTitle(lang, chat) },
            options: { withNodes: true, withMarkdown: true, renderTextFilters: ['br', 'links'] },
          },
        });
      }
      return;
    }

    if (isSelf) {
      forwardToSelf();
    } else {
      const chatId = recipientId;
      const topicId = threadId ? Number(threadId) : undefined;
      if (isForwarding) {
        setForwardChatOrTopic({ chatId, topicId });
      } else {
        openChatOrTopicWithReplyInDraft({ chatId, topicId });
      }
    }
  }, [currentUserId, isStory, isAudioTrack, lang, isForwarding]);

  const handleClose = useCallback(() => {
    exitForwardMode();
  }, [exitForwardMode]);

  const handleSelectedIdsChange = useLastCallback((ids: ChatSelectionKey[]) => {
    setSelectedIds(ids);
  });

  const handleCopyLink = useLastCallback(() => {
    if (!fromChatId || !forwardMessageIds?.length) return;
    copyMessageLink({
      chatId: fromChatId,
      messageId: forwardMessageIds[0],
    });
    exitForwardMode();
  });

  const handleForwardToMultiple = useLastCallback(() => {
    if (!selectedIds.length) return;

    if (selectedIds.length === 1) {
      const { peerId: chatId, topicId } = selectedIds[0];
      if (chatId === currentUserId) {
        forwardToSelf();
        return;
      }

      setForwardChatOrTopic({ chatId, topicId });
      return;
    }

    if (paidChatsInfo.totalStars > 0 && !shouldPaidMessageAutoApprove) {
      openPaymentConfirm();
      return;
    }

    if (paidChatsInfo.totalStars > 0) {
      const starsBalance = getGlobal().stars?.balance?.amount || 0;
      if (paidChatsInfo.totalStars > starsBalance) {
        openStarsBalanceModal({
          topup: {
            balanceNeeded: paidChatsInfo.totalStars,
          },
        });
        return;
      }
    }

    executeForward();
  });

  const handleEnterShortcut = useLastCallback((e: KeyboardEvent) => {
    if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
      return false;
    }

    if (!selectedIds.length) {
      if (!canCopyLink) return false;

      e.preventDefault();
      handleCopyLink();
      return undefined;
    }

    e.preventDefault();
    handleForwardToMultiple();
    return undefined;
  });

  useEffect(() => {
    if (!isOpen || !isMultiSelect || isPaymentConfirmOpen) {
      return undefined;
    }

    return captureKeyboardListeners({ onEnter: handleEnterShortcut });
  }, [isOpen, isMultiSelect, isPaymentConfirmOpen, handleEnterShortcut]);

  const executeForward = useLastCallback(() => {
    const targets: ForwardTarget[] = selectedIds.map(({ peerId, topicId }) => ({
      chatId: peerId,
      topicId,
    }));
    forwardToMultipleChats({ targets, comment: caption || undefined });

    showNotification({
      message: {
        key: 'FwdMessagesToChats',
        variables: { count: selectedIds.length },
        options: {
          pluralValue: selectedIds.length,
          withNodes: true,
          withMarkdown: true,
          renderTextFilters: ['br', 'links'],
        },
      },
    });
    exitForwardMode();
  });

  const handlePaymentConfirm = useLastCallback(() => {
    const totalStars = pendingMusicTarget?.stars ?? paidChatsInfo.totalStars;
    const starsBalance = getGlobal().stars?.balance?.amount || 0;

    if (totalStars > starsBalance) {
      openStarsBalanceModal({
        topup: {
          balanceNeeded: totalStars,
        },
      });
      return;
    }

    closePaymentConfirm();
    if (shouldAutoApprove) {
      setPaidMessageAutoApprove();
    }

    if (pendingMusicTarget) {
      sendAudio(pendingMusicTarget.recipientId, pendingMusicTarget.threadId, pendingMusicTarget.stars);
      setPendingMusicTarget(undefined);
      return;
    }

    if (isAudioTrack || !selectedIds.length) return;

    executeForward();
  });

  const handlePaymentClose = useLastCallback(() => {
    closePaymentConfirm();
    setPendingMusicTarget(undefined);
  });

  const viewportFooter = useMemo(() => (
    <div className="picker-list-spacer" />
  ), []);

  const selectedCount = selectedIds.length;
  const showComposer = selectedCount >= 2;
  const { totalStars: displayedTotalStars } = useFrozenProps(
    { totalStars: paidChatsInfo.totalStars },
    !showComposer,
  );

  const footerContent = useMemo(() => {
    if (!isForwarding || isStory) return undefined;

    const renderButton = () => {
      const isInitial = selectedCount === 0;
      const singleChatStars = selectedCount === 1 ? paidChatsInfo.totalStars : 0;

      return (
        <Button
          className="picker-footer-button"
          color="primary"
          disabled={isInitial && !canCopyLink}
          onClick={isInitial ? handleCopyLink : handleForwardToMultiple}
        >
          <Transition name="fade" activeKey={isInitial ? 0 : 1} slideClassName={styles.buttonSlide}>
            <span>
              {isInitial
                ? (canCopyLink ? lang('CopyLink') : lang('SelectChats'))
                : (singleChatStars > 0
                  ? lang(
                    'ForwardForStars',
                    { price: formatStarsAsIcon(lang, singleChatStars, { asFont: true }) },
                    { withNodes: true },
                  )
                  : lang('Forward'))}
            </span>
          </Transition>
        </Button>
      );
    };

    const renderComposer = () => (
      <div className="picker-footer-input">
        <div className="picker-caption-wrapper">
          <input
            className="picker-caption-input"
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.currentTarget.value)}
            placeholder={lang('AttachmentCaptionPlaceholder')}
          />
          <Button
            className="picker-send-button"
            color="primary"
            onClick={handleForwardToMultiple}
            ariaLabel={lang('Forward')}
          >
            {displayedTotalStars > 0 ? (
              <>
                <Icon name="star" className="star-icon" />
                <AnimatedCounter text={String(displayedTotalStars)} />
              </>
            ) : <i className="icon icon-new-send" />}
          </Button>
        </div>
      </div>
    );

    return (
      <div className="picker-footer">
        <div className={buildClassName(styles.buttonLayer, !showComposer && styles.visible)}>
          {renderButton()}
        </div>
        <div className={buildClassName(styles.composerLayer, showComposer && styles.visible)}>
          {renderComposer()}
        </div>
      </div>
    );
  }, [isForwarding, isStory, selectedCount, showComposer, caption, canCopyLink, displayedTotalStars,
    paidChatsInfo, handleForwardToMultiple, handleCopyLink, lang]);

  if (!isOpen && !isShown) {
    return undefined;
  }

  const confirmTotalStars = pendingMusicTarget?.stars ?? paidChatsInfo.totalStars;
  const confirmChatsCount = pendingMusicTarget ? 1 : paidChatsInfo.paidChatsCount;
  const confirmMessagesCount = pendingMusicTarget ? 1 : paidChatsInfo.totalMessages;

  const confirmPaymentMessage = confirmTotalStars > 0 ? lang(
    'ForwardPaidChatsConfirmation',
    {
      chatsSelected: lang(
        'ForwardPaidChatsSelected',
        { paidChatsCount: confirmChatsCount },
        { withNodes: true, withMarkdown: true, pluralValue: confirmChatsCount },
      ),
      payConfirmation: lang(
        'ForwardPaidChatsPayConfirmation',
        {
          totalAmount: formatStarsAsText(lang, confirmTotalStars),
          count: confirmMessagesCount,
        },
        { withNodes: true, withMarkdown: true, pluralValue: confirmMessagesCount },
      ),
    },
    { withNodes: true },
  ) : undefined;

  const confirmLabel = lang('PayForMessage', { count: confirmMessagesCount }, {
    withNodes: true,
    pluralValue: confirmMessagesCount,
  });

  return (
    <>
      <RecipientPicker
        isOpen={isOpen}
        className={renderingIsStory ? 'component-theme-dark' : undefined}
        title={lang('ShareWith')}
        searchPlaceholder={lang('Search')}
        isMultiSelect={isMultiSelect}
        footer={footerContent}
        viewportFooter={viewportFooter}
        onSelectRecipient={handleSelectRecipient}
        onSelectedIdsChange={handleSelectedIdsChange}
        onClose={handleClose}
        onCloseAnimationEnd={unmarkIsShown}
        isForwarding={isForwarding || isAudioTrack}
        isNativeDialog
        withFolders
      />
      <ConfirmDialog
        title={lang('TitleConfirmPayment')}
        confirmLabel={confirmLabel}
        isOpen={isPaymentConfirmOpen}
        onClose={handlePaymentClose}
        confirmHandler={handlePaymentConfirm}
      >
        {confirmPaymentMessage}
        <Checkbox
          label={lang('DoNotAskAgain')}
          checked={shouldAutoApprove}
          onCheck={setShouldAutoApprove}
        />
      </ConfirmDialog>
    </>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  const {
    messageIds, storyId, audioItem, fromChatId,
  } = selectTabState(global).forwardMessages;
  const isForwarding = (messageIds && messageIds.length > 0);

  return {
    currentUserId: global.currentUserId,
    isStory: Boolean(storyId),
    isAudioTrack: Boolean(audioItem),
    isForwarding,
    fromChatId,
    forwardMessageIds: messageIds,
    shouldPaidMessageAutoApprove: global.settings.byKey.shouldPaidMessageAutoApprove,
    audioPendingSend: selectTabState(global).forwardMessages.audioPendingSend,
  };
})(ForwardRecipientPicker));
