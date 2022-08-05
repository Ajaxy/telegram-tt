import React, { memo, useEffect, useRef } from '../../lib/teact/teact';

import type { FC, TeactNode } from '../../lib/teact/teact';
import type { ApiChat, ApiPhoto, ApiUser } from '../../api/types';
import { ApiMediaFormat } from '../../api/types';

import {
  getChatAvatarHash,
  getChatTitle,
  getUserColorKey,
  getUserFullName,
  isUserId,
  isChatWithRepliesBot,
  isDeletedUser, getVideoAvatarMediaHash,
} from '../../global/helpers';
import renderText from './helpers/renderText';
import buildClassName from '../../util/buildClassName';
import safePlay from '../../util/safePlay';
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
  notActive?: boolean;
  onClick: NoneToVoidFunction;
};

const ProfilePhoto: FC<OwnProps> = ({
  chat,
  user,
  photo,
  isFirstPhoto,
  isSavedMessages,
  notActive,
  lastSyncTime,
  onClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);
  const lang = useLang();
  const isDeleted = user && isDeletedUser(user);
  const isRepliesChat = chat && isChatWithRepliesBot(chat.id);

  function getMediaHash(size: 'normal' | 'big', type: 'photo' | 'video' = 'photo') {
    const userOrChat = user || chat;
    const profilePhoto = photo || userOrChat?.fullInfo?.profilePhoto;
    const hasVideo = profilePhoto?.isVideo;
    const forceAvatar = isFirstPhoto;

    if (type === 'video' && !hasVideo) return undefined;

    if (photo && !forceAvatar) {
      if (hasVideo && type === 'video') {
        return getVideoAvatarMediaHash(photo);
      }
      if (type === 'photo') {
        return `photo${photo.id}?size=c`;
      }
    }

    if (!isSavedMessages && !isDeleted && !isRepliesChat && userOrChat) {
      return getChatAvatarHash(userOrChat, size, type);
    }

    return undefined;
  }

  useEffect(() => {
    if (!videoRef.current) return;
    if (notActive) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    } else {
      safePlay(videoRef.current);
    }
  }, [notActive]);

  const photoHash = getMediaHash('big', 'photo');
  const photoBlobUrl = useMedia(photoHash, false, ApiMediaFormat.BlobUrl, lastSyncTime);
  const videoHash = getMediaHash('normal', 'video');
  const videoBlobUrl = useMedia(videoHash, false, ApiMediaFormat.BlobUrl, lastSyncTime);
  const imageSrc = videoBlobUrl || photoBlobUrl || photo?.thumbnail?.dataUri;

  let content: TeactNode | undefined;

  if (isSavedMessages) {
    content = <i className="icon-avatar-saved-messages" />;
  } else if (isDeleted) {
    content = <i className="icon-avatar-deleted-account" />;
  } else if (isRepliesChat) {
    content = <i className="icon-reply-filled" />;
  } else if (imageSrc) {
    if (videoBlobUrl) {
      content = (
        <video
          ref={videoRef}
          src={imageSrc}
          className="avatar-media"
          muted
          autoPlay={!notActive}
          loop
          playsInline
        />
      );
    } else {
      content = <img src={imageSrc} className="avatar-media" alt="" />;
    }
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
    (!isSavedMessages && !imageSrc) && 'no-photo',
  );

  return (
    <div className={fullClassName} onClick={imageSrc ? onClick : undefined}>
      {typeof content === 'string' ? renderText(content, ['hq_emoji']) : content}
    </div>
  );
};

export default memo(ProfilePhoto);
