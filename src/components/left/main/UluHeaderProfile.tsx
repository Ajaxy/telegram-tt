import type { MouseEvent as ReactMouseEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiPhoto, ApiUser } from '../../../api/types';

import { selectUser, selectUserFullInfo } from '../../../global/selectors';

import ProfilePhoto from '../../common/ProfilePhoto';

import styles from './UluHeaderProfile.module.scss';

type OwnProps = {
  onClick?: (e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => void;
};

type StateProps = {
  user?: ApiUser;
  userPersonalPhoto?: ApiPhoto;
  userProfilePhoto?: ApiPhoto;
  userFallbackPhoto?: ApiPhoto;
};

const getUserFullName = (user?: ApiUser) => {
  if (!user) {
    return '';
  }

  let userFullName = user.firstName || '';
  if (user.lastName) {
    userFullName += ` ${user.lastName}`;
  }

  return userFullName;
};

const UluHeaderProfile: FC<OwnProps & StateProps> = ({
  user, userFallbackPhoto, userPersonalPhoto, userProfilePhoto, onClick,
}) => {
  function renderPhoto() {
    const profilePhoto = userPersonalPhoto || userProfilePhoto || userFallbackPhoto;

    return (
      <ProfilePhoto
        user={user}
        photo={profilePhoto}
        canPlayVideo
      />
    );
  }

  return (
    <div className={styles.wrapper} onClick={onClick}>
      <div className={styles.photoWrapper}>
        {renderPhoto()}
      </div>
      <div className={styles.userName}>
        { getUserFullName(user) }
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global) => {
  const { currentUserId } = global;
  const user = selectUser(global, currentUserId!);
  const userFullInfo = selectUserFullInfo(global, currentUserId!);

  return {
    user,
    userPersonalPhoto: userFullInfo?.personalPhoto,
    userProfilePhoto: userFullInfo?.profilePhoto,
    userFallbackPhoto: userFullInfo?.fallbackPhoto,
  };
})(UluHeaderProfile));
