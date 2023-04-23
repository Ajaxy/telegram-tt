import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiPhoto, ApiUser } from '../../api/types';
import type { AnimationLevel } from '../../types';

import { selectUserPhotoFromFullInfo } from '../../global/selectors';

import Avatar from './Avatar';

type OwnProps = {
  user?: ApiUser;
  withVideo?: boolean;
  className?: string;
  size?: 'micro' | 'tiny' | 'small' | 'medium' | 'large';
};

interface StateProps {
  profilePhoto?: ApiPhoto;
  animationLevel?: AnimationLevel;
}

const UserAvatar: FC<OwnProps & StateProps> = ({
  user,
  profilePhoto,
  className,
  animationLevel,
  withVideo,
  size,
}) => {
  return (
    <Avatar
      user={user}
      className={className}
      userProfilePhoto={profilePhoto}
      animationLevel={animationLevel}
      withVideo={withVideo}
      size={size}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { user }): StateProps => {
    return {
      profilePhoto: user ? selectUserPhotoFromFullInfo(global, user.id) : undefined,
      animationLevel: global.settings.byKey.animationLevel,
    };
  },
)(UserAvatar));
