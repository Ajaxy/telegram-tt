import { MouseEvent as ReactMouseEvent } from 'react';
import React, { FC, memo, useCallback } from '../../lib/teact/teact';

import {
  ApiChat, ApiMediaFormat, ApiPhoto, ApiUser, ApiUserStatus,
} from '../../api/types';

import { IS_TEST } from '../../config';
import {
  getChatAvatarHash,
  getChatTitle,
  getUserColorKey,
  getUserFullName,
  isUserId,
  isChatWithRepliesBot,
  isDeletedUser,
  isUserOnline,
} from '../../global/helpers';
import { getFirstLetters } from '../../util/textFormat';
import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';
import useMedia from '../../hooks/useMedia';
import useShowTransition from '../../hooks/useShowTransition';
import useLang from '../../hooks/useLang';

import './Avatar.scss';

type OwnProps = {
  className?: string;
  size?: 'micro' | 'tiny' | 'small' | 'medium' | 'large' | 'jumbo';
  chat?: ApiChat;
  user?: ApiUser;
  photo?: ApiPhoto;
  userStatus?: ApiUserStatus;
  text?: string;
  isSavedMessages?: boolean;
  lastSyncTime?: number;
  onClick?: (e: ReactMouseEvent<HTMLDivElement, MouseEvent>, hasPhoto: boolean) => void;
};

const Avatar: FC<OwnProps> = ({
  className,
  size = 'large',
  chat,
  user,
  photo,
  userStatus,
  text,
  isSavedMessages,
  lastSyncTime,
  onClick,
}) => {
  const isDeleted = user && isDeletedUser(user);
  const isReplies = user && isChatWithRepliesBot(user.id);
  let imageHash: string | undefined;

  if (!isSavedMessages && !isDeleted) {
    if (user) {
      imageHash = getChatAvatarHash(user);
    } else if (chat) {
      imageHash = getChatAvatarHash(chat);
    } else if (photo) {
      imageHash = `photo${photo.id}?size=m`;
    }
  }

  const blobUrl = useMedia(imageHash, false, ApiMediaFormat.BlobUrl, lastSyncTime);
  const hasBlobUrl = Boolean(blobUrl);
  const { transitionClassNames } = useShowTransition(hasBlobUrl, undefined, hasBlobUrl, 'slow');

  const lang = useLang();

  let content: string | undefined = '';

  if (isSavedMessages) {
    content = <i className="icon-avatar-saved-messages" />;
  } else if (isDeleted) {
    content = <i className="icon-avatar-deleted-account" />;
  } else if (isReplies) {
    content = <i className="icon-reply-filled" />;
  } else if (blobUrl) {
    content = (
      <img src={blobUrl} className={buildClassName('avatar-media', transitionClassNames)} alt="" decoding="async" />
    );
  } else if (user) {
    const userFullName = getUserFullName(user);
    content = userFullName ? getFirstLetters(userFullName, 2) : undefined;
  } else if (chat) {
    const title = getChatTitle(lang, chat);
    content = title && getFirstLetters(title, isUserId(chat.id) ? 2 : 1);
  } else if (text) {
    content = getFirstLetters(text, 2);
  }

  const isOnline = !isSavedMessages && user && userStatus && isUserOnline(user, userStatus);
  const fullClassName = buildClassName(
    `Avatar size-${size}`,
    className,
    `color-bg-${getUserColorKey(user || chat)}`,
    isSavedMessages && 'saved-messages',
    isDeleted && 'deleted-account',
    isReplies && 'replies-bot-account',
    isOnline && 'online',
    onClick && 'interactive',
    (!isSavedMessages && !blobUrl) && 'no-photo',
  );

  const hasImage = Boolean(isSavedMessages || blobUrl);
  const handleClick = useCallback((e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
    if (onClick) {
      onClick(e, hasImage);
    }
  }, [onClick, hasImage]);

  const senderId = (user || chat) && (user || chat)!.id;

  return (
    <div className={fullClassName} onClick={handleClick} data-test-sender-id={IS_TEST ? senderId : undefined}>
      {typeof content === 'string' ? renderText(content, [size === 'jumbo' ? 'hq_emoji' : 'emoji']) : content}
    </div>
  );
};

export default memo(Avatar);
