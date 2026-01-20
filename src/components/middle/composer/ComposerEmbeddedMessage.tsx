import {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiChat, ApiInputMessageReplyInfo, ApiInputSuggestedPostInfo, ApiMessage, ApiPeer,
} from '../../../api/types';
import type { MessageListType, ThemeKey, ThreadId } from '../../../types/index';

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
  selectSender,
  selectTabState,
  selectTheme,
} from '../../../global/selectors';
import { selectIsMediaNsfw } from '../../../global/selectors/media';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { unique } from '../../../util/iteratees';

import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useFrozenProps from '../../../hooks/useFrozenProps';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import usePeerColor from '../../../hooks/usePeerColor';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';

import EmbeddedMessage from '../../common/embedded/EmbeddedMessage';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';

import './ComposerEmbeddedMessage.scss';

type StateProps = {
  replyInfo?: ApiInputMessageReplyInfo;
  suggestedPostInfo?: ApiInputSuggestedPostInfo;
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
  forwardMessageIds?: number[];
  fromChatId?: string;
  isMediaNsfw?: boolean;
  theme: ThemeKey;
};

type OwnProps = {
  shouldForceShowEditing?: boolean;
  chatId: string;
  threadId: ThreadId;
  messageListType: MessageListType;
  onClear?: () => void;
};

const CLOSE_DURATION = 350;

