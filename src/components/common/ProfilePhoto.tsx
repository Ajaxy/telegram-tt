import React, { FC, memo } from '../../lib/teact/teact';

import {
  ApiChat, ApiMediaFormat, ApiPhoto, ApiUser,
} from '../../api/types';

import {
  getChatAvatarHash,
  getChatTitle,
  getUserColorKey,
  getUserFullName,
  isUserId,
  isChatWithRepliesBot,
  isDeletedUser,
} from '../../modules/helpers';
import renderText from './helpers/renderText';
import buildClassName from '../../util/buildClassName';
import { getFirstLetters } from '../../util/textFormat';
import useMedia from '../../hooks/useMedia';
import useBlurSync from '../../hooks/useBlurSync';
import usePrevious from '../../hooks/usePrevious';
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
  const thumbDataUri = useBlurSync(!photoBlobUrl && photo && photo.thumbnail && photo.thumbnail.dataUri);
  const imageSrc = photoBlobUrl || avatarBlobUrl || thumbDataUri;
  const prevImageSrc = usePrevious(imageSrc);

  let content: string | undefined = '';

  if (isSavedMessages) {
    content = <i className="icon-avatar-saved-messages" />;
  } else if (isDeleted) {
    content = <i className="icon-avatar-deleted-account" />;
  } else if (isRepliesChat) {
    content = <i className="icon-reply-filled" />;
  } else if (imageSrc) {
    content = <img src={imageSrc} className="avatar-media" alt="" decoding="async" />;
  } else if (!imageSrc && user) {
    const userFullName = getUserFullName(user);
    content = userFullName ? getFirstLetters(userFullName, 2) : undefined;
  } else if (!imageSrc && chat) {
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
      {prevImageSrc && imageSrc && prevImageSrc !== imageSrc && (
        <img src={prevImageSrc} className="prev-avatar-media" alt="" decoding="async" />
      )}
      {typeof content === 'string' ? renderText(content, ['hq_emoji']) : content}
    </div>
  );
};

export default memo(ProfilePhoto);
