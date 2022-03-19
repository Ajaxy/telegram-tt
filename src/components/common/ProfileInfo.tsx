import React, {
  FC, useEffect, useCallback, memo, useState,
} from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../lib/teact/teactn';

import { ApiUser, ApiChat, ApiUserStatus } from '../../api/types';
import { GlobalState } from '../../global/types';
import { MediaViewerOrigin } from '../../types';

import { IS_TOUCH_ENV } from '../../util/environment';
import { selectChat, selectUser, selectUserStatus } from '../../modules/selectors';
import {
  getUserFullName, getUserStatus, isChatChannel, isUserOnline,
} from '../../modules/helpers';
import renderText from './helpers/renderText';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';
import buildClassName from '../../util/buildClassName';
import usePhotosPreload from './hooks/usePhotosPreload';
import useLang from '../../hooks/useLang';

import VerifiedIcon from './VerifiedIcon';
import ProfilePhoto from './ProfilePhoto';
import Transition from '../ui/Transition';

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
}) => {
  const {
    loadFullUser,
    openMediaViewer,
  } = getDispatch();

  const lang = useLang();

  const { id: userId } = user || {};
  const { id: chatId } = chat || {};
  const fullName = user ? getUserFullName(user) : (chat ? chat.title : '');
  const photos = user?.photos || chat?.photos || [];
  const slideAnimation = animationLevel >= 1
    ? (lang.isRtl ? 'slide-optimized-rtl' : 'slide-optimized')
    : 'none';

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const isFirst = isSavedMessages || photos.length <= 1 || currentPhotoIndex === 0;
  const isLast = isSavedMessages || photos.length <= 1 || currentPhotoIndex === photos.length - 1;

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
      profilePhotoIndex: currentPhotoIndex,
      origin: forceShowSelf ? MediaViewerOrigin.SettingsAvatar : MediaViewerOrigin.ProfileAvatar,
    });
  }, [openMediaViewer, userId, chatId, currentPhotoIndex, forceShowSelf]);

  const selectPreviousMedia = useCallback(() => {
    if (isFirst) {
      return;
    }

    setCurrentPhotoIndex(currentPhotoIndex - 1);
  }, [currentPhotoIndex, isFirst]);

  const selectNextMedia = useCallback(() => {
    if (isLast) {
      return;
    }

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

  function renderPhoto() {
    const photo = !isSavedMessages && photos && photos.length > 0 ? photos[currentPhotoIndex] : undefined;

    return (
      <ProfilePhoto
        key={currentPhotoIndex}
        user={user}
        chat={chat}
        photo={photo}
        isSavedMessages={isSavedMessages}
        isFirstPhoto={isFirst}
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

  return (
    <div className={buildClassName('ProfileInfo', forceShowSelf && 'self')} dir={lang.isRtl ? 'rtl' : undefined}>
      <div className="photo-wrapper">
        {renderPhotoTabs()}
        <Transition activeKey={currentPhotoIndex} name={slideAnimation} className="profile-slide-container">
          {renderPhoto()}
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
            <h3 dir="auto">{lang('SavedMessages')}</h3>
          </div>
        ) : (
          <div className="title">
            <h3 dir="auto">{fullName && renderText(fullName)}</h3>
            {isVerifiedIconShown && <VerifiedIcon />}
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

    return {
      connectionState,
      user,
      userStatus,
      chat,
      isSavedMessages,
      animationLevel,
      serverTimeOffset,
    };
  },
)(ProfileInfo));
