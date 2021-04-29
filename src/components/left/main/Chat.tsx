import React, {
  FC, memo, useCallback, useLayoutEffect, useRef,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import useLang from '../../../hooks/useLang';

import { GlobalActions, MessageListType } from '../../../global/types';
import {
  ApiChat, ApiUser, ApiMessage, ApiMessageOutgoingStatus, ApiFormattedText, MAIN_THREAD_ID,
} from '../../../api/types';

import { ANIMATION_END_DELAY } from '../../../config';
import { IS_MOBILE_SCREEN } from '../../../util/environment';
import {
  getChatTitle,
  isChatPrivate,
  isActionMessage,
  getPrivateChatUserId,
  getMessageAction,
  getMessageSenderName,
  isChatChannel,
  getMessageMediaHash,
  getMessageSummaryText,
  getMessageMediaThumbDataUri,
  getMessageVideo,
  getMessageSticker,
} from '../../../modules/helpers';
import {
  selectChat, selectUser, selectChatMessage, selectOutgoingStatus, selectDraft, selectCurrentMessageList,
} from '../../../modules/selectors';
import { renderActionMessageText } from '../../common/helpers/renderActionMessageText';
import renderText from '../../common/helpers/renderText';
import { fastRaf } from '../../../util/schedulers';
import buildClassName from '../../../util/buildClassName';
import { pick } from '../../../util/iteratees';
import useEnsureMessage from '../../../hooks/useEnsureMessage';
import useChatContextActions from '../../../hooks/useChatContextActions';
import useFlag from '../../../hooks/useFlag';
import useMedia from '../../../hooks/useMedia';
import { ChatAnimationTypes } from './hooks';

import Avatar from '../../common/Avatar';
import VerifiedIcon from '../../common/VerifiedIcon';
import TypingStatus from '../../common/TypingStatus';
import LastMessageMeta from '../../common/LastMessageMeta';
import DeleteChatModal from '../../common/DeleteChatModal';
import ListItem from '../../ui/ListItem';
import Badge from './Badge';

import './Chat.scss';

type OwnProps = {
  style?: string;
  chatId: number;
  folderId?: number;
  orderDiff: number;
  animationType: ChatAnimationTypes;
  isSelected: boolean;
  isPinned?: boolean;
};

type StateProps = {
  chat?: ApiChat;
  privateChatUser?: ApiUser;
  actionTargetUser?: ApiUser;
  actionTargetMessage?: ApiMessage;
  actionTargetChatId?: number;
  lastMessageSender?: ApiUser;
  lastMessageOutgoingStatus?: ApiMessageOutgoingStatus;
  draft?: ApiFormattedText;
  messageListType?: MessageListType;
  animationLevel?: number;
  lastSyncTime?: number;
};

type DispatchProps = Pick<GlobalActions, 'openChat' | 'focusLastMessage'>;

const ANIMATION_DURATION = 200;

const Chat: FC<OwnProps & StateProps & DispatchProps> = ({
  style,
  chatId,
  folderId,
  orderDiff,
  animationType,
  isSelected,
  isPinned,
  chat,
  privateChatUser,
  actionTargetUser,
  lastMessageSender,
  lastMessageOutgoingStatus,
  actionTargetMessage,
  actionTargetChatId,
  draft,
  messageListType,
  animationLevel,
  lastSyncTime,
  openChat,
  focusLastMessage,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();

  const { lastMessage, typingStatus } = chat || {};
  const isAction = lastMessage && isActionMessage(lastMessage);

  useEnsureMessage(chatId, isAction ? lastMessage!.replyToMessageId : undefined, actionTargetMessage);

  const mediaThumbnail = lastMessage && !getMessageSticker(lastMessage)
    ? getMessageMediaThumbDataUri(lastMessage)
    : undefined;
  const mediaBlobUrl = useMedia(lastMessage ? getMessageMediaHash(lastMessage, 'micro') : undefined);

  // Sets animation excess values when `orderDiff` changes and then resets excess values to animate.
  useLayoutEffect(() => {
    if (animationLevel === 0) {
      return;
    }

    const element = ref.current!;

    // TODO Refactor animation: create `useListAnimation` that owns `orderDiff` and `animationType`
    if (animationType === ChatAnimationTypes.Opacity) {
      element.style.opacity = '0';

      fastRaf(() => {
        element.classList.add('animate-opacity');
        element.style.opacity = '1';
      });
    } else if (animationType === ChatAnimationTypes.Move) {
      element.style.transform = `translate3d(0, ${-orderDiff * 100}%, 0)`;

      fastRaf(() => {
        element.classList.add('animate-transform');
        element.style.transform = '';
      });
    } else {
      return;
    }

    setTimeout(() => {
      fastRaf(() => {
        element.classList.remove('animate-opacity', 'animate-transform');
        element.style.opacity = '';
        element.style.transform = '';
      });
    }, ANIMATION_DURATION + ANIMATION_END_DELAY);
  }, [animationLevel, orderDiff, animationType]);

  const handleClick = useCallback(() => {
    openChat({ id: chatId });

    if (isSelected && messageListType === 'thread') {
      focusLastMessage();
    }
  }, [
    isSelected,
    messageListType,
    openChat,
    chatId,
    focusLastMessage,
  ]);

  const contextActions = useChatContextActions({
    chat,
    privateChatUser,
    handleDelete: openDeleteModal,
    folderId,
    isPinned,
  });

  const lang = useLang();

  if (!chat) {
    return undefined;
  }

  function renderLastMessageOrTyping() {
    if (typingStatus && lastMessage && typingStatus.timestamp > lastMessage.date * 1000) {
      return <TypingStatus typingStatus={typingStatus} />;
    }

    if (draft && draft.text.length) {
      return (
        <p className="last-message">
          <span className="draft">{lang('Draft')}</span>
          {renderText(draft.text)}
        </p>
      );
    }

    if (!lastMessage) {
      return undefined;
    }

    if (isAction) {
      const actionOrigin = chat && (isChatChannel(chat) || lastMessage.senderId === lastMessage.chatId)
        ? chat
        : lastMessageSender;

      return (
        <p className="last-message">
          {renderText(renderActionMessageText(
            lastMessage,
            actionOrigin,
            actionTargetUser,
            actionTargetMessage,
            actionTargetChatId,
            { asPlain: true },
          ) as string)}
        </p>
      );
    }

    const senderName = getMessageSenderName(chatId, lastMessageSender);

    return (
      <p className="last-message">
        {senderName && (
          <span className="sender-name">{renderText(senderName)}</span>
        )}
        {renderMessageSummary(lastMessage!, mediaBlobUrl || mediaThumbnail)}
      </p>
    );
  }

  const className = buildClassName(
    'Chat chat-item-clickable',
    isChatPrivate(chatId) ? 'private' : 'group',
    isSelected && !IS_MOBILE_SCREEN && 'selected',
  );

  return (
    <ListItem
      ref={ref}
      className={className}
      style={style}
      ripple={!IS_MOBILE_SCREEN}
      contextActions={contextActions}
      onClick={handleClick}
    >
      <Avatar
        chat={chat}
        user={privateChatUser}
        withOnlineStatus
        isSavedMessages={privateChatUser && privateChatUser.isSelf}
        lastSyncTime={lastSyncTime}
      />
      <div className="info">
        <div className="title">
          <h3>{renderText(getChatTitle(chat, privateChatUser))}</h3>
          {chat.isVerified && <VerifiedIcon />}
          {chat.isMuted && <i className="icon-muted-chat" />}
          {chat.lastMessage && (
            <LastMessageMeta message={chat.lastMessage} outgoingStatus={lastMessageOutgoingStatus} />
          )}
        </div>
        <div className="subtitle">
          {renderLastMessageOrTyping()}
          <Badge chat={chat} isPinned={isPinned} />
        </div>
      </div>
      <DeleteChatModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        chat={chat}
      />
    </ListItem>
  );
};

function renderMessageSummary(message: ApiMessage, blobUrl?: string) {
  if (!blobUrl) {
    return renderText(getMessageSummaryText(message));
  }

  return (
    <span className="media-preview">
      <img src={blobUrl} alt="" />
      {getMessageVideo(message) && <i className="icon-play" />}
      {renderText(getMessageSummaryText(message, true))}
    </span>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    if (!chat || !chat.lastMessage) {
      return {};
    }

    const { senderId, replyToMessageId, isOutgoing } = chat.lastMessage;
    const lastMessageSender = senderId ? selectUser(global, senderId) : undefined;
    const lastMessageAction = getMessageAction(chat.lastMessage);
    const actionTargetMessage = lastMessageAction && replyToMessageId
      ? selectChatMessage(global, chat.id, replyToMessageId)
      : undefined;
    const { targetUserId: actionTargetUserId, targetChatId: actionTargetChatId } = lastMessageAction || {};
    const privateChatUserId = getPrivateChatUserId(chat);
    const { type: messageListType } = selectCurrentMessageList(global) || {};

    return {
      chat,
      lastMessageSender,
      ...(isOutgoing && { lastMessageOutgoingStatus: selectOutgoingStatus(global, chat.lastMessage) }),
      ...(privateChatUserId && { privateChatUser: selectUser(global, privateChatUserId) }),
      ...(actionTargetUserId && { actionTargetUser: selectUser(global, actionTargetUserId) }),
      actionTargetChatId,
      actionTargetMessage,
      draft: selectDraft(global, chatId, MAIN_THREAD_ID),
      messageListType,
      animationLevel: global.settings.byKey.animationLevel,
      lastSyncTime: global.lastSyncTime,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'openChat',
    'focusLastMessage',
  ]),
)(Chat));
