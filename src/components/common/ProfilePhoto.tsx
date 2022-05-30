import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { ApiChat, ApiPhoto, ApiUser } from '../../api/types';
import { ApiMediaFormat } from '../../api/types';

import {
  getChatAvatarHash,
  getChatTitle,
  getUserColorKey,
  getUserFullName,
  isUserId,
  isChatWithRepliesBot,
  isDeletedUser,
} from '../../global/helpers';
import renderText from './helpers/renderText';
import buildClassName from '../../util/buildClassName';
import { getFirstLetters } from '../../util/textFormat';
import useMedia from '../../hooks/useMedia';
import useLang from '../../hooks/useLang';

import Spinner from '../ui/Spinner';

import './ProfilePhoto.scss';

type OwnProps = {
  chat?: ApiChat;
  user?: ApiUser;
  isFirstPhoto?: boolean;
  isSavedMessages?: boolean;
  photo?: ApiPhoto;
  lastSyncTime?: number;
  onClick: NoneToVoidFunction;
};

const ProfilePhoto: FC<OwnProps> = ({
  chat,
  user,
  photo,
  isFirstPhoto,
  isSavedMessages,
  lastSyncTime,
  onClick,
}) => {
  const lang = useLang();
  const isDeleted = user && isDeletedUser(user);
  const isRepliesChat = chat && isChatWithRepliesBot(chat.id);

  function getMediaHash(size: 'normal' | 'big', forceAvatar?: boolean) {
    if (photo && !forceAvatar) {
      return `photo${photo.id}?size=c`;
    }

    let hash: string | undefined;
    if (!isSavedMessages && !isDeleted && !isRepliesChat) {
      if (user) {
        hash = getChatAvatarHash(user, size);
      } else if (chat) {
        hash = getChatAvatarHash(chat, size);
      }
    }

    return hash;
  }

  const photoBlobUrl = useMedia(getMediaHash('big'), false, ApiMediaFormat.BlobUrl, lastSyncTime);
  const avatarMediaHash = isFirstPhoto && !photoBlobUrl ? getMediaHash('normal', true) : undefined;
  const avatarBlobUrl = useMedia(avatarMediaHash, false, ApiMediaFormat.BlobUrl, lastSyncTime);
  const imageSrc = photoBlobUrl || avatarBlobUrl || photo?.thumbnail?.dataUri;

  let content: TeactNode | undefined;

  if (isSavedMessages) {
    content = <i className="icon-avatar-saved-messages" />;
  } else if (isDeleted) {
    content = <i className="icon-avatar-deleted-account" />;
  } else if (isRepliesChat) {
    content = <i className="icon-reply-filled" />;
  } else if (imageSrc) {
    content = <img src={imageSrc} className="avatar-media" alt="" />;
  } else if (user) {
    const userFullName = getUserFullName(user);
    content = userFullName ? getFirstLetters(userFullName, 2) : undefined;
  } else if (chat) {
    const title = getChatTitle(lang, chat);
    content = title && getFirstLetters(title, isUserId(chat.id) ? 2 : 1);
  } else {
    content = (
      <div className="spinner-wrapper">
        <Spinner color="white" />
      </div>
    );
  }

  const fullClassName = buildClassName(
    'ProfilePhoto',
    `color-bg-${getUserColorKey(user || chat)}`,
    isSavedMessages && 'saved-messages',
    isDeleted && 'deleted-account',
    isRepliesChat && 'replies-bot-account',
    (!isSavedMessages && !(imageSrc)) && 'no-photo',
  );

  return (
    <div className={fullClassName} onClick={imageSrc ? onClick : undefined}>
      {typeof content === 'string' ? renderText(content, ['hq_emoji']) : content}
    </div>
  );
};

export default memo(ProfilePhoto);
