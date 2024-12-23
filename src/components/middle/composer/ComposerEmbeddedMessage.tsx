import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat, ApiInputMessageReplyInfo, ApiMessage, ApiPeer,
} from '../../../api/types';
import type { MessageListType } from '../../../global/types';
import type { ThreadId } from '../../../types/index';

import { isChatChannel, stripCustomEmoji } from '../../../global/helpers';
import {
  selectCanAnimateInterface,
  selectChat,
  selectChatMessage,
  selectDraft,
  selectEditingId,
  selectEditingMessage,
  selectEditingScheduledId,
  selectForwardedSender,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
  selectPeer,
  selectSender,
  selectTabState,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { getPeerColorClass } from '../../common/helpers/peerColor';

import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';

import { ClosableEmbeddedMessage } from '../../common/embedded/EmbeddedMessage';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';

import './ComposerEmbeddedMessage.scss';

type StateProps = {
  replyInfo?: ApiInputMessageReplyInfo;
  editingId?: number;
  message?: ApiMessage;
  sender?: ApiPeer;
  shouldAnimate?: boolean;
  forwardedMessagesCount?: number;
  noAuthors?: boolean;
  noCaptions?: boolean;
  forwardsHaveCaptions?: boolean;
  isCurrentUserPremium?: boolean;
  isContextMenuDisabled?: boolean;
  isReplyToDiscussion?: boolean;
  isInChangingRecipientMode?: boolean;
  shouldPreventComposerAnimation?: boolean;
  senderChat?: ApiChat;
  isSenderChannel?: boolean;
  currentUserId?: string;
};

type OwnProps = {
  onClear?: () => void;
  shouldForceShowEditing?: boolean;
  chatId: string;
  threadId: ThreadId;
  messageListType: MessageListType;
};

const CLOSE_DURATION = 350;

const ComposerEmbeddedMessage: FC<OwnProps & StateProps> = ({
  replyInfo,
  editingId,
  message,
  sender,
  shouldAnimate,
  forwardedMessagesCount,
  noAuthors,
  noCaptions,
  forwardsHaveCaptions,
  shouldForceShowEditing,
  isCurrentUserPremium,
  isContextMenuDisabled,
  isReplyToDiscussion,
  onClear,
  isInChangingRecipientMode,
  shouldPreventComposerAnimation,
  senderChat,
  chatId,
  currentUserId,
  isSenderChannel,
}) => {
  const {
    resetDraftReplyInfo,
    updateDraftReplyInfo,
    setEditingId,
    focusMessage,
    changeRecipient,
    openChatOrTopicWithReplyInDraft,
    setForwardNoAuthors,
    setForwardNoCaptions,
    exitForwardMode,
    setShouldPreventComposerAnimation,
  } = getActions();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const oldLang = useOldLang();
  const lang = useLang();

  const isReplyToTopicStart = message?.content.action?.type === 'topicCreate';
  const isShowingReply = replyInfo && !shouldForceShowEditing;
  const isReplyWithQuote = Boolean(replyInfo?.quoteText);

  const isForwarding = Boolean(forwardedMessagesCount);

  const isShown = (() => {
    if (isInChangingRecipientMode) return false;
    if (message && (replyInfo || editingId)) return true;
    if (sender && isForwarding) return true;
    return false;
  })();

  const {
    shouldRender, transitionClassNames,
  } = useShowTransitionDeprecated(
    isShown && !isReplyToTopicStart && !isReplyToDiscussion,
    undefined,
    !shouldAnimate,
    undefined,
    !shouldAnimate,
    CLOSE_DURATION,
    !shouldAnimate,
  );
  useEffect(() => {
    if (shouldPreventComposerAnimation) {
      setShouldPreventComposerAnimation({ shouldPreventComposerAnimation: false });
    }
  });

  const clearEmbedded = useLastCallback(() => {
    if (editingId) {
      setEditingId({ messageId: undefined });
    } else if (forwardedMessagesCount) {
      exitForwardMode();
    } else if (replyInfo && !shouldForceShowEditing) {
      resetDraftReplyInfo();
    }
    onClear?.();
  });

  useEffect(() => (isShown ? captureEscKeyListener(clearEmbedded) : undefined), [isShown, clearEmbedded]);

  const {
    isContextMenuOpen, contextMenuAnchor, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const focusMessageFromDraft = () => {
    focusMessage({ chatId: message!.chatId, messageId: message!.id, noForumTopicPanel: true });
  };
  const handleMessageClick = useLastCallback((e: React.MouseEvent): void => {
    handleContextMenu(e);
  });

  const handleClearClick = useLastCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
    e.stopPropagation();
    clearEmbedded();
    handleContextMenuHide();
  });
  const buildAutoCloseMenuItemHandler = (action: NoneToVoidFunction) => {
    return () => {
      handleContextMenuClose();
      action();
    };
  };
  const handleForwardToAnotherChatClick = useLastCallback(buildAutoCloseMenuItemHandler(changeRecipient));
  const handleShowMessageClick = useLastCallback(buildAutoCloseMenuItemHandler(focusMessageFromDraft));
  const handleRemoveQuoteClick = useLastCallback(buildAutoCloseMenuItemHandler(
    () => updateDraftReplyInfo({ quoteText: undefined }),
  ));
  const handleChangeReplyRecipientClick = useLastCallback(buildAutoCloseMenuItemHandler(changeRecipient));
  const handleReplyInSenderChat = useLastCallback(() => {
    handleContextMenuClose();
    if (!sender) return;
    openChatOrTopicWithReplyInDraft({ chatId: sender.id });
  });
  const handleDoNotReplyClick = useLastCallback(buildAutoCloseMenuItemHandler(clearEmbedded));

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => ref.current!);
  const getMenuElement = useLastCallback(() => ref.current!.querySelector('.forward-context-menu .bubble'));

  useEffect(() => {
    if (!shouldRender) {
      handleContextMenuClose();
      handleContextMenuHide();
    }
  }, [handleContextMenuClose, handleContextMenuHide, shouldRender]);

  const className = buildClassName('ComposerEmbeddedMessage', transitionClassNames);
  const renderingSender = useCurrentOrPrev(sender, true);
  const innerClassName = buildClassName(
    'ComposerEmbeddedMessage_inner',
    getPeerColorClass(renderingSender),
  );

  const leftIcon = useMemo(() => {
    if (editingId) {
      return 'edit';
    }
    if (isForwarding) {
      return 'forward';
    }
    if (isShowingReply) {
      return 'reply';
    }

    return undefined;
  }, [editingId, isForwarding, isShowingReply]);

  const customText = forwardedMessagesCount && forwardedMessagesCount > 1
    ? oldLang('ForwardedMessageCount', forwardedMessagesCount)
    : undefined;

  const strippedMessage = useMemo(() => {
    if (!message || !isForwarding || !message.content.text || !noAuthors || isCurrentUserPremium) return message;

    const strippedText = stripCustomEmoji(message.content.text);
    return {
      ...message,
      content: {
        ...message.content,
        text: strippedText,
      },
    };
  }, [isCurrentUserPremium, isForwarding, message, noAuthors]);

  const renderingLeftIcon = useCurrentOrPrev(leftIcon, true);

  if (!shouldRender) {
    return undefined;
  }

  const canReplyInSenderChat = sender && !isSenderChannel && chatId !== sender.id && sender.id !== currentUserId;

  return (
    <div className={className} ref={ref} onContextMenu={handleContextMenu}>
      <div className={innerClassName}>
        <div className="embedded-left-icon" onClick={handleContextMenu}>
          {renderingLeftIcon && <Icon name={renderingLeftIcon} />}
          {Boolean(replyInfo?.quoteText) && (
            <Icon name="quote" className="quote-reply" />
          )}
        </div>
        <ClosableEmbeddedMessage
          isOpen={isShown}
          className="inside-input"
          replyInfo={replyInfo}
          isInComposer
          message={strippedMessage}
          sender={!noAuthors ? sender : undefined}
          customText={customText}
          title={(editingId && !isShowingReply) ? oldLang('EditMessage')
            : noAuthors ? oldLang('HiddenSendersNameDescription') : undefined}
          onClick={handleMessageClick}
          senderChat={senderChat}
        />
        <Button
          className="embedded-cancel"
          round
          faded
          color="translucent"
          ariaLabel={oldLang('Cancel')}
          onClick={handleClearClick}
        >
          <i className="icon icon-close" />
        </Button>
        {(isShowingReply || isForwarding) && !isContextMenuDisabled && (
          <Menu
            isOpen={isContextMenuOpen}
            anchor={contextMenuAnchor}
            getTriggerElement={getTriggerElement}
            getRootElement={getRootElement}
            getMenuElement={getMenuElement}
            className="forward-context-menu"
            onClose={handleContextMenuClose}
            onCloseAnimationEnd={handleContextMenuHide}
          >
            {isForwarding && (
              <>
                <MenuItem
                  icon={!noAuthors ? 'message-succeeded' : undefined}
                  customIcon={noAuthors ? <i className="icon icon-placeholder" /> : undefined}
                  // eslint-disable-next-line react/jsx-no-bind
                  onClick={() => setForwardNoAuthors({
                    noAuthors: false,
                  })}
                >
                  {oldLang(forwardedMessagesCount > 1 ? 'ShowSenderNames' : 'ShowSendersName')}
                </MenuItem>
                <MenuItem
                  icon={noAuthors ? 'message-succeeded' : undefined}
                  customIcon={!noAuthors ? <i className="icon icon-placeholder" /> : undefined}
                  // eslint-disable-next-line react/jsx-no-bind
                  onClick={() => setForwardNoAuthors({
                    noAuthors: true,
                  })}
                >
                  {oldLang(forwardedMessagesCount > 1 ? 'HideSenderNames' : 'HideSendersName')}
                </MenuItem>
                {forwardsHaveCaptions && (
                  <>
                    <MenuSeparator />
                    <MenuItem
                      icon={!noCaptions ? 'message-succeeded' : undefined}
                      customIcon={noCaptions ? <i className="icon icon-placeholder" /> : undefined}
                      // eslint-disable-next-line react/jsx-no-bind
                      onClick={() => setForwardNoCaptions({
                        noCaptions: false,
                      })}
                    >
                      {oldLang(forwardedMessagesCount > 1 ? 'Conversation.ForwardOptions.ShowCaption' : 'ShowCaption')}
                    </MenuItem>
                    <MenuItem
                      icon={noCaptions ? 'message-succeeded' : undefined}
                      customIcon={!noCaptions ? <i className="icon icon-placeholder" /> : undefined}
                      // eslint-disable-next-line react/jsx-no-bind
                      onClick={() => setForwardNoCaptions({
                        noCaptions: true,
                      })}
                    >
                      {oldLang(forwardedMessagesCount > 1 ? 'Conversation.ForwardOptions.HideCaption' : 'HideCaption')}
                    </MenuItem>
                  </>
                )}
                <MenuSeparator />
                <MenuItem icon="replace" onClick={handleForwardToAnotherChatClick}>
                  {oldLang('ForwardAnotherChat')}
                </MenuItem>
              </>
            )}
            {isShowingReply && (
              <>
                <MenuItem
                  icon="show-message"
                  onClick={handleShowMessageClick}
                >
                  {oldLang('Message.Context.Goto')}
                </MenuItem>
                {isReplyWithQuote && (
                  <MenuItem
                    icon="remove-quote"
                    onClick={handleRemoveQuoteClick}
                  >
                    {oldLang('RemoveQuote')}
                  </MenuItem>
                )}
                {canReplyInSenderChat && (
                  <MenuItem icon="user" onClick={handleReplyInSenderChat}>
                    {lang('ReplyInPrivateMessage')}
                  </MenuItem>
                )}
                <MenuItem icon="replace" onClick={handleChangeReplyRecipientClick}>
                  {oldLang('ReplyToAnotherChat')}
                </MenuItem>
                <MenuItem icon="delete" onClick={handleDoNotReplyClick}>
                  {oldLang('DoNotReply')}
                </MenuItem>
              </>
            )}
          </Menu>
        )}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, {
    shouldForceShowEditing, chatId, threadId, messageListType,
  }): StateProps => {
    const {
      forwardMessages: {
        fromChatId, toChatId, messageIds: forwardMessageIds, noAuthors, noCaptions,
      },
      isShareMessageModalShown: isModalShown,
      shouldPreventComposerAnimation,
    } = selectTabState(global);

    const editingId = messageListType === 'scheduled'
      ? selectEditingScheduledId(global, chatId)
      : selectEditingId(global, chatId, threadId);
    const shouldAnimate = selectCanAnimateInterface(global) && !shouldPreventComposerAnimation;
    const isForwarding = toChatId === chatId;
    const forwardedMessages = forwardMessageIds?.map((id) => selectChatMessage(global, fromChatId!, id)!);

    const draft = selectDraft(global, chatId, threadId);
    const replyInfo = draft?.replyInfo;
    const replyToPeerId = replyInfo?.replyToPeerId;
    const senderChat = replyToPeerId ? selectChat(global, replyToPeerId) : undefined;

    let message: ApiMessage | undefined;
    if (editingId) {
      message = selectEditingMessage(global, chatId, threadId, messageListType);
    } else if (isForwarding && forwardMessageIds!.length === 1) {
      message = forwardedMessages?.[0];
    } else if (replyInfo && !shouldForceShowEditing) {
      message = selectChatMessage(global, replyInfo.replyToPeerId || chatId, replyInfo.replyToMsgId);
    }

    let sender: ApiPeer | undefined;

    if (editingId && message) {
      sender = selectSender(global, message);
    } else if (isForwarding) {
      if (message) {
        sender = selectForwardedSender(global, message);
        if (!sender) {
          sender = selectSender(global, message);
        }
      }
      if (!sender) {
        sender = selectPeer(global, fromChatId!);
      }
    } else if (replyInfo && message && !shouldForceShowEditing) {
      const { forwardInfo } = message;
      const isChatWithSelf = selectIsChatWithSelf(global, chatId);
      if (forwardInfo && (forwardInfo.isChannelPost || isChatWithSelf)) {
        sender = selectForwardedSender(global, message);
      }

      if (!sender && (!forwardInfo?.hiddenUserName || Boolean(replyInfo.quoteText))) {
        sender = selectSender(global, message);
      }
    }

    const chat = sender && selectChat(global, sender.id);
    const isSenderChannel = chat && isChatChannel(chat);

    const forwardsHaveCaptions = forwardedMessages?.some((forward) => (
      forward?.content.text && Object.keys(forward.content).length > 1
    ));

    const isContextMenuDisabled = isForwarding && forwardMessageIds!.length === 1
      && Boolean(message?.content.storyData);

    const isReplyToDiscussion = replyInfo?.replyToMsgId === threadId && !replyInfo.replyToPeerId;

    return {
      replyInfo,
      editingId,
      message,
      sender,
      shouldAnimate,
      forwardedMessagesCount: isForwarding ? forwardMessageIds!.length : undefined,
      noAuthors,
      noCaptions,
      forwardsHaveCaptions,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      isContextMenuDisabled,
      isReplyToDiscussion,
      isInChangingRecipientMode: isModalShown,
      shouldPreventComposerAnimation,
      senderChat,
      currentUserId: global.currentUserId,
      isSenderChannel,
    };
  },
)(ComposerEmbeddedMessage));
