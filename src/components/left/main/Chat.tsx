import React, {
  FC, memo, useCallback, useLayoutEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import useLang, { LangFn } from '../../../hooks/useLang';

import { GlobalActions } from '../../../global/types';
import {
  ApiChat, ApiUser, ApiMessage, ApiMessageOutgoingStatus, ApiFormattedText, MAIN_THREAD_ID,
} from '../../../api/types';

import { ANIMATION_END_DELAY } from '../../../config';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import {
  getChatTitle,
  isUserId,
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
  selectIsChatMuted,
  getMessageRoundVideo,
} from '../../../modules/helpers';
import {
  selectChat, selectUser, selectChatMessage, selectOutgoingStatus, selectDraft, selectCurrentMessageList,
  selectNotifySettings, selectNotifyExceptions,
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
import ChatFolderModal from '../ChatFolderModal.async';
import ChatCallStatus from './ChatCallStatus';

import './Chat.scss';

type OwnProps = {
  style?: string;
  chatId: string;
  folderId?: number;
  orderDiff: number;
  animationType: ChatAnimationTypes;
  isPinned?: boolean;
};

type StateProps = {
  chat?: ApiChat;
  isMuted?: boolean;
  privateChatUser?: ApiUser;
  actionTargetUserIds?: string[];
  usersById?: Record<string, ApiUser>;
  actionTargetMessage?: ApiMessage;
  actionTargetChatId?: string;
  lastMessageSender?: ApiUser;
  lastMessageOutgoingStatus?: ApiMessageOutgoingStatus;
  draft?: ApiFormattedText;
  animationLevel?: number;
  isSelected?: boolean;
  canScrollDown?: boolean;
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
  isPinned,
  chat,
  isMuted,
  privateChatUser,
  actionTargetUserIds,
  usersById,
  lastMessageSender,
  lastMessageOutgoingStatus,
  actionTargetMessage,
  actionTargetChatId,
  draft,
  animationLevel,
  isSelected,
  canScrollDown,
  lastSyncTime,
  openChat,
  focusLastMessage,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag();
  const [isChatFolderModalOpen, openChatFolderModal, closeChatFolderModal] = useFlag();
  const [shouldRenderDeleteModal, markRenderDeleteModal, unmarkRenderDeleteModal] = useFlag();
  const [shouldRenderChatFolderModal, markRenderChatFolderModal, unmarkRenderChatFolderModal] = useFlag();

  const { lastMessage, typingStatus } = chat || {};
  const isAction = lastMessage && isActionMessage(lastMessage);

  useEnsureMessage(chatId, isAction ? lastMessage!.replyToMessageId : undefined, actionTargetMessage);

  const mediaThumbnail = lastMessage && !getMessageSticker(lastMessage)
    ? getMessageMediaThumbDataUri(lastMessage)
    : undefined;
  const mediaBlobUrl = useMedia(lastMessage ? getMessageMediaHash(lastMessage, 'micro') : undefined);
  const isRoundVideo = Boolean(lastMessage && getMessageRoundVideo(lastMessage));

  const actionTargetUsers = useMemo(() => {
    return actionTargetUserIds
      ? actionTargetUserIds.map((userId) => usersById?.[userId]).filter<ApiUser>(Boolean as any)
      : undefined;
  }, [actionTargetUserIds, usersById]);

  // Sets animation excess values when `orderDiff` changes and then resets excess values to animate.
  useLayoutEffect(() => {
    const element = ref.current;

    if (animationLevel === 0 || !element) {
      return;
    }

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
    openChat({ id: chatId, shouldReplaceHistory: true });

    if (isSelected && canScrollDown) {
      focusLastMessage();
    }
  }, [
    isSelected,
    canScrollDown,
    openChat,
    chatId,
    focusLastMessage,
  ]);

  function handleDelete() {
    markRenderDeleteModal();
    openDeleteModal();
  }

  function handleChatFolderChange() {
    markRenderChatFolderModal();
    openChatFolderModal();
  }

  const contextActions = useChatContextActions({
    chat,
    privateChatUser,
    handleDelete,
    handleChatFolderChange,
    folderId,
    isPinned,
    isMuted,
  });

  const lang = useLang();

  if (!chat) {
    return undefined;
  }

  function renderLastMessageOrTyping() {
    if (typingStatus && lastMessage && typingStatus.timestamp > lastMessage.date * 1000) {
      return <TypingStatus typingStatus={typingStatus} />;
    }

    if (draft?.text.length) {
      return (
        <p className="last-message" dir={lang.isRtl ? 'auto' : 'ltr'}>
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
        <p className="last-message" dir={lang.isRtl ? 'auto' : 'ltr'}>
          {renderText(renderActionMessageText(
            lang,
            lastMessage,
            actionOrigin,
            actionTargetUsers,
            actionTargetMessage,
            actionTargetChatId,
            { asPlain: true },
          ) as string)}
        </p>
      );
    }

    const senderName = getMessageSenderName(lang, chatId, lastMessageSender);

    return (
      <p className="last-message" dir={lang.isRtl ? 'auto' : 'ltr'}>
        {senderName && (
          <>
            <span className="sender-name">{renderText(senderName)}</span>
            <span className="colon">:</span>
          </>
        )}
        {renderMessageSummary(lang, lastMessage!, mediaBlobUrl || mediaThumbnail, isRoundVideo)}
      </p>
    );
  }

  const className = buildClassName(
    'Chat chat-item-clickable',
    isUserId(chatId) ? 'private' : 'group',
    isSelected && 'selected',
  );

  return (
    <ListItem
      ref={ref}
      className={className}
      style={style}
      ripple={!IS_SINGLE_COLUMN_LAYOUT}
      contextActions={contextActions}
      onClick={handleClick}
    >
      <div className="status">
        <Avatar
          chat={chat}
          user={privateChatUser}
          withOnlineStatus
          isSavedMessages={privateChatUser?.isSelf}
          lastSyncTime={lastSyncTime}
        />
        {chat.isCallActive && chat.isCallNotEmpty && (
          <ChatCallStatus isSelected={isSelected} isActive={animationLevel !== 0} />
        )}
      </div>
      <div className="info">
        <div className="title">
          <h3>{renderText(getChatTitle(lang, chat, privateChatUser))}</h3>
          {chat.isVerified && <VerifiedIcon />}
          {isMuted && <i className="icon-muted" />}
          {chat.lastMessage && (
            <LastMessageMeta
              message={chat.lastMessage}
              outgoingStatus={lastMessageOutgoingStatus}
            />
          )}
        </div>
        <div className="subtitle">
          {renderLastMessageOrTyping()}
          <Badge chat={chat} isPinned={isPinned} isMuted={isMuted} />
        </div>
      </div>
      {shouldRenderDeleteModal && (
        <DeleteChatModal
          isOpen={isDeleteModalOpen}
          onClose={closeDeleteModal}
          onCloseAnimationEnd={unmarkRenderDeleteModal}
          chat={chat}
        />
      )}
      {shouldRenderChatFolderModal && (
        <ChatFolderModal
          isOpen={isChatFolderModalOpen}
          onClose={closeChatFolderModal}
          onCloseAnimationEnd={unmarkRenderChatFolderModal}
          chatId={chatId}
        />
      )}
    </ListItem>
  );
};

function renderMessageSummary(lang: LangFn, message: ApiMessage, blobUrl?: string, isRoundVideo?: boolean) {
  if (!blobUrl) {
    return renderText(getMessageSummaryText(lang, message));
  }

  return (
    <span className="media-preview">
      <img src={blobUrl} alt="" className={isRoundVideo ? 'round' : undefined} />
      {getMessageVideo(message) && <i className="icon-play" />}
      {renderText(getMessageSummaryText(lang, message, true))}
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
    const { targetUserIds: actionTargetUserIds, targetChatId: actionTargetChatId } = lastMessageAction || {};
    const privateChatUserId = getPrivateChatUserId(chat);
    const { byId: usersById } = global.users;
    const {
      chatId: currentChatId,
      threadId: currentThreadId,
      type: messageListType,
    } = selectCurrentMessageList(global) || {};
    const isSelected = chatId === currentChatId && currentThreadId === MAIN_THREAD_ID;

    return {
      chat,
      isMuted: selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global)),
      lastMessageSender,
      actionTargetUserIds,
      actionTargetChatId,
      actionTargetMessage,
      draft: selectDraft(global, chatId, MAIN_THREAD_ID),
      animationLevel: global.settings.byKey.animationLevel,
      isSelected,
      canScrollDown: isSelected && messageListType === 'thread',
      lastSyncTime: global.lastSyncTime,
      ...(isOutgoing && { lastMessageOutgoingStatus: selectOutgoingStatus(global, chat.lastMessage) }),
      ...(privateChatUserId && { privateChatUser: selectUser(global, privateChatUserId) }),
      ...(actionTargetUserIds && { usersById }),
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'openChat',
    'focusLastMessage',
  ]),
)(Chat));
