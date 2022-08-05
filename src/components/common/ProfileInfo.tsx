import type { FC } from '../../lib/teact/teact';
import React, {
  useEffect, useCallback, memo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiUser, ApiChat, ApiUserStatus } from '../../api/types';
import type { GlobalState } from '../../global/types';
import { MediaViewerOrigin } from '../../types';

import { IS_TOUCH_ENV } from '../../util/environment';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { selectChat, selectUser, selectUserStatus } from '../../global/selectors';
import {
  getUserFullName, getUserStatus, isChatChannel, isUserOnline,
} from '../../global/helpers';
import renderText from './helpers/renderText';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';
import buildClassName from '../../util/buildClassName';
import usePhotosPreload from './hooks/usePhotosPreload';
import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';

import VerifiedIcon from './VerifiedIcon';
import ProfilePhoto from './ProfilePhoto';
import Transition from '../ui/Transition';
import FakeIcon from './FakeIcon';
import PremiumIcon from './PremiumIcon';

import './ProfileInfo.scss';

type OwnProps = {
  userId: string;
  forceShowSelf?: boolean;
};

type StateProps =
  {
    user?: ApiUser;
    userStatus?: ApiUserStatus;
    chat?: ApiChat;
    isSavedMessages?: boolean;
    animationLevel: 0 | 1 | 2;
    serverTimeOffset: number;
    mediaId?: number;
    avatarOwnerId?: string;
  }
  & Pick<GlobalState, 'connectionState'>;