const ComposerEmbeddedMessage = (props: OwnProps & StateProps) => {
  const {
    shouldAnimate,
    isReplyToDiscussion,
    isInChangingRecipientMode,
    forwardMessageIds,
    fromChatId,
    replyInfo,
    editingId,
    suggestedPostInfo,
    shouldForceShowEditing,
    message,
    forwardedMessagesCount,
  } = props;

  const {
    resetDraftReplyInfo,
    resetDraftSuggestedPostInfo,
    updateDraftReplyInfo,
    setEditingId,
    focusMessage,
    changeRecipient,
    openChatOrTopicWithReplyInDraft,
    setForwardNoAuthors,
    setForwardNoCaptions,
    exitForwardMode,
    setShouldPreventComposerAnimation,
    openSuggestMessageModal,
  } = getActions();
  const ref = useRef<HTMLDivElement>();
  const oldLang = useOldLang();
  const lang = useLang();

  const isReplyToTopicStart = message?.content.action?.type === 'topicCreate';
  const isShowingSuggestedPost = Boolean(suggestedPostInfo) && !shouldForceShowEditing;
  const isForwarding = Boolean(forwardedMessagesCount);

  const selectSenderFromForwardedMessage = useLastCallback((forwardedMessage: ApiMessage) => {
    const global = getGlobal();
    let localSender = selectForwardedSender(global, forwardedMessage);
    if (!localSender) {
      localSender = selectSender(global, forwardedMessage);
    }
    return localSender;
  });

  const forwardSenders = useMemo(() => {
    if (!isForwarding) return undefined;
    const forwardedMessages = forwardMessageIds?.map((id) => selectChatMessage(getGlobal(), fromChatId!, id))
      .filter(Boolean);
    const senders = forwardedMessages?.map((m) => selectSenderFromForwardedMessage(m)).filter(Boolean);
    return senders ? unique(senders) : undefined;
  }, [isForwarding, forwardMessageIds, fromChatId]);

  const isShown = (() => {
    if (isInChangingRecipientMode) return false;
    if (message && (replyInfo || editingId)) return true;
    if (forwardSenders && isForwarding) return true;
    if (isShowingSuggestedPost) return true;
    return false;
  })();

  const {
    shouldRender, transitionClassNames, isClosing,
  } = useShowTransitionDeprecated(
    isShown && !isReplyToTopicStart && !isReplyToDiscussion,
    undefined,
    !shouldAnimate,
    undefined,
    !shouldAnimate,
    CLOSE_DURATION,
    !shouldAnimate,
  );

  const {
    chatId,
    currentUserId,
    theme,
    onClear,
    isCurrentUserPremium,
    isContextMenuDisabled,
    shouldPreventComposerAnimation,
    sender,
    senderChat,
    isMediaNsfw,
    noAuthors,
    noCaptions,
    forwardsHaveCaptions,
    forwardedMessagesCount: frozenForwardedMessagesCount,
    message: frozenMessage,
    shouldForceShowEditing: frozenShouldForceShowEditing,
    suggestedPostInfo: frozenSuggestedPostInfo,
    replyInfo: frozenReplyInfo,
    editingId: frozenEditingId,
    isSenderChannel,
  } = useFrozenProps(props, isClosing);

  const isForwardingRendering = Boolean(frozenForwardedMessagesCount);
  const isShowingReplyRendering = Boolean(frozenReplyInfo) && !frozenShouldForceShowEditing;
  const isReplyWithQuoteRendering = Boolean(frozenReplyInfo?.quoteText);
  const isShowingSuggestedPostRendering = Boolean(frozenSuggestedPostInfo) && !frozenShouldForceShowEditing;

  useEffect(() => {
    if (shouldPreventComposerAnimation) {
      setShouldPreventComposerAnimation({ shouldPreventComposerAnimation: false });
    }
  });

  const clearEmbedded = useLastCallback(() => {
    if (frozenEditingId) {
      setEditingId({ messageId: undefined });
    } else if (frozenForwardedMessagesCount) {
      exitForwardMode();
    } else if (isShowingSuggestedPostRendering) {
      resetDraftSuggestedPostInfo();
      resetDraftReplyInfo();
    } else if (frozenReplyInfo && !frozenShouldForceShowEditing) {
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
    focusMessage({ chatId: frozenMessage!.chatId, messageId: frozenMessage!.id, noForumTopicPanel: true });
  };
  const handleMessageClick = useLastCallback((e: React.MouseEvent): void => {
    if (frozenSuggestedPostInfo) {
      openSuggestMessageModal({ chatId });
      return;
    }
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

  const handleIconKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleContextMenu(e as unknown as React.MouseEvent);
    }
  });

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

  const { className: peerColorClass, style: peerColorStyle } = usePeerColor({
    peer: sender,
    theme,
  });
  const innerClassName = buildClassName('ComposerEmbeddedMessage_inner', peerColorClass);

  const leftIcon = useMemo(() => {
    if (frozenEditingId) {
      return 'edit';
    }
    if (isShowingSuggestedPostRendering) {
      return 'cash-circle';
    }
    if (isForwardingRendering) {
      return 'forward';
    }
    if (isShowingReplyRendering) {
      return 'reply';
    }

    return undefined;
  }, [frozenEditingId, isForwardingRendering, isShowingReplyRendering, isShowingSuggestedPostRendering]);

  const customText = frozenForwardedMessagesCount && frozenForwardedMessagesCount > 1
    ? oldLang('ForwardedMessageCount', frozenForwardedMessagesCount)
    : undefined;

  const strippedMessage = useMemo(() => {
    if (!frozenMessage || !isForwardingRendering || !frozenMessage.content.text
      || !noAuthors || isCurrentUserPremium) return frozenMessage;

    const strippedText = stripCustomEmoji(frozenMessage.content.text);
    return {
      ...frozenMessage,
      content: {
        ...frozenMessage.content,
        text: strippedText,
      },
    };
  }, [isCurrentUserPremium, isForwardingRendering, frozenMessage, noAuthors]);

  const renderingLeftIcon = useCurrentOrPrev(leftIcon, true);

  if (!shouldRender) {
    return undefined;
  }

  const canReplyInSenderChat = sender && !isSenderChannel
    && chatId !== sender.id && sender.id !== currentUserId;

  return (
    <div className={className} ref={ref} onContextMenu={handleContextMenu}>
      <div className={innerClassName} style={peerColorStyle}>
        <div
          className="embedded-left-icon"
          role="button"
          tabIndex={0}
          onClick={handleContextMenu}
          onKeyDown={handleIconKeyDown}
        >
          {renderingLeftIcon && <Icon name={renderingLeftIcon} />}
          {Boolean(frozenReplyInfo?.quoteText) && (
            <Icon name="quote" className="quote-reply" />
          )}
        </div>
        <EmbeddedMessage
          isOpen={isShown}
          className="inside-input"
          replyInfo={frozenReplyInfo}
          suggestedPostInfo={frozenSuggestedPostInfo}
          isMediaNsfw={isMediaNsfw}
          isInComposer
          message={strippedMessage}
          sender={!noAuthors ? sender : undefined}
          composerForwardSenders={forwardSenders}
          customText={customText}
          noCaptions={noCaptions}
          title={(frozenEditingId && !isShowingReplyRendering) ? oldLang('EditMessage')
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
          iconName="close"
        />
        {(isShowingReplyRendering || isForwardingRendering) && !isContextMenuDisabled && (
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
            {isForwardingRendering && (
              <>
                <MenuItem
                  icon={!noAuthors ? 'message-succeeded' : undefined}
                  customIcon={noAuthors ? <Icon name="placeholder" /> : undefined}

                  onClick={() => setForwardNoAuthors({
                    noAuthors: false,
                  })}
                >
                  {oldLang(frozenForwardedMessagesCount > 1 ? 'ShowSenderNames' : 'ShowSendersName')}
                </MenuItem>
                <MenuItem
                  icon={noAuthors ? 'message-succeeded' : undefined}
                  customIcon={!noAuthors ? <Icon name="placeholder" /> : undefined}

                  onClick={() => setForwardNoAuthors({
                    noAuthors: true,
                  })}
                >
                  {oldLang(frozenForwardedMessagesCount > 1 ? 'HideSenderNames' : 'HideSendersName')}
                </MenuItem>
                {forwardsHaveCaptions && (
                  <>
                    <MenuSeparator />
                    <MenuItem
                      icon={!noCaptions ? 'message-succeeded' : undefined}
                      customIcon={noCaptions ? <Icon name="placeholder" /> : undefined}

                      onClick={() => setForwardNoCaptions({
                        noCaptions: false,
                      })}
                    >
                      {oldLang(frozenForwardedMessagesCount > 1
                        ? 'Conversation.ForwardOptions.ShowCaption' : 'ShowCaption')}
                    </MenuItem>
                    <MenuItem
                      icon={noCaptions ? 'message-succeeded' : undefined}
                      customIcon={!noCaptions ? <Icon name="placeholder" /> : undefined}

                      onClick={() => setForwardNoCaptions({
                        noCaptions: true,
                      })}
                    >
                      {oldLang(frozenForwardedMessagesCount > 1
                        ? 'Conversation.ForwardOptions.HideCaption' : 'HideCaption')}
                    </MenuItem>
                  </>
                )}
                <MenuSeparator />
                <MenuItem icon="replace" onClick={handleForwardToAnotherChatClick}>
                  {oldLang('ForwardAnotherChat')}
                </MenuItem>
              </>
            )}
            {isShowingReplyRendering && (
              <>
                <MenuItem
                  icon="show-message"
                  onClick={handleShowMessageClick}
                >
                  {oldLang('Message.Context.Goto')}
                </MenuItem>
                {isReplyWithQuoteRendering && (
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
  }): Complete<StateProps> => {
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
    const suggestedPostInfo = draft?.suggestedPostInfo;
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

    const selectSenderFromForwardedMessage = (forwardedMessage: ApiMessage) => {
      sender = selectForwardedSender(global, forwardedMessage);
      if (!sender) {
        sender = selectSender(global, forwardedMessage);
      }
      return sender;
    };

    if (editingId && message) {
      sender = selectSender(global, message);
    } else if (isForwarding) {
      let forwardSenders = forwardedMessages?.map((m) => selectSenderFromForwardedMessage(m)).filter(Boolean);
      forwardSenders = forwardSenders ? unique(forwardSenders) : undefined;
      sender = forwardSenders?.length === 1 ? forwardSenders?.[0] : undefined;
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

    const isMediaNsfw = message && selectIsMediaNsfw(global, message);

    return {
      replyInfo,
      suggestedPostInfo,
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
      forwardMessageIds,
      fromChatId,
      isMediaNsfw,
      theme: selectTheme(global),
    };
  },
)(ComposerEmbeddedMessage));
