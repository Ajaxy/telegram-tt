import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiInputMessageReplyInfo, ApiMessage, ApiPeer } from '../../../api/types';

import { stripCustomEmoji } from '../../../global/helpers';
import {
  selectCanAnimateInterface,
  selectChatMessage,
  selectCurrentMessageList,
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
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMenuPosition from '../../../hooks/useMenuPosition';
import useShowTransition from '../../../hooks/useShowTransition';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import EmbeddedMessage from '../../common/embedded/EmbeddedMessage';
import Icon from '../../common/Icon';
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
};

type OwnProps = {
  onClear?: () => void;
  shouldForceShowEditing?: boolean;
};

const FORWARD_RENDERING_DELAY = 300;

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
}) => {
  const {
    resetDraftReplyInfo,
    setEditingId,
    focusMessage,
    changeForwardRecipient,
    setForwardNoAuthors,
    setForwardNoCaptions,
    exitForwardMode,
  } = getActions();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const lang = useLang();

  const isReplyToTopicStart = message?.content.action?.type === 'topicCreate';

  const isForwarding = Boolean(forwardedMessagesCount);
  const isShown = Boolean(
    ((replyInfo || editingId) && message)
    || (sender && forwardedMessagesCount),
  );
  const canAnimate = useAsyncRendering(
    [isShown],
    isShown ? FORWARD_RENDERING_DELAY : undefined,
  );

  const {
    shouldRender, transitionClassNames,
  } = useShowTransition(
    canAnimate && isShown && !isReplyToTopicStart && !isReplyToDiscussion,
    undefined,
    !shouldAnimate,
    undefined,
    !shouldAnimate,
  );

  const clearEmbedded = useLastCallback(() => {
    if (replyInfo && !shouldForceShowEditing) {
      resetDraftReplyInfo();
    } else if (editingId) {
      setEditingId({ messageId: undefined });
    } else if (forwardedMessagesCount) {
      exitForwardMode();
    }
    onClear?.();
  });

  useEffect(() => (isShown ? captureEscKeyListener(clearEmbedded) : undefined), [isShown, clearEmbedded]);

  const handleMessageClick = useLastCallback((): void => {
    if (isForwarding) return;
    focusMessage({ chatId: message!.chatId, messageId: message!.id, noForumTopicPanel: true });
  });

  const handleClearClick = useLastCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
    e.stopPropagation();
    clearEmbedded();
  });

  const handleChangeRecipientClick = useLastCallback(() => {
    changeForwardRecipient();
  });

  const {
    isContextMenuOpen, contextMenuPosition, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => ref.current!);
  const getMenuElement = useLastCallback(() => ref.current!.querySelector('.forward-context-menu .bubble'));

  const {
    positionX, positionY, transformOriginX, transformOriginY, style: menuStyle,
  } = useMenuPosition(
    contextMenuPosition,
    getTriggerElement,
    getRootElement,
    getMenuElement,
  );

  useEffect(() => {
    if (!shouldRender) handleContextMenuClose();
  }, [handleContextMenuClose, shouldRender]);

  const className = buildClassName('ComposerEmbeddedMessage', transitionClassNames);
  const innerClassName = buildClassName(
    'ComposerEmbeddedMessage_inner',
    getPeerColorClass(sender),
  );

  const isShowingReply = replyInfo && !shouldForceShowEditing;

  const leftIcon = useMemo(() => {
    if (isShowingReply) {
      return 'reply';
    }
    if (editingId) {
      return 'edit';
    }
    if (isForwarding) {
      return 'forward';
    }

    return undefined;
  }, [editingId, isForwarding, isShowingReply]);

  const customText = forwardedMessagesCount && forwardedMessagesCount > 1
    ? lang('ForwardedMessageCount', forwardedMessagesCount)
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

  if (!shouldRender) {
    return undefined;
  }

  return (
    <div className={className} ref={ref} onContextMenu={handleContextMenu} onClick={handleContextMenu}>
      <div className={innerClassName}>
        <div className="embedded-left-icon">
          {leftIcon && <Icon name={leftIcon} />}
          {Boolean(replyInfo?.quoteText) && (
            <Icon name="quote" className="quote-reply" />
          )}
        </div>
        <EmbeddedMessage
          className="inside-input"
          replyInfo={replyInfo}
          isInComposer
          message={strippedMessage}
          sender={!noAuthors ? sender : undefined}
          customText={customText}
          title={(editingId && !isShowingReply) ? lang('EditMessage')
            : noAuthors ? lang('HiddenSendersNameDescription') : undefined}
          onClick={handleMessageClick}
        />
        <Button
          className="embedded-cancel"
          round
          faded
          color="translucent"
          ariaLabel={lang('Cancel')}
          onClick={handleClearClick}
        >
          <i className="icon icon-close" />
        </Button>
        {isForwarding && !isContextMenuDisabled && (
          <Menu
            isOpen={isContextMenuOpen}
            transformOriginX={transformOriginX}
            transformOriginY={transformOriginY}
            positionX={positionX}
            positionY={positionY}
            style={menuStyle}
            className="forward-context-menu"
            onClose={handleContextMenuClose}
            onCloseAnimationEnd={handleContextMenuHide}
          >
            <MenuItem
              icon={!noAuthors ? 'message-succeeded' : undefined}
              customIcon={noAuthors ? <i className="icon icon-placeholder" /> : undefined}
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => setForwardNoAuthors({
                noAuthors: false,
              })}
            >
              {lang(forwardedMessagesCount > 1 ? 'ShowSenderNames' : 'ShowSendersName')}
            </MenuItem>
            <MenuItem
              icon={noAuthors ? 'message-succeeded' : undefined}
              customIcon={!noAuthors ? <i className="icon icon-placeholder" /> : undefined}
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => setForwardNoAuthors({
                noAuthors: true,
              })}
            >
              {lang(forwardedMessagesCount > 1 ? 'HideSenderNames' : 'HideSendersName')}
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
                  {lang(forwardedMessagesCount > 1 ? 'Conversation.ForwardOptions.ShowCaption' : 'ShowCaption')}
                </MenuItem>
                <MenuItem
                  icon={noCaptions ? 'message-succeeded' : undefined}
                  customIcon={!noCaptions ? <i className="icon icon-placeholder" /> : undefined}
                  // eslint-disable-next-line react/jsx-no-bind
                  onClick={() => setForwardNoCaptions({
                    noCaptions: true,
                  })}
                >
                  {lang(forwardedMessagesCount > 1 ? 'Conversation.ForwardOptions.HideCaption' : 'HideCaption')}
                </MenuItem>
              </>
            )}
            <MenuSeparator />
            <MenuItem icon="replace" onClick={handleChangeRecipientClick}>
              {lang('ChangeRecipient')}
            </MenuItem>
          </Menu>
        )}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { shouldForceShowEditing }): StateProps => {
    const { chatId, threadId, type: messageListType } = selectCurrentMessageList(global) || {};
    if (!chatId || !threadId || !messageListType) {
      return {};
    }

    const {
      forwardMessages: {
        fromChatId, toChatId, messageIds: forwardMessageIds, noAuthors, noCaptions,
      },
    } = selectTabState(global);

    const editingId = messageListType === 'scheduled'
      ? selectEditingScheduledId(global, chatId)
      : selectEditingId(global, chatId, threadId);
    const shouldAnimate = selectCanAnimateInterface(global);
    const isForwarding = toChatId === chatId;
    const forwardedMessages = forwardMessageIds?.map((id) => selectChatMessage(global, fromChatId!, id)!);

    const draft = selectDraft(global, chatId, threadId);
    const replyInfo = draft?.replyInfo;

    let message: ApiMessage | undefined;
    if (replyInfo && !shouldForceShowEditing) {
      message = selectChatMessage(global, replyInfo.replyToPeerId || chatId, replyInfo.replyToMsgId);
    } else if (editingId) {
      message = selectEditingMessage(global, chatId, threadId, messageListType);
    } else if (isForwarding && forwardMessageIds!.length === 1) {
      message = forwardedMessages?.[0];
    }

    let sender: ApiPeer | undefined;
    if (replyInfo && message && !shouldForceShowEditing) {
      const { forwardInfo } = message;
      const isChatWithSelf = selectIsChatWithSelf(global, chatId);
      if (forwardInfo && (forwardInfo.isChannelPost || isChatWithSelf)) {
        sender = selectForwardedSender(global, message);
      }

      if (!sender && (!forwardInfo?.hiddenUserName || Boolean(replyInfo.quoteText))) {
        sender = selectSender(global, message);
      }
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
    } else if (editingId && message) {
      sender = selectSender(global, message);
    }

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
    };
  },
)(ComposerEmbeddedMessage));
