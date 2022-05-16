import { MouseEvent as ReactMouseEvent } from 'react';
import React, {
  FC, memo, TeactNode, useCallback,
} from '../../lib/teact/teact';

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
import buildClassName, { createClassNameBuilder } from '../../util/buildClassName';
import renderText from './helpers/renderText';
import useMedia from '../../hooks/useMedia';
import useShowTransition from '../../hooks/useShowTransition';
import useLang from '../../hooks/useLang';

import './Avatar.scss';

const cn = createClassNameBuilder('Avatar');
cn.img = cn('img');
cn.icon = cn('icon');

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

  const shouldFetchBig = size === 'jumbo';
  if (!isSavedMessages && !isDeleted) {
    if (user) {
      imageHash = getChatAvatarHash(user, shouldFetchBig ? 'big' : undefined);
    } else if (chat) {
      imageHash = getChatAvatarHash(chat, shouldFetchBig ? 'big' : undefined);
    } else if (photo) {
      imageHash = `photo${photo.id}?size=m`;
    }
  }

  const blobUrl = useMedia(imageHash, false, ApiMediaFormat.BlobUrl, lastSyncTime);
  const hasBlobUrl = Boolean(blobUrl);
  const { transitionClassNames } = useShowTransition(hasBlobUrl, undefined, hasBlobUrl, 'slow');

  const lang = useLang();

  let content: TeactNode | undefined;
  const author = user ? getUserFullName(user) : (chat ? getChatTitle(lang, chat) : text);

  if (isSavedMessages) {
    content = <i className={buildClassName(cn.icon, 'icon-avatar-saved-messages')} aria-label={author} />;
  } else if (isDeleted) {
    content = <i className={buildClassName(cn.icon, 'icon-avatar-deleted-account')} aria-label={author} />;
  } else if (isReplies) {
    content = <i className={buildClassName(cn.icon, 'icon-reply-filled')} aria-label={author} />;
  } else if (blobUrl) {
    content = (
      <img
        src={blobUrl}
        className={buildClassName(cn.img, 'avatar-media', transitionClassNames)}
        alt={author}
        decoding="async"
      />
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
    <div
      className={fullClassName}
      onClick={handleClick}
      data-test-sender-id={IS_TEST ? senderId : undefined}
      aria-label={typeof content === 'string' ? author : undefined}
    >
      {typeof content === 'string' ? renderText(content, [size === 'jumbo' ? 'hq_emoji' : 'emoji']) : content}
    </div>
  );
};

export default memo(Avatar);
