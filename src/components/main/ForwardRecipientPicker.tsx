import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

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
import { isUserId } from '../../util/entities/ids';
import { formatStarsAsIcon, formatStarsAsText } from '../../util/localization/format';

import useFlag from '../../hooks/useFlag';
import useFrozenProps from '../../hooks/useFrozenProps';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
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
  isManyMessages?: boolean;
  isStory?: boolean;
  isForwarding?: boolean;
  fromChatId?: string;
  forwardMessageIds?: number[];
  shouldPaidMessageAutoApprove?: boolean;
}

const ForwardRecipientPicker: FC<OwnProps & StateProps> = ({
  isOpen,
  currentUserId,
  isManyMessages,
  isStory,
  isForwarding,
  fromChatId,
  forwardMessageIds,
  shouldPaidMessageAutoApprove,
}) => {
  const {
    openChatOrTopicWithReplyInDraft,
    setForwardChatOrTopic,
    exitForwardMode,
    forwardToSavedMessages,
    forwardToMultipleChats,
    forwardStory,
    showNotification,
    copyMessageLink,
    openStarsBalanceModal,
    setPaidMessageAutoApprove,
  } = getActions();

  const lang = useLang();
  const oldLang = useOldLang();

  const renderingIsStory = usePreviousDeprecated(isStory, true);
  const [isShown, markIsShown, unmarkIsShown] = useFlag();
  const [selectedIds, setSelectedIds] = useState<ChatSelectionKey[]>([]);
  const [caption, setCaption] = useState('');
  const [isPaymentConfirmOpen, openPaymentConfirm, closePaymentConfirm] = useFlag();
  const [shouldAutoApprove, setShouldAutoApprove] = useState(shouldPaidMessageAutoApprove);

  const isMultiSelect = isForwarding && !isStory;
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
    }
  }, [isOpen]);

  const handleSelectRecipient = useCallback((recipientId: string, threadId?: ThreadId) => {
    const isSelf = recipientId === currentUserId;
    if (isStory) {
      forwardStory({ toChatId: recipientId });
      const global = getGlobal();
      if (isUserId(recipientId)) {
        showNotification({
          message: isSelf
            ? oldLang('Conversation.StoryForwardTooltip.SavedMessages.One')
            : oldLang(
              'StorySharedTo',
              getUserFirstOrLastName(selectUser(global, recipientId)),
            ),
        });
      } else {
        const chat = selectChat(global, recipientId);
        if (!chat) return;

        showNotification({
          message: oldLang('StorySharedTo', getChatTitle(oldLang, chat)),
        });
      }
      return;
    }

    if (isSelf) {
      const message = oldLang(
        isManyMessages
          ? 'Conversation.ForwardTooltip.SavedMessages.Many'
          : 'Conversation.ForwardTooltip.SavedMessages.One',
      );

      forwardToSavedMessages({});
      showNotification({ message });
    } else {
      const chatId = recipientId;
      const topicId = threadId ? Number(threadId) : undefined;
      if (isForwarding) {
        setForwardChatOrTopic({ chatId, topicId });
      } else {
        openChatOrTopicWithReplyInDraft({ chatId, topicId });
      }
    }
  }, [currentUserId, isManyMessages, isStory, oldLang, isForwarding]);

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

  const executeForward = useLastCallback(() => {
    const targets: ForwardTarget[] = selectedIds.map(({ peerId, topicId }) => ({
      chatId: peerId,
      topicId,
    }));
    forwardToMultipleChats({ targets, comment: caption || undefined });

    showNotification({
      message: lang('FwdMessagesToChats', { count: selectedIds.length }, { pluralValue: selectedIds.length }),
    });
    exitForwardMode();
  });

  const handlePaymentConfirm = useLastCallback(() => {
    const { totalStars } = paidChatsInfo;
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
    executeForward();
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
                ? (canCopyLink ? oldLang('CopyLink') : lang('SelectChats'))
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
    paidChatsInfo, handleForwardToMultiple, handleCopyLink, lang, oldLang]);

  if (!isOpen && !isShown) {
    return undefined;
  }

  const confirmPaymentMessage = paidChatsInfo.totalStars > 0 ? lang(
    'ForwardPaidChatsConfirmation',
    {
      chatsSelected: lang(
        'ForwardPaidChatsSelected',
        { paidChatsCount: paidChatsInfo.paidChatsCount },
        { withNodes: true, withMarkdown: true, pluralValue: paidChatsInfo.paidChatsCount },
      ),
      payConfirmation: lang(
        'ForwardPaidChatsPayConfirmation',
        {
          totalAmount: formatStarsAsText(lang, paidChatsInfo.totalStars),
          count: paidChatsInfo.totalMessages,
        },
        { withNodes: true, withMarkdown: true, pluralValue: paidChatsInfo.totalMessages },
      ),
    },
    { withNodes: true },
  ) : undefined;

  const confirmLabel = lang('PayForMessage', { count: paidChatsInfo.totalMessages }, {
    withNodes: true,
    pluralValue: paidChatsInfo.totalMessages,
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
        isForwarding={isForwarding}
        withFolders
      />
      <ConfirmDialog
        title={lang('TitleConfirmPayment')}
        confirmLabel={confirmLabel}
        isOpen={isPaymentConfirmOpen}
        onClose={closePaymentConfirm}
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
  const { messageIds, storyId, fromChatId } = selectTabState(global).forwardMessages;
  const isForwarding = (messageIds && messageIds.length > 0);

  return {
    currentUserId: global.currentUserId,
    isManyMessages: (messageIds?.length || 0) > 1,
    isStory: Boolean(storyId),
    isForwarding,
    fromChatId,
    forwardMessageIds: messageIds,
    shouldPaidMessageAutoApprove: global.settings.byKey.shouldPaidMessageAutoApprove,
  };
})(ForwardRecipientPicker));
