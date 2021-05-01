import React, {
  FC, useEffect, useCallback, memo, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { ApiUser, ApiChat } from '../../api/types';
import { GlobalActions, GlobalState } from '../../global/types';
import { MediaViewerOrigin } from '../../types';

import { IS_TOUCH_ENV } from '../../util/environment';
import { selectChat, selectUser } from '../../modules/selectors';
import {
  getUserFullName, getUserStatus, isChatChannel, isUserOnline,
} from '../../modules/helpers';
import renderText from '../common/helpers/renderText';
import { pick } from '../../util/iteratees';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';
import usePhotosPreload from './hooks/usePhotosPreload';
import useLang from '../../hooks/useLang';

import VerifiedIcon from '../common/VerifiedIcon';
import ProfilePhoto from './ProfilePhoto';
import Transition from '../ui/Transition';

import './ProfileInfo.scss';

type OwnProps = {
  userId: number;
  forceShowSelf?: boolean;
};

type StateProps = {
  user?: ApiUser;
  chat?: ApiChat;
  isSavedMessages?: boolean;
  animationLevel: 0 | 1 | 2;
} & Pick<GlobalState, 'lastSyncTime'>;

type DispatchProps = Pick<GlobalActions, 'loadFullUser' | 'openMediaViewer'>;

const PrivateChatInfo: FC<OwnProps & StateProps & DispatchProps> = ({
  user,
  chat,
  isSavedMessages,
  lastSyncTime,
  animationLevel,
  loadFullUser,
  openMediaViewer,
}) => {
  const { id: userId } = user || {};
  const { id: chatId } = chat || {};
  const fullName = user ? getUserFullName(user) : (chat ? chat.title : '');
  const photos = (user ? user.photos : (chat ? chat.photos : undefined)) || [];
  const slideAnimation = animationLevel >= 1 ? 'slide' : 'none';

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const isFirst = isSavedMessages || photos.length <= 1 || currentPhotoIndex === 0;
  const isLast = isSavedMessages || photos.length <= 1 || currentPhotoIndex === photos.length - 1;

  // Deleting the last profile photo may result in an error
  useEffect(() => {
    if (currentPhotoIndex > photos.length) {
      setCurrentPhotoIndex(Math.max(0, photos.length - 1));
    }
  }, [currentPhotoIndex, photos.length]);

  const lang = useLang();

  useEffect(() => {
    if (lastSyncTime && userId) {
      loadFullUser({ userId });
    }
  }, [userId, loadFullUser, lastSyncTime]);

  usePhotosPreload(user || chat, photos, currentPhotoIndex);

  const handleProfilePhotoClick = useCallback(() => {
    openMediaViewer({
      avatarOwnerId: userId || chatId,
      profilePhotoIndex: currentPhotoIndex,
      origin: MediaViewerOrigin.ProfileAvatar,
    });
  }, [openMediaViewer, userId, chatId, currentPhotoIndex]);

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

  // Support for swipe gestures and closing on click
  useEffect(() => {
    const element = document.querySelector<HTMLDivElement>(
      '.profile-slide-container > .active, .profile-slide-container > .to',
    );
    if (!element) {
      return undefined;
    }

    return captureEvents(element, {
      excludedClosestSelector: '.navigation',
      onSwipe: IS_TOUCH_ENV ? (e, direction) => {
        if (direction === SwipeDirection.Right) {
          selectPreviousMedia();
        } else if (direction === SwipeDirection.Left) {
          selectNextMedia();
        }
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
        <div className={`status ${isUserOnline(user) ? 'online' : ''}`}>
          <span className="user-status">{getUserStatus(user, lang)}</span>
        </div>
      );
    }

    return (
      <span className="status">{
        isChatChannel(chat!)
          ? lang('Subscribers', chat!.membersCount, 'i')
          : lang('Members', chat!.membersCount, 'i')
      }
      </span>
    );
  }

  const isVerifiedIconShown = (user && user.isVerified) || (chat && chat.isVerified);

  return (
    <div className="ProfileInfo">
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

      <div className="info">
        {isSavedMessages ? (
          <div className="title">
            <h3>{lang('SavedMessages')}</h3>
          </div>
        ) : (
          <div className="title">
            <h3>{fullName && renderText(fullName)}</h3>
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
    const { lastSyncTime } = global;
    const user = selectUser(global, userId);
    const chat = selectChat(global, userId);
    const isSavedMessages = !forceShowSelf && user && user.isSelf;
    const {
      animationLevel,
    } = global.settings.byKey;

    return {
      lastSyncTime, user, chat, isSavedMessages, animationLevel,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['loadFullUser', 'openMediaViewer']),
)(PrivateChatInfo));