const ProfileInfo: FC<OwnProps & StateProps> = ({
  forceShowSelf,
  user,
  userStatus,
  chat,
  isSavedMessages,
  connectionState,
  animationLevel,
  serverTimeOffset,
  mediaId,
  avatarOwnerId,
}) => {
  const {
    loadFullUser,
    openMediaViewer,
    openPremiumModal,
  } = getActions();

  const lang = useLang();

  const { id: userId } = user || {};
  const { id: chatId } = chat || {};
  const fullName = user ? getUserFullName(user) : (chat ? chat.title : '');
  const photos = user?.photos || chat?.photos || MEMO_EMPTY_ARRAY;
  const prevMediaId = usePrevious(mediaId);
  const prevAvatarOwnerId = usePrevious(avatarOwnerId);
  const [hasSlideAnimation, setHasSlideAnimation] = useState(true);
  const slideAnimation = hasSlideAnimation
    ? animationLevel >= 1 ? (lang.isRtl ? 'slide-optimized-rtl' : 'slide-optimized') : 'none'
    : 'none';

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const isFirst = isSavedMessages || photos.length <= 1 || currentPhotoIndex === 0;
  const isLast = isSavedMessages || photos.length <= 1 || currentPhotoIndex === photos.length - 1;

  // Set the current avatar photo to the last selected photo in Media Viewer after it is closed
  useEffect(() => {
    if (prevAvatarOwnerId && prevMediaId !== undefined && mediaId === undefined) {
      setHasSlideAnimation(false);
      setCurrentPhotoIndex(prevMediaId);
    }
  }, [mediaId, prevMediaId, prevAvatarOwnerId]);

  // Deleting the last profile photo may result in an error
  useEffect(() => {
    if (currentPhotoIndex > photos.length) {
      setCurrentPhotoIndex(Math.max(0, photos.length - 1));
    }
  }, [currentPhotoIndex, photos.length]);

  useEffect(() => {
    if (connectionState === 'connectionStateReady' && userId && !forceShowSelf) {
      loadFullUser({ userId });
    }
  }, [userId, loadFullUser, connectionState, forceShowSelf]);

  usePhotosPreload(user || chat, photos, currentPhotoIndex);

  const handleProfilePhotoClick = useCallback(() => {
    openMediaViewer({
      avatarOwnerId: userId || chatId,
      mediaId: currentPhotoIndex,
      origin: forceShowSelf ? MediaViewerOrigin.SettingsAvatar : MediaViewerOrigin.ProfileAvatar,
    });
  }, [openMediaViewer, userId, chatId, currentPhotoIndex, forceShowSelf]);

  const handleClickPremium = useCallback(() => {
    if (!user) return;

    openPremiumModal({ fromUserId: user.id });
  }, [openPremiumModal, user]);

  const selectPreviousMedia = useCallback(() => {
    if (isFirst) {
      return;
    }
    setHasSlideAnimation(true);
    setCurrentPhotoIndex(currentPhotoIndex - 1);
  }, [currentPhotoIndex, isFirst]);

  const selectNextMedia = useCallback(() => {
    if (isLast) {
      return;
    }
    setHasSlideAnimation(true);
    setCurrentPhotoIndex(currentPhotoIndex + 1);
  }, [currentPhotoIndex, isLast]);

  // Swipe gestures
  useEffect(() => {
    const element = document.querySelector<HTMLDivElement>('.photo-wrapper');
    if (!element) {
      return undefined;
    }

    return captureEvents(element, {
      selectorToPreventScroll: '.Profile, .settings-content',
      onSwipe: IS_TOUCH_ENV ? (e, direction) => {
        if (direction === SwipeDirection.Right) {
          selectPreviousMedia();
          return true;
        } else if (direction === SwipeDirection.Left) {
          selectNextMedia();
          return true;
        }

        return false;
      } : undefined,
    });
  }, [selectNextMedia, selectPreviousMedia]);

  if (!user && !chat) {
    return undefined;
  }

  function renderPhotoTabs() {
    if (isSavedMessages || !photos || photos.length <= 1) {
      return undefined;
    }

    return (
      <div className="photo-dashes">
        {photos.map((_, i) => (
          <span className={`photo-dash ${i === currentPhotoIndex ? 'current' : ''}`} />
        ))}
      </div>
    );
  }

  function renderPhoto(isActive?: boolean) {
    const photo = !isSavedMessages && photos.length > 0 ? photos[currentPhotoIndex] : undefined;
    return (
      <ProfilePhoto
        key={currentPhotoIndex}
        user={user}
        chat={chat}
        photo={photo}
        isSavedMessages={isSavedMessages}
        isFirstPhoto={isFirst}
        notActive={!isActive}
        onClick={handleProfilePhotoClick}
      />
    );
  }

  function renderStatus() {
    if (user) {
      return (
        <div className={`status ${isUserOnline(user, userStatus) ? 'online' : ''}`}>
          <span className="user-status" dir="auto">{getUserStatus(lang, user, userStatus, serverTimeOffset)}</span>
        </div>
      );
    }

    return (
      <span className="status" dir="auto">{
        isChatChannel(chat!)
          ? lang('Subscribers', chat!.membersCount ?? 0, 'i')
          : lang('Members', chat!.membersCount ?? 0, 'i')
      }
      </span>
    );
  }

  const isVerifiedIconShown = (user || chat)?.isVerified;
  const isPremiumIconShown = user?.isPremium;
  const fakeType = (user || chat)?.fakeType;

  return (
    <div className={buildClassName('ProfileInfo', forceShowSelf && 'self')} dir={lang.isRtl ? 'rtl' : undefined}>
      <div className="photo-wrapper">
        {renderPhotoTabs()}
        <Transition activeKey={currentPhotoIndex} name={slideAnimation} className="profile-slide-container">
          {renderPhoto}
        </Transition>

        {!isFirst && (
          <button
            type="button"
            className="navigation prev"
            aria-label={lang('AccDescrPrevious')}
            onClick={selectPreviousMedia}
          />
        )}
        {!isLast && (
          <button
            type="button"
            className="navigation next"
            aria-label={lang('Next')}
            onClick={selectNextMedia}
          />
        )}
      </div>

      <div className="info" dir={lang.isRtl ? 'rtl' : 'auto'}>
        {isSavedMessages ? (
          <div className="title">
            <div className="fullName" dir="auto">{lang('SavedMessages')}</div>
          </div>
        ) : (
          <div className="title">
            <div className="fullName" dir="auto">{fullName && renderText(fullName)}</div>
            {isVerifiedIconShown && <VerifiedIcon />}
            {isPremiumIconShown && <PremiumIcon onClick={handleClickPremium} />}
            {fakeType && <FakeIcon fakeType={fakeType} />}
          </div>
        )}
        {!isSavedMessages && renderStatus()}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { userId, forceShowSelf }): StateProps => {
    const { connectionState, serverTimeOffset } = global;
    const user = selectUser(global, userId);
    const userStatus = selectUserStatus(global, userId);
    const chat = selectChat(global, userId);
    const isSavedMessages = !forceShowSelf && user && user.isSelf;
    const { animationLevel } = global.settings.byKey;
    const { mediaId, avatarOwnerId } = global.mediaViewer;

    return {
      connectionState,
      user,
      userStatus,
      chat,
      isSavedMessages,
      animationLevel,
      serverTimeOffset,
      mediaId,
      avatarOwnerId,
    };
  },
)(ProfileInfo));
