import { MouseEvent as ReactMouseEvent } from 'react';
import React, { FC, useCallback, memo } from '../../lib/teact/teact';

import { ApiUser, ApiChat, ApiMediaFormat } from '../../api/types';

import { IS_TEST } from '../../config';
import {
  getChatAvatarHash, getChatTitle, isChatPrivate,
  getUserFullName, isUserOnline, isDeletedUser, getUserColorKey,
} from '../../modules/helpers';
import { getFirstLetters } from '../../util/textFormat';
import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';
import useMedia from '../../hooks/useMedia';
import useTransitionForMedia from '../../hooks/useTransitionForMedia';
import useLang from '../../hooks/useLang';

import './Avatar.scss';

type OwnProps = {
  className?: string;
  size?: 'micro' | 'tiny' | 'small' | 'medium' | 'large' | 'jumbo';
  withOnlineStatus?: boolean;
  chat?: ApiChat;
  user?: ApiUser;
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
  text,
  withOnlineStatus,
  isSavedMessages,
  lastSyncTime,
  onClick,
}) => {
  const isDeleted = user && isDeletedUser(user);
  let imageHash: string | undefined;

  if (!isSavedMessages && !isDeleted) {
    if (user) {
      imageHash = getChatAvatarHash(user);
    } else if (chat) {
      imageHash = getChatAvatarHash(chat);
    }
  }

  const dataUri = useMedia(imageHash, false, ApiMediaFormat.DataUri, lastSyncTime);
  const { shouldRenderFullMedia, transitionClassNames } = useTransitionForMedia(dataUri, 'slow');

  const lang = useLang();

  let content: string | undefined = '';

  if (isSavedMessages) {
    content = <i className="icon-avatar-saved-messages" />;
  } else if (isDeleted) {
    content = <i className="icon-avatar-deleted-account" />;
  } else if (shouldRenderFullMedia) {
    content = <img src={dataUri} className={`${transitionClassNames} avatar-media`} alt="" decoding="async" />;
  } else if (user) {
    const userFullName = getUserFullName(user);
    content = userFullName ? getFirstLetters(userFullName, 2) : undefined;
  } else if (chat) {
    const title = getChatTitle(lang, chat);
    content = title && getFirstLetters(title, isChatPrivate(chat.id) ? 2 : 1);
  } else if (text) {
    content = getFirstLetters(text, 2);
  }

  const isOnline = !isSavedMessages && user && isUserOnline(user);
  const fullClassName = buildClassName(
    `Avatar size-${size}`,
    className,
    `color-bg-${getUserColorKey(user || chat)}`,
    isSavedMessages && 'saved-messages',
    isDeleted && 'deleted-account',
    withOnlineStatus && isOnline && 'online',
    onClick && 'interactive',
    (!isSavedMessages && !shouldRenderFullMedia) && 'no-photo',
  );

  const handleClick = useCallback((e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
    if (onClick) {
      onClick(e, isSavedMessages || shouldRenderFullMedia);
    }
  }, [onClick, isSavedMessages, shouldRenderFullMedia]);

  const senderId = (user || chat) && (user || chat)!.id;

  return (
    <div className={fullClassName} onClick={handleClick} data-test-sender-id={IS_TEST ? senderId : undefined}>
      {typeof content === 'string' ? renderText(content, [size === 'jumbo' ? 'hq_emoji' : 'emoji']) : content}
    </div>
  );
};

export default memo(Avatar);
